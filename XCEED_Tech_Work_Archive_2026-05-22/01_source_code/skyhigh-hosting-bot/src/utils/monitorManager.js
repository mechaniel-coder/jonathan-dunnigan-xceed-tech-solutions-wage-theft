const http  = require('http');
const https = require('https');
const { EmbedBuilder } = require('discord.js');
const db     = require('../database');
const config = require('../config');
const logger = require('./logger');

// ── Stored state ──────────────────────────────────────────────────────────────
let _client = null;
let _timer  = null;

// ── Utility ───────────────────────────────────────────────────────────────────
function fmtBytes(bytes) {
  if (bytes >= 1e12) return (bytes / 1e12).toFixed(2) + ' TB';
  if (bytes >= 1e9)  return (bytes / 1e9).toFixed(2)  + ' GB';
  if (bytes >= 1e6)  return (bytes / 1e6).toFixed(1)  + ' MB';
  return bytes + ' B';
}

function bar(pct, len = 10) {
  const filled = Math.round(Math.min(pct, 100) / 100 * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

// ── Basic HTTP check ──────────────────────────────────────────────────────────
function httpCheck(url) {
  return new Promise(resolve => {
    const start = Date.now();
    const mod   = url.startsWith('https') ? https : http;
    const req   = mod.get(url, { timeout: 8000 }, res => {
      const ping = Date.now() - start;
      res.resume();
      resolve({ ok: res.statusCode < 500, ping, statusCode: res.statusCode });
    });
    req.on('error', () => resolve({ ok: false, ping: -1, statusCode: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, ping: -1, statusCode: 0 }); });
  });
}

// ── Health endpoint fetch ─────────────────────────────────────────────────────
function fetchHealth(healthUrl) {
  return new Promise(resolve => {
    const mod = healthUrl.startsWith('https') ? https : http;
    let data  = '';
    const req = mod.get(healthUrl, { timeout: 8000, headers: { Accept: 'application/json' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j && j.cpu && j.ram && Array.isArray(j.disks)) resolve(j);
          else resolve(null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function getHealthUrl(monitorUrl) {
  try {
    const u = new URL(monitorUrl);
    return `${u.protocol}//${u.host}/health`;
  } catch { return null; }
}

// ── Build Discord embed ───────────────────────────────────────────────────────
function buildEmbed(row, isUp, ping, health) {
  const embed = new EmbedBuilder()
    .setTitle(isUp ? '✅ Service Back Online' : '🔴 Service Down')
    .setColor(isUp ? config.successColor : config.errorColor)
    .setDescription(`**${row.name}** is now **${isUp ? 'ONLINE ✅' : 'OFFLINE 🔴'}**`)
    .addFields({ name: '🔗 URL', value: row.url })
    .setFooter({ text: 'Skyhigh Hosting Monitor' })
    .setTimestamp();

  if (ping > 0) embed.addFields({ name: '📶 Response Time', value: `${ping}ms`, inline: true });

  if (health && isUp) {
    const { cpu, ram, disks } = health;

    const cpuUsage = cpu.usage ?? 0;
    embed.addFields({
      name: '🖥️ CPU',
      value: [
        `**Model:** ${cpu.model || 'Unknown'}`,
        `**Cores:** ${cpu.physicalCores} physical / ${cpu.cores} logical`,
        `**Usage:** ${cpuUsage}%  \`${bar(cpuUsage)} ${cpuUsage}%\``,
      ].join('\n'),
    });

    const ramPct = Math.round((ram.used / ram.total) * 100);
    embed.addFields({
      name: '🧠 RAM',
      value: [
        `**Used:** ${fmtBytes(ram.used)} / ${fmtBytes(ram.total)}`,
        `**Free:** ${fmtBytes(ram.free)}`,
        `\`${bar(ramPct)} ${ramPct}%\``,
      ].join('\n'),
    });

    if (disks.length > 0) {
      const diskLines = disks.map(d => {
        const p = Math.round(d.usePercent ?? 0);
        return `**${d.mount}** (${d.type || 'unknown'})\n${fmtBytes(d.used)} / ${fmtBytes(d.total)}  \`${bar(p)} ${p}%\``;
      });

      let chunk = '';
      let first = true;
      for (const line of diskLines) {
        if (chunk.length + line.length + 2 > 1000) {
          embed.addFields({ name: first ? `💾 Disks (${disks.length} partitions)` : '💾 Disks (cont.)', value: chunk });
          chunk = line;
          first = false;
        } else {
          chunk = chunk ? chunk + '\n\n' + line : line;
        }
      }
      if (chunk) {
        embed.addFields({ name: first ? `💾 Disks (${disks.length} partition${disks.length !== 1 ? 's' : ''})` : '💾 Disks (cont.)', value: chunk });
      }
    }

    if (health.hostname) embed.addFields({ name: '🏠 Hostname', value: health.hostname, inline: true });
  }

  return embed;
}

// ── Main check loop ───────────────────────────────────────────────────────────
async function checkMonitoredServers(client) {
  const rows = await db.query('SELECT * FROM monitored_servers');
  for (const row of rows) {
    try {
      const basic  = await httpCheck(row.url);
      const isUp   = basic.ok;
      const hUrl   = getHealthUrl(row.url);
      const health = hUrl ? await fetchHealth(hUrl) : null;

      // First check — just record state, no alert
      if (row.last_status === null || row.last_status === 'unknown') {
        await db.query(
          'UPDATE monitored_servers SET last_status = ?, last_checked = NOW() WHERE id = ?',
          [isUp ? 'up' : 'down', row.id]
        );
        continue;
      }

      const wasUp = row.last_status === 'up' || Number(row.last_status) === 1;

      await db.query(
        'UPDATE monitored_servers SET last_status = ?, last_checked = NOW() WHERE id = ?',
        [isUp ? 'up' : 'down', row.id]
      );

      const stateLabel = isUp ? 'up' : 'down';
      logger.info(`[Monitor] ${row.name} → ${stateLabel}${basic.ping > 0 ? ` (${basic.ping}ms)` : ''} [was: ${row.last_status}]`);

      if (wasUp === isUp) continue;

      logger.info(`[Monitor] State change for ${row.name}: ${row.last_status} → ${stateLabel}`);

      if (!row.alert_channel_id) {
        logger.warn(`[Monitor] No alert channel set for ${row.name} — skipping Discord alert`);
        continue;
      }
      const channel = client.channels.cache.get(row.alert_channel_id);
      if (!channel) {
        logger.warn(`[Monitor] Channel ${row.alert_channel_id} not in cache for ${row.name}`);
        continue;
      }

      await channel.send({
        content: isUp ? '@here ✅ A service is back online!' : '@here ⚠️ A service is down!',
        embeds:  [buildEmbed(row, isUp, basic.ping, health)],
      }).catch(err => logger.error(`[Monitor] Send failed: ${err.message}`));

    } catch (err) {
      logger.error(`[Monitor] Check failed for ${row.name}: ${err.message}`);
    }
  }
}

// ── Dynamic scheduler ─────────────────────────────────────────────────────────
async function getIntervalMs() {
  try {
    const rows = await db.query("SELECT value FROM bot_settings WHERE `key` = 'monitor_interval'");
    const mins = rows.length ? parseInt(rows[0].value, 10) : 5;
    return (isNaN(mins) || mins < 1 ? 5 : mins) * 60_000;
  } catch { return 5 * 60_000; }
}

function stopMonitor() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

async function startMonitor(client) {
  _client = client;
  stopMonitor();
  const ms = await getIntervalMs();
  _timer = setInterval(() => {
    checkMonitoredServers(_client).catch(err => logger.error(`[Monitor] ${err.message}`));
  }, ms);
  logger.info(`[Monitor] Scheduler started — interval ${ms / 60_000} min(s)`);
  // Run immediately so the first check doesn't wait for the full interval
  setImmediate(() => {
    checkMonitoredServers(_client).catch(err => logger.error(`[Monitor] ${err.message}`));
  });
}

async function restartMonitor(minutes) {
  await db.query(
    "INSERT INTO bot_settings (`key`, value) VALUES ('monitor_interval', ?) ON DUPLICATE KEY UPDATE value = ?",
    [String(minutes), String(minutes)]
  );
  if (_client) await startMonitor(_client);
}

module.exports = { checkMonitoredServers, startMonitor, stopMonitor, restartMonitor };
