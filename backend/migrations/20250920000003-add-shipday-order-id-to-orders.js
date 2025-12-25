'use strict';


module.exports = {
  async up (queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('orders');
    if (!tableDescription.shipday_order_id) {
      await queryInterface.addColumn('orders', 'shipday_order_id', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Shipday order ID for delivery tracking'
      });
    }

    const indexes = await queryInterface.showIndex('orders');
    const indexExists = indexes.some(idx => idx.name === 'orders_shipday_order_id_idx');
    if (!indexExists) {
      await queryInterface.addIndex('orders', ['shipday_order_id'], {
        name: 'orders_shipday_order_id_idx'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    const indexes = await queryInterface.showIndex('orders');
    const indexExists = indexes.some(idx => idx.name === 'orders_shipday_order_id_idx');
    if (indexExists) {
      await queryInterface.removeIndex('orders', 'orders_shipday_order_id_idx');
    }
    
    const tableDescription = await queryInterface.describeTable('orders');
    if (tableDescription.shipday_order_id) {
      await queryInterface.removeColumn('orders', 'shipday_order_id');
    }
  }
};

