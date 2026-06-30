'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('kiddush_menu_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      kiddush_package_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'kiddush_packages',
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
        allowNull: false,
        defaultValue: 0
      },
      category: {
        type: Sequelize.STRING,
        allowNull: false
      },
      image_url: {
        type: Sequelize.STRING
      },
      available: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
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
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
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

    await queryInterface.addIndex('kiddush_menu_items', ['kiddush_package_id']);
    await queryInterface.addIndex('kiddush_menu_items', ['category']);
    await queryInterface.addIndex('kiddush_menu_items', ['available']);
    await queryInterface.addIndex('kiddush_menu_items', ['item_type']);
    await queryInterface.addIndex('kiddush_menu_items', ['display_order']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('kiddush_menu_items');
  }
};
