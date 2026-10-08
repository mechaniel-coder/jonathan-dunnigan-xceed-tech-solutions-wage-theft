const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure auto-moderation for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // /automod status
    .addSubcommand(s => s
      .setName('status')
      .setDescription('Show current auto-mod configuration'))

    // /automod toggle
    .addSubcommand(s => s
      .setName('toggle')
      .setDescription('Enable or disable auto-mod')
      .addBooleanOption(o => o.setName('enabled').setDescription('Enable auto-mod?').setRequired(true)))

    // /automod set — configure individual filters
    .addSubcommand(s => s
      .setName('set')
      .setDescription('Configure auto-mod filters')
      .addStringOption(o => o
        .setName('filter')
        .setDescription('Which filter to configure')
        .setRequired(true)
        .addChoices(
          { name: 'spam',     value: 'spam'     },
          { name: 'caps',     value: 'caps'     },
          { name: 'links',    value: 'links'    },
          { name: 'invites',  value: 'invites'  },
          { name: 'badwords', value: 'badwords' },
          { name: 'mentions', value: 'mentions' },
        ))
      .addBooleanOption(o => o.setName('enabled').setDescription('Enable this filter?').setRequired(true))
      .addIntegerOption(o => o.setName('value').setDescription('spam=msg threshold | caps=% (1-100) | mentions=max mentions')))

    // /automod action — set punishment
    .addSubcommand(s => s
      .setName('action')
      .setDescription('Set what happens when a violation is detected')
      .addStringOption(o => o
        .setName('action')
        .setDescription('Action to take')
        .setRequired(true)
        .addChoices(
          { name: 'delete only',     value: 'delete'  },
          { name: 'delete + warn',   value: 'warn'    },
          { name: 'delete + timeout', value: 'timeout' },
          { name: 'delete + kick',   value: 'kick'    },
          { name: 'delete + ban',    value: 'ban'     },
        ))
      .addIntegerOption(o => o.setName('timeout_minutes').setDescription('Timeout duration in minutes (timeout action only)').setMinValue(1).setMaxValue(40320)))

    // /automod badword
    .addSubcommand(s => s
      .setName('badword')
      .setDescription('Add or remove a word from the bad words list')
      .addStringOption(o => o
        .setName('action')
        .setDescription('Add or remove?')
        .setRequired(true)
        .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }, { name: 'list', value: 'list' }))
      .addStringOption(o => o.setName('word').setDescription('The word (required for add/remove)')))

    // /automod logchannel
    .addSubcommand(s => s
      .setName('logchannel')
      .setDescription('Set the channel where auto-mod violations are logged')
      .addChannelOption(o => o.setName('channel').setDescription('Log channel (leave blank to disable)')))
  ,

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // Ensure row exists
    await db.query(
      'INSERT IGNORE INTO automod_config (guild_id) VALUES (?)',
      [guildId]
    );

    // ── status ───────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const [cfg] = await db.query('SELECT * FROM automod_config WHERE guild_id = ?', [guildId]);
      const bwRows = await db.query('SELECT word FROM automod_badwords WHERE guild_id = ?', [guildId]);
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Auto-Mod Configuration')
        .addFields(
          { name: 'Enabled',        value: cfg.enabled        ? '✅' : '❌', inline: true },
          { name: 'Spam Filter',    value: cfg.spam_enabled   ? `✅ (${cfg.spam_threshold} msgs / ${cfg.spam_window_ms}ms)` : '❌', inline: true },
          { name: 'Caps Filter',    value: cfg.caps_enabled   ? `✅ (${cfg.caps_percent}%, min ${cfg.caps_min_length} chars)` : '❌', inline: true },
          { name: 'Link Filter',    value: cfg.links_enabled  ? '✅' : '❌', inline: true },
          { name: 'Invite Filter',  value: cfg.invites_enabled ? '✅' : '❌', inline: true },
          { name: 'Bad Words',      value: cfg.badwords_enabled ? `✅ (${bwRows.length} words)` : '❌', inline: true },
          { name: 'Mass Mentions',  value: cfg.mentions_enabled ? `✅ (max ${cfg.mentions_limit})` : '❌', inline: true },
          { name: 'Action',         value: cfg.action, inline: true },
          { name: 'Log Channel',    value: cfg.log_channel ? `<#${cfg.log_channel}>` : 'None', inline: true },
        )
        .setColor(config.color)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── toggle ───────────────────────────────────────────────────────────────
    if (sub === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled') ? 1 : 0;
      await db.query('UPDATE automod_config SET enabled = ? WHERE guild_id = ?', [enabled, guildId]);
      return interaction.editReply(`🛡️ Auto-mod is now **${enabled ? 'enabled' : 'disabled'}**.`);
    }

    // ── set ───────────────────────────────────────────────────────────────────
    if (sub === 'set') {
      const filter  = interaction.options.getString('filter');
      const enabled = interaction.options.getBoolean('enabled') ? 1 : 0;
      const value   = interaction.options.getInteger('value');

      const colMap = {
        spam:     { flag: 'spam_enabled',     val: 'spam_threshold'  },
        caps:     { flag: 'caps_enabled',     val: 'caps_percent'    },
        links:    { flag: 'links_enabled',    val: null              },
        invites:  { flag: 'invites_enabled',  val: null              },
        badwords: { flag: 'badwords_enabled', val: null              },
        mentions: { flag: 'mentions_enabled', val: 'mentions_limit'  },
      };

      const { flag, val } = colMap[filter];
      let sql = `UPDATE automod_config SET ${flag} = ?`;
      const params = [enabled];
      if (val && value !== null) { sql += `, ${val} = ?`; params.push(value); }
      sql += ' WHERE guild_id = ?';
      params.push(guildId);

      await db.query(sql, params);
      return interaction.editReply(`✅ **${filter}** filter is now **${enabled ? 'on' : 'off'}**${value !== null ? ` (value: ${value})` : ''}.`);
    }

    // ── action ────────────────────────────────────────────────────────────────
    if (sub === 'action') {
      const action  = interaction.options.getString('action');
      const minutes = interaction.options.getInteger('timeout_minutes');
      const params  = [action];
      let sql = 'UPDATE automod_config SET action = ?';
      if (action === 'timeout' && minutes) { sql += ', timeout_duration = ?'; params.push(minutes * 60000); }
      sql += ' WHERE guild_id = ?';
      params.push(guildId);
      await db.query(sql, params);
      return interaction.editReply(`✅ Auto-mod action set to **${action}**.`);
    }

    // ── badword ───────────────────────────────────────────────────────────────
    if (sub === 'badword') {
      const action = interaction.options.getString('action');
      const word   = interaction.options.getString('word')?.toLowerCase().trim();

      if (action === 'list') {
        const rows = await db.query('SELECT word FROM automod_badwords WHERE guild_id = ?', [guildId]);
        return interaction.editReply(
          rows.length
            ? `📋 Bad words (${rows.length}): ||${rows.map(r => r.word).join(', ')}||`
            : '📋 No bad words configured.'
        );
      }

      if (!word) return interaction.editReply('❌ Provide a word with add/remove.');

      if (action === 'add') {
        await db.query(
          'INSERT IGNORE INTO automod_badwords (guild_id, word) VALUES (?, ?)',
          [guildId, word]
        );
        return interaction.editReply(`✅ Added **||${word}||** to the bad words list.`);
      }

      if (action === 'remove') {
        await db.query(
          'DELETE FROM automod_badwords WHERE guild_id = ? AND word = ?',
          [guildId, word]
        );
        return interaction.editReply(`✅ Removed **||${word}||** from the list.`);
      }
    }

    // ── logchannel ─────────────────────────────────────────────────────────
    if (sub === 'logchannel') {
      const ch = interaction.options.getChannel('channel');
      await db.query(
        'UPDATE automod_config SET log_channel = ? WHERE guild_id = ?',
        [ch?.id ?? null, guildId]
      );
      return interaction.editReply(ch ? `✅ Auto-mod logs → ${ch}` : '✅ Auto-mod log channel cleared.');
    }
  },
};
