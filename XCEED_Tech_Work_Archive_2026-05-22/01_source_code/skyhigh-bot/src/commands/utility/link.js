const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Skyhigh Hosting account to your Discord')
    .addSubcommand(s => s
      .setName('account')
      .setDescription('Link your hosting account email')
      .addStringOption(o => o
        .setName('email')
        .setDescription('The email address on your Skyhigh Hosting account')
        .setRequired(true)
      )
    )
    .addSubcommand(s => s
      .setName('unlink')
      .setDescription('Remove your linked account')
    )
    .addSubcommand(s => s
      .setName('lookup')
      .setDescription('Look up a linked account (staff only)')
      .addUserOption(o => o.setName('user').setDescription('User to look up').setRequired(true))
    ),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'account') {
      const email = interaction.options.getString('email').trim().toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return interaction.reply({ content: '❌ That doesn\'t look like a valid email address.', ephemeral: true });
      }

      await db.query(
        'INSERT INTO linked_accounts (guild_id, user_id, email) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE email = ?',
        [guildId, interaction.user.id, email, email]
      );

      const embed = new EmbedBuilder()
        .setTitle('🔗 Account Linked')
        .setDescription(`Your Discord account is now linked to \`${email}\`.`)
        .addFields({ name: 'Need help?', value: 'Open a support ticket with `/ticket`.' })
        .setColor(config.successColor)
        .setFooter({ text: 'Skyhigh Hosting' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'unlink') {
      const result = await db.query(
        'DELETE FROM linked_accounts WHERE guild_id = ? AND user_id = ?',
        [guildId, interaction.user.id]
      );
      if (result.affectedRows === 0) {
        return interaction.reply({ content: '❌ You don\'t have a linked account.', ephemeral: true });
      }
      await interaction.reply({ content: '✅ Your account has been unlinked.', ephemeral: true });
    }

    if (sub === 'lookup') {
      if (!interaction.member.permissions.has('ManageGuild')) {
        return interaction.reply({ content: '❌ You need **Manage Server** permission to look up accounts.', ephemeral: true });
      }

      const target = interaction.options.getUser('user');
      const [row]  = await db.query(
        'SELECT * FROM linked_accounts WHERE guild_id = ? AND user_id = ?',
        [guildId, target.id]
      );

      if (!row) {
        return interaction.reply({ content: `❌ ${target.tag} has no linked account.`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('🔗 Linked Account')
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: 'Discord',   value: `${target.tag} (${target.id})` },
          { name: 'Email',     value: row.email },
          { name: 'Linked At', value: `<t:${Math.floor(new Date(row.linked_at).getTime() / 1000)}:F>` }
        )
        .setColor(config.color)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
