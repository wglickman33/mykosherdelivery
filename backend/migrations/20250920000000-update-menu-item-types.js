'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT 1 FROM pg_type WHERE typname = 'enum_menu_items_item_type_old' LIMIT 1;
    `);
    const resuming = rows && rows.length > 0;

    await queryInterface.sequelize.query(`
      UPDATE menu_items
      SET item_type = 'simple'
      WHERE item_type::text = 'customizable';
    `);

    if (!resuming) {
      await queryInterface.sequelize.query(`
        ALTER TABLE "menu_items" ALTER COLUMN "item_type" DROP DEFAULT;
      `);
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_menu_items_item_type" RENAME TO "enum_menu_items_item_type_old";
      `);
      await queryInterface.sequelize.query(`
        CREATE TYPE "enum_menu_items_item_type" AS ENUM('simple', 'variety', 'builder');
      `);
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE "menu_items"
      ALTER COLUMN "item_type" TYPE "enum_menu_items_item_type"
      USING "item_type"::text::"enum_menu_items_item_type";
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "menu_items" ALTER COLUMN "item_type" SET DEFAULT 'simple'::"enum_menu_items_item_type";
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
