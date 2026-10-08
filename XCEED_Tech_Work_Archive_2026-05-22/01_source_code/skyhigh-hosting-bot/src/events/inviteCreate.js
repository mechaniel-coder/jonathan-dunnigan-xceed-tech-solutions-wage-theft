const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'inviteCreate',
  async execute(invite) {
    if (!invite.guild) return;
    const embed = new EmbedBuilder()
      .setTitle('🔗 Invite Created')
      .addFields(
        { name: 'Code',       value: invite.code,                                                                         inline: true },
        { name: 'Created By', value: invite.inviter ? `${invite.inviter.tag} (${invite.inviter.id})` : 'Unknown',        inline: true },
        { name: 'Channel',    value: invite.channel  ? `${invite.channel}`                           : 'Unknown',        inline: true },
        { name: 'Max Uses',   value: invite.maxUses  ? `${invite.maxUses}`                           : 'Unlimited',      inline: true },
        { name: 'Expires',    value: invite.expiresAt
          ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>`
          : 'Never',                                                                                                       inline: true },
        { name: 'Temporary',  value: invite.temporary ? 'Yes (kick on disconnect)' : 'No',                               inline: true },
      )
      .setColor(config.successColor)
      .setTimestamp();
    await auditLog(invite.guild, embed);
  },
};
