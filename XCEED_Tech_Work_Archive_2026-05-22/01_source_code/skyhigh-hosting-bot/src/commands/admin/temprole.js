const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

/** Parse duration strings like 10m, 2h, 7d, 2w into milliseconds. */
function parseDuration(str) {
  const match = str.match(/^(\d+)\s*(s|m|h|d|w)$/i);
  if (!match) return null;
  const n    = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const ms   = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  const val  = n * ms[unit];
  if (val > 86_400_000 * 365) return null; // max 1 year
  return val;
}

function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('temprole')
    .setDescription('Assign a role to a member for a limited time')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

    .addSubcommand(s => s
      .setName('add')
      .setDescription('Give a member a temporary role')
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true))
      .addStringOption(o => o
        .setName('duration')
        .setDescription('How long to keep the role (e.g. 10m, 2h, 7d, 2w)')
        .setRequired(true)))

    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a temporary role from a member early')
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))

    .addSubcommand(s => s
      .setName('list')
      .setDescription('List active temporary role assignments')
      .addUserOption(o => o.setName('user').setDescription('Filter by member (shows all if omitted)'))),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── add ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const user   = interaction.options.getUser('user');
      const role   = interaction.options.getRole('role');
      const durStr = interaction.options.getString('duration');

      const durMs = parseDuration(durStr);
      if (!durMs)
        return interaction.editReply('❌ Invalid duration. Use formats like `10m`, `2h`, `7d`, `2w`.');

      if (role.managed)
        return interaction.editReply('❌ Cannot assign bot-managed roles.');
      if (role.id === interaction.guild.roles.everyone.id)
        return interaction.editReply('❌ Cannot assign @everyone.');
      if (role.position >= interaction.guild.members.me.roles.highest.position)
        return interaction.editReply('❌ That role is above my highest role. Move my role higher first.');

      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.editReply('❌ Member not found in this server.');

      const expiresAt = Date.now() + durMs;
      await member.roles.add(role, `Temp role by ${interaction.user.tag} (${fmtDuration(durMs)})`);
      await db.query(
        `INSERT INTO temp_roles (guild_id, user_id, role_id, expires_at) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)`,
        [guildId, user.id, role.id, expiresAt]
      );

      return interaction.editReply(
        `✅ Gave ${member} the **${role.name}** role for **${fmtDuration(durMs)}** ` +
        `(expires <t:${Math.floor(expiresAt / 1000)}:R>).`
      );
    }

    // ── remove ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');

      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.editReply('❌ Member not found.');

      await member.roles.remove(role, `Temp role removed early by ${interaction.user.tag}`).catch(() => {});
      await db.query(
        'DELETE FROM temp_roles WHERE guild_id = ? AND user_id = ? AND role_id = ?',
        [guildId, user.id, role.id]
      );
      return interaction.editReply(`✅ Removed **${role.name}** temp role from ${member}.`);
    }

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const user = interaction.options.getUser('user');
      const rows = user
        ? await db.query(
            'SELECT * FROM temp_roles WHERE guild_id = ? AND user_id = ? ORDER BY expires_at ASC',
            [guildId, user.id]
          )
        : await db.query(
            'SELECT * FROM temp_roles WHERE guild_id = ? ORDER BY expires_at ASC',
            [guildId]
          );

      if (!rows.length) return interaction.editReply('📋 No active temp roles.');

      const lines = rows.map(r =>
        `<@${r.user_id}> → <@&${r.role_id}> — expires <t:${Math.floor(r.expires_at / 1000)}:R>`
      );
      const embed = new EmbedBuilder()
        .setTitle('⏳ Active Temp Roles')
        .setDescription(lines.join('\n'))
        .setColor(config.color)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
