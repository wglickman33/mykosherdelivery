module.exports = (sequelize, DataTypes) => {
  const MenuItem = sequelize.define('MenuItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    restaurantId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'restaurant_id',
      references: {
        model: 'restaurants',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    category: {
      type: DataTypes.STRING
    },
    imageUrl: {
      type: DataTypes.STRING,
      field: 'image_url'
    },
    available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    itemType: {
      type: DataTypes.ENUM('simple', 'variety', 'builder'),
      defaultValue: 'simple',
      field: 'item_type'
    },
    options: {
      type: DataTypes.JSONB
    },
    labels: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'menu_items',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['restaurant_id']
      },
      {
        fields: ['category']
      },
      {
        fields: ['available']
      },
      {
        fields: ['item_type']
      }
    ]
  });

  MenuItem.associate = function(models) {
    // MenuItem belongs to Restaurant
    MenuItem.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant'
    });
    
    // MenuItem has many options
    MenuItem.hasMany(models.MenuItemOption, {
      foreignKey: 'menuItemId',
      as: 'itemOptions'
    });
  };

  return MenuItem;
}; 