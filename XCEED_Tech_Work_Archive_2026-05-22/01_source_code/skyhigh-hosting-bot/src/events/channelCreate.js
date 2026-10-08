const { EmbedBuilder, ChannelType } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

const TYPE_NAME = {
  [ChannelType.GuildText]:         'Text Channel',
  [ChannelType.GuildVoice]:        'Voice Channel',
  [ChannelType.GuildCategory]:     'Category',
  [ChannelType.GuildAnnouncement]: 'Announcement Channel',
  [ChannelType.GuildForum]:        'Forum Channel',
  [ChannelType.GuildStageVoice]:   'Stage Channel',
  [ChannelType.PublicThread]:      'Public Thread',
  [ChannelType.PrivateThread]:     'Private Thread',
};

module.exports = {
  name: 'channelCreate',
  async execute(channel) {
    if (!channel.guild) return;
    const type = TYPE_NAME[channel.type] ?? `Unknown (${channel.type})`;
    const embed = new EmbedBuilder()
      .setTitle('📌 Channel Created')
      .addFields(
        { name: 'Name',     value: channel.name,                                              inline: true },
        { name: 'Type',     value: type,                                                      inline: true },
        { name: 'ID',       value: channel.id,                                                inline: true },
        { name: 'Category', value: channel.parent?.name ?? 'None',                           inline: true },
        { name: 'Mention',  value: channel.isTextBased() ? `${channel}` : `#${channel.name}`, inline: true },
      )
      .setColor(config.successColor)
      .setTimestamp();
    await auditLog(channel.guild, embed);
  },
};
