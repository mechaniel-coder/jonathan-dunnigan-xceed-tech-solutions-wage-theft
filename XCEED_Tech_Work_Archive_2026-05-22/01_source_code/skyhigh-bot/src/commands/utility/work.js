const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { doWork, formatTime } = require('../../utils/economyManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work to earn coins (1-hour cooldown)'),

  async execute(interaction) {
    const result = await doWork(interaction.guild.id, interaction.user.id);

    if (!result.success) {
      const embed = new EmbedBuilder()
        .setColor(config.warnColor)
        .setDescription(`⏳ You're still tired from your last shift. Come back in **${formatTime(result.remaining)}**.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(config.successColor)
      .setTitle('💼 Work Complete!')
      .setDescription(result.message)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
