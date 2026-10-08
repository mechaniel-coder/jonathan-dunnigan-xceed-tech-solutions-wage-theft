const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'emojiUpdate',
  async execute(oldEmoji, newEmoji) {
    if (oldEmoji.name === newEmoji.name) return;
    const embed = new EmbedBuilder()
      .setTitle('😀 Emoji Renamed')
      .setThumbnail(newEmoji.imageURL())
      .addFields(
        { name: 'Old Name', value: oldEmoji.name ?? '?', inline: true },
        { name: 'New Name', value: newEmoji.name ?? '?', inline: true },
        { name: 'ID',       value: newEmoji.id,          inline: true },
      )
      .setColor(config.warnColor)
      .setTimestamp();
    await auditLog(newEmoji.guild, embed);
  },
};
