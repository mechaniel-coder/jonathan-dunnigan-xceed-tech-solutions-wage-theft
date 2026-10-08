const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('onboarding')
    .setDescription('Configure the custom onboarding flow for new members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // /onboarding status
    .addSubcommand(s => s
      .setName('status')
      .setDescription('Show current onboarding configuration'))

    // /onboarding toggle
    .addSubcommand(s => s
      .setName('toggle')
      .setDescription('Enable or disable onboarding DMs')
      .addBooleanOption(o => o.setName('enabled').setDescription('Enable?').setRequired(true)))

    // /onboarding addstep
    .addSubcommand(s => s
      .setName('addstep')
      .setDescription('Add a step to the onboarding DM (sent in order to new members)')
      .addStringOption(o => o.setName('message').setDescription('Step message (supports {user}, {server})').setRequired(true)))

    // /onboarding removestep
    .addSubcommand(s => s
      .setName('removestep')
      .setDescription('Remove a step by its number')
      .addIntegerOption(o => o.setName('step').setDescription('Step number (from /onboarding status)').setMinValue(1).setRequired(true)))

    // /onboarding clearsteps
    .addSubcommand(s => s
      .setName('clearsteps')
      .setDescription('Remove all onboarding steps'))

    // /onboarding test
    .addSubcommand(s => s
      .setName('test')
      .setDescription('Preview the onboarding DM as it would be sent to you'))

    // /onboarding goodbyetoggle
    .addSubcommand(s => s
      .setName('goodbyetoggle')
      .setDescription('Enable or disable the goodbye message when members leave')
      .addBooleanOption(o => o.setName('enabled').setDescription('Enable goodbye messages?').setRequired(true)))

    // /onboarding goodbyechannel
    .addSubcommand(s => s
      .setName('goodbyechannel')
      .setDescription('Set the channel for goodbye messages')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to send goodbye messages in')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)))

    // /onboarding goodbyemessage
    .addSubcommand(s => s
      .setName('goodbyemessage')
      .setDescription('Set the goodbye message text (supports {username}, {server}, {membercount})')
      .addStringOption(o => o
        .setName('message')
        .setDescription('Goodbye message text')
        .setMaxLength(1000)
        .setRequired(true)))

    // /onboarding minage
    .addSubcommand(s => s
      .setName('minage')
      .setDescription('Kick accounts younger than X days (0 = disabled)')
      .addIntegerOption(o => o
        .setName('days')
        .setDescription('Minimum account age in days (0 to disable)')
        .setMinValue(0)
        .setMaxValue(365)
        .setRequired(true)))

    // /onboarding setpickerpanel
    .addSubcommand(s => s
      .setName('setpickerpanel')
      .setDescription('Set which role panel shows as the ephemeral role picker for new members')
      .addIntegerOption(o => o
        .setName('panel_id')
        .setDescription('Panel ID from /rolepanel list — use 0 to disable')
        .setMinValue(0)
        .setRequired(true))),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // Ensure row exists
    await db.query(
      'INSERT IGNORE INTO onboarding_config (guild_id, enabled, dm_on_join, steps) VALUES (?, 0, 1, \'[]\')',
      [guildId]
    );

    const [cfg] = await db.query('SELECT * FROM onboarding_config WHERE guild_id = ?', [guildId]);
    let steps = JSON.parse(cfg.steps || '[]');

    // ── status ────────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const goodbyeCh = cfg.goodbye_channel_id
        ? interaction.guild.channels.cache.get(cfg.goodbye_channel_id)
        : null;
      const embed = new EmbedBuilder()
        .setTitle('🎓 Onboarding Configuration')
        .addFields(
          { name: 'DM Onboarding', value: cfg.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'DM on Join',    value: cfg.dm_on_join ? '✅' : '❌',               inline: true },
          { name: 'Min Account Age', value: cfg.min_account_age_days > 0 ? `${cfg.min_account_age_days} day(s)` : 'Disabled', inline: true },
          { name: 'Goodbye Messages', value: cfg.goodbye_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Goodbye Channel',  value: goodbyeCh ? `<#${goodbyeCh.id}>` : 'Not set', inline: true },
          { name: 'Goodbye Message',  value: cfg.goodbye_message || '_Default_', inline: false },
          { name: 'Steps', value: steps.length ? steps.map((s, i) => `**${i+1}.** ${s}`).join('\n') : '_None configured_' }
        )
        .setFooter({ text: 'Supports {user} {username} {server} {membercount}' })
        .setColor(config.color)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── toggle ─────────────────────────────────────────────────────────────
    if (sub === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled') ? 1 : 0;
      await db.query('UPDATE onboarding_config SET enabled = ? WHERE guild_id = ?', [enabled, guildId]);
      return interaction.editReply(`🎓 Onboarding DMs are now **${enabled ? 'enabled' : 'disabled'}**.`);
    }

    // ── addstep ───────────────────────────────────────────────────────────────
    if (sub === 'addstep') {
      const message = interaction.options.getString('message');
      steps.push(message);
      await db.query('UPDATE onboarding_config SET steps = ? WHERE guild_id = ?', [JSON.stringify(steps), guildId]);
      return interaction.editReply(`✅ Step ${steps.length} added.`);
    }

    // ── removestep ─────────────────────────────────────────────────────────
    if (sub === 'removestep') {
      const idx = interaction.options.getInteger('step') - 1;
      if (idx < 0 || idx >= steps.length)
        return interaction.editReply(`❌ Step ${idx + 1} doesn't exist. You have ${steps.length} step(s).`);
      steps.splice(idx, 1);
      await db.query('UPDATE onboarding_config SET steps = ? WHERE guild_id = ?', [JSON.stringify(steps), guildId]);
      return interaction.editReply(`✅ Step removed. ${steps.length} step(s) remaining.`);
    }

    // ── clearsteps ─────────────────────────────────────────────────────────
    if (sub === 'clearsteps') {
      await db.query('UPDATE onboarding_config SET steps = \'[]\' WHERE guild_id = ?', [guildId]);
      return interaction.editReply('✅ All onboarding steps cleared.');
    }

    // ── test ──────────────────────────────────────────────────────────────
    if (sub === 'test') {
      if (!steps.length) return interaction.editReply('❌ No onboarding steps configured.');
      const guild = interaction.guild;
      const member = interaction.member;
      const vars = {
        '{user}':        interaction.user.toString(),
        '{username}':    interaction.user.username,
        '{server}':      guild.name,
        '{membercount}': guild.memberCount.toString(),
      };
      const rendered = steps.map((s, i) => {
        let msg = s;
        for (const [k, v] of Object.entries(vars)) msg = msg.replaceAll(k, v);
        return msg;
      });
      const embed = new EmbedBuilder()
        .setTitle(`🎓 Onboarding Preview — ${guild.name}`)
        .setDescription(rendered.join('\n\n'))
        .setColor(config.color)
        .setFooter({ text: 'This is a preview of what new members will receive' });
      return interaction.editReply({ embeds: [embed] });
    }

    // ── goodbyetoggle ─────────────────────────────────────────────────────
    if (sub === 'goodbyetoggle') {
      const enabled = interaction.options.getBoolean('enabled') ? 1 : 0;
      await db.query('UPDATE onboarding_config SET goodbye_enabled = ? WHERE guild_id = ?', [enabled, guildId]);
      return interaction.editReply(`👋 Goodbye messages are now **${enabled ? 'enabled' : 'disabled'}**.`);
    }

    // ── goodbyechannel ────────────────────────────────────────────────────
    if (sub === 'goodbyechannel') {
      const channel = interaction.options.getChannel('channel');
      await db.query('UPDATE onboarding_config SET goodbye_channel_id = ? WHERE guild_id = ?', [channel.id, guildId]);
      return interaction.editReply(`✅ Goodbye messages will be sent to ${channel}.`);
    }

    // ── goodbyemessage ────────────────────────────────────────────────────
    if (sub === 'goodbyemessage') {
      const message = interaction.options.getString('message');
      await db.query('UPDATE onboarding_config SET goodbye_message = ? WHERE guild_id = ?', [message, guildId]);
      return interaction.editReply('✅ Goodbye message updated.');
    }

    // ── minage ────────────────────────────────────────────────────────────
    if (sub === 'minage') {
      const days = interaction.options.getInteger('days');
      await db.query('UPDATE onboarding_config SET min_account_age_days = ? WHERE guild_id = ?', [days, guildId]);
      if (days === 0) return interaction.editReply('✅ Account age gate disabled.');
      return interaction.editReply(`✅ Accounts younger than **${days} day(s)** will be automatically kicked when joining.`);
    }

    // ── setpickerpanel ───────────────────────────────────────────────
    if (sub === 'setpickerpanel') {
      const panelId = interaction.options.getInteger('panel_id');
      if (panelId === 0) {
        await db.query(
          'UPDATE guild_settings SET role_picker_panel_id = NULL WHERE guild_id = ?',
          [guildId]
        );
        return interaction.editReply('✅ Role picker disabled for new member onboarding.');
      }
      const [panel] = await db.query(
        'SELECT id FROM role_panels WHERE id = ? AND guild_id = ?',
        [panelId, guildId]
      );
      if (!panel) return interaction.editReply(`❌ Panel #${panelId} not found in this server.`);
      await db.query(
        'INSERT INTO guild_settings (guild_id, role_picker_panel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE role_picker_panel_id = ?',
        [guildId, panelId, panelId]
      );
      return interaction.editReply(`✅ New members will see a **Pick Your Roles** button linked to panel #${panelId}.`);
    }
  },
};
