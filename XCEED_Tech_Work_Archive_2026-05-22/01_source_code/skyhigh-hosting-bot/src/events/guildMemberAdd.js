const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db               = require('../database');
const config           = require('../config');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const { guild } = member;

    // ── Account age gate ──────────────────────────────────────────────────────
    const [onboardingCfg] = await db.query(
      'SELECT * FROM onboarding_config WHERE guild_id = ?',
      [guild.id]
    ).catch(() => []);

    if (onboardingCfg?.min_account_age_days > 0) {
      const ageMs      = Date.now() - member.user.createdTimestamp;
      const ageDays    = ageMs / 86_400_000;
      const minDays    = onboardingCfg.min_account_age_days;

      if (ageDays < minDays) {
        await member.user.send(
          `❌ Your account is too new to join **${guild.name}**.\n` +
          `Accounts must be at least **${minDays} day(s)** old. ` +
          `Your account is **${Math.floor(ageDays)} day(s)** old.\n\n` +
          `Please try again later.`
        ).catch(() => {});
        await member.kick(`Account too new (${Math.floor(ageDays)}d < ${minDays}d minimum)`).catch(() => {});
        return; // stop all further processing
      }
    }

    // ── Welcome message ───────────────────────────────────────────────────────
    const rows = await db.query(
      'SELECT welcome_channel, welcome_message, role_picker_panel_id FROM guild_settings WHERE guild_id = ?',
      [guild.id]
    ).catch(() => []);

    const settings = rows[0];
    if (settings?.welcome_channel) {
      const channel = guild.channels.cache.get(settings.welcome_channel);
      if (channel) {
        const defaultMsg = `Welcome to **${guild.name}**, ${member}! 👋\n\nWe're glad to have you here. Be sure to check out our rules and enjoy your stay!`;
        const message    = settings.welcome_message
          ? settings.welcome_message
              .replace('{user}',        member.toString())
              .replace('{username}',    member.user.username)
              .replace('{server}',      guild.name)
              .replace('{membercount}', guild.memberCount.toString())
          : defaultMsg;

        const embed = new EmbedBuilder()
          .setTitle(`👋 Welcome to ${guild.name}!`)
          .setDescription(message)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setColor(config.color)
          .setFooter({ text: `Member #${guild.memberCount}` })
          .setTimestamp();

        const welcomeComponents = [];
        if (settings.role_picker_panel_id) {
          welcomeComponents.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('open_role_picker')
              .setLabel('🎭 Pick Your Roles')
              .setStyle(ButtonStyle.Primary)
          ));
        }
        await channel.send({ embeds: [embed], components: welcomeComponents }).catch(console.error);
      }
    }

    // ── Auto-role assignment ──────────────────────────────────────────────────
    const autoRoles = await db.query(
      'SELECT role_id FROM autorole_config WHERE guild_id = ?',
      [guild.id]
    ).catch(() => []);

    for (const { role_id } of autoRoles) {
      const role = guild.roles.cache.get(role_id);
      if (role) await member.roles.add(role, 'Auto-role on join').catch(() => {});
    }

    // ── Onboarding DM ─────────────────────────────────────────────────────────
    if (onboardingCfg?.enabled && onboardingCfg?.dm_on_join) {
      const steps = JSON.parse(onboardingCfg.steps || '[]');
      if (steps.length) {
        const vars = {
          '{user}':        member.toString(),
          '{username}':    member.user.username,
          '{server}':      guild.name,
          '{membercount}': guild.memberCount.toString(),
        };
        const text = steps.map(s => {
          let msg = s;
          for (const [k, v] of Object.entries(vars)) msg = msg.replaceAll(k, v);
          return msg;
        }).join('\n\n');

        const dmEmbed = new EmbedBuilder()
          .setTitle(`👋 Welcome to ${guild.name}!`)
          .setDescription(text)
          .setThumbnail(guild.iconURL({ dynamic: true }))
          .setColor(config.color)
          .setTimestamp();

        await member.user.send({ embeds: [dmEmbed] }).catch(() => {});
      }
    }
  },
};
