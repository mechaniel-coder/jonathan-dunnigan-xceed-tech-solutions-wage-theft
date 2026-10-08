require('dotenv').config();

module.exports = {
  token:     process.env.BOT_TOKEN,
  clientId:  process.env.CLIENT_ID,
  guildId:   process.env.GUILD_ID,
  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME     || 'skyhigh_bot',
  },
  // Skyhigh Hosting brand colors
  color:        0x00AAFF,
  errorColor:   0xFF4444,
  successColor: 0x44DD88,
  warnColor:    0xFFAA00,
};
