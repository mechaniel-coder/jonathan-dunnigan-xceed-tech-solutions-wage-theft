const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { getLeaderboard, calcLevel } = require('../../utils/levelManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top 10 most active members by XP'),

  async execute(interaction) {
    await interaction.deferReply();

    const rows = await getLeaderboard(interaction.guild.id, 10);
    if (!rows.length) {
      return interaction.editReply('No leveling data yet — start chatting!');
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines  = rows.map((row, i) => {
      const { level } = calcLevel(row.total_xp);
      const prefix    = medals[i] || `**#${i + 1}**`;
      return `${prefix} <@${row.user_id}> — Level **${level}** · ${row.total_xp} XP`;
    });

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(`🏆 ${interaction.guild.name} — XP Leaderboard`)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
