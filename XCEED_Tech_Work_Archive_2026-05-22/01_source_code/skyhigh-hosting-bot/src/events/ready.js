const cron                       = require('node-cron');
const { ActivityType }           = require('discord.js');
const { checkGiveaways }         = require('../utils/giveawayManager');
const { startMonitor }           = require('../utils/monitorManager');
const logger                     = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`[Ready] Logged in as ${client.user.tag}`);

    client.user.setActivity('Skyhigh Hosting | /help', { type: ActivityType.Watching });

    // Check for ended giveaways every minute
    cron.schedule('* * * * *', () => {
      checkGiveaways(client).catch(err => logger.error(`[Cron/Giveaways] ${err.message}`));
    });

    // Start monitor with dynamic interval from bot_settings
    await startMonitor(client);

    logger.info(`[Ready] Bot is serving ${client.guilds.cache.size} guild(s).`);
  },
};
