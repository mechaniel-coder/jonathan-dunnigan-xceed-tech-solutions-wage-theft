-- ─────────────────────────────────────────────────────────────────────────────
-- Schema v7: Add rules_accept_role default to guild_settings
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE guild_settings
  ADD COLUMN IF NOT EXISTS rules_accept_role VARCHAR(20) DEFAULT NULL;
