module.exports = (sequelize, DataTypes) => {
  const KiddushMenuItem = sequelize.define('KiddushMenuItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    kiddushPackageId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'kiddush_package_id',
      references: {
        model: 'kiddush_packages',
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
      allowNull: false,
      defaultValue: 0
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false
    },
    imageUrl: {
      type: DataTypes.STRING,
      field: 'image_url'
    },
    available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
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
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'display_order'
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
    tableName: 'kiddush_menu_items',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['kiddush_package_id'] },
      { fields: ['category'] },
      { fields: ['available'] },
      { fields: ['item_type'] },
      { fields: ['display_order'] }
    ]
  });

  KiddushMenuItem.associate = function (models) {
    KiddushMenuItem.belongsTo(models.KiddushPackage, {
      foreignKey: 'kiddushPackageId',
      as: 'package'
    });
  };

  return KiddushMenuItem;
};
