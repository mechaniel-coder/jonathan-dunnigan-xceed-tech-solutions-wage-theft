-- Skyhigh Hosting Bot — Schema v2 (new features)
-- Run AFTER schema.sql

USE skyhigh_bot;

-- Add new config columns to guild_settings
ALTER TABLE guild_settings
  ADD COLUMN IF NOT EXISTS suggestions_channel VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviews_channel     VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verified_role       VARCHAR(20) DEFAULT NULL;

-- ── Server uptime monitoring ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monitored_servers (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  guild_id         VARCHAR(20)  NOT NULL,
  name             VARCHAR(100) NOT NULL,
  url              VARCHAR(500) NOT NULL,
  alert_channel_id VARCHAR(20)  DEFAULT NULL,
  last_status      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_guild_url (guild_id, url)
);

-- ── Hosting account links ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS linked_accounts (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  guild_id  VARCHAR(20)  NOT NULL,
  user_id   VARCHAR(20)  NOT NULL,
  email     VARCHAR(255) NOT NULL,
  linked_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_link (guild_id, user_id)
);

-- ── Customer reviews ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  guild_id    VARCHAR(20) NOT NULL,
  user_id     VARCHAR(20) NOT NULL,
  rating      TINYINT(1)  NOT NULL,
  review_text TEXT        NOT NULL,
  message_id  VARCHAR(20) DEFAULT NULL,
  created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_guild (guild_id)
);

-- ── Private staff notes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_notes (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  guild_id       VARCHAR(20) NOT NULL,
  target_user_id VARCHAR(20) NOT NULL,
  author_id      VARCHAR(20) NOT NULL,
  note           TEXT        NOT NULL,
  created_at     TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_guild_user (guild_id, target_user_id)
);

-- ── User suggestions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suggestions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  guild_id        VARCHAR(20) NOT NULL,
  user_id         VARCHAR(20) NOT NULL,
  suggestion_text TEXT        NOT NULL,
  status          ENUM('pending','approved','denied') DEFAULT 'pending',
  message_id      VARCHAR(20) DEFAULT NULL,
  created_at      TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_guild (guild_id)
);

-- ── Auto-responders (keyword triggers) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_responders (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  guild_id     VARCHAR(20)  NOT NULL,
  trigger_text VARCHAR(200) NOT NULL,
  response     TEXT         NOT NULL,
  use_embed    TINYINT(1)   NOT NULL DEFAULT 0,
  created_by   VARCHAR(20)  NOT NULL,
  UNIQUE KEY unique_trigger (guild_id, trigger_text)
);
