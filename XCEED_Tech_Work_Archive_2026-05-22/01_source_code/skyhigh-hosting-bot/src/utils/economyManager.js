const db     = require('../database');
const logger = require('./logger');

const DAILY_AMOUNT  = 100;   // coins per /daily claim
const DAILY_COOLDOWN = 22 * 60 * 60 * 1000; // 22 hours in ms

// Work responses themed for a hosting business
const WORK_RESPONSES = [
  'You helped a client set up their VPS. +{coins} coins!',
  'You optimized a server config for a customer. +{coins} coins!',
  'You answered support tickets all morning. +{coins} coins!',
  'You fixed a broken deployment pipeline. +{coins} coins!',
  'You wrote docs for the client portal. +{coins} coins!',
  'You migrated a client\'s database. +{coins} coins!',
  'You renewed a domain for a customer. +{coins} coins!',
  'You resolved a network outage quickly. +{coins} coins!',
];
const WORK_COOLDOWN = 60 * 60 * 1000; // 1 hour
const WORK_MIN = 20;
const WORK_MAX = 80;

// ── Balance helpers ────────────────────────────────────────────────────────────

async function getBalance(guildId, userId) {
  const [row] = await db.query(
    'SELECT balance, bank, last_daily, last_work FROM economy WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  );
  return row || { balance: 0, bank: 0, last_daily: 0, last_work: 0 };
}

async function addBalance(guildId, userId, amount) {
  await db.query(
    `INSERT INTO economy (guild_id, user_id, balance) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)`,
    [guildId, userId, amount]
  );
}

async function setBalance(guildId, userId, balance) {
  await db.query(
    `INSERT INTO economy (guild_id, user_id, balance) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE balance = VALUES(balance)`,
    [guildId, userId, balance]
  );
}

// ── Daily ──────────────────────────────────────────────────────────────────────

async function claimDaily(guildId, userId) {
  const eco = await getBalance(guildId, userId);
  const now = Date.now();
  if (now - (eco.last_daily || 0) < DAILY_COOLDOWN) {
    const remaining = DAILY_COOLDOWN - (now - eco.last_daily);
    return { success: false, remaining };
  }
  await db.query(
    `INSERT INTO economy (guild_id, user_id, balance, last_daily)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE balance = balance + ?, last_daily = ?`,
    [guildId, userId, DAILY_AMOUNT, now, DAILY_AMOUNT, now]
  );
  return { success: true, amount: DAILY_AMOUNT };
}

// ── Work ───────────────────────────────────────────────────────────────────────

async function doWork(guildId, userId) {
  const eco = await getBalance(guildId, userId);
  const now = Date.now();
  if (now - (eco.last_work || 0) < WORK_COOLDOWN) {
    const remaining = WORK_COOLDOWN - (now - eco.last_work);
    return { success: false, remaining };
  }
  const coins = Math.floor(Math.random() * (WORK_MAX - WORK_MIN + 1)) + WORK_MIN;
  const msg   = WORK_RESPONSES[Math.floor(Math.random() * WORK_RESPONSES.length)].replace('{coins}', coins);
  await db.query(
    `INSERT INTO economy (guild_id, user_id, balance, last_work)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE balance = balance + ?, last_work = ?`,
    [guildId, userId, coins, now, coins, now]
  );
  return { success: true, amount: coins, message: msg };
}

// ── Pay ────────────────────────────────────────────────────────────────────────

async function pay(guildId, fromId, toId, amount) {
  const payer = await getBalance(guildId, fromId);
  if ((payer.balance || 0) < amount) return { success: false, reason: 'insufficient' };
  await db.query(
    `UPDATE economy SET balance = balance - ? WHERE guild_id = ? AND user_id = ?`,
    [amount, guildId, fromId]
  );
  await db.query(
    `INSERT INTO economy (guild_id, user_id, balance) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE balance = balance + ?`,
    [guildId, toId, amount, amount]
  );
  return { success: true };
}

// ── Shop ───────────────────────────────────────────────────────────────────────

async function getShopItems(guildId) {
  return db.query('SELECT * FROM shop_items WHERE guild_id = ? ORDER BY price ASC', [guildId]);
}

async function buyItem(guildId, userId, itemName) {
  const [item] = await db.query(
    'SELECT * FROM shop_items WHERE guild_id = ? AND name = ?',
    [guildId, itemName]
  );
  if (!item) return { success: false, reason: 'not_found' };

  const eco = await getBalance(guildId, userId);
  if ((eco.balance || 0) < item.price) return { success: false, reason: 'insufficient' };

  await db.query(
    `UPDATE economy SET balance = balance - ? WHERE guild_id = ? AND user_id = ?`,
    [item.price, guildId, userId]
  );
  await db.query(
    `INSERT INTO inventory (guild_id, user_id, item_name, quantity) VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
    [guildId, userId, item.name]
  );

  // Award role if item has one
  return { success: true, item };
}

async function getInventory(guildId, userId) {
  return db.query(
    'SELECT item_name, quantity FROM inventory WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  );
}

// ── Leaderboard ────────────────────────────────────────────────────────────────

async function getRichList(guildId, limit = 10) {
  return db.query(
    'SELECT user_id, balance FROM economy WHERE guild_id = ? ORDER BY balance DESC LIMIT ?',
    [guildId, limit]
  );
}

function formatTime(ms) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

module.exports = {
  DAILY_AMOUNT, getBalance, addBalance, setBalance,
  claimDaily, doWork, pay, getShopItems, buyItem, getInventory, getRichList, formatTime,
};
