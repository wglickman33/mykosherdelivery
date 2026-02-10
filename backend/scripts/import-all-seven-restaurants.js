/**
 * Run TSV import with --replace for all 7 restaurants so menus are replaced/updated.
 * Usage: node scripts/import-all-seven-restaurants.js
 * (From backend directory.)
 */
require('dotenv').config();
const path = require('path');
const { execSync } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const dataDir = path.join(backendDir, 'data');

const SEVEN_TSV = [
  'stop-chop-roll-products.tsv',
  'central-perk-products.tsv',
  'graze-products.tsv',
  'bagel-boys-products.tsv',
  'alans-bakery-products.tsv',
  'five-fifty-products.tsv',
  'mazza-and-more-products.tsv'
];

function run() {
  console.log('Importing (--replace) all 7 restaurant TSV files...\n');
  for (const file of SEVEN_TSV) {
    const filePath = path.join('data', file);
    console.log('---', file, '---');
    try {
      execSync(`node scripts/import-product-tsv.js --replace "${filePath}"`, {
        cwd: backendDir,
        stdio: 'inherit'
      });
    } catch (e) {
      console.error('Failed:', file, e.message);
      process.exitCode = 1;
    }
    console.log('');
  }
  console.log('Done. Run node scripts/verify-menu-items.js to verify.');
}

run();
