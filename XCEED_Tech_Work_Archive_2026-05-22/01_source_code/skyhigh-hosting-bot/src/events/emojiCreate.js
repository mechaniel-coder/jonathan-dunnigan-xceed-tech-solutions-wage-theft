const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'emojiCreate',
  async execute(emoji) {
    const embed = new EmbedBuilder()
      .setTitle('😀 Emoji Added')
      .setThumbnail(emoji.imageURL())
      .addFields(
        { name: 'Name',     value: emoji.name ?? '?',             inline: true },
        { name: 'ID',       value: emoji.id,                       inline: true },
        { name: 'Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
        { name: 'Usage',    value: `<:${emoji.name}:${emoji.id}>`, inline: true },
      )
      .setColor(config.successColor)
      .setTimestamp();
    await auditLog(emoji.guild, embed);
  },
};
