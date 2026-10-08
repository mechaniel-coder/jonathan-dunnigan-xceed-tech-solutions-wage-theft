const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { getLevelingConfig, upsertLevelingConfig } = require('../../utils/levelManager');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setleveling')
    .setDescription('Configure the XP leveling system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('enable')
      .setDescription('Enable leveling')
      .addChannelOption(o => o.setName('channel').setDescription('Channel for level-up announcements (optional)')))
    .addSubcommand(s => s
      .setName('disable')
      .setDescription('Disable leveling'))
    .addSubcommand(s => s
      .setName('xprange')
      .setDescription('Set XP gain range per message')
      .addIntegerOption(o => o.setName('min').setDescription('Minimum XP per message').setMinValue(1).setRequired(true))
      .addIntegerOption(o => o.setName('max').setDescription('Maximum XP per message').setMinValue(1).setRequired(true)))
    .addSubcommand(s => s
      .setName('cooldown')
      .setDescription('Set cooldown between XP gains')
      .addIntegerOption(o => o.setName('seconds').setDescription('Seconds between XP grants').setMinValue(0).setMaxValue(3600).setRequired(true)))
    .addSubcommand(s => s
      .setName('multiplier')
      .setDescription('Set XP multiplier (e.g. 1.5 = 50% bonus)')
      .addNumberOption(o => o.setName('value').setDescription('Multiplier value').setMinValue(0.1).setMaxValue(10).setRequired(true)))
    .addSubcommand(s => s
      .setName('status')
      .setDescription('View current leveling settings')),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'enable') {
      const ch = interaction.options.getChannel('channel');
      await upsertLevelingConfig(guildId, { enabled: true, level_up_channel_id: ch?.id ?? null });
      const msg = ch ? `Leveling enabled. Level-up announcements → ${ch}` : 'Leveling enabled.';
      return interaction.reply({ embeds: [ok(msg)] });
    }

    if (sub === 'disable') {
      await upsertLevelingConfig(guildId, { enabled: false });
      return interaction.reply({ embeds: [ok('Leveling disabled.')] });
    }

    if (sub === 'xprange') {
      const min = interaction.options.getInteger('min');
      const max = interaction.options.getInteger('max');
      if (min > max) return interaction.reply({ embeds: [err('Minimum must be less than maximum.')], ephemeral: true });
      await upsertLevelingConfig(guildId, { xp_min: min, xp_max: max });
      return interaction.reply({ embeds: [ok(`XP range set to **${min}–${max}** per message`)] });
    }

    if (sub === 'cooldown') {
      const secs = interaction.options.getInteger('seconds');
      await upsertLevelingConfig(guildId, { cooldown_seconds: secs });
      return interaction.reply({ embeds: [ok(`XP cooldown set to **${secs}s**`)] });
    }

    if (sub === 'multiplier') {
      const val = interaction.options.getNumber('value');
      await upsertLevelingConfig(guildId, { xp_multiplier: val });
      return interaction.reply({ embeds: [ok(`XP multiplier set to **${val}x**`)] });
    }

    if (sub === 'status') {
      const cfg = await getLevelingConfig(guildId);
      if (!cfg) return interaction.reply({ content: 'Leveling has not been configured yet. Use `/setleveling enable`.', ephemeral: true });

      const ch = cfg.level_up_channel_id ? `<#${cfg.level_up_channel_id}>` : 'Same channel as message';
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle('📈 Leveling Config')
        .addFields(
          { name: 'Status',      value: cfg.enabled ? '✅ Enabled' : '❌ Disabled',  inline: true },
          { name: 'XP Range',    value: `${cfg.xp_min}–${cfg.xp_max} per message`,   inline: true },
          { name: 'Cooldown',    value: `${cfg.cooldown_seconds}s`,                   inline: true },
          { name: 'Multiplier',  value: `${cfg.xp_multiplier}x`,                     inline: true },
          { name: 'Level-Up Ch', value: ch,                                           inline: true },
        );

      return interaction.reply({ embeds: [embed] });
    }
  },
};

function ok(text)  { return new EmbedBuilder().setColor(config.successColor).setDescription(`✅ ${text}`); }
function err(text) { return new EmbedBuilder().setColor(config.errorColor).setDescription(`❌ ${text}`); }
