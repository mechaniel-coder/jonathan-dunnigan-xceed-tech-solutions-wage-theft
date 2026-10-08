/**
 * stripe.js
 * Stripe Checkout integration for coin purchases.
 *
 * Requires npm package: stripe
 */

const config = require('../config');
const { getConfig } = require('./paymentConfig');

async function getStripe() {
  const key = await getConfig('stripe_secret_key');
  if (!key) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
  const Stripe = require('stripe');
  return new Stripe(key, { apiVersion: '2024-04-10' });
}

/**
 * Create a Stripe Checkout session for a coin package purchase.
 *
 * @param {object} opts
 * @param {string} opts.discordId
 * @param {number} opts.packageId   - DB id of the coin_package row
 * @param {number} opts.coins       - Coins in this package
 * @param {number} opts.amountCents - Price in cents (must match DB)
 * @param {string} opts.packageName - Display name for the line item
 * @returns {Promise<{url:string, sessionId:string}>}
 */
async function createCheckoutSession({ discordId, packageId, coins, amountCents, packageName }) {
  const stripe     = await getStripe();
  const { baseUrl } = config.payment;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity:   1,
      price_data: {
        currency:     'usd',
        unit_amount:  amountCents,
        product_data: {
          name:        packageName || `${coins} Coins`,
          description: 'Skyhigh Hosting — Virtual Currency',
        },
      },
    }],
    metadata: {
      discordId,
      packageId: String(packageId),
      coins:     String(coins),
    },
    success_url: `${baseUrl}/buy/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${baseUrl}/buy/cancel`,
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Verify and parse a Stripe webhook event.
 * Returns the credit payload if the event is checkout.session.completed,
 * otherwise returns null.
 *
 * @param {Buffer}  rawBody
 * @param {string}  signature  - stripe-signature header value
 * @returns {Promise<{discordId,coins,amountCents,externalId}|null>}
 */
async function handleWebhook(rawBody, signature) {
  const stripe = await getStripe();
  const webhookSecret = await getConfig('stripe_webhook_secret');
  if (!webhookSecret) {
    throw new Error('Stripe webhook secret not configured (STRIPE_WEBHOOK_SECRET missing)');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new Error('Invalid Stripe webhook signature');
  }

  if (event.type !== 'checkout.session.completed') return null;

  const session = event.data.object;
  return {
    discordId:   session.metadata.discordId,
    coins:       parseInt(session.metadata.coins, 10),
    amountCents: session.amount_total,
    externalId:  session.id,
  };
}

module.exports = { createCheckoutSession, handleWebhook };
