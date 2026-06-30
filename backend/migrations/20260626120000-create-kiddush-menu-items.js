'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.sequelize.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kiddush_menu_items'",
      { type: Sequelize.QueryTypes.SELECT }
    ).then((rows) => rows && rows.length > 0);

    if (!tableExists) {
      await queryInterface.createTable('kiddush_menu_items', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        kiddush_package_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'kiddush_packages',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT
        },
        price: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0
        },
        category: {
          type: Sequelize.STRING,
          allowNull: false
        },
        image_url: {
          type: Sequelize.STRING
        },
        available: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        featured: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        item_type: {
          type: Sequelize.ENUM('simple', 'variety', 'builder'),
          defaultValue: 'simple'
        },
        options: {
          type: Sequelize.JSONB
        },
        labels: {
          type: Sequelize.JSONB,
          defaultValue: '[]'
        },
        display_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      });
    }

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      // kiddush_package_id index is created by the FK; only add the rest.
      await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS kiddush_menu_items_category ON kiddush_menu_items (category);'
      );
      await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS kiddush_menu_items_available ON kiddush_menu_items (available);'
      );
      await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS kiddush_menu_items_item_type ON kiddush_menu_items (item_type);'
      );
      await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS kiddush_menu_items_display_order ON kiddush_menu_items (display_order);'
      );
    } else {
      const indexes = await queryInterface.showIndex('kiddush_menu_items').catch(() => []);
      const indexNames = new Set(indexes.map((idx) => idx.name));
      const ensureIndex = async (fields, name) => {
        if (!indexNames.has(name)) {
          await queryInterface.addIndex('kiddush_menu_items', fields, { name });
        }
      };
      await ensureIndex(['category'], 'kiddush_menu_items_category');
      await ensureIndex(['available'], 'kiddush_menu_items_available');
      await ensureIndex(['item_type'], 'kiddush_menu_items_item_type');
      await ensureIndex(['display_order'], 'kiddush_menu_items_display_order');
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('kiddush_menu_items');
  }
};
