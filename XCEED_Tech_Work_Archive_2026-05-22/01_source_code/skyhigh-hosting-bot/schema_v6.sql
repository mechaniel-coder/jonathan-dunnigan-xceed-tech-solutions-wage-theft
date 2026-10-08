-- ─────────────────────────────────────────────────────────────────────────────
-- Schema v6: Reaction roles + ephemeral role picker
-- ─────────────────────────────────────────────────────────────────────────────

-- Tracks which messages are configured as reaction-role messages
CREATE TABLE IF NOT EXISTS reaction_role_messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  guild_id    VARCHAR(20)  NOT NULL,
  channel_id  VARCHAR(20)  NOT NULL,
  message_id  VARCHAR(20)  NOT NULL,
  title       VARCHAR(255) NOT NULL DEFAULT 'React for Roles',
  description TEXT         NULL,
  UNIQUE KEY uniq_msg (message_id),
  INDEX idx_rrm_guild (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Each emoji → role mapping on a reaction-role message
CREATE TABLE IF NOT EXISTS reaction_role_entries (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  message_id VARCHAR(20)  NOT NULL,
  emoji      VARCHAR(100) NOT NULL,   -- Unicode char OR "name:id" for custom emojis
  role_id    VARCHAR(20)  NOT NULL,
  UNIQUE KEY uniq_entry (message_id, emoji)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Which role panel to show in the ephemeral on-join picker
ALTER TABLE guild_settings
  ADD COLUMN IF NOT EXISTS role_picker_panel_id INT DEFAULT NULL;
