const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'threadDelete',
  async execute(thread) {
    const embed = new EmbedBuilder()
      .setTitle('🧵 Thread Deleted')
      .addFields(
        { name: 'Name',         value: thread.name,                                inline: true },
        { name: 'ID',           value: thread.id,                                  inline: true },
        { name: 'Parent Channel', value: thread.parent ? `${thread.parent}` : 'Unknown', inline: true },
      )
      .setColor(config.errorColor)
      .setTimestamp();
    await auditLog(thread.guild, embed);
  },
};
