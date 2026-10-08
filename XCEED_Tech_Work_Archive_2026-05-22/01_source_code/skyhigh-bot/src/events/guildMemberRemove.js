const { EmbedBuilder } = require('discord.js');
const db               = require('../database');
const config           = require('../config');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const { guild } = member;

    const rows = await db.query(
      'SELECT log_channel FROM guild_settings WHERE guild_id = ?',
      [guild.id]
    ).catch(() => []);

    const logChannelId = rows[0]?.log_channel;
    if (!logChannelId) return;

    const channel = guild.channels.cache.get(logChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('📤 Member Left')
      .setDescription(`${member.user.tag} has left the server.`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'User ID',   value: member.id,                                            inline: true },
        { name: 'Joined',    value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
        { name: 'Members',   value: `${guild.memberCount}`,                               inline: true }
      )
      .setColor(config.warnColor)
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(console.error);
  },
};
