# Restaurants & Menu Data: Local and Production (Heroku)

Restaurant and menu item data is stored in PostgreSQL. To keep **local** and **production (Heroku)** in sync, use the export/import scripts and the sync script.

## Quick sync (local + Heroku)

From the **backend** directory, with `.env` pointing at your local DB:

```bash
cd backend

# Sync to local only (export from current DB, then re-import into current DB)
node scripts/sync-restaurants-menu-to-all-dbs.js

# Sync to local AND Heroku (set your Heroku app name)
HEROKU_APP_NAME=your-heroku-app-name node scripts/sync-restaurants-menu-to-all-dbs.js
```

What the sync script does:

1. **Export** from the current DB (whatever `DATABASE_URL` is in `.env`) to `data/restaurants-menu-export-YYYY-MM-DD.json`.
2. **Import** that file into the current DB (idempotent: existing restaurants/items are skipped).
3. If `HEROKU_APP_NAME` is set, **import** the same file into the Heroku app’s DB (using `heroku config:get DATABASE_URL`). Requires the Heroku CLI and being logged in.

## Manual steps

### Export (backup)

```bash
cd backend
node scripts/export-restaurants-and-menu.js
# Writes: data/restaurants-menu-export-YYYY-MM-DD.json
```

### Import into current DB (local or prod)

Uses `DATABASE_URL` from the environment (e.g. `.env` locally, Heroku config in prod).

```bash
cd backend
node scripts/import-restaurants-and-menu.js data/restaurants-menu-export-YYYY-MM-DD.json
```

To **replace** existing menu items for restaurants in the file (delete then re-insert):

```bash
node scripts/import-restaurants-and-menu.js --replace data/restaurants-menu-export-YYYY-MM-DD.json
```

### Import into Heroku only (from your machine)

Option A – run the import **on Heroku** (file must be in the repo):

```bash
# From repo root, after committing the export file
heroku run "cd backend && node scripts/import-restaurants-and-menu.js data/restaurants-menu-export-YYYY-MM-DD.json" -a your-app-name
```

Option B – run the import **locally** against Heroku’s DB:

```bash
cd backend
DATABASE_URL=$(heroku config:get DATABASE_URL -a your-app-name) NODE_ENV=production node scripts/import-restaurants-and-menu.js data/restaurants-menu-export-YYYY-MM-DD.json
```

## Environment

- **Local**: `backend/.env` must set `DATABASE_URL` to your local Postgres.
- **Heroku**: `DATABASE_URL` is set automatically. For the sync script, set `HEROKU_APP_NAME` (or `HEROKU_APP`) to your app name so it can run the import against prod.

## Product TSV imports

After importing from product TSV files (e.g. `import-product-tsv.js`), run the sync so production gets the same data:

```bash
cd backend
# Import TSVs as needed, then:
node scripts/export-restaurants-and-menu.js
HEROKU_APP_NAME=your-app node scripts/sync-restaurants-menu-to-all-dbs.js
```

Or run the sync script once; it will export from the current DB and then import into both local and Heroku (if `HEROKU_APP_NAME` is set).
