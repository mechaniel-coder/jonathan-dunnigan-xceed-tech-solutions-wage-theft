const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { getShopItems, buyItem, getInventory, getRichList } = require('../../utils/economyManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse and buy items from the shop')
    .addSubcommand(s => s.setName('browse').setDescription('Browse available items'))
    .addSubcommand(s => s
      .setName('buy')
      .setDescription('Buy an item')
      .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true)))
    .addSubcommand(s => s
      .setName('inventory')
      .setDescription('View your inventory or another member\'s')
      .addUserOption(o => o.setName('user').setDescription('Member to check (defaults to you)')))
    .addSubcommand(s => s.setName('richlist').setDescription('View the top 10 wealthiest members')),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'browse') {
      const items = await getShopItems(guildId);
      if (!items.length) return interaction.reply({ content: '🛒 The shop is empty. An admin can add items with `/shopmanage add`.', flags: 64 });

      const lines = items.map(i =>
        `**${i.name}** — ${i.price} 🪙\n${i.description || ''}${i.role_id ? `  · Grants <@&${i.role_id}>` : ''}`
      );
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle('🛒 Shop')
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: 'Use /shop buy <item> to purchase' })
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'buy') {
      const itemName = interaction.options.getString('item');
      const result   = await buyItem(guildId, interaction.user.id, itemName);

      if (result.reason === 'not_found')    return interaction.reply({ content: `❌ No item called **${itemName}** in the shop.`, flags: 64 });
      if (result.reason === 'insufficient') return interaction.reply({ content: `❌ You don't have enough coins.`, flags: 64 });

      // Grant role if applicable
      if (result.item.role_id) {
        const role = interaction.guild.roles.cache.get(result.item.role_id);
        if (role) await interaction.member.roles.add(role).catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor(config.successColor)
        .setDescription(`✅ Purchased **${result.item.name}** for **${result.item.price} 🪙**!`);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'inventory') {
      const target = interaction.options.getUser('user') || interaction.user;
      const inv    = await getInventory(guildId, target.id);
      if (!inv.length) return interaction.reply({ content: `${target.username}'s inventory is empty.`, flags: 64 });

      const lines = inv.map(i => `**${i.item_name}** × ${i.quantity}`);
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`🎒 Inventory — ${target.username}`)
        .setDescription(lines.join('\n'))
        .setThumbnail(target.displayAvatarURL());
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'richlist') {
      const list = await getRichList(guildId);
      if (!list.length) return interaction.reply({ content: 'No economy data yet.', flags: 64 });

      const medals = ['🥇', '🥈', '🥉'];
      const lines  = list.map((r, i) => `${medals[i] || `**#${i + 1}**`} <@${r.user_id}> — **${r.balance} 🪙**`);
      const embed  = new EmbedBuilder()
        .setColor(config.color)
        .setTitle('💰 Richest Members')
        .setDescription(lines.join('\n'))
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }
  },
};
