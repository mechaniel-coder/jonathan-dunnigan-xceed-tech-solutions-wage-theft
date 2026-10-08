const mysql = require('mysql2/promise');
const config = require('./config');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host:             config.db.host,
      port:             config.db.port,
      user:             config.db.user,
      password:         config.db.password,
      database:         config.db.database,
      waitForConnections: true,
      connectionLimit:  10,
      charset:          'utf8mb4',
    });
  }
  return pool;
}

/**
 * Execute a parameterized query and return the result rows.
 * @param {string} sql
 * @param {any[]} params
 * @returns {Promise<any[]>}
 */
async function query(sql, params = []) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

/**
 * Create tables required by the payment portal and coin-package system.
 * Safe to call on every startup — uses CREATE TABLE IF NOT EXISTS.
 */
async function initDb() {
  const p = getPool();
  await p.execute(`
    CREATE TABLE IF NOT EXISTS coin_packages (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(100)  NOT NULL,
      coins       INT           NOT NULL,
      price_cents INT           NOT NULL,
      active      TINYINT(1)    NOT NULL DEFAULT 1,
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await p.execute(`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      discord_id    VARCHAR(32)   NOT NULL,
      processor     ENUM('stripe','paypal','square') NOT NULL,
      external_id   VARCHAR(255)  NOT NULL,
      coins_granted INT           NOT NULL,
      amount_cents  INT           NOT NULL,
      status        VARCHAR(50)   NOT NULL DEFAULT 'completed',
      created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_discord_id (discord_id),
      UNIQUE KEY uk_external (processor, external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await p.execute(`
    CREATE TABLE IF NOT EXISTS payment_config (
      \`key\`      VARCHAR(64)  NOT NULL PRIMARY KEY,
      value       TEXT         NOT NULL,
      updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await p.execute(`
    CREATE TABLE IF NOT EXISTS bot_settings (
      \`key\`      VARCHAR(64)  NOT NULL PRIMARY KEY,
      value       TEXT         NOT NULL,
      updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await p.execute(`
    INSERT IGNORE INTO bot_settings (\`key\`, value) VALUES ('monitor_interval', '5')
  `);
}

module.exports = { query, getPool, initDb };
