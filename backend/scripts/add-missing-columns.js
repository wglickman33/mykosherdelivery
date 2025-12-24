#!/usr/bin/env node

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL);

async function addMissingColumns() {
  try {
    console.log('Adding missing columns to menu_items table...');
    
    // Check if item_type column exists
    const [columns] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'menu_items' AND column_name = 'item_type';
    `);
    
    if (columns.length === 0) {
      console.log('Adding item_type column...');
      
      // Create the enum type first (if it doesn't exist)
      try {
        await sequelize.query(`
          CREATE TYPE "enum_menu_items_item_type" AS ENUM('simple', 'variety', 'builder');
        `);
        console.log('Created enum type');
      } catch (error) {
        if (error.original.code === '42710') {
          console.log('Enum type already exists');
        } else {
          throw error;
        }
      }
      
      // Add the column
      await sequelize.query(`
        ALTER TABLE menu_items 
        ADD COLUMN item_type "enum_menu_items_item_type" DEFAULT 'simple';
      `);
      
      console.log('item_type column added successfully');
    } else {
      console.log('item_type column already exists');
    }
    
    // Update all existing menu items to have item_type = 'simple'
    const [updateResult] = await sequelize.query(`
      UPDATE menu_items 
      SET item_type = 'simple' 
      WHERE item_type IS NULL;
    `);
    
    console.log(`Updated ${updateResult.rowCount || 0} menu items with item_type`);
    
    // Make the column NOT NULL
    await sequelize.query(`
      ALTER TABLE menu_items 
      ALTER COLUMN item_type SET NOT NULL;
    `);
    
    console.log('Made item_type column NOT NULL');
    
    // Verify the final state
    const [finalColumns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'menu_items' AND column_name = 'item_type';
    `);
    
    console.log('Final item_type column state:', finalColumns[0]);
    
    // Check menu items
    const [menuItems] = await sequelize.query(`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN item_type = 'simple' THEN 1 END) as simple_count,
             COUNT(CASE WHEN item_type = 'variety' THEN 1 END) as variety_count,
             COUNT(CASE WHEN item_type = 'builder' THEN 1 END) as builder_count
      FROM menu_items;
    `);
    
    console.log('Menu items summary:', menuItems[0]);
    
    console.log('Missing columns added successfully!');
    
  } catch (error) {
    console.error('Error adding missing columns:', error);
  } finally {
    await sequelize.close();
  }
}

addMissingColumns();
