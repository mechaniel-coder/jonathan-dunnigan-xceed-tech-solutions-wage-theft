const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a timeout from a member')
    .addUserOption(o => o.setName('user').setDescription('User to untimeout').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target)
      return interaction.reply({ content: '❌ User not in this server.', flags: 64 });

    if (!target.isCommunicationDisabled())
      return interaction.reply({ content: '❌ That user is not currently timed out.', flags: 64 });

    await target.timeout(null, `${interaction.user.tag}: ${reason}`);
    await target.send(`✅ Your timeout in **${interaction.guild.name}** has been removed.\n**Reason:** ${reason}`).catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle('✅ Timeout Removed')
      .addFields(
        { name: 'User',      value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: interaction.user.tag,                inline: true },
        { name: 'Reason',    value: reason }
      )
      .setColor(config.color)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
