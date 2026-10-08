const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const {
  getLevelingConfig, upsertLevelingConfig,
  setUserXp, getUserLevel, calcLevel, resetUserXp,
} = require('../../utils/levelManager');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Admin XP management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    // /xp give
    .addSubcommand(s => s
      .setName('give')
      .setDescription('Give XP to a user')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount of XP').setMinValue(1).setRequired(true)))
    // /xp take
    .addSubcommand(s => s
      .setName('take')
      .setDescription('Remove XP from a user')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount of XP').setMinValue(1).setRequired(true)))
    // /xp reset
    .addSubcommand(s => s
      .setName('reset')
      .setDescription('Reset a user\'s XP to zero')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true)))
    // /xp levelrole add
    .addSubcommand(s => s
      .setName('levelrole')
      .setDescription('Assign a role reward for reaching a level (use /levelroles to view)')),

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');

    if (sub === 'give') {
      const amount   = interaction.options.getInteger('amount');
      const userData = await getUserLevel(interaction.guild.id, target.id);
      const newTotal = (userData.total_xp || 0) + amount;
      const { level } = await setUserXp(interaction.guild.id, target.id, newTotal);
      await interaction.reply({ embeds: [ok(`Gave **${amount} XP** to ${target} — now Level **${level}** (${newTotal} XP total)`)] });
    }

    if (sub === 'take') {
      const amount   = interaction.options.getInteger('amount');
      const userData = await getUserLevel(interaction.guild.id, target.id);
      const newTotal = Math.max(0, (userData.total_xp || 0) - amount);
      const { level } = await setUserXp(interaction.guild.id, target.id, newTotal);
      await interaction.reply({ embeds: [ok(`Removed **${amount} XP** from ${target} — now Level **${level}** (${newTotal} XP total)`)] });
    }

    if (sub === 'reset') {
      await resetUserXp(interaction.guild.id, target.id);
      await interaction.reply({ embeds: [ok(`Reset ${target}'s XP and level to 0`)] });
    }

    if (sub === 'levelrole') {
      await interaction.reply({ content: 'Use `/levelroles add`, `/levelroles remove`, or `/levelroles list` to manage level roles.', ephemeral: true });
    }
  },
};

function ok(text) {
  return new EmbedBuilder().setColor(config.successColor).setDescription(`✅ ${text}`);
}
