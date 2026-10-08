const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages from a channel')
    .addIntegerOption(o => o.setName('amount').setDescription('Number of messages to delete (1–100)').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const amount    = interaction.options.getInteger('amount');
    const filterUser = interaction.options.getUser('user');

    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    let toDelete = [...messages.values()].filter(m => {
      const age = Date.now() - m.createdTimestamp;
      return age < 14 * 24 * 60 * 60 * 1000; // Discord 14-day limit
    });

    if (filterUser) toDelete = toDelete.filter(m => m.author.id === filterUser.id);
    toDelete = toDelete.slice(0, amount);

    if (!toDelete.length) {
      return interaction.editReply({ content: '❌ No eligible messages found (messages older than 14 days cannot be bulk deleted).' });
    }

    const deleted = await interaction.channel.bulkDelete(toDelete, true);
    await interaction.editReply({ content: `✅ Deleted **${deleted.size}** message(s).` });
  },
};
