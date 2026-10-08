const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setsuggestions')
    .setDescription('Set the channel where user suggestions are posted')
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Suggestions channel')
      .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    await db.query(
      'INSERT INTO guild_settings (guild_id, suggestions_channel) VALUES (?, ?) ON DUPLICATE KEY UPDATE suggestions_channel = ?',
      [interaction.guild.id, channel.id, channel.id]
    );
    await interaction.reply({ content: `✅ Suggestions channel set to ${channel}.`, flags: 64 });
  },
};
