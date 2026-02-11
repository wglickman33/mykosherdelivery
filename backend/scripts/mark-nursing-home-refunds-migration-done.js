#!/usr/bin/env node
/**
 * One-off: mark 20260208000000-create-nursing-home-refunds as already run
 * so "npm run migrate" skips it (table/indexes already exist).
 *
 * Run on Heroku:
 *   heroku run "cd backend && node scripts/mark-nursing-home-refunds-migration-done.js" -a mykosherdelivery
 *
 * Then run migrate again:
 *   heroku run "cd backend && npm run migrate" -a mykosherdelivery
 */
require('dotenv').config();
const { sequelize } = require('../models');

async function main() {
  const name = '20260208000000-create-nursing-home-refunds.js';
  const [rows] = await sequelize.query(
    'SELECT name FROM "SequelizeMeta" WHERE name = ?',
    { replacements: [name] }
  );
  if (rows.length > 0) {
    console.log('Migration already marked as run. Nothing to do.');
    await sequelize.close();
    process.exit(0);
    return;
  }
  await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (?)', { replacements: [name] });
  console.log('Marked migration as run:', name);
  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
