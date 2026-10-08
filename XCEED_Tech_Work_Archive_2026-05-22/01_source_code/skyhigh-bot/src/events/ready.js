const cron                       = require('node-cron');
const { ActivityType }           = require('discord.js');
const { checkGiveaways }         = require('../utils/giveawayManager');
const { checkMonitoredServers }  = require('../utils/monitorManager');
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

    // Check monitored servers every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      checkMonitoredServers(client).catch(err => logger.error(`[Cron/Monitor] ${err.message}`));
    });

    logger.info(`[Ready] Bot is serving ${client.guilds.cache.size} guild(s).`);
  },
};
