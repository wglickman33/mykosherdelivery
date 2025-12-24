module.exports = (sequelize, DataTypes) => {
  const RestaurantOwner = sequelize.define('RestaurantOwner', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'profiles',
        key: 'id'
      }
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
    permissions: {
      type: DataTypes.JSONB,
      defaultValue: {}
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
    tableName: 'restaurant_owners',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'restaurant_id']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['restaurant_id']
      }
    ]
  });

  RestaurantOwner.associate = function(models) {
    // RestaurantOwner belongs to Profile
    RestaurantOwner.belongsTo(models.Profile, {
      foreignKey: 'userId',
      as: 'user'
    });
    
    // RestaurantOwner belongs to Restaurant
    RestaurantOwner.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant'
    });
  };

  return RestaurantOwner;
}; 