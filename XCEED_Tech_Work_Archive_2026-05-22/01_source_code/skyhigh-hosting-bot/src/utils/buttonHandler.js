const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { ticketOpen, ticketClose, ticketConfirmClose } = require('./ticketManager');
const { enterGiveaway } = require('./giveawayManager');
const { buildComponents } = require('./rolePanelManager');
const { performLinkAccount } = require('./linkManager');
const db = require('../database');

async function handleButton(interaction, client) {
  const { customId } = interaction;

  // ── Tickets ──────────────────────────────────────────────────────────────
  if (customId === 'ticket_open') {
    return ticketOpen(interaction, client);
  }
  if (customId === 'ticket_close') {
    return ticketClose(interaction, client);
  }
  if (customId.startsWith('ticket_confirm_close_')) {
    return ticketConfirmClose(interaction, client);
  }
  if (customId === 'ticket_close_cancel') {
    return interaction.update({ content: '❌ Close cancelled.', embeds: [], components: [] });
  }

  // ── Giveaways ────────────────────────────────────────────────────────────
  if (customId.startsWith('giveaway_enter_')) {
    const messageId = customId.replace('giveaway_enter_', '');
    if (messageId === 'placeholder') {
      return interaction.reply({ content: '⏳ This giveaway is still being set up. Try again in a moment!', flags: 64 });
    }
    return enterGiveaway(interaction, client, messageId);
  }

  // ── Self-assign roles ────────────────────────────────────────────────────
  if (customId.startsWith('role_toggle_')) {
    const roleId = customId.replace('role_toggle_', '');
    return handleRoleToggle(interaction, roleId);
  }

  // ── Ephemeral role picker ─────────────────────────────────────────────────
  if (customId === 'open_role_picker') {
    return handleRolePicker(interaction);
  }

  // ── Member verification ──────────────────────────────────────────────────
  if (customId === 'verify_member') {
    return handleVerify(interaction);
  }

  // ── Link account panel button ───────────────────────────────────────────
  if (customId === 'link_account_btn') {
    const modal = new ModalBuilder()
      .setCustomId('link_account_modal')
      .setTitle('Link Your Hosting Account');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('link_email')
          .setLabel('Your skyhigh.cinros.net email')
          .setPlaceholder('example@gmail.com')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  // ── Rules accept (assigns a role specified in the button customId) ────────
  if (customId.startsWith('rules_accept_')) {
    const roleId = customId.replace('rules_accept_', '');
    return handleRulesAccept(interaction, roleId);
  }
}

async function handleRoleToggle(interaction, roleId) {
  await interaction.deferReply({ flags: 64 });
  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) return interaction.editReply({ content: '❌ That role no longer exists.' });

  const member = interaction.member;

  // Check for exclusive group — if set, remove all other roles in the same group first
  const [btnRow] = await db.query(
    'SELECT exclusive_group FROM role_panel_buttons WHERE role_id = ?',
    [roleId]
  );
  if (btnRow?.exclusive_group) {
    const groupRoles = await db.query(
      `SELECT rpb.role_id FROM role_panel_buttons rpb
       JOIN role_panels rp ON rp.id = rpb.panel_id
       WHERE rp.guild_id = ? AND rpb.exclusive_group = ? AND rpb.role_id != ?`,
      [interaction.guild.id, btnRow.exclusive_group, roleId]
    );
    for (const { role_id } of groupRoles) {
      if (member.roles.cache.has(role_id)) {
        const r = interaction.guild.roles.cache.get(role_id);
        if (r) await member.roles.remove(r).catch(() => {});
      }
    }
  }

  const me = interaction.guild.members.me;
  if (!me || role.position >= me.roles.highest.position) {
    return interaction.editReply({
      content: `❌ I don't have permission to manage the **${role.name}** role. An admin needs to move my role above it in Server Settings → Roles.`,
    });
  }

  try {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(role);
      return interaction.editReply({ content: `✅ Removed the **${role.name}** role.` });
    } else {
      await member.roles.add(role);
      return interaction.editReply({ content: `✅ Added the **${role.name}** role.` });
    }
  } catch {
    return interaction.editReply({ content: `❌ Failed to update the **${role.name}** role. Please contact an admin.` });
  }
}

