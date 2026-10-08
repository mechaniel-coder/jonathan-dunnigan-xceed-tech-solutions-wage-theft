'use strict';

/**
 * License check for Skyhigh Hosting Bot.
 *
 * SETUP (one time):
 *   1. In your license manager repo run: node src/cli.js pubkey
 *   2. Paste the output into PUBLIC_KEY below.
 *   3. Add LICENSE_TOKEN=<token> to your .env
 *
 * The token is created with:
 *   node src/cli.js create -c "ClientName" -p "Skyhigh Bot" [--days 30] --server-id <GUILD_ID>
 */

const crypto = require('crypto');

// ── Paste your public key here (node src/cli.js pubkey) ──────────────────────
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAos1xRT4u9+3vLrpe3gVz
piMVqNEOdFFZ7D+sLOjgNABrCR8mkro1lAfK5smdqF/SiDQ10yXq0mX/OMiS3hmq
2bKt9cttTpFNofxqSZQexgxXlegLMix6uHgKoiI7ecvhsNfeR6U77q9oGnazwnX9
P0+BKjlV88j2sgX9ChKoQuUcdQVb59d3jbXHFVMFJuaEdvUgyQXvaUTG4rKogxmp
lZv8ed+O1RIbns1MvKvdxC7qVqAu+VymWHKK+am3euhZMAyEgchdoVM/wZzeonw0
682Wv/dAUVZruQepGC4pY8mC04CDn4sZFfhrerDhAfG/u074O8uKJsyypVQHZK1C
jwIDAQAB
-----END PUBLIC KEY-----`;
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies the LICENSE_TOKEN env var.
 * Pass the GUILD_ID so the binding check works.
 * Calls process.exit(1) if the license is missing or invalid.
 *
 * @param {string} [guildId] - The Discord guild/server ID to check binding against.
 */
function enforeLicense(guildId) {
  const token = process.env.LICENSE_TOKEN;

  if (!token) {
    console.error('[LICENSE] No LICENSE_TOKEN set in .env — contact your provider.');
    process.exit(1);
  }

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
  } catch {
    console.error('[LICENSE] Token is corrupt or unreadable.');
    process.exit(1);
  }

  const { payload, signature } = decoded;
  if (!payload || !signature) {
    console.error('[LICENSE] Malformed token.');
    process.exit(1);
  }

  // Verify RSA-SHA256 signature
  try {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(JSON.stringify(payload));
    if (!verify.verify(PUBLIC_KEY, signature, 'base64')) {
      console.error('[LICENSE] Invalid signature — token may be tampered or forged.');
      process.exit(1);
    }
  } catch {
    console.error('[LICENSE] Signature check failed.');
    process.exit(1);
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.expires_at && now > payload.expires_at) {
    const expiredOn = new Date(payload.expires_at * 1000).toLocaleDateString();
    console.error(`[LICENSE] Expired on ${expiredOn} — renew your license.`);
    process.exit(1);
  }

  // Check server binding
  if (guildId && payload.server_id && payload.server_id !== String(guildId)) {
    console.error('[LICENSE] This license is bound to a different server.');
    process.exit(1);
  }

  console.log(`[LICENSE] Valid — ${payload.client} / ${payload.product}`);
}

module.exports = { enforeLicense };
