'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if column already exists before adding
    const tableDescription = await queryInterface.describeTable('orders');
    if (!tableDescription.shipday_order_id) {
      await queryInterface.addColumn('orders', 'shipday_order_id', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Shipday order ID for delivery tracking'
      });
    }

    // Check if index already exists before adding
    const indexes = await queryInterface.showIndex('orders');
    const indexExists = indexes.some(idx => idx.name === 'orders_shipday_order_id_idx');
    if (!indexExists) {
      await queryInterface.addIndex('orders', ['shipday_order_id'], {
        name: 'orders_shipday_order_id_idx'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    // Check if index exists before removing
    const indexes = await queryInterface.showIndex('orders');
    const indexExists = indexes.some(idx => idx.name === 'orders_shipday_order_id_idx');
    if (indexExists) {
      await queryInterface.removeIndex('orders', 'orders_shipday_order_id_idx');
    }
    
    // Check if column exists before removing
    const tableDescription = await queryInterface.describeTable('orders');
    if (tableDescription.shipday_order_id) {
      await queryInterface.removeColumn('orders', 'shipday_order_id');
    }
  }
};

