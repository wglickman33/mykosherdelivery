module.exports = (sequelize, DataTypes) => {
  const NursingHomeMenuItem = sequelize.define('NursingHomeMenuItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    mealType: {
      type: DataTypes.ENUM('breakfast', 'lunch', 'dinner'),
      allowNull: false,
      field: 'meal_type'
    },
    category: {
      type: DataTypes.ENUM('main', 'side', 'entree', 'dessert', 'soup'),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    requiresBagelType: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'requires_bagel_type',
      comment: 'True if item requires specifying bagel type (Plain, Sesame, Everything, Whole Wheat)'
    },
    excludesSide: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'excludes_side',
      comment: 'True if breakfast main item does not include a side (marked with * in menu)'
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'display_order'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
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
    tableName: 'nursing_home_menu_items',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['meal_type', 'category']
      },
      {
        fields: ['is_active']
      }
    ]
  });

  NursingHomeMenuItem.associate = function() {
  };

  return NursingHomeMenuItem;
};
