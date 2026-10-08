'use strict';
/**
 * automodManager.js
 * Handles all auto-moderation checks for messageCreate.
 * Called from the messageCreate event.
 */

const db = require('../database');

// Per-guild spam tracking: Map<guildId, Map<userId, number[]>> (timestamps)
const spamTracker = new Map();

/**
 * Main entry point. Returns true if the message was actioned (deleted/timeout/etc.)
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>}
 */
async function checkMessage(message) {
  const { guild, member, author, content, channel } = message;
  if (!guild || !member || author.bot) return false;

  const [cfg] = await db.query(
    'SELECT * FROM automod_config WHERE guild_id = ?',
    [guild.id]
  ).catch(() => []);

  if (!cfg?.enabled) return false;

  // Gather bad words for this guild (cached lazily each check, fine for small guilds)
  let badWords = [];
  if (cfg.badwords_enabled) {
    const rows = await db.query(
      'SELECT word FROM automod_badwords WHERE guild_id = ?',
      [guild.id]
    ).catch(() => []);
    badWords = rows.map(r => r.word.toLowerCase());
  }

  let violation = null;

  // ── Spam check ────────────────────────────────────────────────────────────
  if (cfg.spam_enabled && !violation) {
    if (!spamTracker.has(guild.id)) spamTracker.set(guild.id, new Map());
    const guildMap = spamTracker.get(guild.id);
    const now = Date.now();
    const window = cfg.spam_window_ms || 5000;
    const threshold = cfg.spam_threshold || 5;

    const timestamps = (guildMap.get(author.id) || []).filter(t => now - t < window);
    timestamps.push(now);
    guildMap.set(author.id, timestamps);

    if (timestamps.length >= threshold) {
      violation = 'spam';
      guildMap.set(author.id, []);
    }
  }

  // ── Caps check ────────────────────────────────────────────────────────────
  if (cfg.caps_enabled && !violation) {
    const minLen  = cfg.caps_min_length || 10;
    const pct     = cfg.caps_percent || 70;
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= minLen) {
      const uppers = letters.replace(/[^A-Z]/g, '').length;
      if ((uppers / letters.length) * 100 >= pct) violation = 'excessive caps';
    }
  }

  // ── Bad words check ───────────────────────────────────────────────────────
  if (cfg.badwords_enabled && !violation && badWords.length) {
    const lower = content.toLowerCase();
    if (badWords.some(w => lower.includes(w))) violation = 'banned word';
  }

  // ── Link / invite filter ──────────────────────────────────────────────────
  const linkRe   = /https?:\/\/\S+/i;
  const inviteRe = /discord(?:\.gg|(?:app)?\.com\/invite)\/\S+/i;

  if (cfg.links_enabled && !violation && linkRe.test(content))
    violation = 'link';

  if (cfg.invites_enabled && !violation && inviteRe.test(content))
    violation = 'server invite';

  // ── Mass mentions ─────────────────────────────────────────────────────────
  if (cfg.mentions_enabled && !violation) {
    const limit = cfg.mentions_limit || 5;
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    if (mentionCount >= limit) violation = 'mass mention';
  }

  if (!violation) return false;

  // ── Take action ───────────────────────────────────────────────────────────
  await message.delete().catch(() => {});

  const action = cfg.action || 'delete';
  const reason = `[AutoMod] ${violation}`;

  try {
    if (action === 'warn') {
      await db.query(
        'INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)',
        [guild.id, author.id, guild.members.me?.id ?? '0', reason]
      );
    } else if (action === 'timeout') {
      const dur = cfg.timeout_duration || 300000;
      if (member.moderatable) await member.timeout(dur, reason);
    } else if (action === 'kick') {
      if (member.kickable) await member.kick(reason);
    } else if (action === 'ban') {
      if (member.bannable) await member.ban({ reason });
    }
  } catch (_) {}

  // Notify the user (ephemeral-style DM)
  await author
    .send(`🚨 Your message in **${guild.name}** was removed: **${violation}**.`)
    .catch(() => {});

  // ── Log to automod log channel ────────────────────────────────────────────
  if (cfg.log_channel) {
    const logCh = guild.channels.cache.get(cfg.log_channel);
    if (logCh) {
      const { EmbedBuilder } = require('discord.js');
      const { color, errorColor } = require('../config');
      const embed = new EmbedBuilder()
        .setTitle('🛡️ AutoMod Action')
        .addFields(
          { name: 'User',      value: `${author.tag} (${author.id})`, inline: true },
          { name: 'Channel',   value: `${channel}`,                    inline: true },
          { name: 'Violation', value: violation,                       inline: true },
          { name: 'Action',    value: action,                          inline: true },
          { name: 'Message',   value: content.slice(0, 1000) || '(empty)' }
        )
        .setColor(errorColor || '#e74c3c')
        .setTimestamp();
      logCh.send({ embeds: [embed] }).catch(() => {});
    }
  }

  return true;
}

module.exports = { checkMessage };
