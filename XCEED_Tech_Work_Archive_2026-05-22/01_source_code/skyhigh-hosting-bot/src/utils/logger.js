const { createLogger, format, transports } = require('winston');
const Transport = require('winston-transport');
const path = require('path');
const fs   = require('fs');
const { broadcast } = require('./logBroadcaster');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`)
);

const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, stack }) =>
    stack
      ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
      : `[${timestamp}] ${level.toUpperCase()}: ${message}`
  )
);

class BroadcastTransport extends Transport {
  log(info, callback) {
    broadcast({ level: info.level, message: info.message, ts: info.timestamp || new Date().toISOString() });
    callback();
  }
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new transports.Console({ format: consoleFormat }),
    new transports.File({ filename: path.join(logsDir, 'error.log'),    level: 'error', format: fileFormat }),
    new transports.File({ filename: path.join(logsDir, 'combined.log'),              format: fileFormat }),
    new BroadcastTransport({ format: format.combine(format.timestamp({ format: 'HH:mm:ss' }), format.errors({ stack: false })) }),
  ],
});

module.exports = logger;
