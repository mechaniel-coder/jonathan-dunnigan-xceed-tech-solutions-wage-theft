const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Clear all warnings for a member')
    .addUserOption(o => o.setName('user').setDescription('User to clear warnings for').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('user');

    const result = await db.query(
      'DELETE FROM warnings WHERE guild_id = ? AND user_id = ?',
      [interaction.guild.id, target.id]
    );

    const count = result.affectedRows ?? 0;
    await interaction.reply({
      content: count > 0
        ? `✅ Cleared **${count}** warning(s) for ${target.tag}.`
        : `ℹ️ ${target.tag} had no warnings to clear.`,
      ephemeral: true,
    });
  },
};
