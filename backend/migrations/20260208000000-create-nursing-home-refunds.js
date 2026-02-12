'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = (queryInterface.sequelize.getDialect && queryInterface.sequelize.getDialect()) || '';
    const url = (queryInterface.sequelize.config && queryInterface.sequelize.config.url) || process.env.DATABASE_URL || '';
    const isPostgres = dialect === 'postgres' || dialect === 'postgresql' || String(url).includes('postgres') || String(url).includes('postgresql');

    if (isPostgres) {
      const [enumRows] = await queryInterface.sequelize.query(
        "SELECT 1 FROM pg_type WHERE typname = 'enum_nursing_home_refunds_status'"
      );
      if (enumRows.length === 0) {
        await queryInterface.sequelize.query(
          'CREATE TYPE "enum_nursing_home_refunds_status" AS ENUM (\'pending\', \'processed\', \'failed\')'
        );
      }

      const [tableRows] = await queryInterface.sequelize.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nursing_home_refunds'"
      );
      if (tableRows.length === 0) {
        await queryInterface.sequelize.query(`
          CREATE TABLE "nursing_home_refunds" (
            "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "resident_order_id" UUID NOT NULL REFERENCES "nursing_home_resident_orders" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
            "amount" DECIMAL(10,2) NOT NULL,
            "reason" TEXT NOT NULL,
            "stripe_refund_id" VARCHAR(255),
            "processed_by" UUID NOT NULL REFERENCES "profiles" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
            "status" "enum_nursing_home_refunds_status" NOT NULL DEFAULT 'pending',
            "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
      }

      const indexNames = [
        'nursing_home_refunds_resident_order_id',
        'nursing_home_refunds_processed_by',
        'nursing_home_refunds_status'
      ];
      const [indexRows] = await queryInterface.sequelize.query(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'nursing_home_refunds'"
      );
      const existingIndexes = new Set((indexRows || []).map((r) => r.indexname));

      if (!existingIndexes.has(indexNames[0])) {
        await queryInterface.sequelize.query(
          'CREATE INDEX nursing_home_refunds_resident_order_id ON nursing_home_refunds (resident_order_id)'
        );
      }
      if (!existingIndexes.has(indexNames[1])) {
        await queryInterface.sequelize.query(
          'CREATE INDEX nursing_home_refunds_processed_by ON nursing_home_refunds (processed_by)'
        );
      }
      if (!existingIndexes.has(indexNames[2])) {
        await queryInterface.sequelize.query(
          'CREATE INDEX nursing_home_refunds_status ON nursing_home_refunds (status)'
        );
      }
      return;
    }

    await queryInterface.createTable('nursing_home_refunds', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      resident_order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'nursing_home_resident_orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      stripe_refund_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      processed_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'profiles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      status: {
        type: Sequelize.ENUM('pending', 'processed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('nursing_home_refunds', ['resident_order_id']);
    await queryInterface.addIndex('nursing_home_refunds', ['processed_by']);
    await queryInterface.addIndex('nursing_home_refunds', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('nursing_home_refunds');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_nursing_home_refunds_status";');
  }
};
