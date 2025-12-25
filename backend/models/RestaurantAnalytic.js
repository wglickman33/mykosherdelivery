module.exports = (sequelize, DataTypes) => {
  const RestaurantAnalytic = sequelize.define('RestaurantAnalytic', {
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
    metricName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'metric_name'
    },
    metricValue: {
      type: DataTypes.DECIMAL(15, 2),
      field: 'metric_value'
    },
    metricData: {
      type: DataTypes.JSONB,
      field: 'metric_data'
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'restaurant_analytics',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['restaurant_id']
      },
      {
        fields: ['metric_name']
      },
      {
        fields: ['date']
      },
      {
        unique: true,
        fields: ['restaurant_id', 'metric_name', 'date']
      }
    ]
  });

  RestaurantAnalytic.associate = function(models) {
    RestaurantAnalytic.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant'
    });
  };

  return RestaurantAnalytic;
}; 