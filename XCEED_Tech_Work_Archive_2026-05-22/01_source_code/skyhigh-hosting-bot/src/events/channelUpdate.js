const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'channelUpdate',
  async execute(oldCh, newCh) {
    if (!newCh.guild) return;
    const changes = [];

    if (oldCh.name !== newCh.name)
      changes.push({ name: 'Name', value: `\`${oldCh.name}\` → \`${newCh.name}\`` });

    if ((oldCh.topic ?? '') !== (newCh.topic ?? ''))
      changes.push({ name: 'Topic', value: `\`${oldCh.topic || '(none)'}\` → \`${newCh.topic || '(none)'}\`` });

    if ((oldCh.rateLimitPerUser ?? 0) !== (newCh.rateLimitPerUser ?? 0))
      changes.push({ name: 'Slowmode', value: `${oldCh.rateLimitPerUser ?? 0}s → ${newCh.rateLimitPerUser ?? 0}s` });

    if (oldCh.nsfw !== undefined && oldCh.nsfw !== newCh.nsfw)
      changes.push({ name: 'NSFW', value: `${oldCh.nsfw} → ${newCh.nsfw}` });

    if (oldCh.bitrate && newCh.bitrate && oldCh.bitrate !== newCh.bitrate)
      changes.push({ name: 'Bitrate', value: `${Math.floor(oldCh.bitrate / 1000)}kbps → ${Math.floor(newCh.bitrate / 1000)}kbps` });

    if (oldCh.userLimit !== undefined && oldCh.userLimit !== newCh.userLimit)
      changes.push({ name: 'User Limit', value: `${oldCh.userLimit || 'Unlimited'} → ${newCh.userLimit || 'Unlimited'}` });

    if (oldCh.parent?.id !== newCh.parent?.id)
      changes.push({ name: 'Category Moved', value: `${oldCh.parent?.name ?? 'None'} → ${newCh.parent?.name ?? 'None'}` });

    if (!changes.length) return;

    const embed = new EmbedBuilder()
      .setTitle('✏️ Channel Updated')
      .addFields(
        { name: 'Channel', value: `${newCh.isTextBased() ? newCh : `#${newCh.name}`} (${newCh.id})` },
        ...changes.map(c => ({ name: c.name, value: c.value, inline: true })),
      )
      .setColor(config.warnColor)
      .setTimestamp();
    await auditLog(newCh.guild, embed);
  },
};
