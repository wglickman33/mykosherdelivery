module.exports = (sequelize, DataTypes) => {
  const NursingHomeRefund = sequelize.define('NursingHomeRefund', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    residentOrderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'resident_order_id',
      references: {
        model: 'nursing_home_resident_orders',
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
      allowNull: true,
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
      allowNull: false,
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
    tableName: 'nursing_home_refunds',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['resident_order_id'] },
      { fields: ['processed_by'] },
      { fields: ['status'] }
    ]
  });

  NursingHomeRefund.associate = function(models) {
    NursingHomeRefund.belongsTo(models.NursingHomeResidentOrder, {
      foreignKey: 'residentOrderId',
      as: 'residentOrder'
    });
    NursingHomeRefund.belongsTo(models.Profile, {
      foreignKey: 'processedBy',
      as: 'processor'
    });
  };

  return NursingHomeRefund;
};
