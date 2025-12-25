module.exports = (sequelize, DataTypes) => {
  const Restaurant = sequelize.define('Restaurant', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT
    },
    phone: {
      type: DataTypes.STRING
    },
    typeOfFood: {
      type: DataTypes.STRING,
      field: 'type_of_food'
    },
    kosherCertification: {
      type: DataTypes.STRING,
      field: 'kosher_certification'
    },
    logoUrl: {
      type: DataTypes.STRING,
      field: 'logo_url'
    },
    featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
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
    tableName: 'restaurants',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['id']
      }
    ]
  });

  Restaurant.associate = function(models) {
    Restaurant.hasMany(models.Order, {
      foreignKey: 'restaurantId',
      as: 'orders'
    });
    
    Restaurant.hasMany(models.MenuItem, {
      foreignKey: 'restaurantId',
      as: 'menuItems'
    });
    
    Restaurant.hasMany(models.UserRestaurantFavorite, {
      foreignKey: 'restaurantId',
      as: 'favorites'
    });
    
    Restaurant.hasMany(models.RestaurantOwner, {
      foreignKey: 'restaurantId',
      as: 'owners'
    });
    
    Restaurant.hasMany(models.RestaurantAnalytic, {
      foreignKey: 'restaurantId',
      as: 'analytics'
    });
  };

  return Restaurant;
}; 