const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Manage server channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)

    // ── create ──────────────────────────────────────────────────────────────
    .addSubcommandGroup(g => g
      .setName('create')
      .setDescription('Create a new channel')

      .addSubcommand(s => s
        .setName('text')
        .setDescription('Create a text channel')
        .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true))
        .addChannelOption(o => o.setName('category').setDescription('Parent category').addChannelTypes(ChannelType.GuildCategory))
        .addStringOption(o => o.setName('topic').setDescription('Channel topic'))
        .addIntegerOption(o => o.setName('slowmode').setDescription('Slowmode in seconds (0 = off)').setMinValue(0).setMaxValue(21600))
        .addBooleanOption(o => o.setName('nsfw').setDescription('Mark as NSFW')))

      .addSubcommand(s => s
        .setName('voice')
        .setDescription('Create a voice channel')
        .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true))
        .addChannelOption(o => o.setName('category').setDescription('Parent category').addChannelTypes(ChannelType.GuildCategory))
        .addIntegerOption(o => o.setName('bitrate').setDescription('Bitrate in kbps (8–384)').setMinValue(8).setMaxValue(384))
        .addIntegerOption(o => o.setName('userlimit').setDescription('Max users (0 = unlimited)').setMinValue(0).setMaxValue(99)))

      .addSubcommand(s => s
        .setName('category')
        .setDescription('Create a category')
        .addStringOption(o => o.setName('name').setDescription('Category name').setRequired(true)))

      .addSubcommand(s => s
        .setName('announcement')
        .setDescription('Create an announcement channel')
        .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true))
        .addChannelOption(o => o.setName('category').setDescription('Parent category').addChannelTypes(ChannelType.GuildCategory))
        .addStringOption(o => o.setName('topic').setDescription('Channel topic')))

      .addSubcommand(s => s
        .setName('forum')
        .setDescription('Create a forum channel')
        .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true))
        .addChannelOption(o => o.setName('category').setDescription('Parent category').addChannelTypes(ChannelType.GuildCategory))
        .addStringOption(o => o.setName('topic').setDescription('Channel topic')))

      .addSubcommand(s => s
        .setName('stage')
        .setDescription('Create a stage channel')
        .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true))
        .addChannelOption(o => o.setName('category').setDescription('Parent category').addChannelTypes(ChannelType.GuildCategory))
        .addIntegerOption(o => o.setName('bitrate').setDescription('Bitrate in kbps').setMinValue(8).setMaxValue(384))))

    // ── delete ───────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('delete')
      .setDescription('Delete a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to delete').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason')))

    // ── edit ─────────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('edit')
      .setDescription('Edit a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to edit').setRequired(true))
      .addStringOption(o => o.setName('name').setDescription('New name'))
      .addStringOption(o => o.setName('topic').setDescription('New topic (text/announcement/forum)'))
      .addIntegerOption(o => o.setName('slowmode').setDescription('Slowmode seconds (0 = off)').setMinValue(0).setMaxValue(21600))
      .addBooleanOption(o => o.setName('nsfw').setDescription('NSFW toggle')))

    // ── info ─────────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('info')
      .setDescription('Show info about a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))),

  async execute(interaction) {
    await interaction.deferReply();
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();
    const guild = interaction.guild;

    // ── create ──────────────────────────────────────────────────────────────
    if (group === 'create') {
      const name     = interaction.options.getString('name');
      const category = interaction.options.getChannel('category');
      const topic    = interaction.options.getString('topic');
      const nsfw     = interaction.options.getBoolean('nsfw') ?? false;
      const slowmode = interaction.options.getInteger('slowmode') ?? 0;
      const bitrate  = (interaction.options.getInteger('bitrate') ?? 64) * 1000;
      const limit    = interaction.options.getInteger('userlimit') ?? 0;

      const typeMap = {
        text:         ChannelType.GuildText,
        voice:        ChannelType.GuildVoice,
        category:     ChannelType.GuildCategory,
        announcement: ChannelType.GuildAnnouncement,
        forum:        ChannelType.GuildForum,
        stage:        ChannelType.GuildStageVoice,
      };

      const channelType = typeMap[sub];
      const opts = { name, type: channelType };
      if (category)  opts.parent    = category.id;
      if (topic)     opts.topic     = topic;
      if (nsfw)      opts.nsfw      = nsfw;
      if (slowmode)  opts.rateLimitPerUser = slowmode;

      if (sub === 'voice' || sub === 'stage') {
        opts.bitrate   = bitrate;
        opts.userLimit = limit;
      }

      const ch = await guild.channels.create(opts).catch(err => {
        interaction.editReply(`❌ Failed to create channel: ${err.message}`);
        return null;
      });
      if (!ch) return;

      const embed = new EmbedBuilder()
        .setTitle('✅ Channel Created')
        .addFields(
          { name: 'Name',     value: `${ch}`,          inline: true },
          { name: 'Type',     value: sub,              inline: true },
          { name: 'Category', value: category?.name ?? 'None', inline: true }
        )
        .setColor(config.color)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── delete ──────────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const ch     = interaction.options.getChannel('channel');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      await ch.delete(`${interaction.user.tag}: ${reason}`).catch(err => {
        return interaction.editReply(`❌ Could not delete: ${err.message}`);
      });
      return interaction.editReply(`✅ Channel **${ch.name}** deleted.`);
    }

    // ── edit ─────────────────────────────────────────────────────────────────
    if (sub === 'edit') {
      const ch       = interaction.options.getChannel('channel');
      const newName  = interaction.options.getString('name');
      const newTopic = interaction.options.getString('topic');
      const slow     = interaction.options.getInteger('slowmode');
      const isNsfw   = interaction.options.getBoolean('nsfw');

      const edits = {};
      if (newName  !== null) edits.name              = newName;
      if (newTopic !== null) edits.topic             = newTopic;
      if (slow     !== null) edits.rateLimitPerUser  = slow;
      if (isNsfw   !== null) edits.nsfw              = isNsfw;

      if (!Object.keys(edits).length)
        return interaction.editReply('❌ No changes specified.');

      await ch.edit(edits).catch(err => interaction.editReply(`❌ ${err.message}`));
      return interaction.editReply(`✅ Channel **${ch.name}** updated.`);
    }

    // ── info ─────────────────────────────────────────────────────────────────
    if (sub === 'info') {
      const ch = interaction.options.getChannel('channel');
      const typeNames = {
        [ChannelType.GuildText]:         'Text',
        [ChannelType.GuildVoice]:        'Voice',
        [ChannelType.GuildCategory]:     'Category',
        [ChannelType.GuildAnnouncement]: 'Announcement',
        [ChannelType.GuildForum]:        'Forum',
        [ChannelType.GuildStageVoice]:   'Stage',
        [ChannelType.GuildThread]:       'Thread',
        [ChannelType.PrivateThread]:     'Private Thread',
        [ChannelType.PublicThread]:      'Public Thread',
      };
      const embed = new EmbedBuilder()
        .setTitle(`#${ch.name} — Channel Info`)
        .addFields(
          { name: 'ID',        value: ch.id,                                       inline: true },
          { name: 'Type',      value: typeNames[ch.type] ?? `Type ${ch.type}`,    inline: true },
          { name: 'Category',  value: ch.parent?.name ?? 'None',                  inline: true },
          { name: 'NSFW',      value: ch.nsfw ? 'Yes' : 'No',                    inline: true },
          { name: 'Slowmode',  value: ch.rateLimitPerUser ? `${ch.rateLimitPerUser}s` : 'Off', inline: true },
          { name: 'Created',   value: `<t:${Math.floor(ch.createdTimestamp / 1000)}:R>`, inline: true },
        )
        .setColor(config.color)
        .setTimestamp();
      if (ch.topic) embed.setDescription(ch.topic);
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
