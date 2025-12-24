'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add restaurantGroups field to store multiple restaurants per order
    await queryInterface.addColumn('orders', 'restaurant_groups', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Stores multiple restaurants and their items for multi-restaurant orders'
    });

    // Make restaurantId nullable for multi-restaurant orders
    await queryInterface.changeColumn('orders', 'restaurant_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'restaurants',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'restaurant_groups');
    
    // Revert restaurantId to not null
    await queryInterface.changeColumn('orders', 'restaurant_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'restaurants',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  }
};
