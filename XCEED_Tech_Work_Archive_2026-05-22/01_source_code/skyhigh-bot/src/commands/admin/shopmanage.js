const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shopmanage')
    .setDescription('Add or remove items from the shop')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add an item to the shop')
      .addStringOption(o => o.setName('name').setDescription('Item name (no spaces)').setMaxLength(50).setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Cost in coins').setMinValue(1).setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Short description').setMaxLength(200))
      .addRoleOption(o => o.setName('role').setDescription('Role to grant on purchase (optional)')))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove an item from the shop')
      .addStringOption(o => o.setName('name').setDescription('Item name to remove').setRequired(true)))
    .addSubcommand(s => s
      .setName('givecoins')
      .setDescription('Give coins to a member')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setMinValue(1).setRequired(true)))
    .addSubcommand(s => s
      .setName('takecoins')
      .setDescription('Remove coins from a member')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setMinValue(1).setRequired(true))),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const name  = interaction.options.getString('name').trim();
      const price = interaction.options.getInteger('price');
      const desc  = interaction.options.getString('description') || '';
      const role  = interaction.options.getRole('role');

      // Prevent SQL-injectable names (allow only word chars, hyphens, spaces)
      if (!/^[\w\s\-]+$/.test(name)) {
        return interaction.reply({ content: '❌ Item name can only contain letters, numbers, spaces, and hyphens.', ephemeral: true });
      }

      try {
        await db.query(
          'INSERT INTO shop_items (guild_id, name, price, description, role_id) VALUES (?, ?, ?, ?, ?)',
          [guildId, name, price, desc, role?.id ?? null]
        );
        return interaction.reply({ embeds: [ok(`Added **${name}** to the shop for **${price} 🪙**.`)] });
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return interaction.reply({ embeds: [err(`An item named **${name}** already exists.`)], ephemeral: true });
        throw e;
      }
    }

    if (sub === 'remove') {
      const name = interaction.options.getString('name').trim();
      const [res] = await db.query(
        'DELETE FROM shop_items WHERE guild_id = ? AND name = ?',
        [guildId, name]
      );
      if (!res.affectedRows) return interaction.reply({ embeds: [err(`No item called **${name}** found.`)], ephemeral: true });
      return interaction.reply({ embeds: [ok(`Removed **${name}** from the shop.`)] });
    }

    if (sub === 'givecoins') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      await db.query(
        `INSERT INTO economy (guild_id, user_id, balance) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE balance = balance + ?`,
        [guildId, target.id, amount, amount]
      );
      return interaction.reply({ embeds: [ok(`Gave **${amount} 🪙** to ${target}.`)] });
    }

    if (sub === 'takecoins') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      await db.query(
        `UPDATE economy SET balance = GREATEST(0, balance - ?) WHERE guild_id = ? AND user_id = ?`,
        [amount, guildId, target.id]
      );
      return interaction.reply({ embeds: [ok(`Removed up to **${amount} 🪙** from ${target}.`)] });
    }
  },
};

function ok(text)  { return new EmbedBuilder().setColor(config.successColor).setDescription(`✅ ${text}`); }
function err(text) { return new EmbedBuilder().setColor(config.errorColor).setDescription(`❌ ${text}`); }
