const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const express          = require('express');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents }   = require('./handlers/eventHandler');
const config           = require('./config');
const logger           = require('./utils/logger');
const { getPool }      = require('./database');

// ── Discord Client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

client.commands  = new Collection();
client.cooldowns = new Collection();

loadCommands(client);
loadEvents(client);

// ── Health / Ready HTTP Server ────────────────────────────────────────────────
const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), bot: client.isReady() });
});

app.get('/ready', (_req, res) => {
  if (!client.isReady()) return res.status(503).json({ status: 'not_ready' });
  res.json({ status: 'ready' });
});

app.get('/', (_req, res) => {
  res.json({ name: 'Skyhigh Hosting Bot', version: '1.0.0' });
});

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '3000');
app.listen(HEALTH_PORT, () => logger.info(`[Health] Listening on port ${HEALTH_PORT}`));

// ── Login ─────────────────────────────────────────────────────────────────────
client.login(config.token).catch(err => {
  logger.error(`[Login] Failed to log in: ${err.message}`);
  process.exit(1);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`[Shutdown] Received ${signal} — shutting down gracefully...`);
  try { client.destroy(); } catch (_) {}
  try { await getPool().end(); } catch (_) {}
  logger.info('[Shutdown] Done.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', err => logger.error(`[UnhandledRejection] ${err}`));
process.on('uncaughtException',  err => logger.error(`[UncaughtException] ${err}`));
