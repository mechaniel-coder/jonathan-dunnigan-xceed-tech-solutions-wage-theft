const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verification gate — require members to click a button before getting access')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // /verify setup
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('Post a rules + Accept button panel in a channel')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to post the panel in')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
)

    // /verify setrole
    .addSubcommand(s => s
      .setName('setrole')
      .setDescription('Set the role members receive after verifying')
      .addRoleOption(o => o
        .setName('role')
        .setDescription('The "Verified" / "Member" role to assign')
        .setRequired(true)))

    // /verify status
    .addSubcommand(s => s
      .setName('status')
      .setDescription('Show current verification configuration'))

    // /verify rules
    .addSubcommand(s => s
      .setName('rules')
      .setDescription('Post a rules embed in a channel — optionally with an Accept button')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to post the rules in')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addRoleOption(o => o
        .setName('role')
        .setDescription('Role to assign when someone clicks Accept (omit for rules-only, no button)'))),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── setrole ───────────────────────────────────────────────────────────────
    if (sub === 'setrole') {
      const role = interaction.options.getRole('role');
      if (role.managed)
        return interaction.editReply('❌ Cannot use bot-managed roles.');
      if (role.id === interaction.guild.roles.everyone.id)
        return interaction.editReply('❌ Cannot use @everyone.');
      if (role.position >= interaction.guild.members.me.roles.highest.position)
        return interaction.editReply('❌ That role is above my highest role.');

      await db.query(
        `INSERT INTO guild_settings (guild_id, verified_role) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE verified_role = VALUES(verified_role)`,
        [guildId, role.id]
      );
      return interaction.editReply(`✅ Verified role set to **${role.name}**. Now run \`/verify setup #channel\` to post the button.`);
    }

    // ── setup ─────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');

      const [settings] = await db.query(
        'SELECT verified_role FROM guild_settings WHERE guild_id = ?',
        [guildId]
      );
      if (!settings?.verified_role)
        return interaction.editReply('❌ No verified role set. Run `/verify setrole @Role` first.');

      const defaultRules =
        '1. No discrimination or harassment.\n' +
        '2. No hate speech, threats, or bullying.\n' +
        '3. No spamming (messages, pings, links, or ads).\n' +
        '4. No scams, token grabbers, IP loggers, or malicious files/links.\n' +
        '5. Keep drama/arguments out of public channels.\n' +
        '6. No NSFW content.\n' +
        '7. Do not impersonate staff or other users.\n' +
        '8. Use the correct channels (support in #create-ticket, partnerships in #create-ticket / #partner-info).\n' +
        '9. Follow Discord Terms of Service and Community Guidelines.\n' +
        '10. Staff decisions are final. If you think something was unfair, make a ticket.';

      const rulesText = defaultRules;

      const embed = new EmbedBuilder()
        .setTitle('Rules')
        .setDescription(`${rulesText}\n\nClick **Accept** to access the server.`)
        .setColor(config.color);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verify_member')
          .setLabel('Accept')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ embeds: [embed], components: [row] });
      return interaction.editReply(`✅ Rules panel posted in ${channel}. Old bot message can now be deleted.`);
    }

    // ── status ────────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const [settings] = await db.query(
        'SELECT verified_role FROM guild_settings WHERE guild_id = ?',
        [guildId]
      );
      const roleId = settings?.verified_role;
      const role   = roleId ? interaction.guild.roles.cache.get(roleId) : null;

      const embed = new EmbedBuilder()
        .setTitle('✅ Verification Status')
        .addFields(
          { name: 'Verified Role', value: role ? `<@&${roleId}>` : '❌ Not configured', inline: true }
        )
        .setColor(config.color)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── rules ─────────────────────────────────────────────────────────────────
    if (sub === 'rules') {
      const channel = interaction.options.getChannel('channel');
      let   role    = interaction.options.getRole('role');

      // If no role option provided, fall back to the saved default in guild_settings
      if (!role) {
        const [saved] = await db.query(
          'SELECT rules_accept_role FROM guild_settings WHERE guild_id = ?',
          [guildId]
        );
        const savedId = saved?.rules_accept_role;
        if (savedId) role = interaction.guild.roles.cache.get(savedId) ?? null;
      }

      if (role) {
        if (role.managed)
          return interaction.editReply('❌ Cannot use bot-managed roles.');
        if (role.id === interaction.guild.roles.everyone.id)
          return interaction.editReply('❌ Cannot use @everyone.');
        const me = interaction.guild.members.me;
        if (me && role.position >= me.roles.highest.position)
          return interaction.editReply('❌ That role is above my highest role. Move the bot role above it in Server Settings → Roles.');
      }

      const defaultRules =
        '1. No discrimination or harassment.\n' +
        '2. No hate speech, threats, or bullying.\n' +
        '3. No spamming (messages, pings, links, or ads).\n' +
        '4. No scams, token grabbers, IP loggers, or malicious files/links.\n' +
        '5. Keep drama/arguments out of public channels.\n' +
        '6. No NSFW content.\n' +
        '7. Do not impersonate staff or other users.\n' +
        '8. Use the correct channels (support in #create-ticket, partnerships in #create-ticket / #partner-info).\n' +
        '9. Follow Discord Terms of Service and Community Guidelines.\n' +
        '10. Staff decisions are final. If you think something was unfair, make a ticket.';

      const rulesText = defaultRules;
      const footer    = role ? `Click Accept to receive the ${role.name} role.` : null;

      const embed = new EmbedBuilder()
        .setTitle('Rules')
        .setDescription(rulesText)
        .setColor(config.color);
      if (footer) embed.setFooter({ text: footer });

      const components = [];
      if (role) {
        components.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`rules_accept_${role.id}`)
            .setLabel('Accept')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
        ));
      }

      await channel.send({ embeds: [embed], components });

      // Persist as the default rules accept role so the dashboard reflects it
      if (role) {
        await db.query(
          `INSERT INTO guild_settings (guild_id, rules_accept_role) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE rules_accept_role = VALUES(rules_accept_role)`,
          [guildId, role.id]
        );
      }

      return interaction.editReply(
        role
          ? `✅ Rules panel with Accept button posted in ${channel}. Role: **${role.name}**.`
          : `✅ Rules posted in ${channel}.`
      );
    }
  },
};
