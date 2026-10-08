-- ─────────────────────────────────────────────────────────────────────────────
-- Schema v9: Paymenter customer ID on linked_accounts
--
-- Links a Discord user's linked_accounts row to their Paymenter customer ID.
-- Paymenter is now the sole provisioner; the bot looks up customers here
-- instead of hitting the Pterodactyl Application API directly.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE linked_accounts
  ADD COLUMN IF NOT EXISTS paymenter_customer_id VARCHAR(64) DEFAULT NULL AFTER email;
