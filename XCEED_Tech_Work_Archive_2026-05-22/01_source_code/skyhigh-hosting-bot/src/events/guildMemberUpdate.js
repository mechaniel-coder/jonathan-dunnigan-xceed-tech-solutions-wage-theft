const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    if (newMember.user.bot) return;
    const changes = [];

    // Nickname change
    if (oldMember.nickname !== newMember.nickname)
      changes.push({ name: '📝 Nickname', value: `\`${oldMember.nickname ?? '(none)'}\` → \`${newMember.nickname ?? '(none)'}\`` });

    // Roles added
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    if (addedRoles.size)
      changes.push({ name: '✅ Roles Added', value: addedRoles.map(r => `${r}`).join(', ') });

    // Roles removed
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
    if (removedRoles.size)
      changes.push({ name: '❌ Roles Removed', value: removedRoles.map(r => `${r}`).join(', ') });

    // Timeout applied / removed
    const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
    const newTimeout = newMember.communicationDisabledUntilTimestamp;
    if (oldTimeout !== newTimeout) {
      if (newTimeout && newTimeout > Date.now())
        changes.push({ name: '⏰ Timed Out Until', value: `<t:${Math.floor(newTimeout / 1000)}:F>` });
      else if (oldTimeout)
        changes.push({ name: '✅ Timeout Removed', value: 'The timeout was lifted.' });
    }

    if (!changes.length) return;

    const embed = new EmbedBuilder()
      .setTitle('👤 Member Updated')
      .setThumbnail(newMember.user.displayAvatarURL())
      .addFields(
        { name: 'Member', value: `${newMember.user.tag} (${newMember.id})` },
        ...changes.map(c => ({ name: c.name, value: c.value, inline: false })),
      )
      .setColor(config.warnColor)
      .setTimestamp();
    await auditLog(newMember.guild, embed);
  },
};
