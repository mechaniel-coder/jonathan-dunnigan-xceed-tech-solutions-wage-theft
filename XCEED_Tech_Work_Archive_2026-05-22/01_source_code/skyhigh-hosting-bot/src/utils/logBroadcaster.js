const { EventEmitter } = require('events');

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

const buffer = [];
const MAX_BUFFER = 500;

function broadcast(entry) {
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  emitter.emit('log', entry);
}

function getBuffer() {
  return buffer.slice();
}

module.exports = { emitter, broadcast, getBuffer };
