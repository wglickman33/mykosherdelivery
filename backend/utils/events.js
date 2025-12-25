const EventEmitter = require('events');

const appEvents = new EventEmitter();

appEvents.setMaxListeners(50);

const emitOrderCreated = (order) => {
  appEvents.emit('order.created', order);
};

const emitOrderUpdated = (order) => {
  appEvents.emit('order.updated', order);
};

module.exports = {
  appEvents,
  emitOrderCreated,
  emitOrderUpdated
}; 