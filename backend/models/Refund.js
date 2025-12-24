module.exports = (sequelize, DataTypes) => {
  const Refund = sequelize.define('Refund', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'order_id',
      references: {
        model: 'orders',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    stripeRefundId: {
      type: DataTypes.STRING,
      field: 'stripe_refund_id'
    },
    processedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'processed_by',
      references: {
        model: 'profiles',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'processed', 'failed'),
      defaultValue: 'pending'
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
    tableName: 'refunds',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['order_id']
      },
      {
        fields: ['processed_by']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  Refund.associate = function(models) {
    // Refund belongs to Order
    Refund.belongsTo(models.Order, {
      foreignKey: 'orderId',
      as: 'order'
    });
    
    // Refund belongs to Profile (processed by admin)
    Refund.belongsTo(models.Profile, {
      foreignKey: 'processedBy',
      as: 'processor'
    });
  };

  return Refund;
}; 