'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('user_restaurant_favorites', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'profiles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      restaurant_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'restaurants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('user_restaurant_favorites', ['user_id', 'restaurant_id'], {
      unique: true,
      name: 'user_restaurant_favorites_unique'
    });
    await queryInterface.addIndex('user_restaurant_favorites', ['user_id']);
    await queryInterface.addIndex('user_restaurant_favorites', ['restaurant_id']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('user_restaurant_favorites');
  }
};
