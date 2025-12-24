#!/usr/bin/env node

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL);

async function fixEnumTypes() {
  try {
    console.log('Starting enum type cleanup...');
    
    // Check what enum types exist
    const [enumTypes] = await sequelize.query(`
      SELECT typname FROM pg_type WHERE typname LIKE '%enum_menu_items%';
    `);
    
    console.log('Existing enum types:', enumTypes.map(t => t.typname));
    
    // Drop the old enum type if it exists
    try {
      await sequelize.query(`DROP TYPE IF EXISTS "enum_menu_items_item_type_old" CASCADE;`);
      console.log('Dropped old enum type');
    } catch (error) {
      console.log('Old enum type not found or already dropped');
    }
    
    // Check if the current enum type has the right values
    const [currentEnum] = await sequelize.query(`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_menu_items_item_type');
    `);
    
    console.log('Current enum values:', currentEnum.map(e => e.enumlabel));
    
    // If the enum doesn't have the right values, recreate it
    if (currentEnum.length === 0 || !currentEnum.some(e => e.enumlabel === 'simple')) {
      console.log('Recreating enum type...');
      
      // First, convert the column to text temporarily
      await sequelize.query(`
        ALTER TABLE menu_items 
        ALTER COLUMN item_type TYPE TEXT;
      `);
      
      // Drop the old enum
      await sequelize.query(`DROP TYPE IF EXISTS "enum_menu_items_item_type" CASCADE;`);
      
      // Create the new enum
      await sequelize.query(`
        CREATE TYPE "enum_menu_items_item_type" AS ENUM('simple', 'variety', 'builder');
      `);
      
      // Convert back to enum
      await sequelize.query(`
        ALTER TABLE menu_items 
        ALTER COLUMN item_type TYPE "enum_menu_items_item_type" 
        USING item_type::"enum_menu_items_item_type";
      `);
      
      console.log('Enum type recreated successfully');
    }
    
    // Update any 'customizable' values to 'simple'
    const [updateResult] = await sequelize.query(`
      UPDATE menu_items 
      SET item_type = 'simple' 
      WHERE item_type::text = 'customizable';
    `);
    
    console.log(`Updated ${updateResult.rowCount || 0} items from 'customizable' to 'simple'`);
    
    // Verify the final state
    const [finalEnum] = await sequelize.query(`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_menu_items_item_type');
    `);
    
    console.log('Final enum values:', finalEnum.map(e => e.enumlabel));
    
    // Check menu items
    const [menuItems] = await sequelize.query(`
      SELECT DISTINCT item_type, COUNT(*) as count 
      FROM menu_items 
      GROUP BY item_type;
    `);
    
    console.log('Menu items by type:', menuItems);
    
    console.log('Enum type cleanup completed successfully!');
    
  } catch (error) {
    console.error('Error fixing enum types:', error);
  } finally {
    await sequelize.close();
  }
}

fixEnumTypes();
