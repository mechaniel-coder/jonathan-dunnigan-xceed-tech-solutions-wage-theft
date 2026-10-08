const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { pay } = require('../../utils/economyManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Send coins to another member')
    .addUserOption(o => o.setName('user').setDescription('Who to pay').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount to send').setMinValue(1).setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot pay yourself.', ephemeral: true });
    }
    if (target.bot) {
      return interaction.reply({ content: 'You cannot pay a bot.', ephemeral: true });
    }

    const result = await pay(interaction.guild.id, interaction.user.id, target.id, amount);

    if (!result.success) {
      const embed = new EmbedBuilder()
        .setColor(config.errorColor)
        .setDescription('❌ Insufficient balance.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(config.successColor)
      .setDescription(`✅ You sent **${amount} 🪙** to ${target}.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
