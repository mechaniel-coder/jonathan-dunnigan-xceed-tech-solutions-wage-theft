const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { startGiveaway } = require('../../utils/giveawayManager');

const UNIT_MS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  return parseInt(match[1]) * UNIT_MS[match[2].toLowerCase()];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand(s => s
      .setName('start')
      .setDescription('Start a new giveaway')
      .addStringOption(o => o.setName('prize').setDescription('What is being given away').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 2h, 1d').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1).setMaxValue(20).setRequired(false))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post giveaway in').setRequired(false))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      await interaction.deferReply({ ephemeral: true });

      const prize      = interaction.options.getString('prize');
      const durStr     = interaction.options.getString('duration');
      const winners    = interaction.options.getInteger('winners') ?? 1;
      const target     = interaction.options.getChannel('channel') ?? interaction.channel;
      const durationMs = parseDuration(durStr);

      if (!durationMs) {
        return interaction.editReply({ content: '❌ Invalid duration. Use format: `10m`, `2h`, `1d`.' });
      }
      if (durationMs < 10000) {
        return interaction.editReply({ content: '❌ Minimum giveaway duration is 10 seconds.' });
      }

      await startGiveaway(target, prize, winners, durationMs, interaction.user.id);
      await interaction.editReply({ content: `✅ Giveaway started in ${target}! Good luck everyone 🎉` });
    }
  },
};
