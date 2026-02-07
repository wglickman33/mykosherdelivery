module.exports = (sequelize, DataTypes) => {
  const NursingHomeOrder = sequelize.define('NursingHomeOrder', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
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
      field: 'order_number'
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
    residentMeals: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'resident_meals',
      comment: 'Array of {residentId, residentName, roomNumber, meals: [{day, mealType, items, bagelType}]}'
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'confirmed', 'in_progress', 'completed', 'cancelled'),
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
    tableName: 'nursing_home_orders',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['order_number']
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
        fields: ['week_start_date', 'week_end_date']
      }
    ]
  });

  NursingHomeOrder.associate = function(models) {
    NursingHomeOrder.belongsTo(models.NursingHomeFacility, {
      foreignKey: 'facilityId',
      as: 'facility'
    });
    
    NursingHomeOrder.belongsTo(models.Profile, {
      foreignKey: 'createdByUserId',
      as: 'createdBy'
    });
  };

  return NursingHomeOrder;
};
