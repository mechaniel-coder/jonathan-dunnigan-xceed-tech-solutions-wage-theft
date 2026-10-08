/**
 * webhooks.js — Inbound webhook receiver for Paymenter billing events.
 *
 * Paymenter fires POST requests here (via the DiscordNotifier extension)
 * whenever a billing event occurs. The bot then DMs the affected Discord user.
 *
 * Security: every request must include the header
 *   x-paymenter-secret: <PAYMENTER_WEBHOOK_SECRET>
 *
 * Expected payload shape (JSON):
 * {
 *   event:      'invoice.created' | 'invoice.paid' | 'invoice.overdue'
 *              | 'service.created' | 'service.suspended' | 'service.cancelled',
 *   discordId:  '123456789012345678',  // optional — looked up by email if absent
 *   email:      'customer@example.com',
 *   amount?:    '9.99',
 *   invoiceId?: '42',
 *   serviceId?: '7',
 *   extra?:     { ... }  // arbitrary extra fields passed through to the embed
 * }
 */

const express = require('express');
const db      = require('../database');
const config  = require('../config');

const router = express.Router();

// ── Auth middleware ───────────────────────────────────────────────────────────
router.use((req, res, next) => {
  const secret = config.paymenterWebhookSecret;
  if (!secret) {
    // If no secret is configured, reject all inbound webhook calls.
    return res.status(503).json({ error: 'Webhook receiver not configured' });
  }
  const provided = req.headers['x-paymenter-secret'];
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// ── Event → DM mapping ────────────────────────────────────────────────────────
const EVENT_META = {
  'invoice.created':   { title: '🧾 Invoice Due',          color: 0xFFAA00, type: 'invoice'  },
  'invoice.paid':      { title: '✅ Payment Received',      color: 0x44DD88, type: 'received' },
  'invoice.overdue':   { title: '⚠️ Payment Overdue',       color: 0xFF4444, type: 'overdue'  },
  'service.created':   { title: '🚀 Service Provisioned',   color: 0x00AAFF, type: 'general'  },
  'service.suspended': { title: '🔴 Service Suspended',     color: 0xFF4444, type: 'overdue'  },
  'service.cancelled': { title: '🗑️ Service Cancelled',     color: 0x888888, type: 'general'  },
};

/**
 * Resolve a Discord user ID from the payload.
 * Tries payload.discordId first; falls back to looking up email in linked_accounts.
 */
async function resolveDiscordId(discordId, email) {
  if (discordId) return discordId;
  if (!email)    return null;

  const [row] = await db.query(
    'SELECT user_id FROM linked_accounts WHERE email = ? AND confirmed = 1 LIMIT 1',
    [email.toLowerCase()]
  );
  return row?.user_id ?? null;
}

// ── POST /webhooks/paymenter ──────────────────────────────────────────────────
router.post('/paymenter', express.json(), async (req, res) => {
  const { event, discordId, email, amount, invoiceId, serviceId } = req.body ?? {};

  if (!event) return res.status(400).json({ error: 'Missing event field' });

  const meta = EVENT_META[event];
  if (!meta) {
    // Unknown event — acknowledge it but do nothing
    return res.status(200).json({ ok: true, action: 'ignored', event });
  }

  const targetId = await resolveDiscordId(discordId, email);
  if (!targetId) {
    return res.status(200).json({ ok: true, action: 'no_linked_user', event });
  }

  // Build the embed fields
  const fields = [];
  if (email)     fields.push({ name: 'Account',    value: email,                inline: true });
  if (invoiceId) fields.push({ name: 'Invoice #',  value: String(invoiceId),    inline: true });
  if (amount)    fields.push({ name: 'Amount',      value: `$${amount}`,        inline: true });
  if (serviceId) fields.push({ name: 'Service ID',  value: String(serviceId),   inline: true });
  if (config.paymenterUrl) {
    fields.push({ name: 'Billing Portal', value: config.paymenterUrl, inline: false });
  }

  const embed = {
    title:       meta.title,
    color:       meta.color,
    fields,
    footer:      { text: 'Skyhigh Hosting • Billing' },
    timestamp:   new Date().toISOString(),
  };

  // Send DM via the Discord client attached to the app
  try {
    const client = req.app.locals.discordClient;
    if (!client) return res.status(503).json({ error: 'Discord client not available' });

    const dmUser = await client.users.fetch(targetId).catch(() => null);
    if (dmUser) {
      await dmUser.send({ embeds: [embed] }).catch(() => {});
    }
  } catch {
    // DM failures are non-critical — still return 200 so Paymenter doesn't retry
  }

  return res.status(200).json({ ok: true, action: 'dm_sent', targetId, event });
});

module.exports = router;
