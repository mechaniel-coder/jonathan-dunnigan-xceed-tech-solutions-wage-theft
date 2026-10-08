const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'messageDeleteBulk',
  async execute(messages, channel) {
    const guild = channel.guild;
    if (!guild) return;
    const embed = new EmbedBuilder()
      .setTitle('🗑️ Bulk Messages Deleted')
      .setDescription(`A bulk delete (purge) was performed in ${channel}.`)
      .addFields(
        { name: 'Channel',         value: `${channel} (${channel.id})`,   inline: true },
        { name: 'Messages Deleted', value: `${messages.size}`,            inline: true },
      )
      .setColor(config.errorColor)
      .setTimestamp();
    await auditLog(guild, embed);
  },
};
