-- Skyhigh Hosting Discord Bot — Database Schema
-- Run this once to initialize your database

CREATE DATABASE IF NOT EXISTS skyhigh_bot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE skyhigh_bot;

-- Per-guild configuration
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id       VARCHAR(20)  PRIMARY KEY,
  log_channel    VARCHAR(20)  DEFAULT NULL,
  welcome_channel VARCHAR(20) DEFAULT NULL,
  welcome_message TEXT        DEFAULT NULL,
  ticket_category VARCHAR(20) DEFAULT NULL,
  staff_role     VARCHAR(20)  DEFAULT NULL,
  ticket_count   INT          NOT NULL DEFAULT 0
);

-- Moderation warnings
CREATE TABLE IF NOT EXISTS warnings (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  guild_id     VARCHAR(20) NOT NULL,
  user_id      VARCHAR(20) NOT NULL,
  moderator_id VARCHAR(20) NOT NULL,
  reason       TEXT        NOT NULL,
  created_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_guild_user (guild_id, user_id)
);

-- Support tickets
CREATE TABLE IF NOT EXISTS tickets (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  guild_id      VARCHAR(20) NOT NULL,
  user_id       VARCHAR(20) NOT NULL,
  channel_id    VARCHAR(20) NOT NULL,
  ticket_number INT         NOT NULL,
  status        ENUM('open','closed') DEFAULT 'open',
  created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  closed_at     TIMESTAMP   DEFAULT NULL,
  INDEX idx_guild_user (guild_id, user_id),
  INDEX idx_channel (channel_id)
);

-- Giveaways
CREATE TABLE IF NOT EXISTS giveaways (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  guild_id     VARCHAR(20)  NOT NULL,
  channel_id   VARCHAR(20)  NOT NULL,
  message_id   VARCHAR(20)  DEFAULT NULL,
  prize        VARCHAR(255) NOT NULL,
  winner_count INT          NOT NULL DEFAULT 1,
  end_time     BIGINT       NOT NULL,
  ended        TINYINT(1)   NOT NULL DEFAULT 0,
  host_id      VARCHAR(20)  NOT NULL,
  participants JSON         NOT NULL DEFAULT ('[]'),
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_guild (guild_id),
  INDEX idx_active (ended, end_time)
);

-- FAQ entries
CREATE TABLE IF NOT EXISTS faq (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  guild_id   VARCHAR(20)  NOT NULL,
  question   VARCHAR(255) NOT NULL,
  answer     TEXT         NOT NULL,
  created_by VARCHAR(20)  DEFAULT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_guild (guild_id)
);

-- Custom commands
CREATE TABLE IF NOT EXISTS custom_commands (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  guild_id   VARCHAR(20) NOT NULL,
  name       VARCHAR(50) NOT NULL,
  response   TEXT        NOT NULL,
  use_embed  TINYINT(1)  NOT NULL DEFAULT 0,
  created_by VARCHAR(20) DEFAULT NULL,
  UNIQUE KEY unique_cmd (guild_id, name)
);

-- Self-assign role panels
CREATE TABLE IF NOT EXISTS role_panels (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  guild_id    VARCHAR(20)  NOT NULL,
  channel_id  VARCHAR(20)  NOT NULL,
  message_id  VARCHAR(20)  DEFAULT NULL,
  title       VARCHAR(255) DEFAULT 'Self-Assign Roles',
  description TEXT         DEFAULT NULL,
  roles       JSON         NOT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
