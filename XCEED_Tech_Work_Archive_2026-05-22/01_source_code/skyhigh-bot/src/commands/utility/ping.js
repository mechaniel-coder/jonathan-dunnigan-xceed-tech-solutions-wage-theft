const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency'),

  async execute(interaction, client) {
    const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Roundtrip',    value: `${roundtrip}ms`,       inline: true },
        { name: 'API Latency',  value: `${client.ws.ping}ms`,  inline: true }
      )
      .setColor(config.color)
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};
