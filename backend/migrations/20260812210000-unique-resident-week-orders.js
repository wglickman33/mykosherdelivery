'use strict';

/**
 * Enforce one active (non-cancelled) order per resident per week.
 * Dedupes existing rows first (keeps highest-priority / newest).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY resident_id, week_start_date
            ORDER BY
              CASE status
                WHEN 'paid' THEN 1
                WHEN 'submitted' THEN 2
                WHEN 'confirmed' THEN 3
                WHEN 'completed' THEN 4
                WHEN 'in_progress' THEN 5
                WHEN 'draft' THEN 6
                ELSE 7
              END,
              updated_at DESC,
              created_at DESC
          ) AS rn
        FROM nursing_home_resident_orders
        WHERE status IS DISTINCT FROM 'cancelled'
      ),
      dupes AS (
        SELECT id FROM ranked WHERE rn > 1
      )
      DELETE FROM nursing_home_refunds
      WHERE resident_order_id IN (SELECT id FROM dupes);
    `);

    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY resident_id, week_start_date
            ORDER BY
              CASE status
                WHEN 'paid' THEN 1
                WHEN 'submitted' THEN 2
                WHEN 'confirmed' THEN 3
                WHEN 'completed' THEN 4
                WHEN 'in_progress' THEN 5
                WHEN 'draft' THEN 6
                ELSE 7
              END,
              updated_at DESC,
              created_at DESC
          ) AS rn
        FROM nursing_home_resident_orders
        WHERE status IS DISTINCT FROM 'cancelled'
      )
      DELETE FROM nursing_home_resident_orders
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS nursing_home_resident_orders_resident_week_unique
      ON nursing_home_resident_orders (resident_id, week_start_date)
      WHERE status IS DISTINCT FROM 'cancelled';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS nursing_home_resident_orders_resident_week_unique;
    `);
  }
};
