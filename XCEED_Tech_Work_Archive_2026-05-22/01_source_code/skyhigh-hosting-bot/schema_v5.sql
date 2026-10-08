-- ─────────────────────────────────────────────────────────────────────────────
-- Schema v5: Role panels, temp roles, onboarding improvements
-- ─────────────────────────────────────────────────────────────────────────────

-- Self-assign role panels (button menus posted in channels)
CREATE TABLE IF NOT EXISTS role_panels (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  guild_id    VARCHAR(20)  NOT NULL,
  channel_id  VARCHAR(20)  NOT NULL,
  message_id  VARCHAR(20)  NULL,
  title       VARCHAR(256) NOT NULL DEFAULT 'Role Selection',
  description TEXT         NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rp_guild (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Buttons on a role panel (each button = one role)
CREATE TABLE IF NOT EXISTS role_panel_buttons (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  panel_id        INT         NOT NULL,
  role_id         VARCHAR(20) NOT NULL,
  label           VARCHAR(80) NOT NULL,
  emoji           VARCHAR(100) NULL,
  style           VARCHAR(20) DEFAULT 'Primary',
  exclusive_group VARCHAR(50) NULL,
  FOREIGN KEY (panel_id) REFERENCES role_panels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Temporary role assignments (auto-removed when expires_at is reached)
CREATE TABLE IF NOT EXISTS temp_roles (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  guild_id   VARCHAR(20) NOT NULL,
  user_id    VARCHAR(20) NOT NULL,
  role_id    VARCHAR(20) NOT NULL,
  expires_at BIGINT      NOT NULL,
  INDEX idx_tr_expires (expires_at),
  UNIQUE KEY uq_tr_user_role (guild_id, user_id, role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Onboarding improvements: goodbye messages + account age gate
ALTER TABLE onboarding_config
  ADD COLUMN IF NOT EXISTS goodbye_enabled     TINYINT(1)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goodbye_channel_id  VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS goodbye_message     TEXT        NULL,
  ADD COLUMN IF NOT EXISTS min_account_age_days INT        DEFAULT 0;
