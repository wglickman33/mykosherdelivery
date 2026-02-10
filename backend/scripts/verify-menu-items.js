require('dotenv').config();
const { Restaurant, MenuItem, sequelize } = require('../models');
const { validateMenuItemData } = require('../utils/menuItemValidation');

const restaurantId = process.argv[2] || null;

async function run() {
  try {
    const where = restaurantId ? { id: restaurantId } : {};
    const restaurants = await Restaurant.findAll({
      where,
      order: [['id', 'ASC']],
      include: [{ model: MenuItem, as: 'menuItems', required: false }]
    });
    if (restaurants.length === 0) {
      console.log(restaurantId ? `No restaurant found: ${restaurantId}` : 'No restaurants in DB.');
      process.exit(0);
      return;
    }
    let totalSimple = 0;
    let totalVariety = 0;
    let totalBuilder = 0;
    const invalid = [];
    for (const r of restaurants) {
      const items = r.menuItems || [];
      const counts = { simple: 0, variety: 0, builder: 0 };
      for (const mi of items) {
        const t = (mi.itemType || 'simple').toLowerCase();
        if (t === 'simple') counts.simple++;
        else if (t === 'variety') counts.variety++;
        else if (t === 'builder') counts.builder++;
        const payload = {
          name: mi.name,
          itemType: mi.itemType,
          price: mi.price,
          category: mi.category || 'general',
          options: mi.options
        };
        const errs = validateMenuItemData(payload);
        if (errs.length) invalid.push({ restaurant: r.id, name: mi.name, errors: errs });
      }
      totalSimple += counts.simple;
      totalVariety += counts.variety;
      totalBuilder += counts.builder;
      console.log(`${r.id}: ${items.length} items (simple: ${counts.simple}, variety: ${counts.variety}, builder: ${counts.builder})`);
    }
    console.log('\nTotal: simple', totalSimple, '| variety', totalVariety, '| builder', totalBuilder);
    if (invalid.length) {
      console.log('\nValidation issues:', invalid.length);
      invalid.slice(0, 10).forEach(({ restaurant, name, errors }) => {
        console.log('  -', restaurant, name, errors.join('; '));
      });
      if (invalid.length > 10) console.log('  ... and', invalid.length - 10, 'more');
    } else {
      console.log('All items pass validation.');
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

run();
