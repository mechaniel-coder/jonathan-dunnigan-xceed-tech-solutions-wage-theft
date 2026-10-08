'use strict';
/**
 * reminderManager.js
 * Polls DB every 30 seconds and fires due reminders.
 * Call `start(client)` once in index.js after login.
 */

const db = require('../database');

let _client = null;
let _timer  = null;

async function fireDueReminders() {
  const now  = Date.now();
  const rows = await db.query(
    'SELECT * FROM reminders WHERE remind_at <= ?',
    [now]
  ).catch(() => []);

  for (const row of rows) {
    try {
      const guild   = _client.guilds.cache.get(row.guild_id);
      const channel = guild?.channels.cache.get(row.channel_id);
      if (channel) {
        await channel.send(
          `⏰ <@${row.user_id}> — here's your reminder: **${row.message}**`
        ).catch(() => {});
      } else {
        // Fallback: DM the user
        const user = await _client.users.fetch(row.user_id).catch(() => null);
        if (user) await user.send(`⏰ Reminder: **${row.message}**`).catch(() => {});
      }
    } catch (_) {}

    await db.query('DELETE FROM reminders WHERE id = ?', [row.id]).catch(() => {});
  }
}

function start(client) {
  _client = client;
  if (_timer) clearInterval(_timer);
  _timer = setInterval(fireDueReminders, 30_000);
  // Fire immediately on startup to catch any missed reminders
  fireDueReminders().catch(() => {});
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { start, stop };
