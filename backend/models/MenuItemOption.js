module.exports = (sequelize, DataTypes) => {
  const MenuItemOption = sequelize.define('MenuItemOption', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    menuItemId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'menu_item_id',
      references: {
        model: 'menu_items',
        key: 'id'
      }
    },
    optionName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'option_name'
    },
    optionType: {
      type: DataTypes.ENUM('choice', 'quantity', 'text'),
      defaultValue: 'choice',
      field: 'option_type'
    },
    required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    options: {
      type: DataTypes.JSONB
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'menu_item_options',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['menu_item_id']
      },
      {
        fields: ['option_type']
      }
    ]
  });

  MenuItemOption.associate = function(models) {
    // MenuItemOption belongs to MenuItem
    MenuItemOption.belongsTo(models.MenuItem, {
      foreignKey: 'menuItemId',
      as: 'menuItem'
    });
  };

  return MenuItemOption;
}; 