require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const http             = require('http');
const os               = require('os');
const express          = require('express');
const si               = require('systeminformation');
const { Server: SocketIO } = require('socket.io');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents }   = require('./handlers/eventHandler');
const config           = require('./config');
const logger           = require('./utils/logger');
const { getPool, initDb } = require('./database');
const { mountDashboard } = require('./dashboard/index');
const reminderManager  = require('./utils/reminderManager');
const tempRoleManager  = require('./utils/tempRoleManager');
const { enforeLicense } = require('./utils/licenseCheck');

// ── License Check (must pass before anything else starts) ─────────────────────
enforeLicense(process.env.GUILD_ID);

// Decode application ID from bot token (base64url first segment)
function clientIdFromToken(token) {
  try {
    const part = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const padded = part + '='.repeat((4 - part.length % 4) % 4);
    return Buffer.from(padded, 'base64').toString('utf8').trim();
  } catch { return process.env.CLIENT_ID || ''; }
}

// ── Discord Client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,     // voiceStateUpdate
    GatewayIntentBits.GuildInvites,          // inviteCreate / inviteDelete
    GatewayIntentBits.GuildEmojisAndStickers, // emojiCreate / emojiDelete / emojiUpdate
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

client.commands  = new Collection();
client.cooldowns = new Collection();

loadCommands(client);
loadEvents(client);

// ── Express + HTTP Server + Socket.io ─────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new SocketIO(server);

app.locals.discordClient = client;

app.get('/health', async (_req, res) => {
  try {
    const [cpu, cpuLoad, mem, disks] = await Promise.all([
      si.cpu(), si.currentLoad(), si.mem(), si.fsSize(),
    ]);
    res.json({
      status:   'ok',
      hostname: os.hostname(),
      uptime:   os.uptime(),
      bot:      client.isReady(),
      cpu: {
        model:         `${cpu.manufacturer} ${cpu.brand}`.trim(),
        cores:         cpu.cores,
        physicalCores: cpu.physicalCores,
        usage:         Math.round(cpuLoad.currentLoad * 10) / 10,
      },
      ram: {
        total:       mem.total,
        used:        mem.active,
        free:        mem.available,
        usedPercent: Math.round((mem.active / mem.total) * 1000) / 10,
      },
      disks: disks
        .filter(d => d.size > 0)
        .map(d => ({
          mount:      d.mount,
          type:       d.type,
          total:      d.size,
          used:       d.used,
          free:       d.size - d.used,
          usePercent: Math.round(d.use * 10) / 10,
        })),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/ready', (_req, res) => {
  if (!client.isReady()) return res.status(503).json({ status: 'not_ready' });
  res.json({ status: 'ready' });
});

app.get('/', (_req, res) => {
  res.json({ name: 'Skyhigh Hosting Bot', version: '1.0.0' });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
const clientId = clientIdFromToken(config.token);
mountDashboard(app, io, clientId);
logger.info(`[Dashboard] Available at http://localhost:${process.env.HEALTH_PORT || 3002}/dashboard/`);

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '3000');
server.listen(HEALTH_PORT, () => logger.info(`[Health] Listening on port ${HEALTH_PORT}`));

// ── DB Init ───────────────────────────────────────────────────────────────────
initDb()
  .then(() => logger.info('[DB] Payment tables verified/created.'))
  .catch(err => logger.warn(`[DB] initDb warning: ${err.message}`));

// ── Login ─────────────────────────────────────────────────────────────────────
client.login(config.token).then(() => {
  // Start reminder scheduler after client is ready
  client.once('ready', () => {
    reminderManager.start(client);
    tempRoleManager.start(client);
  });
}).catch(err => {
  logger.error(`[Login] Failed to log in: ${err.message}`);
  process.exit(1);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`[Shutdown] Received ${signal} — shutting down gracefully...`);
  reminderManager.stop();
  tempRoleManager.stop();
  try { client.destroy(); } catch (_) {}
  try { await getPool().end(); } catch (_) {}
  logger.info('[Shutdown] Done.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', err => logger.error(`[UnhandledRejection] ${err}`));
process.on('uncaughtException',  err => logger.error(`[UncaughtException] ${err}`));
