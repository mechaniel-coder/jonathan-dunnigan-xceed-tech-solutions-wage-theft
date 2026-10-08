const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'threadCreate',
  async execute(thread, newlyCreated) {
    // Ignore the bot discovering existing threads on startup
    if (!newlyCreated) return;
    const embed = new EmbedBuilder()
      .setTitle('🧵 Thread Created')
      .addFields(
        { name: 'Name',    value: thread.name,                                         inline: true },
        { name: 'ID',      value: thread.id,                                           inline: true },
        { name: 'Channel', value: thread.parent ? `${thread.parent}` : 'Unknown',      inline: true },
        { name: 'Owner',   value: thread.ownerId ? `<@${thread.ownerId}>` : 'Unknown', inline: true },
      )
      .setColor(config.successColor)
      .setTimestamp();
    await auditLog(thread.guild, embed);
  },
};
