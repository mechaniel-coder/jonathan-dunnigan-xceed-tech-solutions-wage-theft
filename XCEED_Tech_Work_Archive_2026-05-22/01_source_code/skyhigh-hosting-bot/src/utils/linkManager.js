// Shared link-account logic used by both /link account (slash) and the
// "Link My Account" button modal.
//
// Account provisioning flow (post-Paymenter integration):
//   1. Look up the customer's email in Paymenter via the Admin API.
//   2. If found  → store paymenter_customer_id + confirm the link.
//   3. If not found → instruct the user to sign up at the Paymenter portal
//      (with Discord OAuth enabled they can log in via Discord).
//   Pterodactyl accounts are now provisioned exclusively by Paymenter;
//   the bot no longer calls the Pterodactyl Application API for creation.

const { EmbedBuilder } = require('discord.js');
const db     = require('../database');
const config = require('../config');
const { lookupPaymenterCustomer } = require('./websiteApi');

async function syncToNextdactyl(discordId, email, username) {
  if (!config.nextdactylUrl || !config.nextdactylSyncSecret) return;
  try {
    await fetch(`${config.nextdactylUrl}/internal/sync-user`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-secret': config.nextdactylSyncSecret },
      body:    JSON.stringify({ discordId, email, username }),
      signal:  AbortSignal.timeout(5000),
    });
  } catch { /* non-critical */ }
}

async function unsyncFromNextdactyl(discordId) {
  if (!config.nextdactylUrl || !config.nextdactylSyncSecret) return;
  try {
    await fetch(`${config.nextdactylUrl}/internal/sync-user/${discordId}`, {
      method:  'DELETE',
      headers: { 'x-sync-secret': config.nextdactylSyncSecret },
      signal:  AbortSignal.timeout(5000),
    });
  } catch { /* non-critical */ }
}

/**
 * Link a Discord user to their Paymenter customer account.
 * Returns { success: true, embed } or { success: false, errorMessage: string }
 *
 * Paymenter is the authority for both the customer record and the downstream
 * Pterodactyl server provisioning. The bot only stores the mapping
 * Discord user ↔ Paymenter customer ID.
 */
async function performLinkAccount({ guild, userId, user, email, guildId }) {
  if (!email.includes('@') || !email.includes('.')) {
    return { success: false, errorMessage: '❌ That doesn\'t look like a valid email address.' };
  }

  // Already confirmed — no re-linking needed
  const [existing] = await db.query(
    'SELECT confirmed FROM linked_accounts WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  );
  if (existing?.confirmed) {
    return { success: false, errorMessage: '✅ Your account is already linked and confirmed. Use `/link unlink` first if you need to change it.' };
  }

  // Paymenter not configured yet — fall back gracefully
  if (!config.paymenterUrl || !config.paymenterApiKey) {
    return { success: false, errorMessage: '⚠️ The billing portal is not configured yet. Please contact staff to link your account.' };
  }

  const lookup = await lookupPaymenterCustomer(email);

  if (lookup.fallback) {
    return { success: false, errorMessage: '⚠️ The billing portal is currently unreachable. Please try again in a few minutes.' };
  }

  if (!lookup.found) {
    const portalUrl = config.paymenterUrl || 'the billing portal';
    return {
      success: false,
      errorMessage:
        `❌ No account found in the billing portal for \`${email}\`.\n\n` +
        `Please **sign up at ${portalUrl}** first — you can log in with Discord.\n` +
        `Once your account is created, run this command again.`,
    };
  }

  // Persist the link (paymenter_customer_id + auto-confirm via API)
  await db.query(
    `INSERT INTO linked_accounts (guild_id, user_id, email, paymenter_customer_id, confirmed)
     VALUES (?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE
       email                 = VALUES(email),
       paymenter_customer_id = VALUES(paymenter_customer_id),
       confirmed             = 0,
       confirmed_by          = NULL,
       confirmed_at          = NULL`,
    [guildId, userId, email, lookup.customerId]
  );
  await db.query(
    `UPDATE linked_accounts
     SET confirmed = 1, confirmed_by = 'paymenter', confirmed_at = NOW()
     WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId]
  );

  // Assign customer role if configured
  const [s] = await db.query('SELECT customer_role FROM guild_settings WHERE guild_id = ?', [guildId]);
  if (s?.customer_role) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) await member.roles.add(s.customer_role, 'Billing account link confirmed').catch(() => {});
  }

  // Sync Discord ID to NextDactyl (coin economy — still needed)
  await syncToNextdactyl(userId, email, lookup.firstName ?? email.split('@')[0]);

  // DM the customer
  const portalLink = config.paymenterUrl || 'https://skyhigh.cinros.net';
  user.send({ embeds: [
    new EmbedBuilder()
      .setTitle('🔗 Account Linked!')
      .setDescription('Your Discord is now linked to your **Skyhigh Hosting** billing account.')
      .addFields(
        { name: 'Email',          value: email,      inline: true },
        { name: 'Billing Portal', value: portalLink, inline: true },
        { name: 'Game Panel',     value: 'https://skyhigh.cinros.net', inline: true },
      )
      .setColor(config.successColor)
      .setFooter({ text: 'Manage your servers & invoices at the billing portal • Skyhigh Hosting' })
      .setTimestamp()
  ]}).catch(() => {});

  const embed = new EmbedBuilder()
    .setTitle('✅ Account Linked!')
    .setDescription('Your Discord is now linked to your **Skyhigh Hosting** billing account.\n**Check your DMs for details.**')
    .addFields(
      { name: 'Email',          value: email,      inline: true },
      { name: 'Billing Portal', value: portalLink, inline: true },
    )
    .setColor(config.successColor)
    .setFooter({ text: 'Skyhigh Hosting • skyhigh.cinros.net' })
    .setTimestamp();

  return { success: true, embed };
}

module.exports = { syncToNextdactyl, unsyncFromNextdactyl, performLinkAccount };
