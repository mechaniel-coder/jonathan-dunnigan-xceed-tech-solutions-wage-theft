const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('customcmd')
    .setDescription('Manage custom text/embed commands')
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a new custom command')
      .addStringOption(o => o.setName('name').setDescription('Command name (no spaces)').setRequired(true))
      .addStringOption(o => o.setName('response').setDescription('Response text').setRequired(true))
      .addBooleanOption(o => o.setName('embed').setDescription('Send as embed?').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a custom command')
      .addStringOption(o => o.setName('name').setDescription('Command name').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all custom commands')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const name     = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');
      const response = interaction.options.getString('response');
      const useEmbed = interaction.options.getBoolean('embed') ?? false;

      await db.query(
        'INSERT INTO custom_commands (guild_id, name, response, use_embed, created_by) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE response = ?, use_embed = ?',
        [interaction.guild.id, name, response, useEmbed ? 1 : 0, interaction.user.id, response, useEmbed ? 1 : 0]
      );
      return interaction.reply({ content: `✅ Custom command \`/${name}\` saved.`, flags: 64 });
    }

    if (sub === 'remove') {
      const name   = interaction.options.getString('name').toLowerCase();
      const result = await db.query(
        'DELETE FROM custom_commands WHERE guild_id = ? AND name = ?',
        [interaction.guild.id, name]
      );
      return interaction.reply({
        content: result.affectedRows > 0 ? `✅ Removed \`/${name}\`.` : `❌ Command \`/${name}\` not found.`,
        flags: 64,
      });
    }

    if (sub === 'list') {
      const cmds = await db.query(
        'SELECT name, use_embed FROM custom_commands WHERE guild_id = ? ORDER BY name',
        [interaction.guild.id]
      );
      if (!cmds.length) return interaction.reply({ content: 'ℹ️ No custom commands set up yet.', flags: 64 });

      const embed = new EmbedBuilder()
        .setTitle('📋 Custom Commands')
        .setDescription(cmds.map(c => `• \`/${c.name}\`${c.use_embed ? ' *(embed)*' : ''}`).join('\n'))
        .setColor(config.color);

      return interaction.reply({ embeds: [embed], flags: 64 });
    }
  },
};
