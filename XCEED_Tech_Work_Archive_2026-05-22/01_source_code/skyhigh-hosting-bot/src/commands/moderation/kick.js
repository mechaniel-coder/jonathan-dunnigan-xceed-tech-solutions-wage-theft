const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the kick').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target)         return interaction.reply({ content: '❌ That user is not in this server.', flags: 64 });
    if (!target.kickable) return interaction.reply({ content: '❌ I do not have permission to kick that user.', flags: 64 });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ You cannot kick yourself.', flags: 64 });
    if (target.roles.highest.position >= interaction.member.roles.highest.position)
      return interaction.reply({ content: '❌ You cannot kick a member with an equal or higher role than yours.', flags: 64 });

    await target.send(`You have been **kicked** from **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
    await target.kick(`${interaction.user.tag}: ${reason}`);

    const embed = new EmbedBuilder()
      .setTitle('👢 Member Kicked')
      .addFields(
        { name: 'User',      value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`,            inline: true },
        { name: 'Reason',    value: reason }
      )
      .setThumbnail(target.user.displayAvatarURL())
      .setColor(config.warnColor)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
