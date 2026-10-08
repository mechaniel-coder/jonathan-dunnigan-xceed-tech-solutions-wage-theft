const { EmbedBuilder } = require('discord.js');
const db               = require('../database');
const config           = require('../config');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const { guild } = member;

    // ── Mod log (existing behaviour) ─────────────────────────────────────────
    const rows = await db.query(
      'SELECT log_channel FROM guild_settings WHERE guild_id = ?',
      [guild.id]
    ).catch(() => []);

    const logChannelId = rows[0]?.log_channel;
    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('📤 Member Left')
          .setDescription(`${member.user.tag} has left the server.`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: 'User ID', value: member.id,                                                                          inline: true },
            { name: 'Joined',  value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
            { name: 'Members', value: `${guild.memberCount}`,                                                             inline: true }
          )
          .setColor(config.warnColor)
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }

    // ── Goodbye channel (public-facing, configurable via /onboarding) ─────────
    const [onboarding] = await db.query(
      'SELECT * FROM onboarding_config WHERE guild_id = ? AND goodbye_enabled = 1',
      [guild.id]
    ).catch(() => []);

    if (onboarding?.goodbye_channel_id) {
      const goodbyeCh = guild.channels.cache.get(onboarding.goodbye_channel_id);
      if (goodbyeCh) {
        const vars = {
          '{user}':        member.user.toString(),
          '{username}':    member.user.username,
          '{server}':      guild.name,
          '{membercount}': guild.memberCount.toString(),
        };
        let msg = onboarding.goodbye_message ||
          `👋 **{username}** has left the server. We now have **{membercount}** members.`;
        for (const [k, v] of Object.entries(vars)) msg = msg.replaceAll(k, v);

        const embed = new EmbedBuilder()
          .setDescription(msg)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setColor(config.warnColor)
          .setTimestamp();

        await goodbyeCh.send({ embeds: [embed] }).catch(() => {});
      }
    }
  },
};
