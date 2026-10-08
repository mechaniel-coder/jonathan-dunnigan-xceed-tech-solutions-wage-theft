const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db     = require('../database');
const config = require('../config');

// ── Build the giveaway embed ─────────────────────────────────────────────────
function buildEmbed(prize, winnerCount, endTime, hostId, participants) {
  return new EmbedBuilder()
    .setTitle('🎉 G I V E A W A Y 🎉')
    .setDescription(
      `**Prize:** ${prize}\n\n` +
      `**Winners:** ${winnerCount}\n` +
      `**Ends:** <t:${Math.floor(endTime / 1000)}:R>  (<t:${Math.floor(endTime / 1000)}:F>)\n` +
      `**Hosted by:** <@${hostId}>\n` +
      `**Entries:** ${participants.length}`
    )
    .setColor(config.color)
    .setFooter({ text: 'Click the button below to enter!' })
    .setTimestamp(endTime);
}

// ── Start a new giveaway ─────────────────────────────────────────────────────
async function startGiveaway(channel, prize, winnerCount, durationMs, hostId) {
  const endTime = Date.now() + durationMs;

  // Send placeholder first so we get the message ID
  const msg = await channel.send({
    embeds: [buildEmbed(prize, winnerCount, endTime, hostId, [])],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway_enter_placeholder')
          .setLabel('Enter Giveaway 🎉')
          .setStyle(ButtonStyle.Primary)
      ),
    ],
  });

  // Re-edit with real message ID in customId
  await msg.edit({
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_enter_${msg.id}`)
          .setLabel('Enter Giveaway 🎉')
          .setStyle(ButtonStyle.Primary)
      ),
    ],
  });

  await db.query(
    'INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winner_count, end_time, host_id, participants) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [channel.guild.id, channel.id, msg.id, prize, winnerCount, endTime, hostId, JSON.stringify([])]
  );

  return msg;
}

// ── Enter a giveaway ─────────────────────────────────────────────────────────
async function enterGiveaway(interaction, client, messageId) {
  await interaction.deferReply({ ephemeral: true });
  const { guild, user } = interaction;

  const rows = await db.query(
    'SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?',
    [messageId, guild.id]
  );
  if (!rows.length) return interaction.editReply({ content: '❌ Giveaway not found.' });

  const giveaway = rows[0];
  if (giveaway.ended || Date.now() > Number(giveaway.end_time)) {
    return interaction.editReply({ content: '❌ This giveaway has already ended.' });
  }

  let participants = JSON.parse(giveaway.participants || '[]');
  if (participants.includes(user.id)) {
    return interaction.editReply({ content: '❌ You have already entered this giveaway!' });
  }

  participants.push(user.id);
  await db.query('UPDATE giveaways SET participants = ? WHERE id = ?', [JSON.stringify(participants), giveaway.id]);

  // Update embed entry count
  const ch = guild.channels.cache.get(giveaway.channel_id);
  if (ch) {
    const msg = await ch.messages.fetch(messageId).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [buildEmbed(giveaway.prize, giveaway.winner_count, Number(giveaway.end_time), giveaway.host_id, participants)] });
    }
  }

  await interaction.editReply({ content: '✅ You\'ve entered the giveaway! Good luck! 🎉' });
}

// ── End a giveaway and pick winners ─────────────────────────────────────────
async function endGiveaway(giveaway, client) {
  const guild = client.guilds.cache.get(giveaway.guild_id);
  if (!guild) return;

  const participants = JSON.parse(giveaway.participants || '[]');
  const shuffled     = [...participants].sort(() => Math.random() - 0.5);
  const winners      = shuffled.slice(0, Math.min(Number(giveaway.winner_count), shuffled.length));
  const winnerStr    = winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'No valid entries';

  const ch = guild.channels.cache.get(giveaway.channel_id);
  if (ch) {
    const msg = await ch.messages.fetch(giveaway.message_id).catch(() => null);
    if (msg) {
      const embed = new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY ENDED 🎉')
        .setDescription(
          `**Prize:** ${giveaway.prize}\n\n` +
          `**Winner(s):** ${winnerStr}\n` +
          `**Hosted by:** <@${giveaway.host_id}>\n` +
          `**Total Entries:** ${participants.length}`
        )
        .setColor(0xFFD700)
        .setTimestamp();
      await msg.edit({ embeds: [embed], components: [] });
    }

    const announcement = winners.length > 0
      ? `🎉 Congratulations ${winnerStr}! You won **${giveaway.prize}**!`
      : `😢 The giveaway for **${giveaway.prize}** ended with no valid entries.`;
    await ch.send(announcement).catch(() => {});
  }

  await db.query('UPDATE giveaways SET ended = 1 WHERE id = ?', [giveaway.id]);
}

// ── Called by cron every minute ──────────────────────────────────────────────
async function checkGiveaways(client) {
  const active = await db.query(
    'SELECT * FROM giveaways WHERE ended = 0 AND end_time <= ?',
    [Date.now()]
  );
  for (const g of active) {
    await endGiveaway(g, client).catch(console.error);
  }
}

module.exports = { startGiveaway, enterGiveaway, endGiveaway, checkGiveaways };
