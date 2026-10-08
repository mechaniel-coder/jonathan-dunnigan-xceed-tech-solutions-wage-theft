const http  = require('http');
const https = require('https');
const { EmbedBuilder } = require('discord.js');
const db     = require('../database');
const config = require('../config');

function checkUrl(url) {
  return new Promise(resolve => {
    const start = Date.now();
    const mod   = url.startsWith('https') ? https : http;
    const req   = mod.get(url, { timeout: 8000 }, res => {
      const ping = Date.now() - start;
      resolve({ ok: res.statusCode < 500, ping });
    });
    req.on('error', () => resolve({ ok: false, ping: -1 }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, ping: -1 }); });
  });
}

async function checkMonitoredServers(client) {
  const rows = await db.query('SELECT * FROM monitored_servers');
  for (const row of rows) {
    const result = await checkUrl(row.url);
    const wasUp  = row.last_status === 1;
    const isUp   = result.ok;

    if (wasUp !== isUp) {
      await db.query(
        'UPDATE monitored_servers SET last_status = ? WHERE id = ?',
        [isUp ? 1 : 0, row.id]
      );

      if (!row.alert_channel_id) continue;
      const channel = client.channels.cache.get(row.alert_channel_id);
      if (!channel) continue;

      const embed = new EmbedBuilder()
        .setTitle(isUp ? '✅ Service Back Online' : '🔴 Service Down')
        .setDescription(`**${row.name}** is now **${isUp ? 'ONLINE ✅' : 'OFFLINE 🔴'}**.`)
        .addFields({ name: 'URL', value: row.url, inline: false })
        .setColor(isUp ? config.successColor : config.errorColor)
        .setFooter({ text: 'Skyhigh Hosting Monitor' })
        .setTimestamp();

      await channel.send({
        content: isUp ? null : '@here ⚠️ A service is down!',
        embeds:  [embed],
      }).catch(console.error);
    }
  }
}

module.exports = { checkMonitoredServers };
