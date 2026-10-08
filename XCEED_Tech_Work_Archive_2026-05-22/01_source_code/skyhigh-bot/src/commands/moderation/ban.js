const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the ban').setRequired(false))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Days of messages to delete (0–7)').setMinValue(0).setMaxValue(7).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const target     = interaction.options.getMember('user');
    const reason     = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    if (!target)         return interaction.reply({ content: '❌ That user is not in this server.', ephemeral: true });
    if (!target.bannable) return interaction.reply({ content: '❌ I do not have permission to ban that user.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ You cannot ban yourself.', ephemeral: true });

    await target.send(`You have been **banned** from **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
    await target.ban({ deleteMessageSeconds: deleteDays * 86400, reason: `${interaction.user.tag}: ${reason}` });

    const embed = new EmbedBuilder()
      .setTitle('🔨 Member Banned')
      .addFields(
        { name: 'User',      value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`,            inline: true },
        { name: 'Reason',    value: reason }
      )
      .setThumbnail(target.user.displayAvatarURL())
      .setColor(config.errorColor)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
