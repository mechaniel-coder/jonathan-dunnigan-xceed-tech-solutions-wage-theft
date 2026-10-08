-- Skyhigh Hosting Bot — Schema v4
-- Run AFTER schema.sql, schema_v2.sql, schema_v3.sql
-- Adds: automod, autorole, reminders, onboarding, last_status column fix

USE skyhigh_bot;

-- ── Auto-moderation configuration ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automod_config (
  guild_id          VARCHAR(20) PRIMARY KEY,
  enabled           TINYINT(1)  NOT NULL DEFAULT 0,
  spam_enabled      TINYINT(1)  NOT NULL DEFAULT 0,
  spam_threshold    INT         NOT NULL DEFAULT 5,
  spam_window_ms    INT         NOT NULL DEFAULT 5000,
  caps_enabled      TINYINT(1)  NOT NULL DEFAULT 0,
  caps_percent      INT         NOT NULL DEFAULT 70,
  caps_min_length   INT         NOT NULL DEFAULT 10,
  links_enabled     TINYINT(1)  NOT NULL DEFAULT 0,
  invites_enabled   TINYINT(1)  NOT NULL DEFAULT 0,
  badwords_enabled  TINYINT(1)  NOT NULL DEFAULT 0,
  mentions_enabled  TINYINT(1)  NOT NULL DEFAULT 0,
  mentions_limit    INT         NOT NULL DEFAULT 5,
  action            ENUM('delete','warn','timeout','kick','ban') NOT NULL DEFAULT 'delete',
  timeout_duration  INT         NOT NULL DEFAULT 300000,
  log_channel       VARCHAR(20) DEFAULT NULL
);

-- ── Auto-mod bad words ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automod_badwords (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(20)  NOT NULL,
  word     VARCHAR(100) NOT NULL,
  UNIQUE KEY unique_word (guild_id, word),
  INDEX idx_guild (guild_id)
);

-- ── Auto-role on join ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autorole_config (
  guild_id VARCHAR(20) NOT NULL,
  role_id  VARCHAR(20) NOT NULL,
  PRIMARY KEY (guild_id, role_id)
);

-- ── Reminders ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  guild_id   VARCHAR(20) NOT NULL,
  user_id    VARCHAR(20) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  message    TEXT        NOT NULL,
  remind_at  BIGINT      NOT NULL,
  created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_remind_at (remind_at),
  INDEX idx_user (guild_id, user_id)
);

-- ── Custom onboarding ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_config (
  guild_id      VARCHAR(20) PRIMARY KEY,
  enabled       TINYINT(1)  NOT NULL DEFAULT 0,
  dm_on_join    TINYINT(1)  NOT NULL DEFAULT 1,
  steps         JSON        NOT NULL DEFAULT ('[]')
);

-- Fix monitored_servers last_status column type (was TINYINT, needs varchar for up/down/unknown)
ALTER TABLE monitored_servers
  MODIFY COLUMN last_status VARCHAR(10) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP DEFAULT NULL;
