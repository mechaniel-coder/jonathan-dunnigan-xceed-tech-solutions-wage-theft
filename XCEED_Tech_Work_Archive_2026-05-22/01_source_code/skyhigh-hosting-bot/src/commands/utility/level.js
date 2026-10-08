const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { getUserLevel, calcLevel, xpForLevel, getLeaderboard } = require('../../utils/levelManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your level or someone else\'s')
    .addUserOption(o => o.setName('user').setDescription('User to check (defaults to you)')),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const data   = await getUserLevel(interaction.guild.id, target.id);
    const { level, currentXp, xpNeeded } = calcLevel(data.total_xp || 0);

    const bar = buildBar(currentXp, xpNeeded);

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(`📊 Level — ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Level',    value: `**${level}**`,                    inline: true },
        { name: 'Total XP', value: `**${data.total_xp || 0}** XP`,   inline: true },
        { name: 'Progress', value: `${bar}\n${currentXp} / ${xpNeeded} XP to level ${level + 1}`, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

function buildBar(current, needed, length = 12) {
  const filled = Math.round((current / needed) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}
