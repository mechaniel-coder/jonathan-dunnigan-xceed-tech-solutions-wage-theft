const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolereact')
    .setDescription('Create a self-assign role panel')
    .addSubcommand(s => s
      .setName('create')
      .setDescription('Create a role panel in a channel')
      .addStringOption(o => o.setName('title').setDescription('Panel title').setRequired(true))
      .addStringOption(o => o.setName('roles').setDescription('Role IDs, comma-separated (e.g. 111,222,333)').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Panel description').setRequired(false))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post in').setRequired(false))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      await interaction.deferReply({ flags: 64 });

      const title    = interaction.options.getString('title');
      const rolesRaw = interaction.options.getString('roles');
      const desc     = interaction.options.getString('description') ?? 'Click a button below to add or remove a role.';
      const target   = interaction.options.getChannel('channel') ?? interaction.channel;

      const roleIds = rolesRaw.split(',').map(r => r.trim()).filter(Boolean);
      const roles   = roleIds.map(id => interaction.guild.roles.cache.get(id)).filter(Boolean);

      if (!roles.length) {
        return interaction.editReply({ content: '❌ None of the provided role IDs were found in this server.' });
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`${desc}\n\n${roles.map(r => `• **${r.name}**`).join('\n')}`)
        .setColor(config.color)
        .setFooter({ text: 'Click a button to toggle a role' });

      // Build button rows (max 5 buttons per row, 5 rows = 25 max)
      const components = [];
      for (let i = 0; i < roles.length; i += 5) {
        const chunk = roles.slice(i, i + 5);
        const row   = new ActionRowBuilder().addComponents(
          chunk.map(role =>
            new ButtonBuilder()
              .setCustomId(`role_toggle_${role.id}`)
              .setLabel(role.name.slice(0, 80))
              .setStyle(ButtonStyle.Secondary)
          )
        );
        components.push(row);
        if (components.length >= 5) break;
      }

      const msg = await target.send({ embeds: [embed], components });

      await db.query(
        'INSERT INTO role_panels (guild_id, channel_id, message_id, title, description, roles) VALUES (?, ?, ?, ?, ?, ?)',
        [interaction.guild.id, target.id, msg.id, title, desc, JSON.stringify(roleIds)]
      );

      await interaction.editReply({ content: `✅ Role panel created in ${target}.` });
    }
  },
};
