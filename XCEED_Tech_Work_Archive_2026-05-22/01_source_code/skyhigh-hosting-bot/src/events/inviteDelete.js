const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'inviteDelete',
  async execute(invite) {
    if (!invite.guild) return;
    const embed = new EmbedBuilder()
      .setTitle('🔗 Invite Deleted / Expired')
      .addFields(
        { name: 'Code',    value: invite.code,                                     inline: true },
        { name: 'Channel', value: invite.channel ? `${invite.channel}` : 'Unknown', inline: true },
        { name: 'Uses',    value: `${invite.uses ?? '?'}`,                          inline: true },
      )
      .setColor(config.errorColor)
      .setTimestamp();
    await auditLog(invite.guild, embed);
  },
};
