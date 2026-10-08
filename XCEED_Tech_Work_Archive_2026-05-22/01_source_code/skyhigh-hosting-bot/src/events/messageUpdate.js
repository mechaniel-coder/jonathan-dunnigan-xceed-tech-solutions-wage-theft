const { EmbedBuilder } = require('discord.js');
const db               = require('../database');
const config           = require('../config');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, client) {
    if (!newMessage.guild || !newMessage.author || newMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const rows = await db.query(
      'SELECT log_channel FROM guild_settings WHERE guild_id = ?',
      [newMessage.guild.id]
    ).catch(() => []);

    const logChannelId = rows[0]?.log_channel;
    if (!logChannelId) return;

    const channel = newMessage.guild.channels.cache.get(logChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('✏️ Message Edited')
      .setURL(newMessage.url)
      .addFields(
        { name: 'Author',  value: `${newMessage.author?.tag ?? 'Unknown'} (${newMessage.author?.id ?? '?'})`, inline: true },
        { name: 'Channel', value: `${newMessage.channel}`,                               inline: true },
        { name: 'Before',  value: (oldMessage.content?.slice(0, 512)) || '*Unknown*' },
        { name: 'After',   value: newMessage.content?.slice(0, 512)   || '*Empty*' }
      )
      .setColor(config.warnColor)
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(console.error);
  },
};
