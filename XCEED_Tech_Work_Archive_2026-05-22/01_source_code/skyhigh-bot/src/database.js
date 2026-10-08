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

module.exports = { query, getPool };
