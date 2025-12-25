'use strict';


module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'restaurant_groups', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Stores multiple restaurants and their items for multi-restaurant orders'
    });

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
