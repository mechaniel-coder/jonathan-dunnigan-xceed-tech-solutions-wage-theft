const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verification')
    .setDescription('Set up member verification for this server')
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('Post a verification panel and configure the verified role')
      .addRoleOption(o => o.setName('role').setDescription('Role to assign when verified').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post the panel in (default: current)').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('setrole')
      .setDescription('Update the verified role without reposting the panel')
      .addRoleOption(o => o.setName('role').setDescription('New verified role').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'setrole') {
      const role = interaction.options.getRole('role');
      await db.query(
        'INSERT INTO guild_settings (guild_id, verified_role) VALUES (?, ?) ON DUPLICATE KEY UPDATE verified_role = ?',
        [guildId, role.id, role.id]
      );
      return interaction.reply({ content: `✅ Verified role updated to **${role.name}**.`, ephemeral: true });
    }

    if (sub === 'setup') {
      const role    = interaction.options.getRole('role');
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;

      await db.query(
        'INSERT INTO guild_settings (guild_id, verified_role) VALUES (?, ?) ON DUPLICATE KEY UPDATE verified_role = ?',
        [guildId, role.id, role.id]
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Welcome to Skyhigh Hosting!')
        .setDescription(
          'To gain access to the server, click the **Verify Me** button below.\n\n' +
          'By verifying, you agree to follow our server rules.'
        )
        .setColor(config.color)
        .setThumbnail(interaction.guild.iconURL() ?? undefined)
        .setFooter({ text: 'Skyhigh Hosting' });

      const button = new ButtonBuilder()
        .setCustomId('verify_member')
        .setLabel('Verify Me')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

      const row = new ActionRowBuilder().addComponents(button);

      await channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ Verification panel posted in ${channel}. Verified role: **${role.name}**.`, ephemeral: true });
    }
  },
};
