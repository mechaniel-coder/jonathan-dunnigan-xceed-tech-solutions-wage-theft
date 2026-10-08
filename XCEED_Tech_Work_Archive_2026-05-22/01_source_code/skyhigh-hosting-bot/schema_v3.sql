-- ============================================================
-- Schema v3 — Leveling & Economy tables
-- Run this against your MySQL database to add these features.
-- ============================================================

-- ── Leveling ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leveling_config (
  guild_id            VARCHAR(20)    NOT NULL PRIMARY KEY,
  enabled             TINYINT(1)     NOT NULL DEFAULT 0,
  xp_min              INT            NOT NULL DEFAULT 15,
  xp_max              INT            NOT NULL DEFAULT 25,
  cooldown_seconds    INT            NOT NULL DEFAULT 20,
  level_up_channel_id VARCHAR(20)    DEFAULT NULL,
  xp_multiplier       DECIMAL(5,2)   NOT NULL DEFAULT 1.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_levels (
  guild_id        VARCHAR(20)  NOT NULL,
  user_id         VARCHAR(20)  NOT NULL,
  total_xp        INT          NOT NULL DEFAULT 0,
  level           INT          NOT NULL DEFAULT 0,
  last_message_at BIGINT       NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS level_roles (
  guild_id  VARCHAR(20)  NOT NULL,
  level     INT          NOT NULL,
  role_id   VARCHAR(20)  NOT NULL,
  PRIMARY KEY (guild_id, level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Economy ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS economy (
  guild_id    VARCHAR(20)  NOT NULL,
  user_id     VARCHAR(20)  NOT NULL,
  balance     BIGINT       NOT NULL DEFAULT 0,
  bank        BIGINT       NOT NULL DEFAULT 0,
  last_daily  BIGINT       NOT NULL DEFAULT 0,
  last_work   BIGINT       NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS shop_items (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id    VARCHAR(20)  NOT NULL,
  name        VARCHAR(50)  NOT NULL,
  price       INT          NOT NULL DEFAULT 0,
  description TEXT,
  role_id     VARCHAR(20)  DEFAULT NULL,
  UNIQUE KEY uq_shop_item (guild_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id    VARCHAR(20)  NOT NULL,
  user_id     VARCHAR(20)  NOT NULL,
  item_name   VARCHAR(50)  NOT NULL,
  quantity    INT          NOT NULL DEFAULT 1,
  UNIQUE KEY uq_inventory (guild_id, user_id, item_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
