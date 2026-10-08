const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement embed to a channel')
    .addStringOption(o => o.setName('message').setDescription('Announcement text (use \\n for new lines)').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Target channel (defaults to current)').setRequired(false))
    .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(false))
    .addStringOption(o => o.setName('ping').setDescription('Role to ping (role ID or "everyone" or "here")').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const message = interaction.options.getString('message').replace(/\\n/g, '\n');
    const title   = interaction.options.getString('title') || '📢 Announcement';
    const target  = interaction.options.getChannel('channel') ?? interaction.channel;
    const pingStr = interaction.options.getString('ping');

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(message)
      .setColor(config.color)
      .setFooter({ text: `Posted by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    let pingContent = '';
    if (pingStr) {
      if (pingStr === 'everyone') pingContent = '@everyone';
      else if (pingStr === 'here') pingContent = '@here';
      else pingContent = `<@&${pingStr}>`;
    }

    await target.send({ content: pingContent || null, embeds: [embed] });
    await interaction.editReply({ content: `✅ Announcement sent to ${target}.` });
  },
};
