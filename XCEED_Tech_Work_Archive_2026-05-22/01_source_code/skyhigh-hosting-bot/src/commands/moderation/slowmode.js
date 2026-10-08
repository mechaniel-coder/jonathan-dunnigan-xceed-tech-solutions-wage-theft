const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode on a channel')
    .addIntegerOption(o =>
      o.setName('seconds')
        .setDescription('Slowmode in seconds (0 = off, max 21600)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to set slowmode on (defaults to current)'))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const reason  = interaction.options.getString('reason') || 'No reason provided';

    if (![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(seconds) && seconds > 21600)
      return interaction.reply({ content: '❌ Seconds must be 0–21600.', flags: 64 });

    await channel.setRateLimitPerUser(seconds, `${interaction.user.tag}: ${reason}`).catch(err =>
      interaction.reply({ content: `❌ ${err.message}`, flags: 64 })
    );

    const embed = new EmbedBuilder()
      .setTitle('⏱️ Slowmode Updated')
      .addFields(
        { name: 'Channel',  value: `${channel}`,                          inline: true },
        { name: 'Slowmode', value: seconds === 0 ? 'Off' : `${seconds}s`, inline: true },
        { name: 'By',       value: interaction.user.tag,                  inline: true }
      )
      .setColor(config.color)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
