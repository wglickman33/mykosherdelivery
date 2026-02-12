'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = (queryInterface.sequelize.getDialect && queryInterface.sequelize.getDialect()) || '';
    const isPostgres = dialect === 'postgres' || dialect === 'postgresql';

    const tableExists = isPostgres
      ? (await queryInterface.sequelize.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gift_cards'"
        ))[0].length > 0
      : false;

    if (!tableExists) {
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
    }

    const indexNames = [
      'gift_cards_purchased_by_user_id',
      'gift_cards_order_id',
      'gift_cards_status'
    ];
    if (isPostgres) {
      const [indexRows] = await queryInterface.sequelize.query(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'gift_cards'"
      );
      const existing = new Set((indexRows || []).map((r) => r.indexname));
      if (!existing.has(indexNames[0])) {
        await queryInterface.addIndex('gift_cards', ['purchased_by_user_id']);
      }
      if (!existing.has(indexNames[1])) {
        await queryInterface.addIndex('gift_cards', ['order_id']);
      }
      if (!existing.has(indexNames[2])) {
        await queryInterface.addIndex('gift_cards', ['status']);
      }
    } else {
      await queryInterface.addIndex('gift_cards', ['purchased_by_user_id']);
      await queryInterface.addIndex('gift_cards', ['order_id']);
      await queryInterface.addIndex('gift_cards', ['status']);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('gift_cards');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_gift_cards_status";');
  }
};
