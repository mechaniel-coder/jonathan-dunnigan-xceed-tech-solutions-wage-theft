const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('billing')
    .setDescription('Send a billing notification to a user or channel (staff only)')
    .addSubcommand(s => s
      .setName('notify')
      .setDescription('Send a billing notification to a specific user')
      .addUserOption(o => o.setName('user').setDescription('User to notify').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Billing message').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Notification type').setRequired(false)
        .addChoices(
          { name: '🧾 Invoice Due',    value: 'invoice' },
          { name: '⚠️ Payment Overdue', value: 'overdue' },
          { name: '✅ Payment Received', value: 'received' },
          { name: '🔔 Service Renewal', value: 'renewal' },
          { name: '📢 General Notice',  value: 'general' },
        )
      )
    )
    .addSubcommand(s => s
      .setName('announce')
      .setDescription('Send a billing/service announcement to a channel')
      .addStringOption(o => o.setName('message').setDescription('Announcement message').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(false))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'notify') {
      const target  = interaction.options.getUser('user');
      const message = interaction.options.getString('message');
      const type    = interaction.options.getString('type') ?? 'general';

      const titles = {
        invoice:  '🧾 Invoice Due',
        overdue:  '⚠️ Payment Overdue',
        received: '✅ Payment Received',
        renewal:  '🔔 Service Renewal',
        general:  '📢 Billing Notice',
      };
      const colors = {
        invoice:  config.warnColor,
        overdue:  config.errorColor,
        received: config.successColor,
        renewal:  config.color,
        general:  config.color,
      };

      const embed = new EmbedBuilder()
        .setTitle(titles[type])
        .setDescription(message)
        .setColor(colors[type])
        .setFooter({ text: 'Skyhigh Hosting Billing', iconURL: interaction.guild.iconURL() ?? undefined })
        .setTimestamp();

      const sent = await target.send({ embeds: [embed] }).catch(() => null);
      await interaction.reply({
        content: sent
          ? `✅ Billing notification sent to ${target.tag}.`
          : `❌ Could not DM ${target.tag} — they may have DMs disabled.`,
        ephemeral: true,
      });
    }

    if (sub === 'announce') {
      const message = interaction.options.getString('message').replace(/\\n/g, '\n');
      const target  = interaction.options.getChannel('channel') ?? interaction.channel;

      const embed = new EmbedBuilder()
        .setTitle('🧾 Billing & Service Announcement')
        .setDescription(message)
        .setColor(config.warnColor)
        .setFooter({ text: 'Skyhigh Hosting Billing', iconURL: interaction.guild.iconURL() ?? undefined })
        .setTimestamp();

      await target.send({ embeds: [embed] });
      await interaction.reply({ content: `✅ Billing announcement sent to ${target}.`, ephemeral: true });
    }
  },
};
