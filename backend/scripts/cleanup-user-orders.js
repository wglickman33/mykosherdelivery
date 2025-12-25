const { Order, Profile } = require('../models');

async function cleanupUserOrders() {
  try {
    const user = await Profile.findOne({
      where: { email: 'willglickman@gmail.com' }
    });

    if (!user) {
      console.log('❌ User not found with email: willglickman@gmail.com');
      return;
    }

    console.log(`👤 Found user: ${user.firstName} ${user.lastName} (ID: ${user.id})`);

    const orders = await Order.findAll({
      where: { userId: user.id }
    });

    console.log(`📦 Found ${orders.length} orders for this user`);

    if (orders.length === 0) {
      console.log('✅ No orders to clean up');
      return;
    }

    const deletedCount = await Order.destroy({
      where: { userId: user.id }
    });

    console.log(`🗑️  Successfully deleted ${deletedCount} orders for ${user.firstName} ${user.lastName}`);
    console.log('✅ Cleanup completed!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

cleanupUserOrders(); 