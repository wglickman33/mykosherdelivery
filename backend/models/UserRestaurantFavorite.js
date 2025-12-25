module.exports = (sequelize, DataTypes) => {
  const UserRestaurantFavorite = sequelize.define('UserRestaurantFavorite', {
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
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'user_restaurant_favorites',
    timestamps: false,
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

  UserRestaurantFavorite.associate = function(models) {
    UserRestaurantFavorite.belongsTo(models.Profile, {
      foreignKey: 'userId',
      as: 'user'
    });
    
    UserRestaurantFavorite.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant'
    });
  };

  return UserRestaurantFavorite;
}; 