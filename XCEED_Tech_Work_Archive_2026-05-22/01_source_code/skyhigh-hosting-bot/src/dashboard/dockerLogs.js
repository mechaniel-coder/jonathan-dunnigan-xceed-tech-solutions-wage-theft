/**
 * dockerLogs.js
 * Streams Docker container logs (stdout + stderr) to the admin dashboard
 * via Socket.io rooms.
 *
 * Requires:
 *   - npm package: dockerode
 *   - /var/run/docker.sock mounted in the container (read-only is sufficient)
 *
 * Socket.io protocol:
 *   Client emits:  'docker:subscribe'   { container: 'skyhigh-bot' | 'nextdactyl' | ... }
 *   Client emits:  'docker:unsubscribe' { container: 'skyhigh-bot' | ... }
 *   Server emits:  'docker:log'         { container, line, stream }   (stream: 'stdout'|'stderr')
 *   Server emits:  'docker:error'       { container, message }
 *   Server emits:  'docker:status'      { container, state }          (state: 'running'|'stopped'|'notfound')
 */

'use strict';

const logger = require('../utils/logger');

// Allowed container names the frontend can subscribe to (whitelist prevents arbitrary access)
const ALLOWED_CONTAINERS = new Set([
  'skyhigh-bot',
  'nextdactyl',
]);

let Docker;
try {
  Docker = require('dockerode');
} catch {
  logger.warn('[DockerLogs] dockerode not installed — Docker log streaming disabled.');
  Docker = null;
}

// Map of containerName → active log stream so we can stop them on unsubscribe
const activeStreams = new Map();

/**
 * Wire Docker log streaming to the existing Socket.io server.
 * Called once from dashboard/index.js after io is created.
 *
 * @param {import('socket.io').Server} io
 */
function mountDockerLogs(io) {
  if (!Docker) return;

  // Admin-only namespace keeps Docker logs separate from the public log namespace
  const docker = new Docker({ socketPath: '/var/run/docker.sock' });

  io.on('connection', (socket) => {
    // Only admin sessions should reach here (auth guard is in index.js), but
    // we double-check the user is authenticated (session is shared via express-session).
    if (!socket.request?.session?.passport?.user) return;

    socket.on('docker:subscribe', async ({ container } = {}) => {
      if (!ALLOWED_CONTAINERS.has(container)) {
        return socket.emit('docker:error', { container, message: 'Container not allowed' });
      }

      const room = `docker:${container}`;
      socket.join(room);

      // If no stream is already running for this container, start one
      if (!activeStreams.has(container)) {
        try {
          await startStream(docker, io, container, room);
        } catch (err) {
          io.to(room).emit('docker:error', { container, message: err.message });
          activeStreams.delete(container);
        }
      }

      // Emit current container state
      emitStatus(docker, io, container, room);
    });

    socket.on('docker:unsubscribe', ({ container } = {}) => {
      if (!ALLOWED_CONTAINERS.has(container)) return;
      socket.leave(`docker:${container}`);
    });
  });
}

/**
 * Start a tail log stream for a container.
 * The stream is kept alive and broadcasts to the room until the container stops.
 */
async function startStream(docker, io, container, room) {
  const c = docker.getContainer(container);

  // Stream last 100 lines then follow
  const logStream = await c.logs({
    stdout:     true,
    stderr:     true,
    follow:     true,
    tail:       100,
    timestamps: true,
  });

  activeStreams.set(container, logStream);

  logStream.on('data', (chunk) => {
    // Docker multiplexes stdout/stderr in an 8-byte header
    // Byte 0: stream type (1=stdout, 2=stderr)
    // Bytes 4-7: payload length (big-endian uint32)
    // Remaining: payload
    let offset = 0;
    while (offset < chunk.length) {
      if (chunk.length < offset + 8) break;
      const streamType = chunk[offset];       // 1 or 2
      const size       = chunk.readUInt32BE(offset + 4);
      const payload    = chunk.slice(offset + 8, offset + 8 + size);
      offset += 8 + size;

      const line   = payload.toString('utf8').trimEnd();
      const stream = streamType === 2 ? 'stderr' : 'stdout';
      io.to(room).emit('docker:log', { container, line, stream });
    }
  });

  logStream.on('end', () => {
    activeStreams.delete(container);
    io.to(room).emit('docker:status', { container, state: 'stopped' });
  });

  logStream.on('error', (err) => {
    activeStreams.delete(container);
    logger.warn(`[DockerLogs] Stream error for ${container}: ${err.message}`);
    io.to(room).emit('docker:error', { container, message: err.message });
  });
}

async function emitStatus(docker, io, container, room) {
  try {
    const c    = docker.getContainer(container);
    const info = await c.inspect();
    const state = info.State?.Running ? 'running' : 'stopped';
    io.to(room).emit('docker:status', { container, state });
  } catch {
    io.to(room).emit('docker:status', { container, state: 'notfound' });
  }
}

module.exports = { mountDockerLogs };
