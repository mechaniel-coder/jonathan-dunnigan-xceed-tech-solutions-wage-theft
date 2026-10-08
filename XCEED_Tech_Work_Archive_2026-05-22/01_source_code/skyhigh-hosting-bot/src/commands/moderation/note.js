const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Manage private staff notes on users')
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a note to a user')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
      .addStringOption(o => o.setName('note').setDescription('Note content').setRequired(true).setMaxLength(1000))
    )
    .addSubcommand(s => s
      .setName('view')
      .setDescription('View all notes on a user')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a note by its ID')
      .addIntegerOption(o => o.setName('id').setDescription('Note ID (shown in /note view)').setRequired(true).setMinValue(1))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const target = interaction.options.getUser('user');
      const note   = interaction.options.getString('note');

      const result = await db.query(
        'INSERT INTO staff_notes (guild_id, target_user_id, author_id, note) VALUES (?, ?, ?, ?)',
        [guildId, target.id, interaction.user.id, note]
      );

      await interaction.reply({
        content: `✅ Note **#${result.insertId}** added for **${target.tag}**.`,
        flags: 64,
      });
    }

    if (sub === 'view') {
      const target = interaction.options.getUser('user');
      const notes  = await db.query(
        'SELECT * FROM staff_notes WHERE guild_id = ? AND target_user_id = ? ORDER BY created_at DESC LIMIT 10',
        [guildId, target.id]
      );

      if (!notes.length) {
        return interaction.reply({ content: `📭 No notes found for **${target.tag}**.`, flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📝 Staff Notes — ${target.tag}`)
        .setThumbnail(target.displayAvatarURL())
        .setColor(config.warnColor)
        .setDescription(
          notes.map(n =>
            `**#${n.id}** — <t:${Math.floor(new Date(n.created_at).getTime() / 1000)}:R> by <@${n.author_id}>\n${n.note}`
          ).join('\n\n')
        )
        .setFooter({ text: `Showing ${notes.length} most recent note(s)` });

      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (sub === 'remove') {
      const id     = interaction.options.getInteger('id');
      const result = await db.query(
        'DELETE FROM staff_notes WHERE id = ? AND guild_id = ?',
        [id, guildId]
      );

      if (result.affectedRows === 0) {
        return interaction.reply({ content: `❌ Note **#${id}** not found.`, flags: 64 });
      }
      await interaction.reply({ content: `✅ Note **#${id}** removed.`, flags: 64 });
    }
  },
};
