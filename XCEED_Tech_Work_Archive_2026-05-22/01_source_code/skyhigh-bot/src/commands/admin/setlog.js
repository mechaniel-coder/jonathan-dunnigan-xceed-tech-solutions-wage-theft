const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('Set the channel for moderation/audit logs')
    .addChannelOption(o => o.setName('channel').setDescription('Log channel').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');

    await db.query(
      'INSERT INTO guild_settings (guild_id, log_channel) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_channel = ?',
      [interaction.guild.id, channel.id, channel.id]
    );

    await interaction.reply({ content: `✅ Log channel set to ${channel}.`, ephemeral: true });
  },
};
