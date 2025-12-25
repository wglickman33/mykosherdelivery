module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'profiles',
        key: 'id'
      }
    },
    restaurantId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'restaurant_id',
      references: {
        model: 'restaurants',
        key: 'id'
      }
    },
    restaurantGroups: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'restaurant_groups',
      comment: 'Stores multiple restaurants and their items for multi-restaurant orders'
    },
    orderNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'order_number'
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    items: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    deliveryFee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'delivery_fee'
    },
    tip: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    tax: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'discount_amount'
    },
    appliedPromo: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'applied_promo',
      comment: 'Stores promo code information including code, type, and value'
    },
    deliveryAddress: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'delivery_address'
    },
    deliveryInstructions: {
      type: DataTypes.TEXT,
      field: 'delivery_instructions'
    },
    estimatedDeliveryTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'estimated_delivery_time'
    },
    actualDeliveryTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'actual_delivery_time'
    },
    shipdayOrderId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'shipday_order_id',
      comment: 'Shipday order ID for delivery tracking'
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
    tableName: 'orders',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['order_number']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['restaurant_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['shipday_order_id']
      }
    ]
  });

  Order.associate = function(models) {
    Order.belongsTo(models.Profile, {
      foreignKey: 'userId',
      as: 'user'
    });
    
    Order.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant'
    });
    
    Order.hasMany(models.Refund, {
      foreignKey: 'orderId',
      as: 'refunds'
    });
  };

  return Order;
}; 