async function handleVerify(interaction) {
  await interaction.deferReply({ flags: 64 });

  const [settings] = await db.query(
    'SELECT verified_role FROM guild_settings WHERE guild_id = ?',
    [interaction.guild.id]
  );

  if (!settings?.verified_role) {
    return interaction.editReply({ content: '❌ Verification is not configured. Please contact an admin.' });
  }

  const role = interaction.guild.roles.cache.get(settings.verified_role);
  if (!role) {
    return interaction.editReply({ content: '❌ The verified role no longer exists. Please contact an admin.' });
  }

  if (interaction.member.roles.cache.has(role.id)) {
    return interaction.editReply({ content: '✅ You are already verified!' });
  }

  const me = interaction.guild.members.me;
  if (!me || role.position >= me.roles.highest.position) {
    return interaction.editReply({
      content: '❌ I don\'t have permission to assign that role. An admin needs to move my role **above** the verified role in Server Settings → Roles.',
    });
  }

  try {
    await interaction.member.roles.add(role);
    return interaction.editReply({ content: `✅ You've been verified and received the **${role.name}** role. Welcome!` });
  } catch {
    return interaction.editReply({ content: '❌ Failed to assign the role. Please contact an admin.' });
  }
}

async function handleRolePicker(interaction) {
  await interaction.deferReply({ flags: 64 });

  const [settings] = await db.query(
    'SELECT role_picker_panel_id FROM guild_settings WHERE guild_id = ?',
    [interaction.guild.id]
  ).catch(() => []);

  const panelId = settings?.role_picker_panel_id;
  if (!panelId) {
    return interaction.editReply({
      content: '❌ No role picker configured. Ask an admin to use `/onboarding setpickerpanel`.',
    });
  }

  const buttons = await db.query(
    'SELECT * FROM role_panel_buttons WHERE panel_id = ? ORDER BY id ASC',
    [panelId]
  ).catch(() => []);

  if (!buttons.length) {
    return interaction.editReply({ content: '❌ The role picker has no roles configured yet.' });
  }

  const components = buildComponents(buttons);
  return interaction.editReply({
    content: '🎭 **Pick your roles below.** Click a button to add or remove a role.',
    components,
  });
}

async function handleRulesAccept(interaction, roleId) {
  await interaction.deferReply({ flags: 64 });

  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) return interaction.editReply({ content: '❌ That role no longer exists. Please contact an admin.' });

  if (interaction.member.roles.cache.has(roleId)) {
    return interaction.editReply({ content: `✅ You already have the **${role.name}** role.` });
  }

  const me = interaction.guild.members.me;
  if (!me || role.position >= me.roles.highest.position) {
    return interaction.editReply({
      content: '❌ I don\'t have permission to assign that role. An admin needs to move my role above it in Server Settings → Roles.',
    });
  }

  try {
    await interaction.member.roles.add(role, 'Accepted rules');
    return interaction.editReply({ content: `✅ You accepted the rules and received the **${role.name}** role!` });
  } catch {
    return interaction.editReply({ content: '❌ Failed to assign the role. Please contact an admin.' });
  }
}

module.exports = { handleButton, handleModal };

async function handleModal(interaction) {
  if (interaction.customId !== 'link_account_modal') return;
  await interaction.deferReply({ flags: 64 });
  const email   = interaction.fields.getTextInputValue('link_email').trim().toLowerCase();
  const result  = await performLinkAccount({
    guild:   interaction.guild,
    userId:  interaction.user.id,
    user:    interaction.user,
    email,
    guildId: interaction.guild.id,
  });
  if (!result.success) return interaction.editReply(result.errorMessage);
  return interaction.editReply({ embeds: [result.embed] });
}
