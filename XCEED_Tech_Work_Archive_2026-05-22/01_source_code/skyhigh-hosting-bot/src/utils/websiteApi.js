/**
 * websiteApi.js
 *
 * API helpers for:
 *  - Paymenter (billing & account source of truth)
 *  - Pterodactyl Application API (kept for admin /link lookup only)
 *
 * Paymenter:
 *   PAYMENTER_URL     = http://107.223.74.163:8080  (or domain)
 *   PAYMENTER_API_KEY = admin bearer token (Admin → API Keys)
 *
 * Pterodactyl (read-only, admin lookup only):
 *   WEBSITE_API_URL = https://skyhigh.cinros.net
 *   WEBSITE_API_KEY = ptla_...
 */

const config = require('../config');

function panelBase() {
  if (!config.websiteApiUrl) return null;
  try { return new URL(config.websiteApiUrl).origin; } catch { return null; }
}

function appHeaders() {
  return {
    'Authorization': `Bearer ${config.websiteApiKey}`,
    'Accept':        'application/json',
    'Content-Type':  'application/json',
  };
}

/**
 * Look up a Pterodactyl user by email using the Application API.
 * @returns {{ found: boolean, fallback?: boolean, userId?: number, username?: string, email?: string }}
 */
async function lookupPanelUser(email) {
  const base = panelBase();
  if (!base || !config.websiteApiKey) return { found: false, fallback: true };

  try {
    const res = await fetch(
      `${base}/api/application/users?filter[email]=${encodeURIComponent(email)}`,
      { headers: appHeaders(), signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { found: false, fallback: res.status >= 500 };

    const data  = await res.json();
    const users = data?.data ?? [];
    if (users.length === 0) return { found: false, fallback: false };

    const u = users[0].attributes;
    return { found: true, userId: u.id, username: u.username, email: u.email };
  } catch {
    return { found: false, fallback: true };
  }
}

/**
 * Create a new Pterodactyl user via the Application API.
 * Derives a username from discordUsername; retries with a suffix on conflict.
 * @returns {{ created: boolean, fallback?: boolean, username?: string, email?: string, password?: string }}
 */
async function createPanelUser(email, discordUsername) {
  const base = panelBase();
  if (!base || !config.websiteApiKey) return { created: false, fallback: true };

  const password = generatePassword();

  // Sanitise discord username → valid panel username (alphanumeric + underscore, 1–32 chars)
  const baseUsername = (discordUsername || email.split('@')[0])
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 28) || 'user';

  for (const suffix of ['', Date.now().toString().slice(-4)]) {
    const username = (baseUsername + suffix).slice(0, 32);
    try {
      const res = await fetch(`${base}/api/application/users`, {
        method: 'POST',
        headers: appHeaders(),
        body: JSON.stringify({
          username,
          email,
          first_name: discordUsername || 'Discord',
          last_name:  'User',
          password,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.status === 422 && suffix === '') continue; // username conflict — retry with suffix
      if (!res.ok) return { created: false, fallback: res.status >= 500 };

      const data = await res.json();
      return { created: true, username: data.attributes.username, email: data.attributes.email, password };
    } catch {
      return { created: false, fallback: true };
    }
  }
  return { created: false, fallback: false };
}

function generatePassword() {
  // Unambiguous characters only (no 0/O, 1/l/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pass = '';
  for (let i = 0; i < 16; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

// ── Paymenter API helpers ─────────────────────────────────────────────────────

function paymenterBase() {
  if (!config.paymenterUrl) return null;
  try { return new URL(config.paymenterUrl).origin; } catch { return null; }
}

function paymenterHeaders() {
  return {
    'Authorization': `Bearer ${config.paymenterApiKey}`,
    'Accept':        'application/vnd.api+json',
    'Content-Type':  'application/json',
  };
}

/**
 * Look up a Paymenter customer by email using the Admin API.
 * Returns { found, fallback?, customerId?, email?, firstName?, lastName? }
 */
async function lookupPaymenterCustomer(email) {
  const base = paymenterBase();
  if (!base || !config.paymenterApiKey) return { found: false, fallback: true };

  try {
    const res = await fetch(
      `${base}/api/v1/admin/users?filter[email]=${encodeURIComponent(email)}&per_page=1`,
      { headers: paymenterHeaders(), signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { found: false, fallback: res.status >= 500 };

    const body  = await res.json();
    const users = body?.data ?? [];
    if (users.length === 0) return { found: false, fallback: false };

    const u = users[0];
    const a = u.attributes ?? {};
    return {
      found:      true,
      customerId: String(u.id ?? a.id),
      email:      a.email,
      firstName:  a.first_name ?? null,
      lastName:   a.last_name  ?? null,
    };
  } catch {
    return { found: false, fallback: true };
  }
}

/**
 * Fetch a single Paymenter customer by ID.
 * Returns { found, fallback?, customerId?, email?, firstName?, lastName? }
 */
async function getPaymenterCustomerById(customerId) {
  const base = paymenterBase();
  if (!base || !config.paymenterApiKey) return { found: false, fallback: true };

  try {
    const res = await fetch(
      `${base}/api/v1/admin/users/${encodeURIComponent(customerId)}`,
      { headers: paymenterHeaders(), signal: AbortSignal.timeout(8000) }
    );
    if (res.status === 404) return { found: false, fallback: false };
    if (!res.ok)            return { found: false, fallback: true };

    const body = await res.json();
    const u = body?.data ?? {};
    const a = u.attributes ?? {};
    return {
      found:      true,
      customerId: String(u.id ?? a.id),
      email:      a.email,
      firstName:  a.first_name ?? null,
      lastName:   a.last_name  ?? null,
    };
  } catch {
    return { found: false, fallback: true };
  }
}

module.exports = { lookupPanelUser, lookupPaymenterCustomer, getPaymenterCustomerById };
