const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Manage roles automatically assigned when a member joins')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a role to the auto-assign list')
      .addRoleOption(o => o.setName('role').setDescription('Role to auto-assign').setRequired(true)))

    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a role from the auto-assign list')
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))

    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all auto-assigned roles')),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const role = interaction.options.getRole('role');

      if (role.managed)
        return interaction.editReply('❌ Cannot auto-assign managed (bot) roles.');
      if (role.id === interaction.guild.roles.everyone.id)
        return interaction.editReply('❌ Cannot auto-assign @everyone.');

      await db.query(
        'INSERT IGNORE INTO autorole_config (guild_id, role_id) VALUES (?, ?)',
        [guildId, role.id]
      );
      return interaction.editReply(`✅ **${role.name}** will now be assigned to new members.`);
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role');
      await db.query(
        'DELETE FROM autorole_config WHERE guild_id = ? AND role_id = ?',
        [guildId, role.id]
      );
      return interaction.editReply(`✅ **${role.name}** removed from auto-role list.`);
    }

    if (sub === 'list') {
      const rows = await db.query(
        'SELECT role_id FROM autorole_config WHERE guild_id = ?',
        [guildId]
      );
      if (!rows.length) return interaction.editReply('📋 No auto-roles configured.');
      const list = rows.map(r => `<@&${r.role_id}>`).join(', ');
      const embed = new EmbedBuilder()
        .setTitle('🎭 Auto-Roles on Join')
        .setDescription(list)
        .setColor(config.color)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
