const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { NursingHomeMenuItem } = require('../models');
const logger = require('../utils/logger');

const menuItemsRaw = [
  { mealType: 'breakfast', category: 'main', name: 'Scrambled Eggs', description: '', price: 15.00, requiresBagelType: false, excludesSide: false, displayOrder: 1 },
  { mealType: 'breakfast', category: 'main', name: 'Omelet', description: '', price: 15.00, requiresBagelType: false, excludesSide: false, displayOrder: 2 },
  { mealType: 'breakfast', category: 'main', name: 'Egg White Omelet', description: '', price: 15.00, requiresBagelType: false, excludesSide: false, displayOrder: 3 },
  { mealType: 'breakfast', category: 'main', name: '2 Eggs on Bagel', description: 'Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: false, displayOrder: 4 },
  { mealType: 'breakfast', category: 'main', name: '2 Eggs & Cheese on Bagel', description: 'Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: false, displayOrder: 5 },
  { mealType: 'breakfast', category: 'main', name: 'Pizza Bagels (2pc)', description: 'Comes on Plain Bagel Only', price: 15.00, requiresBagelType: false, excludesSide: false, displayOrder: 6 },
  { mealType: 'breakfast', category: 'main', name: 'Butter on Bagel', description: 'Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: false, displayOrder: 7 },
  { mealType: 'breakfast', category: 'main', name: 'Plain Cream Cheese on Bagel', description: 'Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: false, displayOrder: 8 },
  { mealType: 'breakfast', category: 'main', name: 'Vegetable Cream Cheese on Bagel', description: 'Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: false, displayOrder: 9 },
  { mealType: 'breakfast', category: 'main', name: 'Scallion Cream Cheese on Bagel', description: 'Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: false, displayOrder: 10 },
  { mealType: 'breakfast', category: 'main', name: 'Olive Cream Cheese on Bagel', description: 'Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: false, displayOrder: 11 },
  { mealType: 'breakfast', category: 'main', name: 'Lox Spread on Bagel', description: 'Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: false, displayOrder: 12 },
  { mealType: 'breakfast', category: 'main', name: 'Pancakes with Syrup', description: 'Does not include side', price: 15.00, requiresBagelType: false, excludesSide: true, displayOrder: 13 },
  { mealType: 'breakfast', category: 'main', name: 'Chocolate Chip Pancakes with Syrup', description: 'Does not include side', price: 15.00, requiresBagelType: false, excludesSide: true, displayOrder: 14 },
  { mealType: 'breakfast', category: 'main', name: 'Blueberry Pancakes with Syrup', description: 'Does not include side', price: 15.00, requiresBagelType: false, excludesSide: true, displayOrder: 15 },
  { mealType: 'breakfast', category: 'main', name: 'French Toast with Syrup', description: 'Does not include side', price: 15.00, requiresBagelType: false, excludesSide: true, displayOrder: 16 },
  { mealType: 'breakfast', category: 'main', name: 'Waffles with Syrup', description: 'Does not include side', price: 15.00, requiresBagelType: false, excludesSide: true, displayOrder: 17 },
  { mealType: 'breakfast', category: 'main', name: 'Tuna Salad on Bagel w/ Pickle and Coleslaw', description: 'Does not include side. Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: true, displayOrder: 18 },
  { mealType: 'breakfast', category: 'main', name: 'Egg Salad on Bagel w/ Pickle and Coleslaw', description: 'Does not include side. Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: true, displayOrder: 19 },
  { mealType: 'breakfast', category: 'main', name: 'Egg Mushroom Onion Salad on Bagel w/ Pickle and Coleslaw', description: 'Does not include side. Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: true, displayOrder: 20 },
  { mealType: 'breakfast', category: 'main', name: 'Egg White Spinach Salad on Bagel w/ Pickle and Coleslaw', description: 'Does not include side. Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: true, displayOrder: 21 },
  { mealType: 'breakfast', category: 'main', name: 'Egg White Mushroom Onion Salad on Bagel w/ Pickle and Coleslaw', description: 'Does not include side. Please indicate bagel type', price: 15.00, requiresBagelType: true, excludesSide: true, displayOrder: 22 },
  { mealType: 'breakfast', category: 'main', name: 'Avocado Toast (2pc)', description: 'Sourdough, Guacamole, Tomato, Onion, Feta topped with Seasoning. Does not include side', price: 15.00, requiresBagelType: false, excludesSide: true, displayOrder: 23 },

  { mealType: 'breakfast', category: 'side', name: 'Chocolate Chip Muffin', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 1 },
  { mealType: 'breakfast', category: 'side', name: 'Corn Muffin', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 2 },
  { mealType: 'breakfast', category: 'side', name: 'Blueberry Muffin', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 3 },
  { mealType: 'breakfast', category: 'side', name: 'Double Chocolate Muffin', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 4 },
  { mealType: 'breakfast', category: 'side', name: 'Fruit Cup', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 5 },
  { mealType: 'breakfast', category: 'side', name: 'Israeli Salad', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 6 },

  { mealType: 'lunch', category: 'entree', name: 'Grilled Salmon Wrap', description: '', price: 21.00, requiresBagelType: false, excludesSide: false, displayOrder: 1 },
  { mealType: 'lunch', category: 'entree', name: 'Roasted Pepper and Portobello Wrap', description: '', price: 21.00, requiresBagelType: false, excludesSide: false, displayOrder: 2 },
  { mealType: 'lunch', category: 'entree', name: 'Fresh Mozzarella Panini', description: '', price: 21.00, requiresBagelType: false, excludesSide: false, displayOrder: 3 },
  { mealType: 'lunch', category: 'entree', name: 'Eggplant Parmesan Panini', description: '', price: 21.00, requiresBagelType: false, excludesSide: false, displayOrder: 4 },
  { mealType: 'lunch', category: 'entree', name: 'Penne Tomato Basil', description: 'Parmesan on side', price: 21.00, requiresBagelType: false, excludesSide: false, displayOrder: 5 },
  { mealType: 'lunch', category: 'entree', name: 'Baked Ziti', description: '', price: 21.00, requiresBagelType: false, excludesSide: false, displayOrder: 6 },
  { mealType: 'lunch', category: 'entree', name: 'Mac & Cheese', description: '', price: 21.00, requiresBagelType: false, excludesSide: false, displayOrder: 7 },
  { mealType: 'lunch', category: 'entree', name: 'Gluten-Free Penne', description: 'Parmesan on side', price: 21.00, requiresBagelType: false, excludesSide: false, displayOrder: 8 },
  { mealType: 'lunch', category: 'entree', name: 'Salmon Burger', description: '', price: 21.00, requiresBagelType: false, excludesSide: false, displayOrder: 9 },
  { mealType: 'lunch', category: 'entree', name: 'Avocado Salad', description: 'With hard boiled egg', price: 21.00, requiresBagelType: false, excludesSide: false, displayOrder: 10 },
  { mealType: 'lunch', category: 'entree', name: 'Greek Salad', description: '', price: 21.00, requiresBagelType: false, excludesSide: false, displayOrder: 11 },
  { mealType: 'lunch', category: 'entree', name: 'Grilled Tuna Caesar Salad', description: '', price: 21.00, requiresBagelType: false, excludesSide: false, displayOrder: 12 },

  { mealType: 'lunch', category: 'side', name: 'Steamed Vegetables', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 1 },
  { mealType: 'lunch', category: 'side', name: 'Roasted Potatoes', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 2 },
  { mealType: 'lunch', category: 'side', name: 'Brown Rice', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 3 },
  { mealType: 'lunch', category: 'side', name: 'Side Salad', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 4 },
  { mealType: 'lunch', category: 'side', name: 'Broccoli', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 5 },
  { mealType: 'lunch', category: 'side', name: 'Mashed Potatoes', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 6 },
  { mealType: 'lunch', category: 'side', name: 'Baked Potato', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 7 },
  { mealType: 'lunch', category: 'side', name: 'Israeli Salad', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 8 },

  { mealType: 'dinner', category: 'entree', name: 'Deli Sandwich or Wrap - Turkey', description: '', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 1 },
  { mealType: 'dinner', category: 'entree', name: 'Deli Sandwich or Wrap - Pastrami', description: '', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 2 },
  { mealType: 'dinner', category: 'entree', name: 'Deli Sandwich or Wrap - Corned Beef', description: '', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 3 },
  { mealType: 'dinner', category: 'entree', name: 'Deli Sandwich or Wrap - Bologna', description: '', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 4 },
  { mealType: 'dinner', category: 'entree', name: 'Chef Salad - Turkey', description: '', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 5 },
  { mealType: 'dinner', category: 'entree', name: 'Chef Salad - Pastrami', description: '', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 6 },
  { mealType: 'dinner', category: 'entree', name: 'Chef Salad - Corned Beef', description: '', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 7 },
  { mealType: 'dinner', category: 'entree', name: 'Chef Salad - Bologna', description: '', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 8 },
  { mealType: 'dinner', category: 'entree', name: 'Grilled Chicken Cutlets', description: '', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 9 },
  { mealType: 'dinner', category: 'entree', name: 'Chicken Tenders', description: '', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 10 },
  { mealType: 'dinner', category: 'entree', name: 'Grilled Pastrami and/or Schnitzel Sandwich', description: 'On Club with Lettuce/Tomato and Russian Dressing', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 11 },
  { mealType: 'dinner', category: 'entree', name: 'Roasted Baby Chicken Thighs (Boneless)', description: '', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 12 },
  { mealType: 'dinner', category: 'entree', name: 'Salmon', description: '', price: 23.00, requiresBagelType: false, excludesSide: false, displayOrder: 13 },

  { mealType: 'dinner', category: 'side', name: 'White Rice', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 1 },
  { mealType: 'dinner', category: 'side', name: 'Brown Rice', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 2 },
  { mealType: 'dinner', category: 'side', name: 'Israeli Salad', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 3 },
  { mealType: 'dinner', category: 'side', name: 'Cole Slaw', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 4 },
  { mealType: 'dinner', category: 'side', name: 'Red Bliss Potato Salad', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 5 },
  { mealType: 'dinner', category: 'side', name: 'Steamed Vegetables', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 6 },
  { mealType: 'dinner', category: 'side', name: 'Grilled Vegetables', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 7 },
  { mealType: 'dinner', category: 'side', name: 'Mashed Potatoes', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 8 },
  { mealType: 'dinner', category: 'side', name: 'Garden Salad', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 9 },
  { mealType: 'dinner', category: 'side', name: 'Baked Idaho Potato', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 10 },
  { mealType: 'dinner', category: 'side', name: 'Baked Sweet Potato', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 11 },
  { mealType: 'dinner', category: 'soup', name: 'Noodle Matzo Ball Gumbo Soup', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 12 },
  { mealType: 'dinner', category: 'soup', name: 'Mushroom Barley Soup', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 13 },
  { mealType: 'dinner', category: 'soup', name: 'Vegetable Soup', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 14 },
  { mealType: 'dinner', category: 'soup', name: 'Split Pea Soup', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 15 },

  { mealType: 'dinner', category: 'dessert', name: 'Fruit Cup', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 1 },
  { mealType: 'dinner', category: 'dessert', name: 'Danish', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 2 },
  { mealType: 'dinner', category: 'dessert', name: 'Chocolate Chip Cookie', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 3 },
  { mealType: 'dinner', category: 'dessert', name: 'Oatmeal Raisin Cookie', description: '', price: 0, requiresBagelType: false, excludesSide: false, displayOrder: 4 }
];

const menuItems = menuItemsRaw.map(item => ({ ...item, isActive: true }));

async function seedMenu() {
  try {
    logger.info('Starting nursing home menu seed...');
    logger.info('DATABASE_URL present: ' + !!process.env.DATABASE_URL);

    await NursingHomeMenuItem.destroy({ where: {} });
    logger.info('Cleared existing menu items');

    await NursingHomeMenuItem.bulkCreate(menuItems);
    logger.info(`Successfully seeded ${menuItems.length} nursing home menu items`);

    const breakfast = menuItems.filter(i => i.mealType === 'breakfast');
    const lunch = menuItems.filter(i => i.mealType === 'lunch');
    const dinner = menuItems.filter(i => i.mealType === 'dinner');
    
    logger.info('Menu summary:');
    logger.info(`- Breakfast: ${breakfast.length} items (${breakfast.filter(i => i.category === 'main').length} mains, ${breakfast.filter(i => i.category === 'side').length} sides)`);
    logger.info(`- Lunch: ${lunch.length} items (${lunch.filter(i => i.category === 'entree').length} entrees, ${lunch.filter(i => i.category === 'side').length} sides)`);
    logger.info(`- Dinner: ${dinner.length} items (${dinner.filter(i => i.category === 'entree').length} entrees, ${dinner.filter(i => i.category === 'side').length} sides, ${dinner.filter(i => i.category === 'soup').length} soups, ${dinner.filter(i => i.category === 'dessert').length} desserts)`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding nursing home menu:', error);
    process.exit(1);
  }
}

seedMenu();
