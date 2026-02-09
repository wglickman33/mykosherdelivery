'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('gift_cards', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false
      },
      code: {
        type: Sequelize.STRING(32),
        allowNull: false,
        unique: true
      },
      initial_balance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      balance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      purchased_by_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'profiles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      recipient_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'used', 'void'),
        allowNull: false,
        defaultValue: 'active'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('gift_cards', ['code'], { unique: true });
    await queryInterface.addIndex('gift_cards', ['purchased_by_user_id']);
    await queryInterface.addIndex('gift_cards', ['order_id']);
    await queryInterface.addIndex('gift_cards', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('gift_cards');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_gift_cards_status";');
  }
};
