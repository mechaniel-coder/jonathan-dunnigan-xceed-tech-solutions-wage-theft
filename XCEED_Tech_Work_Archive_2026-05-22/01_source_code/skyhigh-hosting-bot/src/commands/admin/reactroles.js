'use strict';
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

// Convert user-provided emoji string to storage format:
//   Unicode <input>        → kept as-is (e.g. "🎮")
//   Custom  <:name:id>     → "name:id"
function toStored(input) {
  const m = input.trim().match(/^<a?:(\w+):(\d+)>$/);
  return m ? `${m[1]}:${m[2]}` : input.trim();
}

// Convert stored emoji key to a Discord display string
function toDisplay(stored) {
  const parts = stored.split(':');
  return parts.length === 2 && /^\d+$/.test(parts[1])
    ? `<:${parts[0]}:${parts[1]}>`
    : stored;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactroles')
    .setDescription('Manage emoji reaction role messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

    // /reactroles setup
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('Create a reaction roles message in a channel')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to post in')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true))
      .addStringOption(o => o
        .setName('title')
        .setDescription('Embed title')
        .setMaxLength(256)
        .setRequired(true))
      .addStringOption(o => o
        .setName('description')
        .setDescription('Intro text shown above the role list')
        .setMaxLength(500)))

    // /reactroles add
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add an emoji → role mapping')
      .addStringOption(o => o
        .setName('message_id')
        .setDescription('Message ID (from /reactroles list)')
        .setRequired(true))
      .addStringOption(o => o
        .setName('emoji')
        .setDescription('Emoji to react with (e.g. 🎮 or <:custom:id>)')
        .setRequired(true))
      .addRoleOption(o => o
        .setName('role')
        .setDescription('Role to grant/remove on reaction')
        .setRequired(true)))

    // /reactroles remove
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove an emoji mapping from a reaction roles message')
      .addStringOption(o => o
        .setName('message_id')
        .setDescription('Message ID')
        .setRequired(true))
      .addStringOption(o => o
        .setName('emoji')
        .setDescription('Emoji to remove')
        .setRequired(true)))

    // /reactroles list
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all reaction role messages in this server'))

    // /reactroles delete
    .addSubcommand(s => s
      .setName('delete')
      .setDescription('Delete a reaction roles message from the channel and DB')
      .addStringOption(o => o
        .setName('message_id')
        .setDescription('Message ID to delete')
        .setRequired(true))),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── setup ─────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const title   = interaction.options.getString('title');
      const desc    = interaction.options.getString('description') || 'React below to assign yourself a role.';

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`${desc}\n\n*No roles added yet — use \`/reactroles add\` to add some.*`)
        .setColor(config.color)
        .setFooter({ text: 'React to toggle a role' })
        .setTimestamp();

      const msg = await channel.send({ embeds: [embed] });

      await db.query(
        'INSERT INTO reaction_role_messages (guild_id, channel_id, message_id, title, description) VALUES (?, ?, ?, ?, ?)',
        [guildId, channel.id, msg.id, title, desc]
      );

      return interaction.editReply(
        `✅ Reaction roles message created in ${channel}.\n` +
        `Message ID: \`${msg.id}\`\n` +
        `Use \`/reactroles add ${msg.id} 🎮 @Role\` to add mappings.`
      );
    }

    // ── add ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const messageId = interaction.options.getString('message_id').trim();
      const emojiRaw  = interaction.options.getString('emoji');
      const role      = interaction.options.getRole('role');
      const stored    = toStored(emojiRaw);

      const [rrm] = await db.query(
        'SELECT * FROM reaction_role_messages WHERE message_id = ? AND guild_id = ?',
        [messageId, guildId]
      );
      if (!rrm) return interaction.editReply('❌ Reaction roles message not found in this server.');

      const existing = await db.query(
        'SELECT id FROM reaction_role_entries WHERE message_id = ? AND emoji = ?',
        [messageId, stored]
      );
      if (existing.length) return interaction.editReply('❌ That emoji is already mapped on this message.');

      await db.query(
        'INSERT INTO reaction_role_entries (message_id, emoji, role_id) VALUES (?, ?, ?)',
        [messageId, stored, role.id]
      );

      // Update embed + react to the message
      await refreshEmbed(interaction.client, rrm);
      try {
        const ch  = interaction.guild.channels.cache.get(rrm.channel_id);
        const msg = ch && await ch.messages.fetch(messageId).catch(() => null);
        if (msg) await msg.react(stored).catch(() => {});
      } catch {}

      return interaction.editReply(`✅ Mapped ${toDisplay(stored)} → **${role.name}**.`);
    }

    // ── remove ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const messageId = interaction.options.getString('message_id').trim();
      const emojiRaw  = interaction.options.getString('emoji');
      const stored    = toStored(emojiRaw);

      const [rrm] = await db.query(
        'SELECT * FROM reaction_role_messages WHERE message_id = ? AND guild_id = ?',
        [messageId, guildId]
      );
      if (!rrm) return interaction.editReply('❌ Reaction roles message not found.');

      const res = await db.query(
        'DELETE FROM reaction_role_entries WHERE message_id = ? AND emoji = ?',
        [messageId, stored]
      );
      if (!res.affectedRows) return interaction.editReply('❌ That emoji mapping was not found.');

      await refreshEmbed(interaction.client, rrm);
      return interaction.editReply(`✅ Removed ${toDisplay(stored)} mapping.`);
    }

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const messages = await db.query(
        'SELECT * FROM reaction_role_messages WHERE guild_id = ? ORDER BY id ASC',
        [guildId]
      );
      if (!messages.length)
        return interaction.editReply('No reaction role messages yet. Use `/reactroles setup` to create one.');

      const lines = [];
      for (const rrm of messages) {
        const entries = await db.query(
          'SELECT emoji, role_id FROM reaction_role_entries WHERE message_id = ? ORDER BY id ASC',
          [rrm.message_id]
        );
        const pairs = entries.length
          ? entries.map(e => `${toDisplay(e.emoji)} <@&${e.role_id}>`).join('  ')
          : '*no roles yet*';
        lines.push(`**${rrm.title}** · \`${rrm.message_id}\` · <#${rrm.channel_id}>\n${pairs}`);
      }
      return interaction.editReply(lines.join('\n\n'));
    }

    // ── delete ────────────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const messageId = interaction.options.getString('message_id').trim();
      const [rrm] = await db.query(
        'SELECT * FROM reaction_role_messages WHERE message_id = ? AND guild_id = ?',
        [messageId, guildId]
      );
      if (!rrm) return interaction.editReply('❌ Not found.');

      try {
        const ch  = interaction.guild.channels.cache.get(rrm.channel_id);
        const msg = ch && await ch.messages.fetch(messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      } catch {}

      await db.query('DELETE FROM reaction_role_messages WHERE message_id = ?', [messageId]);
      return interaction.editReply('✅ Reaction roles message deleted.');
    }
  },
};

