require('dotenv').config();

module.exports = {
  token:     process.env.BOT_TOKEN,
  clientId:  process.env.CLIENT_ID,
  guildId:   process.env.GUILD_ID,
  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME     || 'skyhigh_bot',
  },
  // Website API (optional — enables automatic account verification)
  // Set WEBSITE_API_URL and WEBSITE_API_KEY in .env to activate
  websiteApiUrl: process.env.WEBSITE_API_URL || null,
  websiteApiKey: process.env.WEBSITE_API_KEY || null,

  // nextdactyl integration (optional — syncs /link data to nextdactyl SQLite)
  // Set NEXTDACTYL_URL (e.g. http://nextdactyl:53135) and NEXTDACTYL_SYNC_SECRET
  // in .env to activate. Secret must match SYNC_SECRET in nextdactyl config.env.
  nextdactylUrl:        process.env.NEXTDACTYL_URL          || null,
  nextdactylSyncSecret: process.env.NEXTDACTYL_SYNC_SECRET  || null,

  // Billing/payment portal URL (for customer DMs after account link)
  // Set PORTAL_BASE_URL in .env, e.g. http://107.223.74.163:3010
  portalUrl: process.env.PORTAL_BASE_URL || null,

  // Paymenter integration
  // PAYMENTER_URL     — base URL of the Paymenter install, e.g. http://107.223.74.163:8080
  // PAYMENTER_API_KEY — admin API bearer token (Admin → API Keys in Paymenter)
  // PAYMENTER_WEBHOOK_SECRET — shared secret for inbound billing webhooks from Paymenter
  paymenterUrl:           process.env.PAYMENTER_URL            || null,
  paymenterApiKey:        process.env.PAYMENTER_API_KEY        || null,
  paymenterWebhookSecret: process.env.PAYMENTER_WEBHOOK_SECRET || null,

  // ── Payment processors ────────────────────────────────────────────────────
  payment: {
    // Stripe
    stripeSecretKey:     process.env.STRIPE_SECRET_KEY         || null,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET     || null,

    // PayPal (REST API v2)
    paypalClientId:      process.env.PAYPAL_CLIENT_ID          || null,
    paypalClientSecret:  process.env.PAYPAL_CLIENT_SECRET      || null,
    paypalWebhookId:     process.env.PAYPAL_WEBHOOK_ID         || null,
    paypalMode:          process.env.PAYPAL_MODE               || 'live', // 'sandbox' | 'live'

    // Square
    squareAccessToken:        process.env.SQUARE_ACCESS_TOKEN           || null,
    squareWebhookSignatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || null,
    squareLocationId:         process.env.SQUARE_LOCATION_ID            || null,
    squareEnvironment:        process.env.SQUARE_ENVIRONMENT            || 'production', // 'sandbox' | 'production'

    // Public base URL for payment success/cancel redirects
    baseUrl: process.env.PUBLIC_BASE_URL || 'https://admin.skyhigh.cinros.net',
  },

  // Skyhigh Hosting brand colors
  color:        0x00AAFF,
  errorColor:   0xFF4444,
  successColor: 0x44DD88,
  warnColor:    0xFFAA00,
};
