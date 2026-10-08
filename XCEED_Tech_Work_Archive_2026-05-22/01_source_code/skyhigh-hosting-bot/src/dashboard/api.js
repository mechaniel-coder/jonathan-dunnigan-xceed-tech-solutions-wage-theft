const express = require('express');
const router  = express.Router();
const { query } = require('../database');
const { getConfig, setConfig, getAllMasked, PLAIN_KEYS } = require('../payments/paymentConfig');
const { restartMonitor } = require('../utils/monitorManager');

const guildId = () => process.env.GUILD_ID;

// ── Auth guard ────────────────────────────────────────────────────────────────
router.use((req, res, next) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const client = req.app.locals.discordClient;
    const [[ul], [eu], [tc], [wc], [gc]] = await Promise.all([
      query('SELECT COUNT(*) AS c FROM user_levels  WHERE guild_id = ?', [guildId()]),
      query('SELECT COUNT(*) AS c FROM economy      WHERE guild_id = ?', [guildId()]),
      query('SELECT COUNT(*) AS c FROM tickets      WHERE guild_id = ? AND status = "open"', [guildId()]),
      query('SELECT COUNT(*) AS c FROM warnings     WHERE guild_id = ?', [guildId()]),
      query('SELECT COUNT(*) AS c FROM giveaways    WHERE guild_id = ? AND ended = 0', [guildId()]),
    ]);
    res.json({
      bot: {
        tag:      client.user?.tag,
        avatar:   client.user?.displayAvatarURL({ size: 128 }),
        uptime:   process.uptime(),
        ready:    client.isReady(),
        guilds:   client.guilds.cache.size,
        commands: client.commands.size,
      },
      stats: {
        trackedUsers:    ul.c,
        economyUsers:    eu.c,
        openTickets:     tc.c,
        warnings:        wc.c,
        activeGiveaways: gc.c,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Economy ───────────────────────────────────────────────────────────────────
router.get('/economy', async (req, res) => {
  try {
    const rows = await query(
      'SELECT user_id, balance, bank, last_daily, last_work FROM economy WHERE guild_id = ? ORDER BY (balance+bank) DESC LIMIT 50',
      [guildId()]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/economy/:userId', async (req, res) => {
  try {
    const { balance, bank } = req.body;
    if (typeof balance !== 'number' || typeof bank !== 'number') {
      return res.status(400).json({ error: 'balance and bank must be numbers' });
    }
    await query(
      'UPDATE economy SET balance = ?, bank = ? WHERE guild_id = ? AND user_id = ?',
      [balance, bank, guildId(), req.params.userId]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Shop ──────────────────────────────────────────────────────────────────────
router.get('/shop', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM shop_items WHERE guild_id = ? ORDER BY price', [guildId()]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/shop', async (req, res) => {
  try {
    const { name, price, description, role_id } = req.body;
    if (!name || typeof price !== 'number') return res.status(400).json({ error: 'name and price required' });
    await query(
      'INSERT INTO shop_items (guild_id, name, price, description, role_id) VALUES (?, ?, ?, ?, ?)',
      [guildId(), name.slice(0, 50), price, description || null, role_id || null]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/shop/:id', async (req, res) => {
  try {
    await query('DELETE FROM shop_items WHERE id = ? AND guild_id = ?', [req.params.id, guildId()]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Levels ────────────────────────────────────────────────────────────────────
router.get('/levels', async (req, res) => {
  try {
    const [users, config, roles] = await Promise.all([
      query('SELECT user_id, total_xp, level FROM user_levels WHERE guild_id = ? ORDER BY total_xp DESC LIMIT 50', [guildId()]),
      query('SELECT * FROM leveling_config WHERE guild_id = ?', [guildId()]),
      query('SELECT level, role_id FROM level_roles WHERE guild_id = ? ORDER BY level', [guildId()]),
    ]);
    res.json({ users, config: config[0] || {}, roles });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/levels/:userId', async (req, res) => {
  try {
    const { total_xp, level } = req.body;
    if (typeof total_xp !== 'number' || typeof level !== 'number') {
      return res.status(400).json({ error: 'total_xp and level must be numbers' });
    }
    await query(
      'UPDATE user_levels SET total_xp = ?, level = ? WHERE guild_id = ? AND user_id = ?',
      [total_xp, level, guildId(), req.params.userId]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Guild Settings ────────────────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const [row] = await query('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId()]);
    res.json(row || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/settings', async (req, res) => {
  try {
    const {
      log_channel, welcome_channel, welcome_message, ticket_category, staff_role,
      suggestions_channel, reviews_channel, verified_role, rules_accept_role,
    } = req.body;
    await query(
      `INSERT INTO guild_settings
         (guild_id, log_channel, welcome_channel, welcome_message, ticket_category, staff_role,
          suggestions_channel, reviews_channel, verified_role, rules_accept_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         log_channel         = VALUES(log_channel),
         welcome_channel     = VALUES(welcome_channel),
         welcome_message     = VALUES(welcome_message),
         ticket_category     = VALUES(ticket_category),
         staff_role          = VALUES(staff_role),
         suggestions_channel = VALUES(suggestions_channel),
         reviews_channel     = VALUES(reviews_channel),
         verified_role       = VALUES(verified_role),
         rules_accept_role   = VALUES(rules_accept_role)`,
      [guildId(),
       log_channel || null, welcome_channel || null, welcome_message || null,
       ticket_category || null, staff_role || null,
       suggestions_channel || null, reviews_channel || null, verified_role || null,
       rules_accept_role || null]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Giveaways ─────────────────────────────────────────────────────────────────
router.get('/giveaways', async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, prize, winner_count, end_time, ended, host_id, created_at,
              JSON_LENGTH(participants) AS entry_count
       FROM giveaways WHERE guild_id = ? ORDER BY ended ASC, end_time DESC LIMIT 25`,
      [guildId()]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Tickets ───────────────────────────────────────────────────────────────────
router.get('/tickets', async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, user_id, channel_id, ticket_number, status, created_at, closed_at FROM tickets WHERE guild_id = ? ORDER BY created_at DESC LIMIT 50',
      [guildId()]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Moderation ────────────────────────────────────────────────────────────────
router.get('/moderation', async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, user_id, moderator_id, reason, created_at FROM warnings WHERE guild_id = ? ORDER BY created_at DESC LIMIT 100',
      [guildId()]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/moderation/:id', async (req, res) => {
  try {
    await query('DELETE FROM warnings WHERE id = ? AND guild_id = ?', [req.params.id, guildId()]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Guild Info (channels + roles from Discord cache) ─────────────────────────
router.get('/guild', (req, res) => {
  try {
    const client = req.app.locals.discordClient;
    const guild  = client.guilds.cache.get(guildId());
    if (!guild) return res.status(404).json({ error: 'Guild not in cache' });
    const { ChannelType } = require('discord.js');
    const channels = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
      .sort((a, b) => (a.parent?.position ?? -1) - (b.parent?.position ?? -1) || a.position - b.position)
      .map(c => ({ id: c.id, name: c.name, parent: c.parent?.name ?? null }));
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id && !r.managed)
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name }));
    res.json({ channels, roles });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Leveling Config (full) ────────────────────────────────────────────────────
router.get('/leveling', async (req, res) => {
  try {
    const [cfg] = await query('SELECT * FROM leveling_config WHERE guild_id = ?', [guildId()]);
    res.json(cfg || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/leveling', async (req, res) => {
  try {
    const { enabled, xp_min, xp_max, cooldown_seconds, xp_multiplier, level_up_channel_id } = req.body;
    await query(
      `INSERT INTO leveling_config (guild_id, enabled, xp_min, xp_max, cooldown_seconds, xp_multiplier, level_up_channel_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         enabled = VALUES(enabled), xp_min = VALUES(xp_min), xp_max = VALUES(xp_max),
         cooldown_seconds = VALUES(cooldown_seconds), xp_multiplier = VALUES(xp_multiplier),
         level_up_channel_id = VALUES(level_up_channel_id)`,
      [guildId(), enabled ? 1 : 0, xp_min ?? 15, xp_max ?? 25, cooldown_seconds ?? 20, xp_multiplier ?? 1.0, level_up_channel_id || null]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Level Roles ───────────────────────────────────────────────────────────────
router.post('/levelroles', async (req, res) => {
  try {
    const { level, role_id } = req.body;
    if (!level || !role_id) return res.status(400).json({ error: 'level and role_id required' });
    await query(
      'INSERT INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)',
      [guildId(), level, role_id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/levelroles/:level', async (req, res) => {
  try {
    await query('DELETE FROM level_roles WHERE guild_id = ? AND level = ?', [guildId(), req.params.level]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Auto-Responders ───────────────────────────────────────────────────────────
router.get('/autoresponders', async (req, res) => {
  try {
    const rows = await query('SELECT id, trigger_text, response, use_embed FROM auto_responders WHERE guild_id = ? ORDER BY trigger_text', [guildId()]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/autoresponders', async (req, res) => {
  try {
    const { trigger, response, use_embed } = req.body;
    if (!trigger || !response) return res.status(400).json({ error: 'trigger and response required' });
    await query(
      `INSERT INTO auto_responders (guild_id, trigger_text, response, use_embed, created_by)
       VALUES (?, ?, ?, ?, 'dashboard')
       ON DUPLICATE KEY UPDATE response = VALUES(response), use_embed = VALUES(use_embed)`,
      [guildId(), trigger.toLowerCase().slice(0, 100), response.slice(0, 2000), use_embed ? 1 : 0]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/autoresponders/:id', async (req, res) => {
  try {
    await query('DELETE FROM auto_responders WHERE id = ? AND guild_id = ?', [req.params.id, guildId()]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Custom Commands ───────────────────────────────────────────────────────────
router.get('/customcmds', async (req, res) => {
  try {
    const rows = await query('SELECT id, name, response, use_embed FROM custom_commands WHERE guild_id = ? ORDER BY name', [guildId()]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/customcmds', async (req, res) => {
  try {
    const { name, response, use_embed } = req.body;
    if (!name || !response) return res.status(400).json({ error: 'name and response required' });
    const safeName = name.toLowerCase().replace(/\s+/g, '-').slice(0, 32);
    await query(
      `INSERT INTO custom_commands (guild_id, name, response, use_embed, created_by)
       VALUES (?, ?, ?, ?, 'dashboard')
       ON DUPLICATE KEY UPDATE response = VALUES(response), use_embed = VALUES(use_embed)`,
      [guildId(), safeName, response.slice(0, 2000), use_embed ? 1 : 0]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/customcmds/:id', async (req, res) => {
  try {
    await query('DELETE FROM custom_commands WHERE id = ? AND guild_id = ?', [req.params.id, guildId()]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Uptime Monitors ───────────────────────────────────────────────────────────
router.get('/monitors', async (req, res) => {
  try {
    const rows = await query('SELECT id, name, url, alert_channel_id, last_status, last_checked FROM monitored_servers WHERE guild_id = ? ORDER BY name', [guildId()]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/monitors', async (req, res) => {
  try {
    const { name, url, alert_channel_id } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'name and url required' });
    if (!/^https?:\/\/.+/.test(url)) return res.status(400).json({ error: 'URL must start with http:// or https://' });
    await query(
      `INSERT INTO monitored_servers (guild_id, name, url, alert_channel_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE url = VALUES(url), alert_channel_id = VALUES(alert_channel_id)`,
      [guildId(), name.slice(0, 100), url, alert_channel_id || null]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/monitors/:id', async (req, res) => {
  try {
    const { name, url, alert_channel_id } = req.body;
    const fields = [];
    const vals   = [];
    if (name) { fields.push('name = ?'); vals.push(name.slice(0, 100)); }
    if (url !== undefined) {
      if (!/^https?:\/\/.+/.test(url)) return res.status(400).json({ error: 'URL must start with http:// or https://' });
      fields.push('url = ?'); vals.push(url);
    }
    if (alert_channel_id !== undefined) { fields.push('alert_channel_id = ?'); vals.push(alert_channel_id || null); }
    if (!fields.length) return res.status(400).json({ error: 'nothing to update' });
    vals.push(req.params.id, guildId());
    await query(`UPDATE monitored_servers SET ${fields.join(', ')} WHERE id = ? AND guild_id = ?`, vals);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/monitors/:id', async (req, res) => {
  try {
    await query('DELETE FROM monitored_servers WHERE id = ? AND guild_id = ?', [req.params.id, guildId()]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/monitor-settings — returns current check interval
router.get('/monitor-settings', async (req, res) => {
  try {
    const rows = await query("SELECT value FROM bot_settings WHERE `key` = 'monitor_interval'");
    res.json({ interval: rows.length ? parseInt(rows[0].value, 10) : 5 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/monitor-settings — update interval and restart scheduler
router.put('/monitor-settings', async (req, res) => {
  try {
    const mins = parseInt(req.body.interval, 10);
    if (isNaN(mins) || mins < 1 || mins > 1440) {
      return res.status(400).json({ error: 'interval must be between 1 and 1440 minutes' });
    }
    await restartMonitor(mins);
    res.json({ ok: true, interval: mins });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Restart ───────────────────────────────────────────────────────────────────
router.post('/restart', (req, res) => {
  res.json({ ok: true, message: 'Bot is restarting...' });
  setTimeout(() => process.exit(0), 500);
});

// ── Auto-mod ─────────────────────────────────────────────────────────────────
router.get('/automod', async (req, res) => {
  try {
    await query('INSERT IGNORE INTO automod_config (guild_id) VALUES (?)', [guildId()]);
    const [cfg]   = await query('SELECT * FROM automod_config WHERE guild_id = ?', [guildId()]);
    const badwords = await query('SELECT id, word FROM automod_badwords WHERE guild_id = ?', [guildId()]);
    res.json({ cfg, badwords });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/automod', async (req, res) => {
  try {
    const {
      enabled, spam_enabled, spam_threshold, spam_window_ms,
      caps_enabled, caps_percent, caps_min_length,
      links_enabled, invites_enabled, badwords_enabled,
      mentions_enabled, mentions_limit, action, timeout_duration, log_channel,
    } = req.body;
    await query(
      `INSERT INTO automod_config
         (guild_id, enabled, spam_enabled, spam_threshold, spam_window_ms,
          caps_enabled, caps_percent, caps_min_length,
          links_enabled, invites_enabled, badwords_enabled,
          mentions_enabled, mentions_limit, action, timeout_duration, log_channel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         enabled = VALUES(enabled), spam_enabled = VALUES(spam_enabled),
         spam_threshold = VALUES(spam_threshold), spam_window_ms = VALUES(spam_window_ms),
         caps_enabled = VALUES(caps_enabled), caps_percent = VALUES(caps_percent),
         caps_min_length = VALUES(caps_min_length), links_enabled = VALUES(links_enabled),
         invites_enabled = VALUES(invites_enabled), badwords_enabled = VALUES(badwords_enabled),
         mentions_enabled = VALUES(mentions_enabled), mentions_limit = VALUES(mentions_limit),
         action = VALUES(action), timeout_duration = VALUES(timeout_duration),
         log_channel = VALUES(log_channel)`,
      [guildId(), enabled ? 1 : 0, spam_enabled ? 1 : 0, spam_threshold ?? 5, spam_window_ms ?? 5000,
       caps_enabled ? 1 : 0, caps_percent ?? 70, caps_min_length ?? 10,
       links_enabled ? 1 : 0, invites_enabled ? 1 : 0, badwords_enabled ? 1 : 0,
       mentions_enabled ? 1 : 0, mentions_limit ?? 5, action || 'delete', timeout_duration ?? 300000,
       log_channel || null]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/automod/badwords', async (req, res) => {
  try {
    const { word } = req.body;
    if (!word) return res.status(400).json({ error: 'word required' });
    await query('INSERT IGNORE INTO automod_badwords (guild_id, word) VALUES (?, ?)', [guildId(), word.toLowerCase().trim()]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/automod/badwords/:id', async (req, res) => {
  try {
    await query('DELETE FROM automod_badwords WHERE id = ? AND guild_id = ?', [req.params.id, guildId()]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Auto-role ─────────────────────────────────────────────────────────────────
router.get('/autoroles', async (req, res) => {
  try {
    const rows = await query('SELECT role_id FROM autorole_config WHERE guild_id = ?', [guildId()]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/autoroles', async (req, res) => {
  try {
    const { role_id } = req.body;
    if (!role_id) return res.status(400).json({ error: 'role_id required' });
    await query('INSERT IGNORE INTO autorole_config (guild_id, role_id) VALUES (?, ?)', [guildId(), role_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/autoroles/:role_id', async (req, res) => {
  try {
    await query('DELETE FROM autorole_config WHERE guild_id = ? AND role_id = ?', [guildId(), req.params.role_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Reminders ─────────────────────────────────────────────────────────────────
router.get('/reminders', async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, user_id, channel_id, message, remind_at, created_at FROM reminders WHERE guild_id = ? ORDER BY remind_at ASC',
      [guildId()]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/reminders/:id', async (req, res) => {
  try {
    await query('DELETE FROM reminders WHERE id = ? AND guild_id = ?', [req.params.id, guildId()]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Onboarding ────────────────────────────────────────────────────────────────
router.get('/onboarding', async (req, res) => {
  try {
    await query(`INSERT IGNORE INTO onboarding_config (guild_id, enabled, dm_on_join, steps) VALUES (?, 0, 1, '[]')`, [guildId()]);
    const [cfg] = await query('SELECT * FROM onboarding_config WHERE guild_id = ?', [guildId()]);
    res.json(cfg);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/onboarding', async (req, res) => {
  try {
    const { enabled, dm_on_join, steps } = req.body;
    if (!Array.isArray(steps)) return res.status(400).json({ error: 'steps must be an array' });
    await query(
      `INSERT INTO onboarding_config (guild_id, enabled, dm_on_join, steps)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), dm_on_join = VALUES(dm_on_join), steps = VALUES(steps)`,
      [guildId(), enabled ? 1 : 0, dm_on_join ? 1 : 0, JSON.stringify(steps)]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Role Panels ───────────────────────────────────────────────────────────────
router.get('/rolepanels', async (req, res) => {
  try {
    const panels = await query('SELECT * FROM role_panels WHERE guild_id = ? ORDER BY id ASC', [guildId()]);
    for (const p of panels) {
      p.buttons = await query('SELECT * FROM role_panel_buttons WHERE panel_id = ?', [p.id]);
    }
    res.json(panels);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/rolepanels/:id', async (req, res) => {
  try {
    await query('DELETE FROM role_panels WHERE id = ? AND guild_id = ?', [req.params.id, guildId()]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/rolepanels/:id/buttons', async (req, res) => {
  try {
    const { role_id, label, emoji, style, exclusive_group } = req.body;
    await query(
      'INSERT INTO role_panel_buttons (panel_id, role_id, label, emoji, style, exclusive_group) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, role_id, label, emoji || null, style || 'Primary', exclusive_group || null]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/rolepanels/:panelId/buttons/:buttonId', async (req, res) => {
  try {
    await query('DELETE FROM role_panel_buttons WHERE id = ? AND panel_id = ?', [req.params.buttonId, req.params.panelId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Temp Roles ────────────────────────────────────────────────────────────────
router.get('/temproles', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM temp_roles WHERE guild_id = ? ORDER BY expires_at ASC', [guildId()]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/temproles/:id', async (req, res) => {
  try {
    await query('DELETE FROM temp_roles WHERE id = ? AND guild_id = ?', [req.params.id, guildId()]);

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Coin Packages (admin CRUD) ────────────────────────────────────────────────
router.get('/coin-packages', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM coin_packages ORDER BY price_cents ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/coin-packages', async (req, res) => {
  try {
    const { name, coins, price_cents, active } = req.body;
    if (!name || typeof coins !== 'number' || typeof price_cents !== 'number') {
      return res.status(400).json({ error: 'name, coins (number), and price_cents (number) required' });
    }
    await query(
      'INSERT INTO coin_packages (name, coins, price_cents, active) VALUES (?, ?, ?, ?)',
      [name.slice(0, 100), coins, price_cents, active !== false ? 1 : 0]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/coin-packages/:id', async (req, res) => {
  try {
    const { name, coins, price_cents, active } = req.body;
    const fields = [];
    const vals   = [];
    if (name        !== undefined) { fields.push('name = ?');        vals.push(name.slice(0, 100)); }
    if (coins       !== undefined) { fields.push('coins = ?');       vals.push(coins); }
    if (price_cents !== undefined) { fields.push('price_cents = ?'); vals.push(price_cents); }
    if (active      !== undefined) { fields.push('active = ?');      vals.push(active ? 1 : 0); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.params.id);
    await query(`UPDATE coin_packages SET ${fields.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/coin-packages/:id', async (req, res) => {
  try {
    await query('DELETE FROM coin_packages WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Payment Transactions (read-only in admin panel) ───────────────────────────
router.get('/payment-transactions', async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT 100'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Linked Accounts (skyhigh_bot.linked_accounts table) ──────────────────────
router.get('/linked-accounts', async (req, res) => {
  try {
    const rows = await query(
      `SELECT user_id AS discord_id, email, confirmed, confirmed_by, confirmed_at, linked_at
       FROM linked_accounts ORDER BY linked_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Nextdactyl Proxy (passes admin requests through to nextdactyl) ────────────
const config = require('../config');

async function nextdactylFetch(path, options = {}) {
  if (!config.nextdactylUrl || !config.nextdactylSyncSecret) {
    throw new Error('nextdactyl integration not configured');
  }
  const url  = `${config.nextdactylUrl}/internal/admin${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      'x-sync-secret': config.nextdactylSyncSecret,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: resp.status, json };
}

router.get('/nextdactyl/users', async (req, res) => {
  try {
    const { status, json } = await nextdactylFetch('/users');
    res.status(status).json(json);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.get('/nextdactyl/users/:discordId', async (req, res) => {
  try {
    const { status, json } = await nextdactylFetch(`/users/${encodeURIComponent(req.params.discordId)}`);
    res.status(status).json(json);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.put('/nextdactyl/users/:discordId/coins', async (req, res) => {
  try {
    const { status, json } = await nextdactylFetch(
      `/users/${encodeURIComponent(req.params.discordId)}/coins`,
      { method: 'PUT', body: JSON.stringify(req.body) }
    );
    res.status(status).json(json);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.post('/nextdactyl/users/:discordId/coins/add', async (req, res) => {
  try {
    const { status, json } = await nextdactylFetch(
      `/users/${encodeURIComponent(req.params.discordId)}/coins/add`,
      { method: 'POST', body: JSON.stringify(req.body) }
    );
    res.status(status).json(json);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.get('/nextdactyl/stats', async (req, res) => {
  try {
    const { status, json } = await nextdactylFetch('/stats');
    res.status(status).json(json);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.get('/nextdactyl/shop', async (req, res) => {
  try {
    const { status, json } = await nextdactylFetch('/shop');
    res.status(status).json(json);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.post('/nextdactyl/shop', async (req, res) => {
  try {
    const { status, json } = await nextdactylFetch('/shop', { method: 'POST', body: JSON.stringify(req.body) });
    res.status(status).json(json);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.delete('/nextdactyl/shop/:index', async (req, res) => {
  try {
    const { status, json } = await nextdactylFetch(`/shop/${encodeURIComponent(req.params.index)}`, { method: 'DELETE' });
    res.status(status).json(json);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

// Restart nextdactyl container (uses Docker socket — requires dockerode)
router.post('/bots/nextdactyl/restart', async (req, res) => {
  try {
    let Docker;
    try { Docker = require('dockerode'); } catch { return res.status(503).json({ error: 'dockerode not installed' }); }
    const docker    = new Docker({ socketPath: '/var/run/docker.sock' });
    const container = docker.getContainer('nextdactyl');
    await container.restart();
    res.json({ ok: true, message: 'nextdactyl container restarted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Payment Processor Config ──────────────────────────────────────────────────
// GET /api/payment-config  — return all keys with masked values
router.get('/payment-config', async (req, res) => {
  try {
    res.json(await getAllMasked());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/payment-config/:key  — update a single config value
router.put('/payment-config/:key', async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  const { ENV_MAP } = require('../payments/paymentConfig');
  if (!ENV_MAP[key]) return res.status(400).json({ error: 'Unknown config key' });
  if (value === undefined || value === null) return res.status(400).json({ error: 'value is required' });
  try {
    await setConfig(key, String(value));
    // Return masked value so UI can confirm save
    const masked = PLAIN_KEYS.has(key) ? String(value) : String(value).substring(0, 6) + '••••••••';
    res.json({ ok: true, key, masked });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
