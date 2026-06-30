module.exports = (sequelize, DataTypes) => {
  const KiddushPackage = sequelize.define('KiddushPackage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    category: {
      type: DataTypes.STRING(32),
      allowNull: false,
      validate: {
        isIn: [['kiddush', 'shalom_zachor']]
      }
    },
    sizeTier: {
      type: DataTypes.STRING(16),
      allowNull: false,
      field: 'size_tier',
      validate: {
        isIn: [['8_12', '15_20', '25_plus']]
      }
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    shortDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'short_description'
    },
    includedItems: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'included_items'
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'image_url'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_active'
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'display_order'
    }
  }, {
    tableName: 'kiddush_packages',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['category', 'is_active'] },
      { fields: ['display_order'] }
    ]
  });

  KiddushPackage.associate = function (models) {
    KiddushPackage.hasMany(models.KiddushMenuItem, {
      foreignKey: 'kiddushPackageId',
      as: 'menuItems'
    });
  };

  return KiddushPackage;
};
