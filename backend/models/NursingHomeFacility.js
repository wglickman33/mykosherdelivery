module.exports = (sequelize, DataTypes) => {
  const NursingHomeFacility = sequelize.define('NursingHomeFacility', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    address: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Stores facility address: {street, city, state, zip_code, apartment}'
    },
    contactEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'contact_email',
      validate: {
        isEmail: true
      }
    },
    contactPhone: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'contact_phone'
    },
    logoUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'logo_url'
    },
    billingFrequency: {
      type: DataTypes.ENUM('weekly', 'monthly'),
      allowNull: false,
      defaultValue: 'monthly',
      field: 'billing_frequency'
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
    tableName: 'nursing_home_facilities',
    timestamps: true,
    underscored: true
  });

  NursingHomeFacility.associate = function(models) {
    NursingHomeFacility.hasMany(models.Profile, {
      foreignKey: 'nursingHomeFacilityId',
      as: 'staff'
    });
    
    NursingHomeFacility.hasMany(models.NursingHomeResident, {
      foreignKey: 'facilityId',
      as: 'residents'
    });
    
    NursingHomeFacility.hasMany(models.NursingHomeOrder, {
      foreignKey: 'facilityId',
      as: 'orders'
    });
    
    NursingHomeFacility.hasMany(models.NursingHomeInvoice, {
      foreignKey: 'facilityId',
      as: 'invoices'
    });
  };

  return NursingHomeFacility;
};
