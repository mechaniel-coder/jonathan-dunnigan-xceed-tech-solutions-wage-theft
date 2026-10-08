const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('faq')
    .setDescription('Manage and view frequently asked questions')
    .addSubcommand(s => s
      .setName('view')
      .setDescription('View a FAQ entry')
      .addIntegerOption(o => o.setName('id').setDescription('FAQ entry ID (leave blank for list)').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a new FAQ entry (staff only)')
      .addStringOption(o => o.setName('question').setDescription('The question').setRequired(true))
      .addStringOption(o => o.setName('answer').setDescription('The answer').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a FAQ entry (staff only)')
      .addIntegerOption(o => o.setName('id').setDescription('FAQ entry ID to remove').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const id = interaction.options.getInteger('id');
      if (id) {
        const rows = await db.query(
          'SELECT * FROM faq WHERE id = ? AND guild_id = ?',
          [id, interaction.guild.id]
        );
        if (!rows.length) return interaction.reply({ content: '❌ FAQ entry not found.', flags: 64 });
        const entry = rows[0];
        const embed = new EmbedBuilder()
          .setTitle(`❓ FAQ #${entry.id}`)
          .setDescription(`**Q:** ${entry.question}\n\n**A:** ${entry.answer}`)
          .setColor(config.color)
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      } else {
        const rows = await db.query(
          'SELECT id, question FROM faq WHERE guild_id = ? ORDER BY id',
          [interaction.guild.id]
        );
        if (!rows.length) return interaction.reply({ content: 'ℹ️ No FAQ entries yet.', flags: 64 });
        const embed = new EmbedBuilder()
          .setTitle('📋 Frequently Asked Questions')
          .setDescription(rows.map(r => `**#${r.id}** — ${r.question}`).join('\n'))
          .setColor(config.color)
          .setFooter({ text: 'Use /faq view <id> to see the full answer' });
        return interaction.reply({ embeds: [embed] });
      }
    }

    if (sub === 'add') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need **Manage Server** permission to add FAQ entries.', flags: 64 });
      }
      const question = interaction.options.getString('question');
      const answer   = interaction.options.getString('answer');
      await db.query(
        'INSERT INTO faq (guild_id, question, answer, created_by) VALUES (?, ?, ?, ?)',
        [interaction.guild.id, question, answer, interaction.user.id]
      );
      return interaction.reply({ content: '✅ FAQ entry added.', flags: 64 });
    }

    if (sub === 'remove') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need **Manage Server** permission to remove FAQ entries.', flags: 64 });
      }
      const id     = interaction.options.getInteger('id');
      const result = await db.query(
        'DELETE FROM faq WHERE id = ? AND guild_id = ?',
        [id, interaction.guild.id]
      );
      return interaction.reply({
        content: result.affectedRows > 0 ? `✅ FAQ #${id} removed.` : `❌ FAQ #${id} not found.`,
        flags: 64,
      });
    }
  },
};
