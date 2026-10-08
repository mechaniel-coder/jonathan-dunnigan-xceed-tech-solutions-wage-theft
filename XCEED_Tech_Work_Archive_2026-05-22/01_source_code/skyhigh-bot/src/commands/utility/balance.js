const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { getBalance } = require('../../utils/economyManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your coin balance or another member\'s')
    .addUserOption(o => o.setName('user').setDescription('Member to check (defaults to you)')),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const eco    = await getBalance(interaction.guild.id, target.id);

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(`💰 Balance — ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Wallet', value: `**${eco.balance || 0}** 🪙`, inline: true },
        { name: 'Bank',   value: `**${eco.bank    || 0}** 🪙`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
