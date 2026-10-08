'use strict';

const db     = require('../database');
const logger = require('./logger');

let interval;

/** Start the temp-role expiry checker (runs every 60 seconds). */
function start(client) {
  checkExpired(client); // run immediately to catch any missed expirations
  interval = setInterval(() => checkExpired(client), 60_000);
  logger.info('[TempRole] Manager started.');
}

function stop() {
  clearInterval(interval);
}

async function checkExpired(client) {
  try {
    const rows = await db.query(
      'SELECT * FROM temp_roles WHERE expires_at <= ?',
      [Date.now()]
    );

    for (const row of rows) {
      try {
        const guild = client.guilds.cache.get(row.guild_id);
        if (!guild) {
          await db.query('DELETE FROM temp_roles WHERE id = ?', [row.id]);
          continue;
        }
        const member = await guild.members.fetch(row.user_id).catch(() => null);
        if (member) {
          await member.roles.remove(row.role_id, 'Temp role expired').catch(() => {});
        }
        await db.query('DELETE FROM temp_roles WHERE id = ?', [row.id]);
      } catch (err) {
        logger.error(`[TempRole] Error processing id=${row.id}: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error(`[TempRole] checkExpired error: ${err.message}`);
  }
}

module.exports = { start, stop };
