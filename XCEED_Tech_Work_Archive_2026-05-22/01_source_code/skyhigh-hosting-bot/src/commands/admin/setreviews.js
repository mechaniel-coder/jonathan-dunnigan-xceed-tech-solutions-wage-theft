const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setreviews')
    .setDescription('Set the channel where customer reviews are posted')
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Reviews channel')
      .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    await db.query(
      'INSERT INTO guild_settings (guild_id, reviews_channel) VALUES (?, ?) ON DUPLICATE KEY UPDATE reviews_channel = ?',
      [interaction.guild.id, channel.id, channel.id]
    );
    await interaction.reply({ content: `✅ Reviews channel set to ${channel}.`, flags: 64 });
  },
};
