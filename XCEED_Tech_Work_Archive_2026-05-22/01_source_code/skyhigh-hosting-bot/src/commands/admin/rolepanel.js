const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const db               = require('../../database');
const config           = require('../../config');
const { postPanel }    = require('../../utils/rolePanelManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolepanel')
    .setDescription('Manage self-assignable role panels (interactive button menus)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

    // /rolepanel create
    .addSubcommand(s => s
      .setName('create')
      .setDescription('Create a new role panel and post it in a channel')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to post the panel in')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true))
      .addStringOption(o => o
        .setName('title')
        .setDescription('Title shown on the panel embed')
        .setMaxLength(256)
        .setRequired(true))
      .addStringOption(o => o
        .setName('description')
        .setDescription('Optional description text on the panel')
        .setMaxLength(1000)))

    // /rolepanel add
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a role button to an existing panel')
      .addIntegerOption(o => o
        .setName('panel_id')
        .setDescription('Panel ID (from /rolepanel list)')
        .setMinValue(1)
        .setRequired(true))
      .addRoleOption(o => o
        .setName('role')
        .setDescription('Role to assign/remove when clicked')
        .setRequired(true))
      .addStringOption(o => o
        .setName('label')
        .setDescription('Button label text')
        .setMaxLength(80)
        .setRequired(true))
      .addStringOption(o => o
        .setName('emoji')
        .setDescription('Button emoji (e.g. 🎮 or a custom emoji)'))
      .addStringOption(o => o
        .setName('style')
        .setDescription('Button colour')
        .addChoices(
          { name: '🔵 Blue (Primary)',   value: 'Primary'   },
          { name: '⚫ Grey (Secondary)', value: 'Secondary' },
          { name: '🟢 Green (Success)',  value: 'Success'   },
          { name: '🔴 Red (Danger)',     value: 'Danger'    },
        ))
      .addStringOption(o => o
        .setName('group')
        .setDescription('Exclusive group name — only ONE role from this group can be active at a time')))

    // /rolepanel remove
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a role button from a panel')
      .addIntegerOption(o => o
        .setName('panel_id')
        .setDescription('Panel ID')
        .setMinValue(1)
        .setRequired(true))
      .addRoleOption(o => o
        .setName('role')
        .setDescription('Role to remove from the panel')
        .setRequired(true)))

    // /rolepanel delete
    .addSubcommand(s => s
      .setName('delete')
      .setDescription('Delete an entire role panel and its Discord message')
      .addIntegerOption(o => o
        .setName('panel_id')
        .setDescription('Panel ID')
        .setMinValue(1)
        .setRequired(true)))

    // /rolepanel list
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all role panels in this server'))

    // /rolepanel refresh
    .addSubcommand(s => s
      .setName('refresh')
      .setDescription('Re-post a panel (use if the message was deleted)')
      .addIntegerOption(o => o
        .setName('panel_id')
        .setDescription('Panel ID')
        .setMinValue(1)
        .setRequired(true))),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── create ────────────────────────────────────────────────────────────────
    if (sub === 'create') {
      const channel     = interaction.options.getChannel('channel');
      const title       = interaction.options.getString('title');
      const description = interaction.options.getString('description') || null;

      const result = await db.query(
        'INSERT INTO role_panels (guild_id, channel_id, title, description) VALUES (?, ?, ?, ?)',
        [guildId, channel.id, title, description]
      );
      const panelId = result.insertId;

      // Post placeholder — no buttons yet
      const panel = { id: panelId, guild_id: guildId, channel_id: channel.id, title, description, message_id: null };
      await postPanel(client, panel, []);

      return interaction.editReply(
        `✅ Role panel **#${panelId}** created in ${channel}.\n` +
        `Use \`/rolepanel add ${panelId} @Role Label\` to add buttons.`
      );
    }

    // ── add ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const panelId = interaction.options.getInteger('panel_id');
      const role    = interaction.options.getRole('role');
      const label   = interaction.options.getString('label');
      const emoji   = interaction.options.getString('emoji')  || null;
      const style   = interaction.options.getString('style')  || 'Primary';
      const group   = interaction.options.getString('group')  || null;

      if (role.managed)
        return interaction.editReply('❌ Cannot use bot-managed roles.');
      if (role.id === interaction.guild.roles.everyone.id)
        return interaction.editReply('❌ Cannot use @everyone.');
      if (role.position >= interaction.guild.members.me.roles.highest.position)
        return interaction.editReply('❌ That role is above my highest role.');

      const [panel] = await db.query(
        'SELECT * FROM role_panels WHERE id = ? AND guild_id = ?',
        [panelId, guildId]
      );
      if (!panel) return interaction.editReply(`❌ Panel #${panelId} not found.`);

      const existing = await db.query('SELECT * FROM role_panel_buttons WHERE panel_id = ?', [panelId]);
      if (existing.length >= 25)
        return interaction.editReply('❌ A panel can have at most 25 buttons (5 rows × 5).');
      if (existing.find(b => b.role_id === role.id))
        return interaction.editReply(`❌ **${role.name}** is already on this panel.`);

      await db.query(
        'INSERT INTO role_panel_buttons (panel_id, role_id, label, emoji, style, exclusive_group) VALUES (?, ?, ?, ?, ?, ?)',
        [panelId, role.id, label, emoji, style, group]
      );

      const buttons = await db.query('SELECT * FROM role_panel_buttons WHERE panel_id = ?', [panelId]);
      await postPanel(client, panel, buttons);

      const groupNote = group ? ` (exclusive group: \`${group}\`)` : '';
      return interaction.editReply(`✅ Added **${role.name}** button to panel #${panelId}${groupNote}.`);
    }

    // ── remove ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const panelId = interaction.options.getInteger('panel_id');
      const role    = interaction.options.getRole('role');

      const [panel] = await db.query(
        'SELECT * FROM role_panels WHERE id = ? AND guild_id = ?',
        [panelId, guildId]
      );
      if (!panel) return interaction.editReply(`❌ Panel #${panelId} not found.`);

      const result = await db.query(
        'DELETE FROM role_panel_buttons WHERE panel_id = ? AND role_id = ?',
        [panelId, role.id]
      );
      if (!result.affectedRows)
        return interaction.editReply(`❌ **${role.name}** is not on panel #${panelId}.`);

      const buttons = await db.query('SELECT * FROM role_panel_buttons WHERE panel_id = ?', [panelId]);
      await postPanel(client, panel, buttons);

      return interaction.editReply(`✅ Removed **${role.name}** from panel #${panelId}.`);
    }

    // ── delete ────────────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const panelId = interaction.options.getInteger('panel_id');
      const [panel] = await db.query(
        'SELECT * FROM role_panels WHERE id = ? AND guild_id = ?',
        [panelId, guildId]
      );
      if (!panel) return interaction.editReply(`❌ Panel #${panelId} not found.`);

      // Try to delete the Discord message
      try {
        const ch = interaction.guild.channels.cache.get(panel.channel_id);
        if (ch && panel.message_id) {
          const msg = await ch.messages.fetch(panel.message_id).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }
      } catch {}

      await db.query('DELETE FROM role_panels WHERE id = ?', [panelId]);
      return interaction.editReply(`✅ Panel #${panelId} deleted.`);
    }

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const panels = await db.query(
        'SELECT * FROM role_panels WHERE guild_id = ? ORDER BY id ASC',
        [guildId]
      );
      if (!panels.length) return interaction.editReply('📋 No role panels configured.');

      const lines = await Promise.all(panels.map(async p => {
        const [cnt] = await db.query(
          'SELECT COUNT(*) AS c FROM role_panel_buttons WHERE panel_id = ?',
          [p.id]
        );
        const ch = interaction.guild.channels.cache.get(p.channel_id);
        return `**#${p.id}** — ${p.title} | ${cnt.c} button(s) | ${ch ? `<#${p.channel_id}>` : '⚠️ channel deleted'}`;
      }));

      const embed = new EmbedBuilder()
        .setTitle('🎛️ Role Panels')
        .setDescription(lines.join('\n'))
        .setColor(config.color)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── refresh ───────────────────────────────────────────────────────────────
    if (sub === 'refresh') {
      const panelId = interaction.options.getInteger('panel_id');
      const [panel] = await db.query(
        'SELECT * FROM role_panels WHERE id = ? AND guild_id = ?',
        [panelId, guildId]
      );
      if (!panel) return interaction.editReply(`❌ Panel #${panelId} not found.`);

      // Force re-post by clearing message_id so postPanel creates a new message
      panel.message_id = null;
      await db.query('UPDATE role_panels SET message_id = NULL WHERE id = ?', [panelId]);

      const buttons = await db.query('SELECT * FROM role_panel_buttons WHERE panel_id = ?', [panelId]);
      await postPanel(client, panel, buttons);

      return interaction.editReply(`✅ Panel #${panelId} re-posted.`);
    }
  },
};
