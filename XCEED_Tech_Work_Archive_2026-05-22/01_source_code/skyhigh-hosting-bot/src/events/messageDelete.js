const { EmbedBuilder } = require('discord.js');
const db               = require('../database');
const config           = require('../config');

module.exports = {
  name: 'messageDelete',
  async execute(message, client) {
    if (!message.guild || message.author?.bot) return;

    const rows = await db.query(
      'SELECT log_channel FROM guild_settings WHERE guild_id = ?',
      [message.guild.id]
    ).catch(() => []);

    const logChannelId = rows[0]?.log_channel;
    if (!logChannelId) return;

    const channel = message.guild.channels.cache.get(logChannelId);
    if (!channel || channel.id === message.channel.id) return;

    const content = message.content?.slice(0, 1024) || '*No text content*';

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Message Deleted')
      .addFields(
        { name: 'Author',  value: message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown', inline: true },
        { name: 'Channel', value: `${message.channel}`,                                                          inline: true },
        { name: 'Content', value: content }
      )
      .setColor(config.errorColor)
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(console.error);
  },
};
