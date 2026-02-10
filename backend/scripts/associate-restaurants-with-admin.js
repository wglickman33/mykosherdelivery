/**
 * Associate all restaurants with an admin account by creating RestaurantOwner rows.
 * This lets the admin see restaurants in the owner portal and ensures every restaurant
 * is linked to at least one user.
 *
 * Usage: node backend/scripts/associate-restaurants-with-admin.js <admin-email-or-user-id>
 * Example: node backend/scripts/associate-restaurants-with-admin.js admin@example.com
 */

require('dotenv').config();
const path = require('path');
const models = require(path.resolve(__dirname, '..', 'models'));
const { Profile, Restaurant, RestaurantOwner } = models;

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node associate-restaurants-with-admin.js <admin-email-or-user-id>');
    process.exit(1);
  }

  const user = await Profile.findOne({
    where: arg.includes('@')
      ? { email: arg }
      : { id: arg }
  });

  if (!user) {
    console.error('User not found:', arg);
    process.exit(2);
  }

  if (user.role !== 'admin') {
    console.log(`User ${user.email} has role "${user.role}". Setting role to "admin" for owner portal access.`);
    await user.update({ role: 'admin' });
  }

  const restaurants = await Restaurant.findAll({ attributes: ['id', 'name'] });
  if (restaurants.length === 0) {
    console.log('No restaurants in the database. Nothing to associate.');
    process.exit(0);
  }

  let created = 0;
  let skipped = 0;

  for (const r of restaurants) {
    const [, wasCreated] = await RestaurantOwner.findOrCreate({
      where: { userId: user.id, restaurantId: r.id },
      defaults: { userId: user.id, restaurantId: r.id }
    });
    if (wasCreated) created++;
    else skipped++;
  }

  console.log(`Admin: ${user.email} (${user.id})`);
  console.log(`Restaurants: ${restaurants.length} total, ${created} new associations, ${skipped} already linked.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(3);
});
