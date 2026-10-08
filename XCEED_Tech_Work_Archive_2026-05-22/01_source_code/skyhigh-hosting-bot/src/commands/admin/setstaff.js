const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setstaff')
    .setDescription('Set the staff role (used for tickets, permissions)')
    .addRoleOption(o => o.setName('role').setDescription('Staff role').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const role = interaction.options.getRole('role');

    await db.query(
      'INSERT INTO guild_settings (guild_id, staff_role) VALUES (?, ?) ON DUPLICATE KEY UPDATE staff_role = ?',
      [interaction.guild.id, role.id, role.id]
    );

    await interaction.reply({ content: `✅ Staff role set to ${role}.`, flags: 64 });
  },
};
