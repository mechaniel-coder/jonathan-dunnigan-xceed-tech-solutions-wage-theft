const { ticketOpen, ticketClose, ticketConfirmClose } = require('./ticketManager');
const { enterGiveaway } = require('./giveawayManager');
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
      return interaction.reply({ content: '⏳ This giveaway is still being set up. Try again in a moment!', ephemeral: true });
    }
    return enterGiveaway(interaction, client, messageId);
  }

  // ── Self-assign roles ────────────────────────────────────────────────────
  if (customId.startsWith('role_toggle_')) {
    const roleId = customId.replace('role_toggle_', '');
    return handleRoleToggle(interaction, roleId);
  }

  // ── Member verification ──────────────────────────────────────────────────
  if (customId === 'verify_member') {
    return handleVerify(interaction);
  }
}

async function handleRoleToggle(interaction, roleId) {
  await interaction.deferReply({ ephemeral: true });
  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) return interaction.editReply({ content: '❌ That role no longer exists.' });

  const member = interaction.member;
  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(role);
    return interaction.editReply({ content: `✅ Removed the **${role.name}** role.` });
  } else {
    await member.roles.add(role);
    return interaction.editReply({ content: `✅ Added the **${role.name}** role.` });
  }
}

async function handleVerify(interaction) {
  await interaction.deferReply({ ephemeral: true });

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

  await interaction.member.roles.add(role);
  return interaction.editReply({ content: `✅ You've been verified and received the **${role.name}** role. Welcome!` });
}

module.exports = { handleButton };
