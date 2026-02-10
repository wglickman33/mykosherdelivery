require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const dataDir = path.join(backendDir, 'data');
const dateStr = new Date().toISOString().slice(0, 10);
const exportPath = path.join(dataDir, `restaurants-menu-export-${dateStr}.json`);

function run(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: 'inherit',
    cwd: backendDir,
    ...opts
  });
}

async function main() {
  console.log('--- Sync restaurants & menu to local and prod (Heroku) ---\n');

  console.log('1) Exporting from current DB...');
  run(`node scripts/export-restaurants-and-menu.js "${exportPath}"`);
  if (!fs.existsSync(exportPath)) {
    console.error('Export file not found:', exportPath);
    process.exit(1);
  }
  console.log('   Export file:', exportPath, '\n');

  console.log('2) Importing into current DB (local)...');
  run(`node scripts/import-restaurants-and-menu.js "${exportPath}"`);
  console.log('   Done.\n');

  const herokuAppRaw = process.env.HEROKU_APP_NAME || process.env.HEROKU_APP;
  const herokuApp = typeof herokuAppRaw === 'string'
    ? herokuAppRaw.replace(/[^a-zA-Z0-9_-]/g, '')
    : '';
  if (!herokuApp) {
    console.log('3) Skipping Heroku (set HEROKU_APP_NAME to sync prod).');
    console.log('   Example: HEROKU_APP_NAME=my-app node scripts/sync-restaurants-menu-to-all-dbs.js\n');
    return;
  }

  console.log('3) Importing into Heroku DB (app: ' + herokuApp + ')...');
  let herokuUrl;
  try {
    herokuUrl = execSync(`heroku config:get DATABASE_URL -a ${herokuApp}`, {
      encoding: 'utf8',
      cwd: backendDir
    }).trim();
  } catch (e) {
    console.error('   Failed to get Heroku DATABASE_URL. Error: ' + e.message + ' Is `heroku` CLI installed and logged in?');
    console.error('   Run: heroku config:get DATABASE_URL -a', herokuApp);
    process.exit(1);
  }
  if (!herokuUrl) {
    console.error('   Heroku DATABASE_URL is empty.');
    process.exit(1);
  }

  const env = { ...process.env, DATABASE_URL: herokuUrl, NODE_ENV: 'production' };
  run(`node scripts/import-restaurants-and-menu.js "${exportPath}"`, { env });
  console.log('   Heroku import done.\n');

  console.log('--- Sync complete: local and prod updated. ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
