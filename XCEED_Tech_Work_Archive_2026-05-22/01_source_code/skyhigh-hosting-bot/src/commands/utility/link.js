const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db     = require('../../database');
const config = require('../../config');
const { syncToNextdactyl, unsyncFromNextdactyl, performLinkAccount } = require('../../utils/linkManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your skyhigh.cinros.net account to your Discord')

    // /link account
    .addSubcommand(s => s
      .setName('account')
      .setDescription('Link your Skyhigh Hosting billing account to Discord')
      .addStringOption(o => o
        .setName('email')
        .setDescription('The email address on your Skyhigh Hosting billing account at the portal')

    // /link status
    .addSubcommand(s => s
      .setName('status')
      .setDescription('Check the status of your account link'))

    // /link unlink
    .addSubcommand(s => s
      .setName('unlink')
      .setDescription('Remove your linked account'))

    // /link setrole  (admin)
    .addSubcommand(s => s
      .setName('setrole')
      .setDescription('Set the role automatically assigned to confirmed customers (admin)')
      .addRoleOption(o => o
        .setName('role')
        .setDescription('Role to assign on confirmation')
        .setRequired(true)))

    // /link confirm  (admin — fallback only)
    .addSubcommand(s => s
      .setName('confirm')
      .setDescription('Manually confirm a pending account link request (admin)')
      .addUserOption(o => o
        .setName('user')
        .setDescription('User to confirm')
        .setRequired(true)))

    // /link deny  (admin)
    .addSubcommand(s => s
      .setName('deny')
      .setDescription('Deny a pending account link request (admin)')
      .addUserOption(o => o
        .setName('user')
        .setDescription('User to deny')
        .setRequired(true))
      .addStringOption(o => o
        .setName('reason')
        .setDescription('Reason shown to the user')))

    // /link lookup  (admin)
    .addSubcommand(s => s
      .setName('lookup')
      .setDescription('Look up a linked account (admin)')
      .addUserOption(o => o
        .setName('user')
        .setDescription('User to look up')
        .setRequired(true)))

    // /link setup  (admin)
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('Post the "Link My Account" panel to a channel (admin)')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to post the panel in')
        .setRequired(true))),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 }); // ephemeral
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId  = interaction.user.id;

    // ── Helper: assign customer role ─────────────────────────────────────────
    async function assignCustomerRole(memberId) {
      const [s] = await db.query('SELECT customer_role FROM guild_settings WHERE guild_id = ?', [guildId]);
      if (!s?.customer_role) return false;
      const member = await interaction.guild.members.fetch(memberId).catch(() => null);
      if (!member) return false;
      await member.roles.add(s.customer_role, 'Hosting account link confirmed').catch(() => {});
      return true;
    }

    // ── Helper: remove customer role ─────────────────────────────────────────
    async function removeCustomerRole(memberId) {
      const [s] = await db.query('SELECT customer_role FROM guild_settings WHERE guild_id = ?', [guildId]);
      if (!s?.customer_role) return;
      const member = await interaction.guild.members.fetch(memberId).catch(() => null);
      if (member) member.roles.remove(s.customer_role, 'Account unlinked').catch(() => {});
    }

    // ── Helper: mark confirmed in DB + assign role ────────────────────────────
    async function confirmLink(targetId, confirmedBy) {
      await db.query(
        `UPDATE linked_accounts
         SET confirmed = 1, confirmed_by = ?, confirmed_at = NOW()
         WHERE guild_id = ? AND user_id = ?`,
        [confirmedBy, guildId, targetId]
      );
      return assignCustomerRole(targetId);
    }

    // ── Helper: notify staff log channel ─────────────────────────────────────
    async function notifyStaff(embed) {
      const [s] = await db.query('SELECT log_channel FROM guild_settings WHERE guild_id = ?', [guildId]);
      if (!s?.log_channel) return;
      const ch = interaction.guild.channels.cache.get(s.log_channel);
      if (ch) ch.send({ embeds: [embed] }).catch(() => {});
    }

    // ── /link account ─────────────────────────────────────────────────────────
    if (sub === 'account') {
      const email = interaction.options.getString('email').trim().toLowerCase();
      const result = await performLinkAccount({
        guild: interaction.guild, userId, user: interaction.user, email, guildId,
      });
      if (!result.success) return interaction.editReply(result.errorMessage);
      return interaction.editReply({ embeds: [result.embed] });
    }

    // ── /link setup (admin) ───────────────────────────────────────────────────
    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return interaction.editReply('❌ You need **Manage Server** permission.');

      const channel = interaction.options.getChannel('channel');

      const portalUrl = config.paymenterUrl || 'https://skyhigh.cinros.net';
      const embed = new EmbedBuilder()
        .setTitle('🔗 Link Your Hosting Account')
        .setDescription(
          'Connect your **Skyhigh Hosting** billing account to Discord to unlock customer perks and manage your servers directly from this server.\n\n' +
          'Click **Link My Account** below to get started.'
        )
        .addFields(
          { name: '📧 Already have a billing account?', value: 'Enter your billing portal email and we\'ll link it instantly.', inline: false },
          { name: '✨ New here?', value: `No account yet? Sign up at [the billing portal](${portalUrl}) — you can register with Discord.`, inline: false },
        )
        .setColor(config.color)
        .setFooter({ text: 'Skyhigh Hosting • skyhigh.cinros.net' })
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('link_account_btn')
          .setLabel('Link My Account')
          .setEmoji('🔗')
          .setStyle(ButtonStyle.Primary)
      );

      await channel.send({ embeds: [embed], components: [row] });
      return interaction.editReply(`✅ Link panel posted in ${channel}.`);
    }

    // ── /link status ──────────────────────────────────────────────────────────
    if (sub === 'status') {
      const [row] = await db.query(
        'SELECT * FROM linked_accounts WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );
      if (!row) {
        return interaction.editReply('❌ You have no linked account. Use `/link account email:youremail@example.com` to submit one.');
      }

      const embed = new EmbedBuilder()
        .setTitle('🔗 Account Link Status')
        .addFields(
          { name: 'Email',  value: row.email,                                          inline: true },
          { name: 'Status', value: row.confirmed ? '✅ Confirmed' : '⏳ Pending confirmation', inline: true }
        )
        .setColor(row.confirmed ? config.successColor : config.warnColor)
        .setFooter({ text: 'Skyhigh Hosting • skyhigh.cinros.net' })
        .setTimestamp();

      if (row.paymenter_customer_id) {
        embed.addFields({ name: 'Billing ID', value: `\`${row.paymenter_customer_id}\``, inline: true });
      } else if (row.confirmed) {
        embed.addFields({ name: 'Billing ID', value: '⚠️ Re-link to sync with billing portal', inline: true });
      }

      if (row.confirmed && row.confirmed_at) {
        embed.addFields({ name: 'Confirmed', value: `<t:${Math.floor(new Date(row.confirmed_at).getTime() / 1000)}:F>`, inline: true });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ── /link unlink ──────────────────────────────────────────────────────────
    if (sub === 'unlink') {
      const [row] = await db.query(
        'SELECT confirmed FROM linked_accounts WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );
      if (!row) return interaction.editReply('❌ You don\'t have a linked account.');

      await db.query('DELETE FROM linked_accounts WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
      if (row.confirmed) {
        const [s] = await db.query('SELECT customer_role FROM guild_settings WHERE guild_id = ?', [guildId]);
        if (s?.customer_role) {
          const member = await interaction.guild.members.fetch(userId).catch(() => null);
          if (member) await member.roles.remove(s.customer_role, 'Account unlinked').catch(() => {});
        }
      }
      await unsyncFromNextdactyl(userId);

      return interaction.editReply('✅ Your account link has been removed.');
    }

    // ── /link setrole (admin) ─────────────────────────────────────────────────
    if (sub === 'setrole') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return interaction.editReply('❌ You need **Manage Server** permission.');

      const role = interaction.options.getRole('role');
      if (role.managed) return interaction.editReply('❌ Cannot use bot-managed roles.');

      await db.query(
        `INSERT INTO guild_settings (guild_id, customer_role) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE customer_role = VALUES(customer_role)`,
        [guildId, role.id]
      );
      return interaction.editReply(`✅ Customer role set to **${role.name}**. It will be assigned automatically when a link is confirmed.`);
    }

    // ── /link confirm (admin) ─────────────────────────────────────────────────
    if (sub === 'confirm') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return interaction.editReply('❌ You need **Manage Server** permission.');

      const target = interaction.options.getUser('user');
      const [row]  = await db.query(
        'SELECT * FROM linked_accounts WHERE guild_id = ? AND user_id = ?',
        [guildId, target.id]
      );

      if (!row)           return interaction.editReply(`❌ ${target.tag} has no pending link request.`);
      if (row.confirmed)  return interaction.editReply(`❌ ${target.tag}'s account is already confirmed (\`${row.email}\`).`);

      const roleAssigned = await confirmLink(target.id, userId);

      // DM the user
      target.send({ embeds: [new EmbedBuilder()
        .setTitle('✅ Account Link Confirmed!')
        .setDescription(`Your **skyhigh.cinros.net** account (\`${row.email}\`) has been linked to your Discord in **${interaction.guild.name}**.`)
        .setColor(config.successColor)
        .setFooter({ text: 'Skyhigh Hosting • skyhigh.cinros.net' })
        .setTimestamp()
      ]}).catch(() => {});

      return interaction.editReply(
        `✅ **${target.tag}**'s account (\`${row.email}\`) confirmed.` +
        (roleAssigned ? ' Customer role assigned.' : ' *(No customer role set — use `/link setrole` to configure one.)*')
      );
    }

    // ── /link deny (admin) ────────────────────────────────────────────────────
    if (sub === 'deny') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return interaction.editReply('❌ You need **Manage Server** permission.');

      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') ?? 'No reason provided.';
      const [row]  = await db.query(
        'SELECT * FROM linked_accounts WHERE guild_id = ? AND user_id = ?',
        [guildId, target.id]
      );

      if (!row) return interaction.editReply(`❌ ${target.tag} has no pending link request.`);

      await db.query('DELETE FROM linked_accounts WHERE guild_id = ? AND user_id = ?', [guildId, target.id]);

      target.send({ embeds: [new EmbedBuilder()
        .setTitle('❌ Account Link Denied')
        .setDescription('Your account link request for **skyhigh.cinros.net** was not approved.')
        .addFields(
          { name: 'Server', value: interaction.guild.name },
          { name: 'Reason', value: reason }
        )
        .setColor(config.errorColor)
        .setFooter({ text: 'Open a support ticket if you think this is a mistake.' })
        .setTimestamp()
      ]}).catch(() => {});

      return interaction.editReply(`✅ Denied **${target.tag}**'s link request. Reason: ${reason}`);
    }

    // ── /link lookup (admin) ──────────────────────────────────────────────────
    if (sub === 'lookup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return interaction.editReply('❌ You need **Manage Server** permission.');

      const target = interaction.options.getUser('user');
      const [row]  = await db.query(
        'SELECT * FROM linked_accounts WHERE guild_id = ? AND user_id = ?',
        [guildId, target.id]
      );

      if (!row) return interaction.editReply(`❌ ${target.tag} has no linked account.`);

      const paymenterUrl = config.paymenterUrl
        ? `${config.paymenterUrl}/admin/users/${row.paymenter_customer_id ?? ''}`
        : null;

      const embed = new EmbedBuilder()
        .setTitle('🔗 Linked Account')
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: 'Discord',    value: `${target.tag} (${target.id})`,                    inline: true },
          { name: 'Email',      value: row.email,                                          inline: true },
          { name: 'Status',     value: row.confirmed ? '✅ Confirmed' : '⏳ Pending',      inline: true },
          { name: 'Billing ID', value: row.paymenter_customer_id ? `\`${row.paymenter_customer_id}\`` : '—', inline: true },
          { name: 'Submitted',  value: `<t:${Math.floor(new Date(row.linked_at).getTime() / 1000)}:F>`, inline: true }
        )
        .setColor(row.confirmed ? config.successColor : config.warnColor)
        .setTimestamp();

      if (paymenterUrl && row.paymenter_customer_id) {
        embed.addFields({ name: 'Paymenter Profile', value: paymenterUrl, inline: false });
      }

      if (row.confirmed && row.confirmed_at) {
        const who = (row.confirmed_by === 'api' || row.confirmed_by === 'paymenter')
          ? '🤖 Auto (Paymenter)' : `<@${row.confirmed_by}>`;
        embed.addFields(
          { name: 'Confirmed At', value: `<t:${Math.floor(new Date(row.confirmed_at).getTime() / 1000)}:F>`, inline: true },
          { name: 'Confirmed By', value: who, inline: true }
        );
      }

      return interaction.editReply({ embeds: [embed] });
    }
  },
};

