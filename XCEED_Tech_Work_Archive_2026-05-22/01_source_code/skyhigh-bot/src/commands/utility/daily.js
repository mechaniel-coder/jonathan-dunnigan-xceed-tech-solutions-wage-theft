const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { claimDaily, DAILY_AMOUNT, formatTime } = require('../../utils/economyManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription(`Claim your daily ${DAILY_AMOUNT} 🪙 coins (22-hour cooldown)`),

  async execute(interaction) {
    const result = await claimDaily(interaction.guild.id, interaction.user.id);

    if (!result.success) {
      const embed = new EmbedBuilder()
        .setColor(config.warnColor)
        .setDescription(`⏳ You already claimed your daily. Come back in **${formatTime(result.remaining)}**.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(config.successColor)
      .setTitle('💰 Daily Reward!')
      .setDescription(`You received **${DAILY_AMOUNT} 🪙 coins**! Come back in 22 hours.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
