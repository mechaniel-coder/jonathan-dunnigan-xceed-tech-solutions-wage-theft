const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Send a custom embed to a channel')
    .addStringOption(o => o.setName('description').setDescription('Body text of the embed').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Title').setRequired(false))
    .addStringOption(o => o.setName('color').setDescription('Hex color code e.g. #00AAFF').setRequired(false))
    .addStringOption(o => o.setName('image').setDescription('Image URL').setRequired(false))
    .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const description = interaction.options.getString('description').replace(/\\n/g, '\n');
    const title       = interaction.options.getString('title');
    const colorStr    = interaction.options.getString('color');
    const imageUrl    = interaction.options.getString('image');
    const target      = interaction.options.getChannel('channel') ?? interaction.channel;

    let color = config.color;
    if (colorStr) {
      const parsed = parseInt(colorStr.replace('#', ''), 16);
      if (!isNaN(parsed)) color = parsed;
    }

    const embed = new EmbedBuilder()
      .setDescription(description)
      .setColor(color)
      .setTimestamp();

    if (title)    embed.setTitle(title);
    if (imageUrl) embed.setImage(imageUrl);

    await target.send({ embeds: [embed] });
    await interaction.editReply({ content: `✅ Embed sent to ${target}.` });
  },
};