// ── Helper: rebuild the embed on the reaction roles message ──────────────────
async function refreshEmbed(client, rrm) {
  try {
    const entries = await db.query(
      'SELECT emoji, role_id FROM reaction_role_entries WHERE message_id = ? ORDER BY id ASC',
      [rrm.message_id]
    );

    const guild = client.guilds.cache.get(rrm.guild_id);
    if (!guild) return;
    const ch  = guild.channels.cache.get(rrm.channel_id);
    if (!ch) return;
    const msg = await ch.messages.fetch(rrm.message_id).catch(() => null);
    if (!msg) return;

    const lines = entries.map(e => {
      const display  = toDisplay(e.emoji);
      const roleName = guild.roles.cache.get(e.role_id)?.name ?? `<@&${e.role_id}>`;
      return `${display}  **${roleName}**`;
    });

    const baseDesc = rrm.description || 'React below to assign yourself a role.';
    const body     = lines.length
      ? lines.join('\n')
      : '*No roles added yet — use `/reactroles add` to add some.*';

    const embed = msg.embeds[0]
      ? EmbedBuilder.from(msg.embeds[0]).setDescription(`${baseDesc}\n\n${body}`)
      : new EmbedBuilder()
          .setTitle(rrm.title)
          .setDescription(`${baseDesc}\n\n${body}`)
          .setColor(config.color)
          .setFooter({ text: 'React to toggle a role' });

    await msg.edit({ embeds: [embed] });
  } catch (_) {}
}
