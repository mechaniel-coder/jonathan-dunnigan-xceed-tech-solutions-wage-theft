const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

// ══════════════════════════════════════════════════════════════════════════
// EDIT THESE PLANS TO MATCH YOUR ACTUAL HOSTING OFFERINGS
// ══════════════════════════════════════════════════════════════════════════
const PLANS = [
  {
    name:        '🌱 Starter',
    price:       '$3.99/mo',
    description: 'Great for small projects & personal sites',
    features:    ['1 GB RAM', '10 GB NVMe SSD', '1 vCPU', 'DDoS Protection', '99.9% Uptime'],
  },
  {
    name:        '🚀 Growth',
    price:       '$7.99/mo',
    description: 'For growing communities & small businesses',
    features:    ['4 GB RAM', '25 GB NVMe SSD', '2 vCPU', 'DDoS Protection', 'Free Backups', 'Priority Support'],
  },
  {
    name:        '⚡ Pro',
    price:       '$14.99/mo',
    description: 'High performance for demanding apps',
    features:    ['8 GB RAM', '50 GB NVMe SSD', '4 vCPU', 'DDoS Protection', 'Daily Backups', 'Dedicated IP', 'Priority Support'],
  },
  {
    name:        '🏢 Enterprise',
    price:       'Custom Pricing',
    description: 'Fully managed solutions at scale',
    features:    ['Custom Resources', 'NVMe SSD Storage', 'Dedicated vCPUs', 'Advanced DDoS', 'Custom SLA', 'Dedicated Account Manager'],
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plans')
    .setDescription('View Skyhigh Hosting plans and pricing'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📦 Skyhigh Hosting — Plans & Pricing')
      .setDescription(
        'Find the plan that fits your needs.\n' +
        '🌐 **Order at:** [skyhigh.cinros.net](https://skyhigh.cinros.net/)\n\u200b'
      )
      .setColor(config.color)
      .setFooter({ text: 'Skyhigh Hosting • All plans include free setup', iconURL: interaction.guild.iconURL() ?? undefined })
      .setTimestamp();

    for (const p of PLANS) {
      embed.addFields({
        name:   `${p.name} — ${p.price}`,
        value:  `*${p.description}*\n${p.features.map(f => `✅ ${f}`).join('\n')}`,
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
