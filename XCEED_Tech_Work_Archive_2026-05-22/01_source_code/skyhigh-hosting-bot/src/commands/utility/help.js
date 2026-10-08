const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

const CATEGORIES = [
  {
    name: '🛡️ Moderation',
    commands: [
      { name: '/ban',        desc: 'Ban a member' },
      { name: '/kick',       desc: 'Kick a member' },
      { name: '/warn',       desc: 'Warn a member' },
      { name: '/warnings',   desc: 'View warnings for a member' },
      { name: '/clearwarns', desc: 'Clear all warnings for a member' },
      { name: '/timeout',    desc: 'Timeout a member' },
      { name: '/purge',      desc: 'Bulk delete messages' },
      { name: '/note',       desc: 'Add/view/remove private staff notes on a user' },
    ],
  },
  {
    name: '🎫 Tickets',
    commands: [
      { name: '/ticket setup',    desc: 'Post the support ticket panel' },
      { name: '/ticket category', desc: 'Set the ticket channel category' },
      { name: '/ticket close',    desc: 'Force close a ticket (staff)' },
    ],
  },
  {
    name: '🎭 Roles',
    commands: [
      { name: '/rolereact create', desc: 'Create a self-assign role panel' },
    ],
  },
  {
    name: '🎉 Giveaways',
    commands: [
      { name: '/giveaway start', desc: 'Start a new giveaway' },
      { name: '/gend',           desc: 'Force end a giveaway' },
      { name: '/greroll',        desc: 'Reroll giveaway winners' },
    ],
  },
  {
    name: '� Leveling',
    commands: [
      { name: '/level',       desc: 'View your level and XP progress' },
      { name: '/leaderboard', desc: 'Top 10 members by XP' },
    ],
  },
  {
    name: '💰 Economy',
    commands: [
      { name: '/balance',           desc: 'Check your coin balance' },
      { name: '/daily',             desc: 'Claim your daily coins' },
      { name: '/work',              desc: 'Work to earn coins (1-hour cooldown)' },
      { name: '/pay',               desc: 'Send coins to another member' },
      { name: '/shop browse',       desc: 'Browse the shop' },
      { name: '/shop buy',          desc: 'Buy an item from the shop' },
      { name: '/shop inventory',    desc: 'View your inventory' },
      { name: '/shop richlist',     desc: 'Top 10 wealthiest members' },
    ],
  },
  {
    name: '�📋 Utility',
    commands: [
      { name: '/ping',              desc: 'Check bot latency' },
      { name: '/status',            desc: 'Check Skyhigh service status' },
      { name: '/plans',             desc: 'View hosting plans & pricing' },
      { name: '/faq',               desc: 'View/manage FAQ entries' },
      { name: '/suggest',           desc: 'Submit a suggestion' },
      { name: '/review',            desc: 'Leave a star-rated public review' },
      { name: '/link account',      desc: 'Link your hosting account email' },
      { name: '/link unlink',       desc: 'Remove your linked account' },
      { name: '/link lookup',       desc: 'Look up a linked account (staff)' },
      { name: '/lookup',            desc: 'DNS lookup for a domain' },
      { name: '/poll',              desc: 'Create a reaction poll' },
      { name: '/billing notify',    desc: 'Send billing DM to a user (staff)' },
      { name: '/billing announce',  desc: 'Post a billing announcement (staff)' },
    ],
  },
  {
    name: '⚙️ Admin',
    commands: [
      { name: '/setlog',          desc: 'Set the audit log channel' },
      { name: '/setwelcome',      desc: 'Configure welcome messages' },
      { name: '/setstaff',        desc: 'Set the staff role' },
      { name: '/setsuggestions',  desc: 'Set the suggestions channel' },
      { name: '/setreviews',      desc: 'Set the reviews channel' },
      { name: '/setleveling',     desc: 'Configure the XP leveling system' },
      { name: '/xp',              desc: 'Give/take/reset XP for a user' },
      { name: '/levelroles',      desc: 'Add/remove level role rewards' },
      { name: '/shopmanage',      desc: 'Add/remove shop items, give/take coins' },
      { name: '/monitor',         desc: 'Add/remove/list uptime monitors' },
      { name: '/verification',    desc: 'Set up the member verification gate' },
      { name: '/autorespond',     desc: 'Manage keyword auto-responders' },
      { name: '/announce',        desc: 'Send an announcement embed' },
      { name: '/embed',           desc: 'Send a custom embed' },
      { name: '/customcmd',       desc: 'Manage !prefix custom commands' },
    ],
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📖 Skyhigh Hosting Bot — Help')
      .setDescription('Here\'s everything this bot can do:')
      .setColor(config.color)
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setFooter({ text: 'Skyhigh Hosting', iconURL: interaction.guild.iconURL() ?? undefined })
      .setTimestamp();

    for (const cat of CATEGORIES) {
      embed.addFields({
        name:  cat.name,
        value: cat.commands.map(c => `\`${c.name}\` — ${c.desc}`).join('\n'),
      });
    }

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
