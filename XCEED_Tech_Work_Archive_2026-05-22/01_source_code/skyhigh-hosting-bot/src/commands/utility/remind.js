const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

// Duration parsing: 10m, 2h, 1d, 30s
const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

function parseDuration(str) {
  const m = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!m) return null;
  return parseInt(m[1]) * UNITS[m[2].toLowerCase()];
}

function humanizeDuration(ms) {
  if (ms < 60_000)      return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000)   return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000)  return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set, list, or delete reminders')

    .addSubcommand(s => s
      .setName('me')
      .setDescription('Set a reminder')
      .addStringOption(o => o.setName('time').setDescription('When (e.g. 10m, 2h, 1d)').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('What to remind you of').setRequired(true)))

    .addSubcommand(s => s
      .setName('list')
      .setDescription('Show your active reminders'))

    .addSubcommand(s => s
      .setName('cancel')
      .setDescription('Cancel a reminder by ID')
      .addIntegerOption(o => o.setName('id').setDescription('Reminder ID (from /remind list)').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'me') {
      const timeStr  = interaction.options.getString('time');
      const message  = interaction.options.getString('message');
      const durationMs = parseDuration(timeStr);

      if (!durationMs)
        return interaction.reply({ content: '❌ Invalid time format. Use `10m`, `2h`, `1d`, etc.', flags: 64 });
      if (durationMs > 30 * 86_400_000)
        return interaction.reply({ content: '❌ Max reminder time is 30 days.', flags: 64 });

      const remindAt = Date.now() + durationMs;

      await db.query(
        'INSERT INTO reminders (guild_id, user_id, channel_id, message, remind_at) VALUES (?, ?, ?, ?, ?)',
        [interaction.guild.id, interaction.user.id, interaction.channel.id, message, remindAt]
      );

      const embed = new EmbedBuilder()
        .setTitle('⏰ Reminder Set')
        .addFields(
          { name: 'Message', value: message },
          { name: 'Time',    value: `<t:${Math.floor(remindAt / 1000)}:R>`, inline: true },
          { name: 'Channel', value: `${interaction.channel}`,               inline: true }
        )
        .setColor(config.color)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (sub === 'list') {
      const rows = await db.query(
        'SELECT id, message, remind_at FROM reminders WHERE guild_id = ? AND user_id = ? ORDER BY remind_at ASC',
        [interaction.guild.id, interaction.user.id]
      );
      if (!rows.length)
        return interaction.reply({ content: '📋 You have no active reminders.', flags: 64 });

      const lines = rows.map(r =>
        `**ID ${r.id}** — <t:${Math.floor(r.remind_at / 1000)}:R> — ${r.message.slice(0, 80)}`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('⏰ Your Reminders')
        .setDescription(lines)
        .setColor(config.color)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (sub === 'cancel') {
      const id = interaction.options.getInteger('id');
      const [row] = await db.query(
        'SELECT id FROM reminders WHERE id = ? AND guild_id = ? AND user_id = ?',
        [id, interaction.guild.id, interaction.user.id]
      );
      if (!row)
        return interaction.reply({ content: '❌ Reminder not found or does not belong to you.', flags: 64 });

      await db.query('DELETE FROM reminders WHERE id = ?', [id]);
      return interaction.reply({ content: `✅ Reminder **#${id}** cancelled.`, flags: 64 });
    }
  },
};
