'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'discount_amount', {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.addColumn('orders', 'applied_promo', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Stores promo code information including code, type, and value'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'discount_amount');
    await queryInterface.removeColumn('orders', 'applied_promo');
  }
};
