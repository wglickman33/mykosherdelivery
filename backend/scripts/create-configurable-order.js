const { Order, Profile, Restaurant, MenuItem } = require('../models');
const { sequelize } = require('../models');

async function createConfigurableOrder() {
  try {
    // Find an existing user (don't create new one to avoid password requirement)
    let user = await Profile.findOne({ where: { role: 'user' } });
    if (!user) {
      console.log('No users found. Please create a user first through the app.');
      return;
    }

    // Find a restaurant (or use the first one)
    const restaurant = await Restaurant.findOne();
    if (!restaurant) {
      console.log('No restaurants found. Please create a restaurant first.');
      return;
    }

    // Create order with configurable item
    const orderNumber = `ORD-${Date.now()}`;
    
    // Calculate the configuration price correctly
    const selectedConfigurations = [
      { category: 'Base', option: 'Brown Rice', priceModifier: 0 },
      { category: 'Protein', option: 'Salmon', priceModifier: 2.00 },
      { category: 'Protein', option: 'Tuna', priceModifier: 1.00 },
      { category: 'Toppings', option: 'Avocado', priceModifier: 1.50 },
      { category: 'Toppings', option: 'Cucumber', priceModifier: 0 },
      { category: 'Toppings', option: 'Edamame', priceModifier: 0.50 },
      { category: 'Sauce', option: 'Spicy Mayo', priceModifier: 0 }
    ];

    const basePrice = 21.54; // This should be the actual base price
    const configurationPrice = selectedConfigurations.reduce((total, config) => total + config.priceModifier, 0);
    const finalPrice = basePrice + configurationPrice;

    const configurableItem = {
      id: 'config-item-1',
      name: 'Build Your Own Poke Bowl',
      price: finalPrice,
      basePrice: basePrice,
      quantity: 1,
      itemType: 'builder',
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      selectedConfigurations: selectedConfigurations,
      configurationPrice: configurationPrice,
      specialInstructions: 'Extra spicy please!'
    };

    const subtotal = finalPrice * configurableItem.quantity;
    const deliveryFee = 3.99;
    const tip = 4.00;
    const tax = subtotal * 0.0825; // 8.25% tax
    const total = subtotal + deliveryFee + tip + tax;

    const order = await Order.create({
      userId: user.id,
      restaurantId: restaurant.id,
      orderNumber: orderNumber,
      status: 'pending',
      items: [configurableItem],
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      tip: tip,
      tax: tax,
      total: total,
      deliveryAddress: '123 Test Street, Test City, TC 12345',
      deliveryInstructions: 'Ring doorbell twice'
    });

    console.log('✅ Created configurable order successfully!');
    console.log(`Order Number: ${orderNumber}`);
    console.log(`Order ID: ${order.id}`);
    console.log(`User: ${user.firstName} ${user.lastName}`);
    console.log(`Restaurant: ${restaurant.name}`);
    console.log(`Item: ${configurableItem.name}`);
    console.log(`Configurations:`);
    const configsByCategory = {};
    configurableItem.selectedConfigurations.forEach(config => {
      if (!configsByCategory[config.category]) {
        configsByCategory[config.category] = [];
      }
      configsByCategory[config.category].push(`${config.option} (+$${config.priceModifier})`);
    });
    Object.entries(configsByCategory).forEach(([category, options]) => {
      console.log(`  ${category}: ${options.join(', ')}`);
    });
    console.log(`Base Price: $${configurableItem.basePrice.toFixed(2)}`);
    console.log(`Configuration Price: +$${configurableItem.configurationPrice.toFixed(2)}`);
    console.log(`Final Price: $${configurableItem.price.toFixed(2)}`);
    console.log(`Subtotal: $${parseFloat(order.subtotal).toFixed(2)}`);
    console.log(`Total Order: $${parseFloat(order.total).toFixed(2)}`);

  } catch (error) {
    console.error('Error creating configurable order:', error);
  } finally {
    await sequelize.close();
  }
}

createConfigurableOrder();
