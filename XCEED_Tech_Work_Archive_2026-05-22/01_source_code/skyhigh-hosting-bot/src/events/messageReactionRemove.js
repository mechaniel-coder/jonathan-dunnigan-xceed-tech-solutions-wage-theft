'use strict';
const db = require('../database');

function emojiKey(emoji) {
  return emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;
}

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user) {
    if (user.bot) return;

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
    if (role) await member.roles.remove(role, 'Reaction role removed').catch(() => {});
  },
};
