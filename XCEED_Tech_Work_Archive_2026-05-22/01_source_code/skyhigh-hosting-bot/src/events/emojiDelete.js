const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'emojiDelete',
  async execute(emoji) {
    const embed = new EmbedBuilder()
      .setTitle('😀 Emoji Removed')
      .setThumbnail(emoji.imageURL())
      .addFields(
        { name: 'Name',     value: emoji.name ?? '?',             inline: true },
        { name: 'ID',       value: emoji.id,                       inline: true },
        { name: 'Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
      )
      .setColor(config.errorColor)
      .setTimestamp();
    await auditLog(emoji.guild, embed);
  },
};
