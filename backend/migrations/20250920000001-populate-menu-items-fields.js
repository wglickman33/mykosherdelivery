'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update existing menu items to ensure all fields have proper values
    await queryInterface.sequelize.query(`
      UPDATE menu_items 
      SET 
        item_type = COALESCE(item_type, 'simple'),
        available = COALESCE(available, true),
        options = COALESCE(options, '{}'),
        labels = COALESCE(labels, '[]'),
        description = COALESCE(description, ''),
        category = COALESCE(category, 'General'),
        image_url = COALESCE(image_url, ''),
        price = COALESCE(price, 0.00)
      WHERE 
        item_type IS NULL 
        OR available IS NULL 
        OR options IS NULL 
        OR labels IS NULL
        OR description IS NULL
        OR category IS NULL
        OR image_url IS NULL
        OR price IS NULL;
    `);

    // Ensure price is properly formatted as decimal
    await queryInterface.sequelize.query(`
      UPDATE menu_items 
      SET price = ROUND(CAST(price AS DECIMAL(10,2)), 2)
      WHERE price IS NOT NULL;
    `);

    // Set default options for items based on their type
    await queryInterface.sequelize.query(`
      UPDATE menu_items 
      SET options = '{"variants": []}'::jsonb
      WHERE item_type = 'variety' AND (options IS NULL OR options = '{}'::jsonb);
    `);

    await queryInterface.sequelize.query(`
      UPDATE menu_items 
      SET options = '{"configurations": []}'::jsonb
      WHERE item_type = 'builder' AND (options IS NULL OR options = '{}'::jsonb);
    `);

    await queryInterface.sequelize.query(`
      UPDATE menu_items 
      SET options = NULL
      WHERE item_type = 'simple' AND (options IS NULL OR options = '{}'::jsonb);
    `);

    // Ensure labels is always an array
    await queryInterface.sequelize.query(`
      UPDATE menu_items 
      SET labels = '[]'::jsonb
      WHERE labels IS NULL OR labels = '{}'::jsonb;
    `);

    // Ensure all required fields are not null
    await queryInterface.sequelize.query(`
      ALTER TABLE menu_items 
      ALTER COLUMN item_type SET NOT NULL,
      ALTER COLUMN available SET NOT NULL,
      ALTER COLUMN labels SET NOT NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert changes - this is complex to reverse, so we'll just log
    console.log('Migration down: Data population changes cannot be easily reverted');
  }
};
