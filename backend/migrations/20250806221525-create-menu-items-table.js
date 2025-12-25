'use strict';


module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('menu_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
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
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      category: {
        type: Sequelize.STRING
      },
      image_url: {
        type: Sequelize.STRING
      },
      available: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      item_type: {
        type: Sequelize.ENUM('simple', 'variety', 'builder'),
        defaultValue: 'simple'
      },
      options: {
        type: Sequelize.JSONB
      },
      labels: {
        type: Sequelize.JSONB,
        defaultValue: '[]'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('menu_items', ['restaurant_id']);
    await queryInterface.addIndex('menu_items', ['category']);
    await queryInterface.addIndex('menu_items', ['available']);
    await queryInterface.addIndex('menu_items', ['item_type']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('menu_items');
  }
};
