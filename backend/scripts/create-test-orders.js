require('dotenv').config();
const { Order, Profile, Restaurant } = require('../models');
const { sequelize } = require('../models');

// Compute MKD week window: Friday 6:00 PM to the following Thursday 6:00 PM (local time)
const getMKDWeekWindow = (offsetWeeks = 0) => {
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = todayMid.getDay(); // 0 Sun .. 6 Sat

  // Days since last Friday
  const daysSinceFri = (day + 2) % 7; // Fri(5)->0, Sat(6)->1, Sun(0)->2, ... Thu(4)->6

  // Candidate last Friday 18:00
  const start = new Date(todayMid);
  start.setDate(todayMid.getDate() - daysSinceFri);
  start.setHours(18, 0, 0, 0);

  // If it's earlier than this Friday 18:00, roll back one week
  if (now < start) {
    start.setDate(start.getDate() - 7);
  }

  // Apply offset weeks into the past
  if (offsetWeeks && Number.isFinite(offsetWeeks)) {
    start.setDate(start.getDate() - (7 * offsetWeeks));
  }

  // End = Thursday 18:00 following that Friday
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Fri -> Thu
  end.setHours(18, 0, 0, 0);

  return { start, end };
};

// Generate a random date within the week window
const getRandomDateInWeek = (start, end) => {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime);
};

async function createTestOrders() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Get current week window
    const { start, end } = getMKDWeekWindow(0);
    console.log(`Creating orders for week: ${start.toLocaleString()} to ${end.toLocaleString()}`);

    // Get all restaurants
    const restaurants = await Restaurant.findAll({ where: { active: true } });
    if (restaurants.length === 0) {
      console.log('No restaurants found. Please create restaurants first.');
      await sequelize.close();
      return;
    }
    console.log(`Found ${restaurants.length} restaurants`);

    // Get or create test users
    const testUsers = [
      { firstName: 'William', lastName: 'GLICKMAN', email: 'glickman@test.com' },
      { firstName: 'Sarah', lastName: 'ROSE', email: 'rose@test.com' },
      { firstName: 'David', lastName: 'NAYOWITZ', email: 'nayowitz@test.com' },
      { firstName: 'Rachel', lastName: 'COHEN', email: 'cohen@test.com' },
      { firstName: 'Michael', lastName: 'LEVINE', email: 'levine@test.com' }
    ];

    const users = [];
    for (const userData of testUsers) {
      let user = await Profile.findOne({ where: { email: userData.email } });
      if (!user) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('test123', 12);
        user = await Profile.create({
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: 'user'
        });
        console.log(`Created test user: ${userData.firstName} ${userData.lastName}`);
      } else {
        console.log(`Using existing user: ${userData.firstName} ${userData.lastName}`);
      }
      users.push(user);
    }

    // Sample menu items for different restaurants
    const sampleItems = {
      bakery: [
        { name: 'Egg Challah', price: 8.99, quantity: 3 },
        { name: 'Cookies', price: 4.99, quantity: 2 },
        { name: 'Challah Roll', price: 2.99, quantity: 4 },
        { name: 'Muffin', price: 3.99, quantity: 5 },
        { name: 'Multigrain Challah', price: 9.99, quantity: 1 },
        { name: 'Rugalach', price: 5.99, quantity: 2 },
        { name: 'Cupcakes', price: 6.99, quantity: 1 },
        { name: 'Pie', price: 12.99, quantity: 2 }
      ],
      deli: [
        { name: 'Pastrami Sandwich', price: 14.99, quantity: 1 },
        { name: 'Turkey Sandwich', price: 13.99, quantity: 2 },
        { name: 'Cole Slaw', price: 4.99, quantity: 1 }
      ],
      pizza: [
        { name: 'Large Cheese Pizza', price: 18.99, quantity: 1 },
        { name: 'Pepperoni Pizza', price: 21.99, quantity: 1 },
        { name: 'Garlic Bread', price: 6.99, quantity: 2 }
      ]
    };

    // Create test orders
    const orders = [
      {
        user: users[0], // GLICKMAN
        restaurant: restaurants[0],
        items: [
          { name: 'Egg Challah', price: 8.99, quantity: 3 },
          { name: 'Cookies', price: 4.99, quantity: 2 },
          { name: 'Challah Roll', price: 2.99, quantity: 4 }
        ],
        dateOffset: 0 // Friday
      },
      {
        user: users[1], // ROSE
        restaurant: restaurants[0],
        items: [
          { name: 'Muffin', price: 3.99, quantity: 5 },
          { name: 'Multigrain Challah', price: 9.99, quantity: 1 },
          { name: 'Rugalach', price: 5.99, quantity: 2 }
        ],
        dateOffset: 1 // Saturday
      },
      {
        user: users[2], // NAYOWITZ
        restaurant: restaurants[0],
        items: [
          { name: 'Cupcakes', price: 6.99, quantity: 1 },
          { name: 'Pie', price: 12.99, quantity: 2 }
        ],
        dateOffset: 2 // Sunday
      },
      {
        user: users[3], // COHEN
        restaurant: restaurants.length > 1 ? restaurants[1] : restaurants[0],
        items: [
          { name: 'Pastrami Sandwich', price: 14.99, quantity: 1 },
          { name: 'Cole Slaw', price: 4.99, quantity: 1 }
        ],
        dateOffset: 3 // Monday
      },
      {
        user: users[4], // LEVINE
        restaurant: restaurants.length > 2 ? restaurants[2] : restaurants[0],
        items: [
          { name: 'Large Cheese Pizza', price: 18.99, quantity: 1 },
          { name: 'Garlic Bread', price: 6.99, quantity: 2 }
        ],
        dateOffset: 4 // Tuesday
      }
    ];

    let createdCount = 0;
    for (const orderData of orders) {
      const orderDate = new Date(start);
      orderDate.setDate(start.getDate() + orderData.dateOffset);
      orderDate.setHours(12 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 60), 0, 0); // Random time between 12 PM and 6 PM

      const subtotal = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const deliveryFee = 5.99;
      const tax = subtotal * 0.0825;
      const total = subtotal + deliveryFee + tax;

      const restaurantGroups = {
        [orderData.restaurant.id]: {
          items: orderData.items,
          subtotal: subtotal
        }
      };

      const orderNumber = `MKD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const order = await Order.create({
        userId: orderData.user.id,
        restaurantId: orderData.restaurant.id,
        restaurantGroups: restaurantGroups,
        orderNumber: orderNumber,
        status: ['pending', 'confirmed', 'preparing', 'delivered'][Math.floor(Math.random() * 4)],
        items: orderData.items.map(item => ({
          ...item,
          restaurantId: orderData.restaurant.id
        })),
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        tip: 0,
        tax: tax,
        total: total,
        discountAmount: 0,
        appliedPromo: null,
        deliveryAddress: {
          street: '123 Test Street',
          city: 'New York',
          state: 'NY',
          zipCode: '10001'
        },
        deliveryInstructions: 'Ring doorbell',
        createdAt: orderDate,
        updatedAt: orderDate
      });

      console.log(`Created order ${orderNumber} for ${orderData.user.lastName} on ${orderDate.toLocaleString()}`);
      createdCount++;
    }

    console.log(`\nSuccessfully created ${createdCount} test orders for the current week.`);
    await sequelize.close();
  } catch (error) {
    console.error('Error creating test orders:', error);
    await sequelize.close();
    process.exit(1);
  }
}

createTestOrders();

