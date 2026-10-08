'use strict';
const db = require('../database');

// Normalize reaction emoji to the stored key format:
//   Unicode emoji  →  the character itself  (e.g. "🎮")
//   Custom emoji   →  "name:id"             (e.g. "gaming:123456789012345678")
function emojiKey(emoji) {
  return emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;
}

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    if (user.bot) return;

    // Fetch partials so we have full data
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    const { message } = reaction;
    if (!message.guild) return;

    const [entry] = await db.query(
      'SELECT role_id FROM reaction_role_entries WHERE message_id = ? AND emoji = ?',
      [message.id, emojiKey(reaction.emoji)]
    ).catch(() => []);

    if (!entry) return;

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = message.guild.roles.cache.get(entry.role_id);
    if (role) await member.roles.add(role, 'Reaction role').catch(() => {});
  },
};
