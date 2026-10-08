const db     = require('../database');
const logger = require('./logger');

// XP required to reach the NEXT level from level `n`
function xpForLevel(level) {
  return 5 * Math.pow(level, 2) + 50 * level + 50;
}

// Given total accumulated XP, return { level, currentXp, xpNeeded }
function calcLevel(totalXp) {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, currentXp: remaining, xpNeeded: xpForLevel(level) };
}

// ── Config helpers ─────────────────────────────────────────────────────────────

async function getLevelingConfig(guildId) {
  const [row] = await db.query(
    'SELECT * FROM leveling_config WHERE guild_id = ?',
    [guildId]
  );
  if (!row) return null;
  return row;
}

async function upsertLevelingConfig(guildId, fields) {
  const current = await getLevelingConfig(guildId);
  if (!current) {
    await db.query(
      `INSERT INTO leveling_config
         (guild_id, enabled, xp_min, xp_max, cooldown_seconds, level_up_channel_id, xp_multiplier)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        guildId,
        fields.enabled    ?? false,
        fields.xp_min     ?? 15,
        fields.xp_max     ?? 25,
        fields.cooldown_seconds ?? 20,
        fields.level_up_channel_id ?? null,
        fields.xp_multiplier ?? 1.0,
      ]
    );
  } else {
    const sets = Object.entries(fields).map(([k]) => `${k} = ?`).join(', ');
    await db.query(
      `UPDATE leveling_config SET ${sets} WHERE guild_id = ?`,
      [...Object.values(fields), guildId]
    );
  }
}

// ── User data ──────────────────────────────────────────────────────────────────

async function getUserLevel(guildId, userId) {
  const [row] = await db.query(
    'SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  );
  if (!row) return { total_xp: 0, level: 0, last_message_at: 0 };
  return row;
}

async function setUserXp(guildId, userId, totalXp) {
  const { level } = calcLevel(totalXp);
  await db.query(
    `INSERT INTO user_levels (guild_id, user_id, total_xp, level, last_message_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE total_xp = VALUES(total_xp), level = VALUES(level)`,
    [guildId, userId, totalXp, level, Date.now()]
  );
  return { totalXp, level };
}

async function resetUserXp(guildId, userId) {
  await db.query(
    `INSERT INTO user_levels (guild_id, user_id, total_xp, level, last_message_at)
     VALUES (?, ?, 0, 0, 0)
     ON DUPLICATE KEY UPDATE total_xp = 0, level = 0`,
    [guildId, userId]
  );
}

// ── XP gain on message ─────────────────────────────────────────────────────────

// cooldowns map: guildId:userId → timestamp of last XP grant
const _cooldowns = new Map();

async function processMessage(client, message) {
  try {
    const config = await getLevelingConfig(message.guild.id);
    if (!config || !config.enabled) return;

    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const last = _cooldowns.get(key) || 0;
    if (now - last < config.cooldown_seconds * 1000) return;
    _cooldowns.set(key, now);

    const xpGain = Math.floor(
      (Math.random() * (config.xp_max - config.xp_min + 1) + config.xp_min)
      * config.xp_multiplier
    );

    const userData  = await getUserLevel(message.guild.id, message.author.id);
    const oldLevel  = userData.level;
    const newTotalXp = (userData.total_xp || 0) + xpGain;
    const { level: newLevel } = calcLevel(newTotalXp);

    await db.query(
      `INSERT INTO user_levels (guild_id, user_id, total_xp, level, last_message_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE total_xp = VALUES(total_xp), level = VALUES(level), last_message_at = VALUES(last_message_at)`,
      [message.guild.id, message.author.id, newTotalXp, newLevel, now]
    );

    // Level-up announcement
    if (newLevel > oldLevel) {
      const channelId = config.level_up_channel_id || message.channel.id;
      const channel   = client.channels.cache.get(channelId) || message.channel;
      const { EmbedBuilder } = require('discord.js');
      const cfg = require('../config');

      const embed = new EmbedBuilder()
        .setColor(cfg.successColor)
        .setTitle('⬆️ Level Up!')
        .setDescription(`${message.author} reached **Level ${newLevel}**!`)
        .setThumbnail(message.author.displayAvatarURL())
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => {});

      // Check for level role rewards
      const roles = await db.query(
        'SELECT role_id FROM level_roles WHERE guild_id = ? AND level = ?',
        [message.guild.id, newLevel]
      );
      for (const r of roles) {
        const role = message.guild.roles.cache.get(r.role_id);
        if (role && message.member) {
          await message.member.roles.add(role).catch(() => {});
        }
      }
    }
  } catch (err) {
    logger.error(`[LevelManager] ${err.message}`);
  }
}

// ── Leaderboard ────────────────────────────────────────────────────────────────

async function getLeaderboard(guildId, limit = 10) {
  return db.query(
    'SELECT user_id, total_xp, level FROM user_levels WHERE guild_id = ? ORDER BY total_xp DESC LIMIT ?',
    [guildId, limit]
  );
}

module.exports = { xpForLevel, calcLevel, getLevelingConfig, upsertLevelingConfig, getUserLevel, setUserXp, resetUserXp, processMessage, getLeaderboard };
