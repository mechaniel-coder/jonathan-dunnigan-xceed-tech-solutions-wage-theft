const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'roleCreate',
  async execute(role) {
    const embed = new EmbedBuilder()
      .setTitle('🎭 Role Created')
      .addFields(
        { name: 'Name',        value: role.name,                                        inline: true },
        { name: 'ID',          value: role.id,                                          inline: true },
        { name: 'Color',       value: role.hexColor,                                    inline: true },
        { name: 'Hoisted',     value: role.hoist      ? 'Yes' : 'No',                  inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No',                 inline: true },
        { name: 'Managed',     value: role.managed    ? 'Yes (Bot/Integration)' : 'No', inline: true },
      )
      .setColor(config.successColor)
      .setTimestamp();
    await auditLog(role.guild, embed);
  },
};
