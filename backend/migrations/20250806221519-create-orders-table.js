'use strict';


module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
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
      order_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      items: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      delivery_fee: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      tax: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      total: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      delivery_address: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      delivery_instructions: {
        type: Sequelize.TEXT
      },
      estimated_delivery_time: {
        type: Sequelize.DATE
      },
      actual_delivery_time: {
        type: Sequelize.DATE
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

    await queryInterface.addIndex('orders', ['order_number'], {
      unique: true,
      name: 'orders_order_number_unique'
    });
    await queryInterface.addIndex('orders', ['user_id']);
    await queryInterface.addIndex('orders', ['restaurant_id']);
    await queryInterface.addIndex('orders', ['status']);
    await queryInterface.addIndex('orders', ['created_at']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('orders');
  }
};
