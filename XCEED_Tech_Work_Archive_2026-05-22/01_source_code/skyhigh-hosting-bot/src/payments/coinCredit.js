/**
 * coinCredit.js
 * Credits coins to a Discord user after a successful payment.
 *  1. Calls nextdactyl's /internal/admin endpoint to add coins
 *  2. Inserts a row into payment_transactions for audit / duplicate prevention
 */

const { query } = require('../database');
const config    = require('../config');

/**
 * @param {object} opts
 * @param {string} opts.discordId    - Discord snowflake of the buyer
 * @param {'stripe'|'paypal'|'square'} opts.processor
 * @param {string} opts.externalId   - Processor-side payment / session ID
 * @param {number} opts.coins        - Coins to grant
 * @param {number} opts.amountCents  - Amount charged in cents (for records)
 * @returns {Promise<{ok:true, coins:number}>}
 */
async function creditCoins({ discordId, processor, externalId, coins, amountCents }) {
  if (!config.nextdactylUrl || !config.nextdactylSyncSecret) {
    throw new Error('nextdactyl integration not configured (NEXTDACTYL_URL / NEXTDACTYL_SYNC_SECRET missing)');
  }

  // Guard against double-crediting (idempotency via UNIQUE KEY on processor+external_id)
  const existing = await query(
    'SELECT id FROM payment_transactions WHERE processor = ? AND external_id = ?',
    [processor, externalId]
  );
  if (existing.length > 0) {
    return { ok: true, coins, alreadyCredited: true };
  }

  // Add coins via nextdactyl admin API
  const url = `${config.nextdactylUrl}/internal/admin/users/${encodeURIComponent(discordId)}/coins/add`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'x-sync-secret':  config.nextdactylSyncSecret,
    },
    body: JSON.stringify({ amount: coins }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`nextdactyl admin API returned ${resp.status}: ${text}`);
  }

  // Record the transaction
  await query(
    `INSERT INTO payment_transactions
       (discord_id, processor, external_id, coins_granted, amount_cents, status)
     VALUES (?, ?, ?, ?, ?, 'completed')`,
    [discordId, processor, externalId, coins, amountCents]
  );

  return { ok: true, coins };
}

module.exports = { creditCoins };
