const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban) {
    const entry = await ban.guild
      .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove })
      .then(a => a.entries.first())
      .catch(() => null);

    const recent = entry && (Date.now() - entry.createdTimestamp) < 5000;
    const mod    = recent && entry.executor
      ? `${entry.executor.tag} (${entry.executor.id})`
      : 'Unknown';

    const embed = new EmbedBuilder()
      .setTitle('✅ Member Unbanned')
      .setThumbnail(ban.user.displayAvatarURL())
      .addFields(
        { name: 'User',      value: `${ban.user.tag} (${ban.user.id})`, inline: true },
        { name: 'Moderator', value: mod,                                  inline: true },
      )
      .setColor(config.successColor)
      .setTimestamp();
    await auditLog(ban.guild, embed);
  },
};
