/**
 * payment.js  — /buy/* routes
 *
 * User-facing coin purchase portal.  Discord OAuth is used to identify
 * the buyer (separate "discord-user" Passport strategy — no admin check).
 *
 * Routes:
 *   GET  /buy/                       — coin package store
 *   GET  /buy/auth                   — start Discord OAuth
 *   GET  /buy/auth/callback          — OAuth callback
 *   GET  /buy/logout                 — clear session + redirect to /buy/
 *   POST /buy/checkout/stripe        — create Stripe checkout
 *   POST /buy/checkout/paypal        — create PayPal order
 *   POST /buy/checkout/square        — create Square payment link
 *   GET  /buy/paypal/capture         — capture PayPal order after approval
 *   POST /buy/webhook/stripe         — Stripe webhook (raw body required)
 *   POST /buy/webhook/paypal         — PayPal webhook
 *   POST /buy/webhook/square         — Square webhook (raw body required)
 *   GET  /buy/success                — payment success page
 *   GET  /buy/cancel                 — payment cancelled page
 *   GET  /buy/packages               — JSON: active coin packages
 *   GET  /buy/me                     — JSON: currently logged-in user info
 */

'use strict';

const path       = require('path');
const express    = require('express');
const { passport: passportInstance, setupUserStrategy } = require('./auth');
const { query }  = require('../database');
const { creditCoins } = require('../payments/coinCredit');
const stripePayment   = require('../payments/stripe');
const paypalPayment   = require('../payments/paypal');
const squarePayment   = require('../payments/square');
const logger          = require('../utils/logger');

const PUBLIC = path.join(__dirname, 'public');

/**
 * Mount all /buy/* routes onto the provided Express app.
 * Call this AFTER session middleware is attached.
 *
 * @param {import('express').Application} app
 * @param {string} clientId  - Discord application client ID
 */
