const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

const UNITS = { s: 1, m: 60, h: 3600, d: 86400 };

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const secs = parseInt(match[1]) * UNITS[match[2].toLowerCase()];
  return secs * 1000; // ms
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout (mute) a member')
    .addUserOption(o => o.setName('user').setDescription('User to timeout').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 1h, 2d (max 28d)').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target   = interaction.options.getMember('user');
    const durStr   = interaction.options.getString('duration');
    const reason   = interaction.options.getString('reason') || 'No reason provided';

    if (!target)           return interaction.reply({ content: '❌ User not found.',                      ephemeral: true });
    if (!target.moderatable) return interaction.reply({ content: '❌ I cannot timeout that user.',        ephemeral: true });

    const durationMs = parseDuration(durStr);
    if (!durationMs) return interaction.reply({ content: '❌ Invalid duration. Use format: `10m`, `1h`, `2d`.', ephemeral: true });
    if (durationMs > 28 * 24 * 3600 * 1000) return interaction.reply({ content: '❌ Max timeout is 28 days.', ephemeral: true });

    await target.timeout(durationMs, `${interaction.user.tag}: ${reason}`);
    await target.send(`⏱️ You have been timed out in **${interaction.guild.name}** for **${durStr}**.\n**Reason:** ${reason}`).catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle('⏱️ Member Timed Out')
      .addFields(
        { name: 'User',      value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`,            inline: true },
        { name: 'Duration',  value: durStr,                               inline: true },
        { name: 'Reason',    value: reason }
      )
      .setColor(config.warnColor)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
