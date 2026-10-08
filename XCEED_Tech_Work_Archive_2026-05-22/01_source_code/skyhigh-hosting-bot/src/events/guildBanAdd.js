const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    // Fetch audit log entry to get the moderator who issued the ban
    const entry = await ban.guild
      .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBan })
      .then(a => a.entries.first())
      .catch(() => null);

    const recent = entry && (Date.now() - entry.createdTimestamp) < 5000;
    const mod    = recent && entry.executor
      ? `${entry.executor.tag} (${entry.executor.id})`
      : 'Unknown';
    const reason = ban.reason ?? entry?.reason ?? 'No reason provided.';

    const embed = new EmbedBuilder()
      .setTitle('🔨 Member Banned')
      .setThumbnail(ban.user.displayAvatarURL())
      .addFields(
        { name: 'User',      value: `${ban.user.tag} (${ban.user.id})`, inline: true },
        { name: 'Moderator', value: mod,                                  inline: true },
        { name: 'Reason',    value: reason.slice(0, 1024) },
      )
      .setColor(config.errorColor)
      .setTimestamp();
    await auditLog(ban.guild, embed);
  },
};
