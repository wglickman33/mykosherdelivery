#!/usr/bin/env node
/**
 * One-off script to add applied_gift_card to orders if missing.
 * Run on production: heroku run "node scripts/add-applied-gift-card-column.js" -a mykosherdelivery
 * (from backend directory, or adjust path if running from repo root)
 */
require('dotenv').config();
const { sequelize } = require('../models');

async function main() {
  const table = 'orders';
  const column = 'applied_gift_card';
  const dialect = sequelize.getDialect();
  if (dialect !== 'postgres') {
    console.log('This script is for PostgreSQL. Dialect:', dialect);
    process.exit(1);
  }
  const [rows] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'applied_gift_card'`
  );
  if (rows.length > 0) {
    console.log(`Column ${column} already exists on ${table}. Nothing to do.`);
    await sequelize.close();
    process.exit(0);
  }
  console.log(`Adding column ${column} to ${table}...`);
  await sequelize.query(`
    ALTER TABLE "orders" ADD COLUMN "applied_gift_card" JSONB NULL;
  `);
  await sequelize.query(`COMMENT ON COLUMN "orders"."applied_gift_card" IS 'Applied gift card: { giftCardId, code, amountApplied }';`).catch(() => {});
  console.log('Done.');
  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
