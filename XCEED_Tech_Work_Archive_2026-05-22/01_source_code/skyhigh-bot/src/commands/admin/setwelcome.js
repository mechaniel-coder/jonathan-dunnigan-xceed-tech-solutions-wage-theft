const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Configure the welcome message system')
    .addSubcommand(s => s
      .setName('channel')
      .setDescription('Set the welcome channel')
      .addChannelOption(o => o.setName('channel').setDescription('Welcome channel').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('message')
      .setDescription('Set the welcome message (use {user}, {username}, {server}, {membercount})')
      .addStringOption(o => o.setName('message').setDescription('Welcome message').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('disable')
      .setDescription('Disable welcome messages')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');
      await db.query(
        'INSERT INTO guild_settings (guild_id, welcome_channel) VALUES (?, ?) ON DUPLICATE KEY UPDATE welcome_channel = ?',
        [interaction.guild.id, channel.id, channel.id]
      );
      return interaction.reply({ content: `✅ Welcome channel set to ${channel}.`, ephemeral: true });
    }

    if (sub === 'message') {
      const message = interaction.options.getString('message');
      await db.query(
        'INSERT INTO guild_settings (guild_id, welcome_message) VALUES (?, ?) ON DUPLICATE KEY UPDATE welcome_message = ?',
        [interaction.guild.id, message, message]
      );
      return interaction.reply({ content: `✅ Welcome message updated.\n**Preview variables:** \`{user}\` \`{username}\` \`{server}\` \`{membercount}\``, ephemeral: true });
    }

    if (sub === 'disable') {
      await db.query(
        'INSERT INTO guild_settings (guild_id, welcome_channel) VALUES (?, NULL) ON DUPLICATE KEY UPDATE welcome_channel = NULL',
        [interaction.guild.id]
      );
      return interaction.reply({ content: '✅ Welcome messages disabled.', ephemeral: true });
    }
  },
};
