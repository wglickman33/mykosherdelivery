'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, update any existing 'customizable' values to 'simple'
    await queryInterface.sequelize.query(`
      UPDATE menu_items 
      SET item_type = 'simple' 
      WHERE item_type = 'customizable';
    `);
    
    // Update the ENUM to remove 'customizable' and keep only 'simple', 'variety', 'builder'
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_menu_items_item_type" RENAME TO "enum_menu_items_item_type_old";
    `);
    
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_menu_items_item_type" AS ENUM('simple', 'variety', 'builder');
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TABLE "menu_items" 
      ALTER COLUMN "item_type" TYPE "enum_menu_items_item_type" 
      USING "item_type"::text::"enum_menu_items_item_type";
    `);
    
    await queryInterface.sequelize.query(`
      DROP TYPE "enum_menu_items_item_type_old";
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert back to the old ENUM with 'customizable'
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_menu_items_item_type" RENAME TO "enum_menu_items_item_type_old";
    `);
    
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_menu_items_item_type" AS ENUM('simple', 'variety', 'builder', 'customizable');
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TABLE "menu_items" 
      ALTER COLUMN "item_type" TYPE "enum_menu_items_item_type" 
      USING "item_type"::text::"enum_menu_items_item_type";
    `);
    
    await queryInterface.sequelize.query(`
      DROP TYPE "enum_menu_items_item_type_old";
    `);
  }
};
