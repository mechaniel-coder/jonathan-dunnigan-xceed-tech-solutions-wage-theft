const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelroles')
    .setDescription('Manage role rewards granted on level-up')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Award a role when a member reaches a level')
      .addIntegerOption(o => o.setName('level').setDescription('Level required').setMinValue(1).setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to award').setRequired(true)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a level role reward')
      .addIntegerOption(o => o.setName('level').setDescription('Level to remove').setMinValue(1).setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all level role rewards')),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const level  = interaction.options.getInteger('level');
      const role   = interaction.options.getRole('role');
      await db.query(
        'INSERT INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)',
        [guildId, level, role.id]
      );
      return interaction.reply({ embeds: [ok(`${role} will be awarded at **Level ${level}**`)] });
    }

    if (sub === 'remove') {
      const level = interaction.options.getInteger('level');
      const [res]  = await db.query(
        'DELETE FROM level_roles WHERE guild_id = ? AND level = ?',
        [guildId, level]
      );
      if (!res.affectedRows) return interaction.reply({ embeds: [err(`No role reward found for Level ${level}`)], ephemeral: true });
      return interaction.reply({ embeds: [ok(`Removed role reward for Level ${level}`)] });
    }

    if (sub === 'list') {
      const rows = await db.query(
        'SELECT level, role_id FROM level_roles WHERE guild_id = ? ORDER BY level ASC',
        [guildId]
      );
      if (!rows.length) return interaction.reply({ content: 'No level roles configured.', ephemeral: true });
      const lines = rows.map(r => `Level **${r.level}** → <@&${r.role_id}>`);
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle('🎭 Level Role Rewards')
        .setDescription(lines.join('\n'));
      return interaction.reply({ embeds: [embed] });
    }
  },
};

function ok(text)  { return new EmbedBuilder().setColor(config.successColor).setDescription(`✅ ${text}`); }
function err(text) { return new EmbedBuilder().setColor(config.errorColor).setDescription(`❌ ${text}`); }
