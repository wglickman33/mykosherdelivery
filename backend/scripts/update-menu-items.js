require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL);

async function updateMenuItems() {
  try {
    console.log('Starting menu items data update...');
    
    const updateQuery = `
      UPDATE menu_items 
      SET 
        item_type = COALESCE(item_type, 'simple'),
        available = COALESCE(available, true),
        options = CASE 
          WHEN item_type = 'variety' AND (options IS NULL OR options = '{}'::jsonb) THEN '{"variants": []}'::jsonb
          WHEN item_type = 'builder' AND (options IS NULL OR options = '{}'::jsonb) THEN '{"configurations": []}'::jsonb
          WHEN item_type = 'simple' AND (options IS NULL OR options = '{}'::jsonb) THEN NULL
          ELSE COALESCE(options, '{}'::jsonb)
        END,
        labels = COALESCE(labels, '[]'::jsonb),
        description = COALESCE(description, ''),
        category = COALESCE(category, 'General'),
        image_url = COALESCE(image_url, ''),
        price = ROUND(CAST(COALESCE(price, 0.00) AS DECIMAL(10,2)), 2)
      WHERE 
        item_type IS NULL 
        OR available IS NULL 
        OR options IS NULL 
        OR labels IS NULL
        OR description IS NULL
        OR category IS NULL
        OR image_url IS NULL
        OR price IS NULL;
    `;
    
    const [results] = await sequelize.query(updateQuery);
    console.log(`Updated ${results.rowCount || 0} menu items`);
    
    const [menuItems] = await sequelize.query('SELECT COUNT(*) as count FROM menu_items');
    console.log(`Total menu items: ${menuItems[0].count}`);
    
    const [sample] = await sequelize.query(`
      SELECT id, name, price, item_type, category, available 
      FROM menu_items 
      LIMIT 5
    `);
    
    console.log('Sample menu items:');
    sample.forEach(item => {
      console.log(`- ${item.name}: ${item.price} (${item.item_type}) - ${item.category}`);
    });
    
    console.log('Menu items data update completed successfully!');
    
  } catch (error) {
    console.error('Error updating menu items:', error);
  } finally {
    await sequelize.close();
  }
}

updateMenuItems();
