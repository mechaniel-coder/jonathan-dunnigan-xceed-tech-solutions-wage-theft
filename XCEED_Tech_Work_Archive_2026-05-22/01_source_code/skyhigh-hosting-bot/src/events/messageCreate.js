const { EmbedBuilder } = require('discord.js');
const db             = require('../database');
const config         = require('../config');
const { processMessage: processXp } = require('../utils/levelManager');
const { checkMessage: automodCheck } = require('../utils/automodManager');

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const content = message.content.toLowerCase();

    // ── Auto-moderation (runs first; if actioned, skip everything else) ───────
    const actioned = await automodCheck(message).catch(() => false);
    if (actioned) return;

    // ── XP / Leveling ─────────────────────────────────────────────────────────
    processXp(message.client, message);

    // ── Auto-responders (keyword triggers) ───────────────────────────────
    const responders = await db.query(
      'SELECT * FROM auto_responders WHERE guild_id = ?',
      [guildId]
    );
    for (const r of responders) {
      if (content.includes(r.trigger_text.toLowerCase())) {
        if (r.use_embed) {
          const embed = new EmbedBuilder()
            .setDescription(r.response)
            .setColor(config.color);
          await message.reply({ embeds: [embed] }).catch(() => {});
        } else {
          await message.reply(r.response).catch(() => {});
        }
        return; // Only fire the first matching trigger
      }
    }

    // ── Prefix-based custom commands (!commandname) ───────────────────────
    if (!message.content.startsWith('!')) return;
    const cmdName = message.content.slice(1).split(/\s+/)[0].toLowerCase();
    if (!cmdName) return;

    const [cmd] = await db.query(
      'SELECT * FROM custom_commands WHERE guild_id = ? AND name = ?',
      [guildId, cmdName]
    );
    if (!cmd) return;

    if (cmd.use_embed) {
      const embed = new EmbedBuilder()
        .setDescription(cmd.response)
        .setColor(config.color);
      await message.reply({ embeds: [embed] }).catch(() => {});
    } else {
      await message.reply(cmd.response).catch(() => {});
    }
  },
};
