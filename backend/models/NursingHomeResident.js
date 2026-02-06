module.exports = (sequelize, DataTypes) => {
  const NursingHomeResident = sequelize.define('NursingHomeResident', {
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
    assignedUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'assigned_user_id',
      references: {
        model: 'profiles',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    roomNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'room_number'
    },
    dietaryRestrictions: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'dietary_restrictions'
    },
    allergies: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    billingEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'billing_email',
      comment: 'Email for weekly invoices (resident or family member)'
    },
    billingName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'billing_name',
      comment: 'Name of person responsible for payment'
    },
    billingPhone: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'billing_phone',
      comment: 'Phone number for billing contact'
    },
    paymentMethodId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'payment_method_id',
      comment: 'Stripe payment method ID for automatic weekly billing'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
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
    tableName: 'nursing_home_residents',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['facility_id']
      },
      {
        fields: ['assigned_user_id']
      }
    ]
  });

  NursingHomeResident.associate = function(models) {
    NursingHomeResident.belongsTo(models.NursingHomeFacility, {
      foreignKey: 'facilityId',
      as: 'facility'
    });
    
    NursingHomeResident.belongsTo(models.Profile, {
      foreignKey: 'assignedUserId',
      as: 'assignedUser'
    });
    
    NursingHomeResident.hasMany(models.NursingHomeResidentOrder, {
      foreignKey: 'residentId',
      as: 'orders'
    });
  };

  return NursingHomeResident;
};
