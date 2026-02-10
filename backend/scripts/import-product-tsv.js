require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Restaurant, MenuItem, sequelize } = require('../models');
const logger = require('../utils/logger');
const { validateMenuItemData } = require('../utils/menuItemValidation');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const replace = process.argv.includes('--replace');
const fileArg = args[0];
if (!fileArg) {
  console.error('Usage: node scripts/import-product-tsv.js [--replace] <path-to.tsv>');
  process.exit(1);
}

const resolved = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg);
if (!fs.existsSync(resolved)) {
  console.error('File not found:', resolved);
  process.exit(1);
}

const raw = fs.readFileSync(resolved, 'utf8');
const lines = raw.split(/\r?\n/).filter((l) => l.trim());
if (lines.length < 2) {
  console.error('File has no data rows');
  process.exit(1);
}

function stripHtml(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapRestaurantSlug(name) {
  if (name === 'central-perk') return 'central-perk-cafe';
  if (name === 'graze') return 'graze-smokehouse';
  if (name === 'ruthies-place') return 'ruthys-grocery-and-deli';
  if (name === 'stop-chop-roll') return 'stop-chop-and-roll';
  if (name === 'traditions') return 'traditions-eatery';
  return name;
}

function humanizeSlug(slug) {
  return (slug || '')
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Round to 2 decimals so stored structure matches admin/owner-created items (avoids float noise). */
function roundPrice(v) {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

const header = (lines[0] || '').toLowerCase();
const isLongFormat = header.includes('title') && header.includes('product page');

const DEFAULT_CATEGORY = 'general';

/** Parse into rows; long format includes all 6 option columns and carries previous product/name for variant rows */
const parsed = [];
let lastProductId = '';
let lastName = '';
let lastRestaurant = '';
let lastCategory = '';
let lastDescription = '';

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t');
  if (isLongFormat && parts.length >= 25) {
    const productId = (parts[0] || '').trim();
    const restaurantName = mapRestaurantSlug((parts[3] || '').trim());
    const name = (parts[5] || '').trim();
    const description = stripHtml((parts[6] || '').trim());
    const price = parseFloat(parts[20]);
    const category = (parts[24] || '').trim().replace(/^\//, '');
    const visible = (parts[30] || '').trim().toLowerCase() === 'yes';
    const optionPairs = [];
    for (let k = 0; k < 6; k++) {
      const oName = (parts[8 + k * 2] || '').trim();
      const oVal = (parts[9 + k * 2] || '').trim();
      if (oName || oVal) optionPairs.push({ name: oName || `Option ${k + 1}`, value: oVal || 'Default' });
    }
    if (!restaurantName) continue;
    const resolvedName = name || lastName;
    const resolvedProductId = productId || lastProductId;
    if (!resolvedName && !resolvedProductId) continue;
    if (name) {
      lastProductId = productId;
      lastName = name;
      lastRestaurant = restaurantName;
      lastCategory = category;
      lastDescription = description;
    }
    parsed.push({
      productId: resolvedProductId || `row-${i}`,
      restaurantName: restaurantName || lastRestaurant,
      name: resolvedName,
      description: (description || lastDescription) || null,
      price: Number.isFinite(price) ? price : 0,
      category: (category || lastCategory) || null,
      available: visible,
      optionPairs
    });
  } else {
    if (parts.length < 8) continue;
    const restaurantName = mapRestaurantSlug((parts[3] || '').trim());
    const category = (parts[4] || '').trim().replace(/^\//, '');
    const name = (parts[5] || '').trim();
    const description = stripHtml((parts[6] || '').trim());
    const price = parseFloat(parts[7]) || 0;
    const visible = parts.length > 12 ? (parts[12] || '').trim().toLowerCase() === 'yes' : true;
    const productType = (parts[2] || '').trim();
    const variants = (parts[10] || '').trim();
    if (!restaurantName || !name) continue;
    parsed.push({
      productId: (parts[0] || '').trim() || `row-${i}`,
      restaurantName,
      name,
      description: description || null,
      price,
      category: category || null,
      available: visible,
      productType,
      variants,
      optionPairs: variants ? [{ name: 'Variety', value: variants }] : []
    });
  }
}

/** Group by (restaurantName, productId); then build simple / variety / builder to match DB structure */
function buildItems() {
  const byKey = new Map();
  for (const row of parsed) {
    if (!row.restaurantName) continue;
    const key = isLongFormat
      ? `${row.restaurantName}\t${row.productId}`
      : `${row.restaurantName}\t${row.productId}\t${row.name}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }

  const items = [];
  for (const rows of byKey.values()) {
    const first = rows[0];
    const name = first.name || (first.optionPairs[0] && first.optionPairs[0].value) || 'Unnamed';
    const basePrice = first.price;
    const category = (first.category && first.category.trim()) ? first.category.trim() : DEFAULT_CATEGORY;

    const allOptionNames = new Set();
    for (const r of rows) {
      for (const p of (r.optionPairs || [])) {
        if (p.name && p.name.trim()) allOptionNames.add(p.name.trim());
      }
    }

    if (allOptionNames.size >= 2) {
      const configurations = [];
      for (const optName of allOptionNames) {
        const valueToModifier = new Map();
        for (const r of rows) {
          for (const p of (r.optionPairs || [])) {
            if ((p.name || '').trim() !== optName) continue;
            const v = (p.value || 'Default').trim() || 'Default';
            const mod = Number.isFinite(r.price) && Number.isFinite(basePrice) ? roundPrice(r.price - basePrice) : 0;
            if (!valueToModifier.has(v)) valueToModifier.set(v, mod);
          }
        }
        const options = Array.from(valueToModifier.entries()).map(([optionName, priceModifier]) => ({
          name: optionName,
          priceModifier
        }));
        if (options.length) {
          configurations.push({
            category: optName,
            required: true,
            maxSelections: 1,
            options
          });
        }
      }
      if (configurations.length >= 2) {
        items.push({
          restaurantName: first.restaurantName,
          name,
          description: first.description,
          price: basePrice,
          category,
          available: first.available !== false,
          itemType: 'builder',
          options: { configurations }
        });
        continue;
      }
    }

    if (allOptionNames.size === 1 || first.productType === 'Variable' || (first.variants && first.variants.trim())) {
      const variantList = rows.map((r) => {
        const vName = (r.optionPairs[0] && r.optionPairs[0].value) || first.variants || 'Default';
        const v = (typeof vName === 'string' ? vName : '').trim() || 'Default';
        const modifier = Number.isFinite(r.price) && Number.isFinite(basePrice) ? roundPrice(r.price - basePrice) : 0;
        return { name: v, priceModifier: modifier };
      });
      if (variantList.length === 0 && first.variants && first.variants.trim()) {
        variantList.push({ name: first.variants.trim(), priceModifier: 0 });
      }
      if (variantList.length > 0) {
        items.push({
          restaurantName: first.restaurantName,
          name,
          description: first.description,
          price: basePrice,
          category,
          available: first.available !== false,
          itemType: 'variety',
          options: { variants: variantList }
        });
        continue;
      }
    }

    items.push({
      restaurantName: first.restaurantName,
      name,
      description: first.description,
      price: basePrice,
      category,
      available: first.available !== false,
      itemType: 'simple',
      options: null
    });
  }
  return items;
}

const itemsToCreate = buildItems();

async function run() {
  let created = 0;
  let skipped = 0;
  let replaced = 0;
  const validationErrors = [];
  const counts = { simple: 0, variety: 0, builder: 0 };
  const t = await sequelize.transaction();
  try {
    const byRestaurant = new Map();
    for (const item of itemsToCreate) {
      const k = item.restaurantName;
      if (!byRestaurant.has(k)) byRestaurant.set(k, []);
      byRestaurant.get(k).push(item);
    }

    for (const [restaurantName, items] of byRestaurant) {
      let restaurant = await Restaurant.findByPk(restaurantName, { transaction: t });
      if (!restaurant) {
        const [createdRestaurant] = await Restaurant.findOrCreate({
          where: { id: restaurantName },
          defaults: {
            id: restaurantName,
            name: humanizeSlug(restaurantName),
            address: null,
            phone: null,
            typeOfFood: null,
            kosherCertification: null,
            logoUrl: null,
            featured: false,
            active: true
          },
          transaction: t
        });
        restaurant = createdRestaurant;
        logger.info('Created restaurant for upload:', restaurantName);
      }

      if (replace && items.length > 0) {
        const deleted = await MenuItem.destroy({
          where: { restaurantId: restaurant.id },
          transaction: t
        });
        if (deleted > 0) {
          replaced += deleted;
          logger.info(`Replaced ${deleted} menu items for ${restaurant.id}`);
        }
      }

      for (const item of items) {
        if (!item.name || !item.name.trim()) continue;
        const existing = await MenuItem.findOne({
          where: { restaurantId: restaurant.id, name: item.name.trim() },
          transaction: t
        });
        if (existing) {
          skipped++;
          continue;
        }
        const payload = {
          name: item.name.trim(),
          description: item.description || null,
          price: item.price,
          category: item.category || DEFAULT_CATEGORY,
          available: item.available !== false,
          itemType: item.itemType,
          options: item.options
        };
        const errs = validateMenuItemData(payload);
        if (errs.length) {
          validationErrors.push({ name: item.name, errors: errs });
          continue;
        }
        await MenuItem.create(
          {
            restaurantId: restaurant.id,
            name: payload.name,
            description: payload.description,
            price: payload.price,
            category: payload.category,
            imageUrl: null,
            available: payload.available,
            itemType: payload.itemType,
            options: payload.options,
            labels: []
          },
          { transaction: t }
        );
        created++;
        counts[payload.itemType] = (counts[payload.itemType] || 0) + 1;
      }
    }

    await t.commit();
    console.log('\nImport complete:', created, 'created,', skipped, 'skipped' + (replaced ? `, ${replaced} replaced` : ''));
    console.log('By type: simple', counts.simple || 0, '| variety', counts.variety || 0, '| builder', counts.builder || 0);
    if (validationErrors.length) {
      console.log('Validation skipped:', validationErrors.length, 'items');
      validationErrors.slice(0, 5).forEach(({ name, errors }) => {
        console.log('  -', name, errors.join('; '));
      });
      if (validationErrors.length > 5) console.log('  ... and', validationErrors.length - 5, 'more');
    }
    logger.info('Product TSV import complete', { created, skipped, replaced, byType: counts });
  } catch (err) {
    await t.rollback();
    logger.error('Import failed', err);
    console.error('Import failed:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

run();
