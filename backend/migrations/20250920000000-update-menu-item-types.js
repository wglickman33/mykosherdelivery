'use strict';


module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE menu_items 
      SET item_type = 'simple' 
      WHERE item_type = 'customizable';
    `);
    
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
