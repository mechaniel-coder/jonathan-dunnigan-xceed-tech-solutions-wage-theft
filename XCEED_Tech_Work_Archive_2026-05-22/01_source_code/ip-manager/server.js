'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { ImapFlow } = require('imapflow');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3010;
const IMAP_HOST = process.env.IMAP_HOST || '127.0.0.1';
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '143', 10);
const DATA_FILE = process.env.DATA_FILE || '/app/data/whitelist.json';
const TRIGGER_FILE = path.dirname(DATA_FILE) + '/.apply';

// ─── Whitelist persistence ───────────────────────────────────────────────────

function loadWhitelist() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('[whitelist] Load error:', e.message); }
  return {};
}

function saveWhitelist(whitelist) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(whitelist, null, 2));
  fs.renameSync(tmp, DATA_FILE);
  // Signal host-side apply script to rebuild iptables rules
  fs.writeFileSync(TRIGGER_FILE, Date.now().toString());
}

// ─── IMAP auth ───────────────────────────────────────────────────────────────

async function verifyCredentials(username, password) {
  if (!username || !password || username.length > 254 || password.length > 256) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) return false;

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: false,
    auth: { user: username, pass: password },
    logger: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });

  try {
    await client.connect();
    await client.logout();
    return true;
  } catch {
    return false;
  }
}

// ─── IP validation ───────────────────────────────────────────────────────────

function isValidIP(ip) {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).map(Number).every(n => n <= 255);
}

function getClientIP(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) {
    const ip = fwd.split(',')[0].trim();
    if (isValidIP(ip)) return ip;
  }
  const raw = req.ip || '';
  // Strip IPv6-mapped IPv4 prefix
  return raw.replace(/^::ffff:/, '');
}

// ─── Express setup ───────────────────────────────────────────────────────────

app.set('trust proxy', 1);
app.use(express.json({ limit: '4kb' }));
app.use(express.urlencoded({ extended: false, limit: '4kb' }));
app.use(express.static('/app/public'));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get('/my-ip', (req, res) => {
  res.json({ ip: getClientIP(req) });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
});

app.post('/update-ip', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  const ip = getClientIP(req);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  if (!ip || !isValidIP(ip)) {
    return res.status(400).json({ error: 'Could not determine your IP address.' });
  }

  console.log(`[auth] Attempt: ${username} from ${ip}`);

  const valid = await verifyCredentials(username, password);
  if (!valid) {
    console.log(`[auth] Failed: ${username}`);
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  console.log(`[auth] Success: ${username} -> ${ip}`);

  const whitelist = loadWhitelist();
  const previousIp = whitelist[username]?.ip || null;
  whitelist[username] = { ip, updatedAt: new Date().toISOString() };
  saveWhitelist(whitelist);

  console.log(`[whitelist] Updated ${username}: ${previousIp || 'new'} -> ${ip}`);

  res.json({
    success: true,
    message: `Access granted for ${ip}`,
    ip,
    user: username,
    previousIp,
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] IP Manager listening on port ${PORT}`);
});
