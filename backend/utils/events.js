const EventEmitter = require('events');

// Central event bus for app-wide notifications
const appEvents = new EventEmitter();

// Increase listeners limit to avoid warnings in dev
appEvents.setMaxListeners(50);

// Helper emitters for clarity
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