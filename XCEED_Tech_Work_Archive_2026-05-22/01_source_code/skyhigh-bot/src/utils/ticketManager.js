const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const db     = require('../database');
const config = require('../config');

// ── Open a new ticket ────────────────────────────────────────────────────────
async function ticketOpen(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  const { guild, user } = interaction;

  // Check for existing open ticket
  const existing = await db.query(
    'SELECT channel_id FROM tickets WHERE guild_id = ? AND user_id = ? AND status = "open"',
    [guild.id, user.id]
  );

  if (existing.length > 0) {
    const ch = guild.channels.cache.get(existing[0].channel_id);
    if (ch) {
      return interaction.editReply({ content: `❌ You already have an open ticket: ${ch}` });
    }
    // Channel was manually deleted — mark closed
    await db.query(
      'UPDATE tickets SET status = "closed", closed_at = NOW() WHERE guild_id = ? AND user_id = ? AND status = "open"',
      [guild.id, user.id]
    );
  }

  // Get guild settings
  const rows    = await db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [guild.id]);
  const settings = rows[0] || {};

  // Increment and fetch ticket number
  await db.query(
    'INSERT INTO guild_settings (guild_id, ticket_count) VALUES (?, 1) ON DUPLICATE KEY UPDATE ticket_count = ticket_count + 1',
    [guild.id]
  );
  const countRows   = await db.query('SELECT ticket_count FROM guild_settings WHERE guild_id = ?', [guild.id]);
  const ticketNum   = countRows[0]?.ticket_count ?? 1;
  const numPadded   = String(ticketNum).padStart(4, '0');
  const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}-${numPadded}`;

  // Build permission overwrites
  const permissionOverwrites = [
    { id: guild.id,  deny:  [PermissionFlagsBits.ViewChannel] },
    { id: user.id,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
  ];

  if (settings.staff_role) {
    permissionOverwrites.push({
      id: settings.staff_role,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  const channel = await guild.channels.create({
    name:               channelName,
    type:               ChannelType.GuildText,
    parent:             settings.ticket_category || null,
    permissionOverwrites,
    topic:              `Support ticket for ${user.tag} — #${numPadded}`,
  });

  await db.query(
    'INSERT INTO tickets (guild_id, user_id, channel_id, ticket_number, status) VALUES (?, ?, ?, ?, "open")',
    [guild.id, user.id, channel.id, ticketNum]
  );

  const embed = new EmbedBuilder()
    .setTitle(`🎫 Support Ticket #${numPadded}`)
    .setDescription(`Welcome ${user}!\n\nA staff member will be with you shortly. Please describe your issue in as much detail as possible.`)
    .addFields(
      { name: 'Ticket #', value: `#${numPadded}`,                                         inline: true },
      { name: 'Opened By', value: `${user}`,                                               inline: true },
      { name: 'Created',  value: `<t:${Math.floor(Date.now() / 1000)}:F>`,                 inline: false }
    )
    .setColor(config.color)
    .setFooter({ text: 'Skyhigh Hosting Support', iconURL: guild.iconURL() ?? undefined })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒')
  );

  await channel.send({ content: `${user}${settings.staff_role ? ` <@&${settings.staff_role}>` : ''}`, embeds: [embed], components: [row] });
  await interaction.editReply({ content: `✅ Your ticket has been created: ${channel}` });
}

// ── Initiate close (asks for confirmation) ───────────────────────────────────
async function ticketClose(interaction, client) {
  const { channel, guild } = interaction;

  const ticket = await db.query(
    'SELECT * FROM tickets WHERE channel_id = ? AND status = "open"',
    [channel.id]
  );

  if (!ticket.length) {
    return interaction.reply({ content: '❌ This channel is not an active ticket.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🔒 Close Ticket?')
    .setDescription(`Are you sure you want to close this ticket?\n\nRequested by: ${interaction.user}`)
    .setColor(config.warnColor);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_confirm_close_${channel.id}`)
      .setLabel('Yes, Close')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_close_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}

// ── Confirm close — delete the channel ──────────────────────────────────────
async function ticketConfirmClose(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  const { guild, channel, user } = interaction;

  await db.query(
    'UPDATE tickets SET status = "closed", closed_at = NOW() WHERE channel_id = ?',
    [channel.id]
  );

  // Log to log channel
  const rows = await db.query('SELECT log_channel FROM guild_settings WHERE guild_id = ?', [guild.id]);
  const logChannelId = rows[0]?.log_channel;
  if (logChannelId) {
    const logCh = guild.channels.cache.get(logChannelId);
    if (logCh) {
      const embed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .addFields(
          { name: 'Channel',   value: channel.name,                                         inline: true },
          { name: 'Closed By', value: `${user}`,                                            inline: true },
          { name: 'Time',      value: `<t:${Math.floor(Date.now() / 1000)}:F>`,             inline: false }
        )
        .setColor(config.errorColor)
        .setTimestamp();
      logCh.send({ embeds: [embed] }).catch(() => {});
    }
  }

  await interaction.editReply({ content: '✅ Ticket closing in 5 seconds...' });
  setTimeout(() => channel.delete(`Ticket closed by ${user.tag}`).catch(() => {}), 5000);
}

module.exports = { ticketOpen, ticketClose, ticketConfirmClose };
