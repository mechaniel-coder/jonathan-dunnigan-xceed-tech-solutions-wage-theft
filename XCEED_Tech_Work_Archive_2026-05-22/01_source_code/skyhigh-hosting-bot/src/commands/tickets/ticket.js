const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system management')
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('Post the ticket panel in a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post the panel in').setRequired(false))
      .addStringOption(o => o.setName('description').setDescription('Custom panel description').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('category')
      .setDescription('Set the category where ticket channels are created')
      .addChannelOption(o => o.setName('category').setDescription('Category channel').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('close')
      .setDescription('Force close the current ticket (staff)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── Setup panel ──────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const target = interaction.options.getChannel('channel') ?? interaction.channel;
      const desc   = interaction.options.getString('description') ??
        'Need help? Click the button below to open a private support ticket.\nA staff member will assist you as soon as possible.';

      const embed = new EmbedBuilder()
        .setTitle('🎫 Skyhigh Hosting Support')
        .setDescription(desc)
        .setColor(config.color)
        .setFooter({ text: 'Skyhigh Hosting', iconURL: interaction.guild.iconURL() ?? undefined })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_open')
          .setLabel('Open a Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

      await target.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: `✅ Ticket panel posted in ${target}.`, flags: 64 });
    }

    // ── Set category ─────────────────────────────────────────────────────────
    if (sub === 'category') {
      const category = interaction.options.getChannel('category');
      if (category.type !== ChannelType.GuildCategory) {
        return interaction.reply({ content: '❌ Please select a **Category** channel.', flags: 64 });
      }
      await db.query(
        'INSERT INTO guild_settings (guild_id, ticket_category) VALUES (?, ?) ON DUPLICATE KEY UPDATE ticket_category = ?',
        [interaction.guild.id, category.id, category.id]
      );
      return interaction.reply({ content: `✅ Ticket category set to **${category.name}**.`, flags: 64 });
    }

    // ── Force close ──────────────────────────────────────────────────────────
    if (sub === 'close') {
      const { channel, guild, user } = interaction;
      const ticket = await db.query(
        'SELECT * FROM tickets WHERE channel_id = ? AND status = "open"',
        [channel.id]
      );
      if (!ticket.length) {
        return interaction.reply({ content: '❌ This is not an active ticket channel.', flags: 64 });
      }
      await db.query(
        'UPDATE tickets SET status = "closed", closed_at = NOW() WHERE channel_id = ?',
        [channel.id]
      );
      await interaction.reply({ content: `🔒 Ticket closed by ${user}. Channel deleting in 5 seconds...` });
      setTimeout(() => channel.delete(`Ticket force-closed by ${user.tag}`).catch(() => {}), 5000);
    }
  },
};
