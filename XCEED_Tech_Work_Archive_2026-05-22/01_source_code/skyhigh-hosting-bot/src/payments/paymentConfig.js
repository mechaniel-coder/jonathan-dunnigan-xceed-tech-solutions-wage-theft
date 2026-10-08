/**
 * paymentConfig.js
 * DB-backed payment processor config with .env fallback.
 * Keys stored in the `payment_config` table take precedence over environment variables.
 */

const { query } = require('../database');

/** Maps DB key names → environment variable names */
const ENV_MAP = {
  stripe_secret_key:            'STRIPE_SECRET_KEY',
  stripe_webhook_secret:        'STRIPE_WEBHOOK_SECRET',
  paypal_client_id:             'PAYPAL_CLIENT_ID',
  paypal_client_secret:         'PAYPAL_CLIENT_SECRET',
  paypal_webhook_id:            'PAYPAL_WEBHOOK_ID',
  paypal_mode:                  'PAYPAL_MODE',
  square_access_token:          'SQUARE_ACCESS_TOKEN',
  square_webhook_signature_key: 'SQUARE_WEBHOOK_SIGNATURE_KEY',
  square_location_id:           'SQUARE_LOCATION_ID',
  square_environment:           'SQUARE_ENVIRONMENT',
};

/** Non-secret fields — returned as plaintext in the API */
const PLAIN_KEYS = new Set([
  'paypal_mode', 'paypal_webhook_id',
  'square_location_id', 'square_environment',
]);

/**
 * Get a config value. DB takes precedence over env vars.
 * @param {string} key  One of the keys in ENV_MAP
 * @returns {Promise<string|null>}
 */
async function getConfig(key) {
  try {
    const rows = await query('SELECT value FROM payment_config WHERE `key` = ?', [key]);
    if (rows.length && rows[0].value) return rows[0].value;
  } catch { /* DB not ready yet — fall through to env */ }
  return process.env[ENV_MAP[key]] || null;
}

/**
 * Persist a config value to the DB.
 * @param {string} key
 * @param {string} value
 */
async function setConfig(key, value) {
  await query(
    'INSERT INTO payment_config (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
    [key, value],
  );
}

/**
 * Return all config keys with values masked for display.
 * @returns {Promise<Record<string, string|null>>}
 */
async function getAllMasked() {
  const result = {};
  for (const key of Object.keys(ENV_MAP)) {
    const val = await getConfig(key);
    if (!val) {
      result[key] = null;
    } else if (PLAIN_KEYS.has(key)) {
      result[key] = val;
    } else {
      result[key] = val.substring(0, 6) + '••••••••';
    }
  }
  return result;
}

module.exports = { getConfig, setConfig, getAllMasked, ENV_MAP, PLAIN_KEYS };
