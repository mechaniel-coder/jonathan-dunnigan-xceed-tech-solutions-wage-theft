const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const https  = require('https');
const http   = require('http');
const config = require('../../config');

const SITES = [
  { name: 'Skyhigh Hosting Panel', url: 'https://skyhigh.cinros.net/' },
  { name: 'Bot Host Server',       url: 'http://107.223.74.163:8080/' },
];

function checkUrl(url) {
  return new Promise(resolve => {
    const start   = Date.now();
    const module_ = url.startsWith('https') ? https : http;
    const req     = module_.get(url, { timeout: 5000 }, res => {
      const ping = Date.now() - start;
      resolve({ ok: res.statusCode < 400, status: res.statusCode, ping });
    });
    req.on('error', () => resolve({ ok: false, status: 0, ping: -1 }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, ping: -1 }); });
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check Skyhigh Hosting service status'),

  async execute(interaction) {
    await interaction.deferReply();

    const results = await Promise.all(SITES.map(async site => {
      const result = await checkUrl(site.url);
      return { ...site, ...result };
    }));

    const fields = results.map(r => ({
      name:   r.name,
      value:  r.ok
        ? `✅ Online — HTTP ${r.status} — \`${r.ping}ms\``
        : `❌ Offline / Unreachable`,
      inline: false,
    }));

    const allOnline = results.every(r => r.ok);
    const embed = new EmbedBuilder()
      .setTitle('🌐 Skyhigh Hosting — Service Status')
      .setDescription(allOnline ? '✅ All systems operational' : '⚠️ Some services may be degraded')
      .addFields(fields)
      .setColor(allOnline ? config.successColor : config.warnColor)
      .setFooter({ text: 'Status check performed at' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
