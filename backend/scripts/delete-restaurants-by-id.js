/* eslint-env node */
require('dotenv').config();
const path = require('path');
const models = require(path.resolve(__dirname, '..', 'models'));
const { Restaurant, MenuItem, UserRestaurantFavorite, Order, sequelize } = models;

async function deleteByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    console.error('Provide at least one restaurant id');
    process.exit(1);
  }
  const t = await sequelize.transaction();
  try {
    let total = 0;
    for (const id of ids) {
      const exists = await Restaurant.findByPk(id, { transaction: t });
      if (!exists) {
        console.log(`No row for id=${id}`);
        continue;
      }
      console.log(`Cleaning references for id=${id}...`);
      await Order.update({ restaurantId: null }, { where: { restaurantId: id }, transaction: t });
      await UserRestaurantFavorite.destroy({ where: { restaurantId: id }, transaction: t });
      await MenuItem.destroy({ where: { restaurantId: id }, transaction: t });
      const [result] = await sequelize.query('DELETE FROM restaurants WHERE id = :id', { replacements: { id }, transaction: t });
      console.log(`Deleted restaurant id=${id}`);
      total += (result?.rowCount || 1);
    }
    await t.commit();
    console.log(`Done. Deleted ${total} restaurant rows.`);
    process.exit(0);
  } catch (err) {
    await t.rollback();
    console.error('Error during delete:', err);
    process.exit(2);
  }
}

const idsFromArgs = process.argv.slice(2);
deleteByIds(idsFromArgs); 