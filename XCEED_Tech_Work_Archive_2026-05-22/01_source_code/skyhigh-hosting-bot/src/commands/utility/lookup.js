const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dns    = require('dns').promises;
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lookup')
    .setDescription('DNS lookup for a domain (hosting support tool)')
    .addStringOption(o => o
      .setName('target')
      .setDescription('Domain name (e.g. example.com)')
      .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    // Strip protocol and path — keep only the host part
    const raw    = interaction.options.getString('target').trim();
    const target = raw.replace(/^https?:\/\//i, '').replace(/[/?#].*/g, '').toLowerCase();

    // Only allow safe domain/IP characters
    if (!/^[a-z0-9.\-]+$/.test(target) || target.length > 253) {
      return interaction.editReply({ content: '❌ Invalid domain name.' });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔍 DNS Lookup: \`${target}\``)
      .setColor(config.color)
      .setTimestamp();

    const [aRes, aaaaRes, mxRes, nsRes, txtRes] = await Promise.all([
      dns.resolve(target, 'A').catch(() => null),
      dns.resolve(target, 'AAAA').catch(() => null),
      dns.resolve(target, 'MX').catch(() => null),
      dns.resolve(target, 'NS').catch(() => null),
      dns.resolve(target, 'TXT').catch(() => null),
    ]);

    if (!aRes && !aaaaRes && !mxRes && !nsRes) {
      embed.setDescription('❌ No DNS records found. The domain may not exist or is unreachable.');
      embed.setColor(config.errorColor);
      return interaction.editReply({ embeds: [embed] });
    }

    if (aRes?.length)    embed.addFields({ name: '🌐 A Records (IPv4)',  value: aRes.slice(0, 10).join('\n'), inline: false });
    if (aaaaRes?.length) embed.addFields({ name: '🌐 AAAA Records (IPv6)', value: aaaaRes.slice(0, 5).join('\n'), inline: false });
    if (mxRes?.length)   embed.addFields({ name: '📧 MX Records', value: mxRes.slice(0, 5).map(r => `Priority ${r.priority}: ${r.exchange}`).join('\n'), inline: false });
    if (nsRes?.length)   embed.addFields({ name: '🔧 NS Records', value: nsRes.slice(0, 5).join('\n'), inline: false });
    if (txtRes?.length)  embed.addFields({ name: '📝 TXT Records', value: txtRes.flat().slice(0, 3).join('\n').slice(0, 1024), inline: false });

    await interaction.editReply({ embeds: [embed] });
  },
};
