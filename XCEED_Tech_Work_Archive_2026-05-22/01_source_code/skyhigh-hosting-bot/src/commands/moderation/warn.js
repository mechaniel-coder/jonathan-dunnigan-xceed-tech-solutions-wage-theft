const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a member')
    .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');

    if (!target) return interaction.reply({ content: '❌ That user is not in this server.', flags: 64 });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ You cannot warn yourself.', flags: 64 });

    await db.query(
      'INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)',
      [interaction.guild.id, target.id, interaction.user.id, reason]
    );

    const warnCount = await db.query(
      'SELECT COUNT(*) AS cnt FROM warnings WHERE guild_id = ? AND user_id = ?',
      [interaction.guild.id, target.id]
    );

    await target.send(`⚠️ You have received a warning in **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Member Warned')
      .addFields(
        { name: 'User',         value: `${target.user.tag} (${target.id})`,       inline: true },
        { name: 'Moderator',    value: `${interaction.user.tag}`,                 inline: true },
        { name: 'Total Warns',  value: `${warnCount[0].cnt}`,                     inline: true },
        { name: 'Reason',       value: reason }
      )
      .setColor(config.warnColor)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
