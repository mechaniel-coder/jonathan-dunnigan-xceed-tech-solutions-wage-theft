const { EmbedBuilder } = require('discord.js');
const { auditLog } = require('../utils/auditLog');
const config = require('../config');

module.exports = {
  name: 'roleDelete',
  async execute(role) {
    const embed = new EmbedBuilder()
      .setTitle('🗑️ Role Deleted')
      .addFields(
        { name: 'Name',  value: role.name,    inline: true },
        { name: 'ID',    value: role.id,       inline: true },
        { name: 'Color', value: role.hexColor, inline: true },
      )
      .setColor(config.errorColor)
      .setTimestamp();
    await auditLog(role.guild, embed);
  },
};
