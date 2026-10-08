const db = require('../database');

/**
 * Send an embed to the guild's configured log channel.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').EmbedBuilder} embed
 */
async function auditLog(guild, embed) {
  const [s] = await db.query(
    'SELECT log_channel FROM guild_settings WHERE guild_id = ?',
    [guild.id]
  ).catch(() => []);
  if (!s?.log_channel) return;
  const ch = guild.channels.cache.get(s.log_channel);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { auditLog };
