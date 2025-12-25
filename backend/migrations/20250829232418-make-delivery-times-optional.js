'use strict';


module.exports = {
  async up(queryInterface, Sequelize) {
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
