const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monitor')
    .setDescription('Manage uptime monitoring for your servers')
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a URL to monitor')
      .addStringOption(o => o.setName('name').setDescription('Friendly name for this server').setRequired(true))
      .addStringOption(o => o.setName('url').setDescription('URL to monitor (include http/https)').setRequired(true))
      .addChannelOption(o => o.setName('alert_channel').setDescription('Channel to send alerts to').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Stop monitoring a URL')
      .addStringOption(o => o.setName('name').setDescription('Name of the monitor to remove').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all monitored URLs')
    )
    .addSubcommand(s => s
      .setName('alert')
      .setDescription('Set the alert channel for all monitors in this server')
      .addChannelOption(o => o.setName('channel').setDescription('Alert channel').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const name    = interaction.options.getString('name');
      const url     = interaction.options.getString('url');
      const channel = interaction.options.getChannel('alert_channel');

      if (!/^https?:\/\/.+/.test(url)) {
        return interaction.reply({ content: '❌ URL must start with `http://` or `https://`', flags: 64 });
      }

      await db.query(
        `INSERT INTO monitored_servers (guild_id, name, url, alert_channel_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), alert_channel_id = VALUES(alert_channel_id)`,
        [guildId, name, url, channel?.id ?? null]
      );

      await interaction.reply({
        content: `✅ Now monitoring **${name}**\n🔗 \`${url}\`${channel ? `\n🔔 Alerts → ${channel}` : ''}`,
        flags: 64,
      });
    }

    if (sub === 'remove') {
      const name   = interaction.options.getString('name');
      const result = await db.query(
        'DELETE FROM monitored_servers WHERE guild_id = ? AND name = ?',
        [guildId, name]
      );
      if (result.affectedRows === 0) {
        return interaction.reply({ content: `❌ No monitor named **${name}** found.`, flags: 64 });
      }
      await interaction.reply({ content: `✅ Removed monitor **${name}**.`, flags: 64 });
    }

    if (sub === 'list') {
      const rows = await db.query('SELECT * FROM monitored_servers WHERE guild_id = ?', [guildId]);
      if (!rows.length) {
        return interaction.reply({ content: '📭 No servers are being monitored. Use `/monitor add` to add one.', flags: 64 });
      }
      const embed = new EmbedBuilder()
        .setTitle('🖥️ Monitored Servers')
        .setColor(config.color)
        .setDescription(rows.map(r =>
          `**${r.name}**\n🔗 \`${r.url}\`\nStatus: ${r.last_status ? '✅ Online' : '🔴 Offline'}${r.alert_channel_id ? `\nAlerts: <#${r.alert_channel_id}>` : ''}`
        ).join('\n\n'))
        .setFooter({ text: `${rows.length} server(s) monitored` })
        .setTimestamp();
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (sub === 'alert') {
      const channel = interaction.options.getChannel('channel');
      await db.query(
        'UPDATE monitored_servers SET alert_channel_id = ? WHERE guild_id = ?',
        [channel.id, guildId]
      );
      await interaction.reply({ content: `✅ Alert channel updated to ${channel} for all monitors.`, flags: 64 });
    }
  },
};
