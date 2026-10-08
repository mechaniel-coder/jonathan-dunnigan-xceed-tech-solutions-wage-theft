const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    const changes = [];

    if (oldRole.name        !== newRole.name)
      changes.push({ name: 'Name',        value: `\`${oldRole.name}\` → \`${newRole.name}\`` });
    if (oldRole.hexColor    !== newRole.hexColor)
      changes.push({ name: 'Color',       value: `\`${oldRole.hexColor}\` → \`${newRole.hexColor}\`` });
    if (oldRole.hoist       !== newRole.hoist)
      changes.push({ name: 'Hoisted',     value: `${oldRole.hoist} → ${newRole.hoist}` });
    if (oldRole.mentionable !== newRole.mentionable)
      changes.push({ name: 'Mentionable', value: `${oldRole.mentionable} → ${newRole.mentionable}` });

    // Permission diff
    const oldPerms = oldRole.permissions.toArray();
    const newPerms = newRole.permissions.toArray();
    const added    = newPerms.filter(p => !oldPerms.includes(p));
    const removed  = oldPerms.filter(p => !newPerms.includes(p));
    if (added.length)   changes.push({ name: '✅ Permissions Added',   value: added.join(', ').slice(0, 1024)   });
    if (removed.length) changes.push({ name: '❌ Permissions Removed', value: removed.join(', ').slice(0, 1024) });

    if (!changes.length) return;

    const embed = new EmbedBuilder()
      .setTitle('🔄 Role Updated')
      .addFields(
        { name: 'Role', value: `${newRole} (${newRole.id})` },
        ...changes.map(c => ({ name: c.name, value: c.value, inline: false })),
      )
      .setColor(config.warnColor)
      .setTimestamp();
    await auditLog(newRole.guild, embed);
  },
};
