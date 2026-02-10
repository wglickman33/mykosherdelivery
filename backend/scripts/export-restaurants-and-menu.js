require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Restaurant, MenuItem, MenuItemOption } = require('../models');
const logger = require('../utils/logger');

const DEFAULT_DIR = path.join(__dirname, '..', 'data');

async function exportData() {
  const outPath = process.argv[2] || path.join(DEFAULT_DIR, `restaurants-menu-export-${new Date().toISOString().slice(0, 10)}.json`);

  try {
    const restaurants = await Restaurant.findAll({
      order: [['name', 'ASC']],
      include: [{
        model: MenuItem,
        as: 'menuItems',
        required: false,
        include: [{
          model: MenuItemOption,
          as: 'itemOptions',
          required: false
        }]
      }]
    });

    const payload = {
      exportedAt: new Date().toISOString(),
      restaurantCount: restaurants.length,
      menuItemCount: restaurants.reduce((sum, r) => sum + (r.menuItems?.length || 0), 0),
      restaurants: restaurants.map((r) => {
        const rj = r.toJSON();
        if (rj.menuItems) {
          rj.menuItems = rj.menuItems.map((mi) => {
            const mj = { ...mi };
            if (mj.itemOptions) mj.itemOptions = mj.itemOptions.map((o) => ({ ...o }));
            return mj;
          });
        }
        return rj;
      })
    };

    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    logger.info(`Exported ${payload.restaurantCount} restaurants and ${payload.menuItemCount} menu items to ${outPath}`);
    console.log(`Exported ${payload.restaurantCount} restaurants and ${payload.menuItemCount} menu items to ${outPath}`);
  } catch (err) {
    logger.error('Export failed', err);
    console.error('Export failed:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

exportData();
