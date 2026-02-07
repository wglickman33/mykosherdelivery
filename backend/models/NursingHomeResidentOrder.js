module.exports = (sequelize, DataTypes) => {
  const NursingHomeResidentOrder = sequelize.define('NursingHomeResidentOrder', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    residentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'resident_id',
      references: {
        model: 'nursing_home_residents',
        key: 'id'
      }
    },
    facilityId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'facility_id',
      references: {
        model: 'nursing_home_facilities',
        key: 'id'
      }
    },
    createdByUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by_user_id',
      references: {
        model: 'profiles',
        key: 'id'
      }
    },
    orderNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'order_number',
      comment: 'Format: NH-RES-{timestamp}-{random}'
    },
    weekStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'week_start_date',
      comment: 'Monday of the week'
    },
    weekEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'week_end_date',
      comment: 'Sunday of the week'
    },
    meals: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Array of {day, mealType, items: [{id, name, category, price}], bagelType}'
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'paid', 'in_progress', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft'
    },
    totalMeals: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_meals'
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    tax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'payment_status'
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'payment_method',
      comment: 'stripe, cash, check, etc.'
    },
    paymentIntentId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'payment_intent_id',
      comment: 'Stripe payment intent ID'
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'paid_at'
    },
    deliveryAddress: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'delivery_address',
      comment: 'Facility delivery address'
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'submitted_at'
    },
    deadline: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Sunday 12:00 PM deadline for the week'
    },
    residentName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'resident_name',
      comment: 'Cached for reporting'
    },
    roomNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'room_number',
      comment: 'Cached for reporting'
    },
    billingEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'billing_email',
      comment: 'Email to send invoice/receipt to (resident or family)'
    },
    billingName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'billing_name',
      comment: 'Name of person responsible for payment'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Special instructions or notes'
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
    tableName: 'nursing_home_resident_orders',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['order_number']
      },
      {
        fields: ['resident_id']
      },
      {
        fields: ['facility_id']
      },
      {
        fields: ['created_by_user_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['payment_status']
      },
      {
        fields: ['week_start_date', 'week_end_date']
      }
    ]
  });

  NursingHomeResidentOrder.associate = function(models) {
    NursingHomeResidentOrder.belongsTo(models.NursingHomeResident, {
      foreignKey: 'residentId',
      as: 'resident'
    });
    
    NursingHomeResidentOrder.belongsTo(models.NursingHomeFacility, {
      foreignKey: 'facilityId',
      as: 'facility'
    });
    
    NursingHomeResidentOrder.belongsTo(models.Profile, {
      foreignKey: 'createdByUserId',
      as: 'createdBy'
    });
  };

  return NursingHomeResidentOrder;
};
