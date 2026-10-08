const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    const changes = [];

    // Channel join / leave / move
    if (!oldState.channelId && newState.channelId)
      changes.push({ name: 'Action', value: `🔊 Joined **${newState.channel?.name ?? '?'}**` });
    else if (oldState.channelId && !newState.channelId)
      changes.push({ name: 'Action', value: `🔇 Left **${oldState.channel?.name ?? '?'}**` });
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId)
      changes.push({ name: 'Action', value: `🔀 Moved: **${oldState.channel?.name ?? '?'}** → **${newState.channel?.name ?? '?'}**` });

    // Server mute / unmute
    if (oldState.serverMute !== newState.serverMute)
      changes.push({ name: 'Server Mute',   value: newState.serverMute   ? '🔇 Muted by server'      : '🔊 Unmuted by server' });

    // Server deafen / undeafen
    if (oldState.serverDeaf !== newState.serverDeaf)
      changes.push({ name: 'Server Deafen', value: newState.serverDeaf   ? '🔕 Deafened by server'   : '🔔 Undeafened by server' });

    // Screen share
    if (oldState.streaming !== newState.streaming)
      changes.push({ name: 'Screen Share',  value: newState.streaming    ? '🖥️ Started sharing screen' : '🖥️ Stopped sharing screen' });

    // Camera
    if (oldState.selfVideo !== newState.selfVideo)
      changes.push({ name: 'Camera',        value: newState.selfVideo    ? '📷 Camera on'             : '📷 Camera off' });

    if (!changes.length) return;

    const embed = new EmbedBuilder()
      .setTitle('🎙️ Voice State Update')
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: 'Member', value: `${member.user.tag} (${member.id})` },
        ...changes.map(c => ({ name: c.name, value: c.value, inline: false })),
      )
      .setColor(config.color)
      .setTimestamp();
    await auditLog(newState.guild, embed);
  },
};
