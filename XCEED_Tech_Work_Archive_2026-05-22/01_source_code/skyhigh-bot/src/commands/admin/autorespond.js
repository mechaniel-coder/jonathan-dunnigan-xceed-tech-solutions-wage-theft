const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorespond')
    .setDescription('Manage keyword auto-responders')
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a keyword trigger')
      .addStringOption(o => o.setName('trigger').setDescription('Keyword or phrase (case-insensitive)').setRequired(true))
      .addStringOption(o => o.setName('response').setDescription('Message to reply with').setRequired(true))
      .addBooleanOption(o => o.setName('embed').setDescription('Send response as an embed? (default: false)'))
    )
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove an auto-responder')
      .addStringOption(o => o.setName('trigger').setDescription('Trigger to remove').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all auto-responders')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const trigger  = interaction.options.getString('trigger').toLowerCase();
      const response = interaction.options.getString('response');
      const useEmbed = interaction.options.getBoolean('embed') ?? false;

      await db.query(
        `INSERT INTO auto_responders (guild_id, trigger_text, response, use_embed, created_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE response = VALUES(response), use_embed = VALUES(use_embed)`,
        [guildId, trigger, response, useEmbed ? 1 : 0, interaction.user.id]
      );
      await interaction.reply({ content: `✅ Auto-responder added for keyword: \`${trigger}\``, ephemeral: true });
    }

    if (sub === 'remove') {
      const trigger = interaction.options.getString('trigger').toLowerCase();
      const result  = await db.query(
        'DELETE FROM auto_responders WHERE guild_id = ? AND trigger_text = ?',
        [guildId, trigger]
      );
      if (result.affectedRows === 0) {
        return interaction.reply({ content: `❌ No auto-responder found for \`${trigger}\`.`, ephemeral: true });
      }
      await interaction.reply({ content: `✅ Auto-responder removed.`, ephemeral: true });
    }

    if (sub === 'list') {
      const rows = await db.query('SELECT * FROM auto_responders WHERE guild_id = ?', [guildId]);
      if (!rows.length) {
        return interaction.reply({ content: '📭 No auto-responders set up yet. Use `/autorespond add` to create one.', ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setTitle('🤖 Auto-Responders')
        .setColor(config.color)
        .setDescription(
          rows.map(r =>
            `**Trigger:** \`${r.trigger_text}\`\n**Response:** ${r.response.length > 80 ? r.response.slice(0, 80) + '…' : r.response}`
          ).join('\n\n')
        )
        .setFooter({ text: `${rows.length} trigger(s) active` });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
