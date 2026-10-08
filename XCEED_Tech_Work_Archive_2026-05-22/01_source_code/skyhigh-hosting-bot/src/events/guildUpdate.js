const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

const VERIFICATION = ['None', 'Low', 'Medium', 'High', 'Very High'];
const EXPLICIT     = ['Disabled', 'Members without roles', 'All members'];

module.exports = {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild) {
    const changes = [];

    if (oldGuild.name                    !== newGuild.name)
      changes.push({ name: 'Name',               value: `\`${oldGuild.name}\` → \`${newGuild.name}\`` });
    if ((oldGuild.description ?? '')     !== (newGuild.description ?? ''))
      changes.push({ name: 'Description',        value: `\`${oldGuild.description || '(none)'}\` → \`${newGuild.description || '(none)'}\`` });
    if (oldGuild.icon                    !== newGuild.icon)
      changes.push({ name: 'Icon',               value: 'Server icon was changed.' });
    if (oldGuild.banner                  !== newGuild.banner)
      changes.push({ name: 'Banner',             value: 'Server banner was changed.' });
    if (oldGuild.verificationLevel       !== newGuild.verificationLevel)
      changes.push({ name: 'Verification Level', value: `${VERIFICATION[oldGuild.verificationLevel] ?? oldGuild.verificationLevel} → ${VERIFICATION[newGuild.verificationLevel] ?? newGuild.verificationLevel}` });
    if (oldGuild.explicitContentFilter   !== newGuild.explicitContentFilter)
      changes.push({ name: 'Explicit Filter',    value: `${EXPLICIT[oldGuild.explicitContentFilter] ?? oldGuild.explicitContentFilter} → ${EXPLICIT[newGuild.explicitContentFilter] ?? newGuild.explicitContentFilter}` });
    if (oldGuild.afkChannelId            !== newGuild.afkChannelId)
      changes.push({ name: 'AFK Channel',        value: `<#${oldGuild.afkChannelId ?? '?'}> → ${newGuild.afkChannelId ? `<#${newGuild.afkChannelId}>` : 'None'}` });
    if (oldGuild.systemChannelId         !== newGuild.systemChannelId)
      changes.push({ name: 'System Channel',     value: `<#${oldGuild.systemChannelId ?? '?'}> → ${newGuild.systemChannelId ? `<#${newGuild.systemChannelId}>` : 'None'}` });

    if (!changes.length) return;

    const embed = new EmbedBuilder()
      .setTitle('🏠 Server Settings Updated')
      .setThumbnail(newGuild.iconURL())
      .addFields(...changes.map(c => ({ name: c.name, value: c.value, inline: false })))
      .setColor(config.warnColor)
      .setTimestamp();
    await auditLog(newGuild, embed);
  },
};
