'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Make estimated_delivery_time and actual_delivery_time nullable
    await queryInterface.changeColumn('orders', 'estimated_delivery_time', {
      type: Sequelize.DATE,
      allowNull: true
    });
    
    await queryInterface.changeColumn('orders', 'actual_delivery_time', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert to non-nullable (if needed)
    await queryInterface.changeColumn('orders', 'estimated_delivery_time', {
      type: Sequelize.DATE,
      allowNull: false
    });
    
    await queryInterface.changeColumn('orders', 'actual_delivery_time', {
      type: Sequelize.DATE,
      allowNull: false
    });
  }
};
