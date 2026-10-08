-- ─────────────────────────────────────────────────────────────────────────────
-- Schema v8: Confirmation columns for linked_accounts + customer_role
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE linked_accounts
  ADD COLUMN IF NOT EXISTS confirmed     TINYINT(1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmed_by  VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at  TIMESTAMP   DEFAULT NULL;

ALTER TABLE guild_settings
  ADD COLUMN IF NOT EXISTS customer_role VARCHAR(20) DEFAULT NULL;
