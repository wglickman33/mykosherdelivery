require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Restaurant, MenuItem, MenuItemOption, sequelize } = require('../models');
const logger = require('../utils/logger');

function parseArgs() {
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const filePath = args.filter((a) => !a.startsWith('--'))[0];
  return { replace, filePath };
}

function toMenuItemPayload(row) {
  const p = {
    restaurantId: row.restaurantId ?? row.restaurant_id,
    name: row.name,
    description: row.description ?? null,
    price: row.price,
    category: row.category ?? null,
    imageUrl: row.imageUrl ?? row.image_url ?? null,
    available: row.available !== false,
    itemType: (row.itemType ?? row.item_type ?? 'simple').toLowerCase(),
    options: row.options ?? null,
    labels: Array.isArray(row.labels) ? row.labels : (typeof row.labels === 'string' ? (() => { try { return JSON.parse(row.labels); } catch { return []; } })() : [])
  };
  if (!['simple', 'variety', 'builder', 'customizable'].includes(p.itemType)) p.itemType = 'simple';
  return p;
}

function toRestaurantPayload(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? null,
    phone: row.phone ?? null,
    typeOfFood: row.typeOfFood ?? row.type_of_food ?? null,
    kosherCertification: row.kosherCertification ?? row.kosher_certification ?? null,
    logoUrl: row.logoUrl ?? row.logo_url ?? null,
    featured: !!row.featured,
    active: row.active !== false
  };
}

async function importData() {
  const { replace, filePath } = parseArgs();
  if (!filePath) {
    console.error('Usage: node scripts/import-restaurants-and-menu.js [--replace] <path-to-export.json>');
    process.exit(1);
  }
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    console.error('File not found:', resolved);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
  }

  const restaurants = data.restaurants || data;
  const array = Array.isArray(restaurants) ? restaurants : [restaurants];

  let createdRestaurants = 0;
  let skippedRestaurants = 0;
  let createdMenuItems = 0;
  let skippedMenuItems = 0;
  let createdOptions = 0;

  const t = await sequelize.transaction();
  try {
    for (const r of array) {
      const restaurantId = r.id;
      if (!restaurantId) continue;
      const payload = toRestaurantPayload(r);
      const [restaurant, created] = await Restaurant.findOrCreate({
        where: { id: restaurantId },
        defaults: payload,
        transaction: t
      });
      if (created) createdRestaurants++; else skippedRestaurants++;

      const menuItems = r.menuItems || r.menu_items || [];
      if (replace && menuItems.length > 0) {
        const deleted = await MenuItem.destroy({
          where: { restaurantId: restaurant.id },
          transaction: t
        });
        if (deleted > 0) logger.info(`Replaced ${deleted} menu items for restaurant ${restaurant.id}`);
      }

      for (const mi of menuItems) {
        const name = mi.name;
        if (!name) continue;
        const existing = await MenuItem.findOne({
          where: { restaurantId: restaurant.id, name },
          transaction: t
        });
        if (existing) {
          skippedMenuItems++;
          continue;
        }
        const itemPayload = toMenuItemPayload({ ...mi, restaurantId: restaurant.id });
        const newItem = await MenuItem.create(itemPayload, { transaction: t });
        createdMenuItems++;
        const options = mi.itemOptions || mi.item_options || [];
        for (const opt of options) {
          await MenuItemOption.create({
            menuItemId: newItem.id,
            optionName: opt.optionName ?? opt.option_name ?? 'Option',
            optionType: (opt.optionType ?? opt.option_type ?? 'choice').toLowerCase(),
            required: !!opt.required,
            options: opt.options ?? null
          }, { transaction: t });
          createdOptions++;
        }
      }
    }
    await t.commit();
    logger.info('Import complete', {
      createdRestaurants,
      skippedRestaurants,
      createdMenuItems,
      skippedMenuItems,
      createdOptions
    });
    console.log('Import complete:');
    console.log(`  Restaurants: ${createdRestaurants} created, ${skippedRestaurants} already existed`);
    console.log(`  Menu items:  ${createdMenuItems} created, ${skippedMenuItems} skipped (already exist)`);
    if (createdOptions) console.log(`  Item options: ${createdOptions} created`);
  } catch (err) {
    await t.rollback();
    logger.error('Import failed', err);
    console.error('Import failed:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

importData();
