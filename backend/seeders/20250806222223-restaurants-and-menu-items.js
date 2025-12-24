'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date();

    // Clear existing data to avoid conflicts
    await queryInterface.bulkDelete('menu_items', null, {});
    await queryInterface.bulkDelete('restaurants', null, {});

    // Restaurants copied from src/data/restaurants.js (images handled separately via logo filenames)
    const restaurants = [
      {
        id: 'bagel-boys',
        name: 'Bagel Boys',
        address: '598 Central Ave, Cedarhurst, NY 11516',
        phone: '516-374-7644',
        type_of_food: 'Bagels, Breakfast Eats, Dairy',
        kosher_certification: 'VAAD',
        logo_url: 'bagelBoysLogo.jpg',
        featured: false,
        created_at: now,
        updated_at: now
      },
      {
        id: 'the-cheese-store',
        name: 'The Cheese Store',
        address: '532 Central Ave, Cedarhurst, NY 11516',
        phone: '516-295-3099',
        type_of_food: 'Cheese, Coffee, Dairy',
        kosher_certification: 'VAAD',
        logo_url: 'cheeseStoreLogo.jpg',
        featured: false,
        created_at: now,
        updated_at: now
      },
      {
        id: 'stop-chop-and-roll',
        name: 'Stop Chop & Roll',
        address: '119 Cedarhurst Ave, Cedarhurst, NY 11516',
        phone: '516-341-7874',
        type_of_food: 'Sushi',
        kosher_certification: 'VAAD',
        logo_url: 'stopChopLogo.png',
        featured: true,
        created_at: now,
        updated_at: now
      },
      {
        id: 'ruthys-grocery-and-deli',
        name: "Ruthy's Grocery & Deli",
        address: '142 Cedarhurst Ave, Cedarhurst, NY 11516',
        phone: '516-374-2744',
        type_of_food: 'Israeli Food, Meat',
        kosher_certification: 'VAAD',
        logo_url: 'ruthiesPlaceLogo.png',
        featured: false,
        created_at: now,
        updated_at: now
      },
      {
        id: 'graze-smokehouse',
        name: 'Graze Smokehouse',
        address: '529 Central Ave, Cedarhurst, NY 11516',
        phone: '516-828-5000',
        type_of_food: 'BBQ, Smokehouse, Jerky, Meat',
        kosher_certification: 'VAAD',
        logo_url: 'grazeLogo.png',
        featured: true,
        created_at: now,
        updated_at: now
      },
      {
        id: 'traditions-eatery',
        name: 'Traditions Eatery',
        address: '302 Central Ave, Lawrence, NY 11559',
        phone: '516-295-3630',
        type_of_food: 'Deli, Meat',
        kosher_certification: 'VAAD',
        logo_url: 'traditionsEateryLogo.jpg',
        featured: true,
        created_at: now,
        updated_at: now
      },
      {
        id: 'alans-bakery',
        name: "Alan's Bakery",
        address: '140E Washington Ave, Cedarhurst, NY 11516',
        phone: '516-812-5000',
        type_of_food: 'Bakery',
        kosher_certification: 'VAAD',
        logo_url: 'alansBakeryLogo.jpg',
        featured: false,
        created_at: now,
        updated_at: now
      },
      {
        id: 'central-perk-cafe',
        name: 'Central Perk Cafe',
        address: '105 Cedarhurst Ave, Cedarhurst, NY 11516',
        phone: '516-374-6400',
        type_of_food: 'Breakfast and Brunch Cafe, Dairy',
        kosher_certification: 'VAAD',
        logo_url: 'centralPerkLogo.jpg',
        featured: false,
        created_at: now,
        updated_at: now
      },
      {
        id: 'spruce-dvine',
        name: "Spruce D'Vine",
        address: '131 Spruce St, Cedarhurst, NY 11516',
        phone: '516-791-9800',
        type_of_food: 'Wine and Spirits, Alcohol',
        kosher_certification: 'Kosher',
        logo_url: 'spruceDvineLogo.png',
        featured: true,
        created_at: now,
        updated_at: now
      },
      {
        id: 'oh-nuts',
        name: 'Oh! Nuts',
        address: '480 Central Ave, Cedarhurst, NY 11516',
        phone: '516-295-0131',
        type_of_food: 'Nuts, Chocolates, Candy',
        kosher_certification: 'VAAD',
        logo_url: 'ohNutsLogo.jpeg',
        featured: false,
        created_at: now,
        updated_at: now
      },
      {
        id: 'five-fifty',
        name: 'Five Fifty',
        address: '550 Central Ave, Cedarhurst, NY 11516',
        phone: '516-374-0550',
        type_of_food: 'Premium Prepared Food, Meat',
        kosher_certification: 'VAAD',
        logo_url: 'fiveFiftyLogo.png',
        featured: false,
        created_at: now,
        updated_at: now
      },
      {
        id: 'mazza-and-more',
        name: 'Mazza & More',
        address: '412 Avenue M, Brooklyn, NY 11230',
        phone: '844-466-2992',
        type_of_food: 'Israeli Food, Meat',
        kosher_certification: 'TARTIKOV',
        logo_url: 'mazzaAndMoreLogo.png',
        featured: true,
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('restaurants', restaurants, {});

    // Menu items copied from src/data/restaurants.js (category omitted)
    const menuItems = [
      // Bagel Boys
      {
        id: uuidv4(),
        restaurant_id: 'bagel-boys',
        name: 'Everything Bagel with Cream Cheese',
        description: 'Fresh baked everything bagel with premium cream cheese spread',
        price: 4.50,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['D']),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        restaurant_id: 'bagel-boys',
        name: 'Lox and Bagel Platter',
        description: 'Nova lox, cream cheese, tomato, onion, and capers on your choice of bagel',
        price: 12.95,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['D']),
        created_at: now,
        updated_at: now
      },
      // The Cheese Store
      {
        id: uuidv4(),
        restaurant_id: 'the-cheese-store',
        name: 'Artisanal Cheese Board',
        description: 'Selection of premium kosher cheeses with crackers and accompaniments',
        price: 18.00,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32b?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['D']),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        restaurant_id: 'the-cheese-store',
        name: 'Cappuccino',
        description: 'Rich espresso with steamed milk and foam',
        price: 4.25,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['D']),
        created_at: now,
        updated_at: now
      },
      // Stop Chop & Roll
      {
        id: uuidv4(),
        restaurant_id: 'stop-chop-and-roll',
        name: 'California Roll',
        description: 'Imitation crab, avocado, and cucumber rolled in seaweed and rice',
        price: 8.50,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify([]),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        restaurant_id: 'stop-chop-and-roll',
        name: 'Salmon Avocado Roll',
        description: 'Fresh salmon and avocado with sushi rice and nori',
        price: 10.95,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify([]),
        created_at: now,
        updated_at: now
      },
      // Ruthy's Grocery & Deli
      {
        id: uuidv4(),
        restaurant_id: 'ruthys-grocery-and-deli',
        name: 'Falafel Platter',
        description: 'Crispy falafel balls with hummus, tahini, and fresh vegetables',
        price: 12.00,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['V', 'GF']),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        restaurant_id: 'ruthys-grocery-and-deli',
        name: 'Shawarma Wrap',
        description: 'Tender spiced meat in a warm pita with vegetables and sauce',
        price: 14.50,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['M']),
        created_at: now,
        updated_at: now
      },
      // Graze Smokehouse
      {
        id: uuidv4(),
        restaurant_id: 'graze-smokehouse',
        name: 'BBQ Brisket Platter',
        description: 'Slow-smoked brisket with BBQ sauce, coleslaw, and pickles',
        price: 18.95,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['M']),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        restaurant_id: 'graze-smokehouse',
        name: 'Smoked Wings',
        description: 'Tender smoked chicken wings with your choice of sauce',
        price: 13.50,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['M']),
        created_at: now,
        updated_at: now
      },
      // Traditions Eatery
      {
        id: uuidv4(),
        restaurant_id: 'traditions-eatery',
        name: 'Pastrami Sandwich',
        description: 'House-cured pastrami on rye bread with mustard and pickles',
        price: 15.50,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['M']),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        restaurant_id: 'traditions-eatery',
        name: 'Matzo Ball Soup',
        description: 'Traditional chicken soup with fluffy matzo balls',
        price: 8.95,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['M']),
        created_at: now,
        updated_at: now
      },
      // Alan's Bakery
      {
        id: uuidv4(),
        restaurant_id: 'alans-bakery',
        name: 'Chocolate Rugelach',
        description: 'Traditional Jewish pastry filled with chocolate and nuts',
        price: 3.50,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['D']),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        restaurant_id: 'alans-bakery',
        name: 'Challah Bread',
        description: 'Fresh baked traditional braided bread, perfect for Shabbat',
        price: 6.00,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['D']),
        created_at: now,
        updated_at: now
      },
      // Central Perk Cafe
      {
        id: uuidv4(),
        restaurant_id: 'central-perk-cafe',
        name: 'Avocado Toast',
        description: 'Smashed avocado on sourdough with tomato, feta, and herbs',
        price: 9.95,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['D', 'V']),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        restaurant_id: 'central-perk-cafe',
        name: 'Greek Yogurt Parfait',
        description: 'Creamy Greek yogurt layered with granola and fresh berries',
        price: 7.50,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['D', 'V']),
        created_at: now,
        updated_at: now
      },
      // Spruce D'Vine
      {
        id: uuidv4(),
        restaurant_id: 'spruce-dvine',
        name: 'Kosher Red Wine Selection',
        description: 'Premium selection of kosher red wines from various regions',
        price: 25.00,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify([]),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        restaurant_id: 'spruce-dvine',
        name: 'Artisanal Cheese & Wine Pairing',
        description: 'Curated selection of kosher wines paired with artisanal cheeses',
        price: 35.00,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1515669097368-22e68427d265?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['D']),
        created_at: now,
        updated_at: now
      },
      // Oh! Nuts
      {
        id: uuidv4(),
        restaurant_id: 'oh-nuts',
        name: 'Mixed Nuts Assortment',
        description: 'Premium selection of roasted and seasoned nuts',
        price: 12.95,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['V', 'GF']),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        restaurant_id: 'oh-nuts',
        name: 'Dark Chocolate Truffles',
        description: 'Handcrafted dark chocolate truffles with various fillings',
        price: 16.50,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['D']),
        created_at: now,
        updated_at: now
      },
      // Five Fifty
      {
        id: uuidv4(),
        restaurant_id: 'five-fifty',
        name: 'Herb-Crusted Lamb Chops',
        description: 'Premium lamb chops with herb crust and seasonal vegetables',
        price: 28.95,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['M']),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        restaurant_id: 'five-fifty',
        name: 'Gourmet Beef Wellington',
        description: 'Tender beef wrapped in puff pastry with mushroom duxelles',
        price: 32.00,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['M']),
        created_at: now,
        updated_at: now
      },
      // Mazza & More
      {
        id: uuidv4(),
        restaurant_id: 'mazza-and-more',
        name: 'Mixed Grill Platter',
        description: 'Combination of grilled meats with rice, salad, and pita',
        price: 22.50,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['M']),
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        restaurant_id: 'mazza-and-more',
        name: 'Hummus with Meat',
        description: 'Creamy hummus topped with seasoned ground meat and pine nuts',
        price: 16.95,
        category: null,
        image_url: 'https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=600&q=80',
        available: true,
        item_type: 'simple',
        labels: JSON.stringify(['M']),
        created_at: now,
        updated_at: now
      },
    ];

    await queryInterface.bulkInsert('menu_items', menuItems, {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('menu_items', null, {});
    await queryInterface.bulkDelete('restaurants', null, {});
  }
};
