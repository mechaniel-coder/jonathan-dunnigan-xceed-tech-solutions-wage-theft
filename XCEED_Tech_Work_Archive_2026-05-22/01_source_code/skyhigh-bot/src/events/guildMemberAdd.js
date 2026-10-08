const { EmbedBuilder } = require('discord.js');
const db               = require('../database');
const config           = require('../config');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const { guild } = member;

    const rows = await db.query(
      'SELECT welcome_channel, welcome_message FROM guild_settings WHERE guild_id = ?',
      [guild.id]
    ).catch(() => []);

    const settings = rows[0];
    if (!settings?.welcome_channel) return;

    const channel = guild.channels.cache.get(settings.welcome_channel);
    if (!channel) return;

    const defaultMsg = `Welcome to **${guild.name}**, ${member}! 👋\n\nWe're glad to have you here. Be sure to check out our rules and enjoy your stay!`;
    const message    = settings.welcome_message
      ? settings.welcome_message
          .replace('{user}',        member.toString())
          .replace('{username}',    member.user.username)
          .replace('{server}',      guild.name)
          .replace('{membercount}', guild.memberCount.toString())
      : defaultMsg;

    const embed = new EmbedBuilder()
      .setTitle(`👋 Welcome to ${guild.name}!`)
      .setDescription(message)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setColor(config.color)
      .setFooter({ text: `Member #${guild.memberCount}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(console.error);
  },
};
