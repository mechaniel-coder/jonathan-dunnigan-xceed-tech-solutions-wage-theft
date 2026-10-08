const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a member')
    .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('user');

    const warns = await db.query(
      'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC',
      [interaction.guild.id, target.id]
    );

    if (!warns.length) {
      return interaction.reply({ content: `✅ ${target.tag} has no warnings.`, ephemeral: true });
    }

    const fields = warns.slice(0, 10).map((w, i) => ({
      name:  `#${i + 1} — <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:d>`,
      value: `**Reason:** ${w.reason}\n**By:** <@${w.moderator_id}>`,
    }));

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Warnings for ${target.tag}`)
      .setDescription(`Total warnings: **${warns.length}**`)
      .addFields(fields)
      .setThumbnail(target.displayAvatarURL())
      .setColor(config.warnColor)
      .setFooter({ text: warns.length > 10 ? `Showing 10 of ${warns.length} warnings` : '' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
