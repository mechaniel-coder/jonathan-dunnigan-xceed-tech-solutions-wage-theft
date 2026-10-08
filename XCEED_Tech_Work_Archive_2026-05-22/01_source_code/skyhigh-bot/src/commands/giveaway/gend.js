const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { endGiveaway } = require('../../utils/giveawayManager');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gend')
    .setDescription('Force-end an active giveaway by message ID')
    .addStringOption(o => o.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const messageId = interaction.options.getString('message_id');

    const rows = await db.query(
      'SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ? AND ended = 0',
      [messageId, interaction.guild.id]
    );

    if (!rows.length) {
      return interaction.editReply({ content: '❌ No active giveaway found with that message ID.' });
    }

    await endGiveaway(rows[0], client);
    await interaction.editReply({ content: '✅ Giveaway ended and winners selected.' });
  },
};
