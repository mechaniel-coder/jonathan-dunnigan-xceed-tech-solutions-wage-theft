const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .addStringOption(o => o.setName('user_id').setDescription('User ID to unban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for unban'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!/^\d{17,20}$/.test(userId))
      return interaction.reply({ content: '❌ Invalid user ID.', flags: 64 });

    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban)
      return interaction.reply({ content: '❌ That user is not banned.', flags: 64 });

    await interaction.guild.members.unban(userId, `${interaction.user.tag}: ${reason}`);

    const embed = new EmbedBuilder()
      .setTitle('🔓 Member Unbanned')
      .addFields(
        { name: 'User',      value: `${ban.user.tag} (${userId})`, inline: true },
        { name: 'Moderator', value: interaction.user.tag,          inline: true },
        { name: 'Reason',    value: reason }
      )
      .setThumbnail(ban.user.displayAvatarURL())
      .setColor(config.color)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
