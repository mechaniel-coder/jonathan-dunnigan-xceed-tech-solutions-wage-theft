const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greroll')
    .setDescription('Reroll winners for an ended giveaway')
    .addStringOption(o => o.setName('message_id').setDescription('The message ID of the ended giveaway').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('Number of new winners (default 1)').setMinValue(1).setMaxValue(20).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const messageId   = interaction.options.getString('message_id');
    const winnerCount = interaction.options.getInteger('winners') ?? 1;

    const rows = await db.query(
      'SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ? AND ended = 1',
      [messageId, interaction.guild.id]
    );

    if (!rows.length) {
      return interaction.editReply({ content: '❌ No ended giveaway found with that message ID.' });
    }

    const giveaway    = rows[0];
    const participants = JSON.parse(giveaway.participants || '[]');
    if (!participants.length) {
      return interaction.editReply({ content: '❌ No entries to reroll from.' });
    }

    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const winners  = shuffled.slice(0, Math.min(winnerCount, shuffled.length));
    const mention  = winners.map(id => `<@${id}>`).join(', ');

    const channel = interaction.guild.channels.cache.get(giveaway.channel_id);
    if (channel) {
      await channel.send(`🎉 **Giveaway Reroll!** New winner(s) for **${giveaway.prize}**: ${mention} — Congratulations!`);
    }

    await interaction.editReply({ content: `✅ Rerolled — New winner(s): ${mention}` });
  },
};