function mountPaymentPortal(app, clientId) {
  // Register the non-admin Discord OAuth strategy once
  setupUserStrategy(clientId);

  // ── Auth routes ─────────────────────────────────────────────────────────────
  app.get('/buy/auth', passportInstance.authenticate('discord-user'));

  app.get('/buy/auth/callback',
    passportInstance.authenticate('discord-user', {
      failureRedirect: '/buy/?error=login_failed',
      successRedirect: '/buy/',
    })
  );

  app.get('/buy/logout', (req, res) => {
    req.logout(() => res.redirect('/buy/'));
  });

  // ── Public JSON endpoints ───────────────────────────────────────────────────
  // Active coin packages list (no auth required — needed before login)
  app.get('/buy/packages', async (req, res) => {
    try {
      const rows = await query(
        'SELECT id, name, coins, price_cents FROM coin_packages WHERE active = 1 ORDER BY price_cents ASC'
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Current user info
  app.get('/buy/me', (req, res) => {
    if (!req.isAuthenticated()) return res.json({ authenticated: false });
    res.json({ authenticated: true, id: req.user.id, username: req.user.username, avatar: req.user.avatar });
  });

  // ── Auth guard middleware for checkout endpoints ─────────────────────────────
  const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Login required' });
    next();
  };

  // ── Checkout: Stripe ────────────────────────────────────────────────────────
  app.post('/buy/checkout/stripe', express.json(), requireAuth, async (req, res) => {
    try {
      const { packageId } = req.body;
      const pkg = await getPackage(packageId);
      if (!pkg) return res.status(404).json({ error: 'Package not found' });

      const { url } = await stripePayment.createCheckoutSession({
        discordId:   req.user.id,
        packageId:   pkg.id,
        coins:       pkg.coins,
        amountCents: pkg.price_cents,
        packageName: pkg.name,
      });
      res.json({ url });
    } catch (err) {
      logger.error(`[Payment/Stripe] Checkout error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Checkout: PayPal ────────────────────────────────────────────────────────
  app.post('/buy/checkout/paypal', express.json(), requireAuth, async (req, res) => {
    try {
      const { packageId } = req.body;
      const pkg = await getPackage(packageId);
      if (!pkg) return res.status(404).json({ error: 'Package not found' });

      const { url, orderId } = await paypalPayment.createOrder({
        discordId:   req.user.id,
        packageId:   pkg.id,
        coins:       pkg.coins,
        amountCents: pkg.price_cents,
        packageName: pkg.name,
      });
      // Store orderId + discord ID in session so we can credit after redirect-back
      req.session.pendingPaypal = { orderId, discordId: req.user.id, coins: pkg.coins, amountCents: pkg.price_cents };
      res.json({ url });
    } catch (err) {
      logger.error(`[Payment/PayPal] Checkout error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // PayPal redirect-back capture (user lands here after approving on PayPal)
  app.get('/buy/paypal/capture', requireAuth, async (req, res) => {
    try {
      const pending = req.session.pendingPaypal;
      const { token: orderId } = req.query; // PayPal appends ?token=ORDER_ID
      if (!orderId) return res.redirect('/buy/cancel');

      const result = await paypalPayment.captureOrder(orderId);
      if (!result) return res.redirect('/buy/cancel');

      delete req.session.pendingPaypal;
      await creditCoins({ ...result, processor: 'paypal', discordId: req.user.id });
      res.redirect('/buy/success');
    } catch (err) {
      logger.error(`[Payment/PayPal] Capture error: ${err.message}`);
      res.redirect('/buy/cancel');
    }
  });

  // ── Checkout: Square ────────────────────────────────────────────────────────
  app.post('/buy/checkout/square', express.json(), requireAuth, async (req, res) => {
    try {
      const { packageId } = req.body;
      const pkg = await getPackage(packageId);
      if (!pkg) return res.status(404).json({ error: 'Package not found' });

      const { url } = await squarePayment.createPaymentLink({
        discordId:   req.user.id,
        packageId:   pkg.id,
        coins:       pkg.coins,
        amountCents: pkg.price_cents,
        packageName: pkg.name,
      });
      res.json({ url });
    } catch (err) {
      logger.error(`[Payment/Square] Checkout error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Webhooks ────────────────────────────────────────────────────────────────

  // Stripe webhook — needs raw body (no express.json())
  app.post('/buy/webhook/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      try {
        const sig = req.headers['stripe-signature'];
        const result = await stripePayment.handleWebhook(req.body, sig);
        if (result) {
          await creditCoins({ ...result, processor: 'stripe' });
          logger.info(`[Payment/Stripe] Credited ${result.coins} coins to ${result.discordId}`);
        }
        res.json({ received: true });
      } catch (err) {
        logger.error(`[Payment/Stripe] Webhook error: ${err.message}`);
        res.status(400).json({ error: err.message });
      }
    }
  );

  // PayPal webhook
  app.post('/buy/webhook/paypal', express.json(), async (req, res) => {
    try {
      const result = await paypalPayment.handleWebhook(req.body, req.headers);
      if (result) {
        await creditCoins({ ...result, processor: 'paypal' });
        logger.info(`[Payment/PayPal] Credited ${result.coins} coins to ${result.discordId}`);
      }
      res.json({ received: true });
    } catch (err) {
      logger.error(`[Payment/PayPal] Webhook error: ${err.message}`);
      res.status(400).json({ error: err.message });
    }
  });

  // Square webhook — needs raw body for HMAC verification
  app.post('/buy/webhook/square',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      try {
        const sig        = req.headers['x-square-hmacsha256-signature'];
        const webhookUrl = `${process.env.PUBLIC_BASE_URL || ''}/buy/webhook/square`;
        const result     = squarePayment.handleWebhook(req.body, sig, webhookUrl);
        if (result) {
          await creditCoins({ ...result, processor: 'square' });
          logger.info(`[Payment/Square] Credited ${result.coins} coins to ${result.discordId}`);
        }
        res.json({ received: true });
      } catch (err) {
        logger.error(`[Payment/Square] Webhook error: ${err.message}`);
        res.status(400).json({ error: err.message });
      }
    }
  );

  // ── Static pages ─────────────────────────────────────────────────────────────
  app.use('/buy', express.static(path.join(PUBLIC, 'buy')));

  // SPA fallback for /buy/ — also serves index.html for unknown sub-paths
  app.get(['/buy', '/buy/', '/buy/success', '/buy/cancel'], (_req, res) => {
    res.sendFile(path.join(PUBLIC, 'buy', 'index.html'));
  });
}

// ── Helper ──────────────────────────────────────────────────────────────────────
async function getPackage(id) {
  if (!id) return null;
  const rows = await query(
    'SELECT id, name, coins, price_cents FROM coin_packages WHERE id = ? AND active = 1',
    [id]
  );
  return rows[0] || null;
}

module.exports = { mountPaymentPortal };
