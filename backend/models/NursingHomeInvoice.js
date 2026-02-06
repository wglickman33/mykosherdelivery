module.exports = (sequelize, DataTypes) => {
  const NursingHomeInvoice = sequelize.define('NursingHomeInvoice', {
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
    invoiceNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'invoice_number'
    },
    billingPeriodStart: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'billing_period_start'
    },
    billingPeriodEnd: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'billing_period_end'
    },
    orderIds: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
      field: 'order_ids',
      comment: 'Array of NursingHomeOrder IDs included in this invoice'
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
    status: {
      type: DataTypes.ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft'
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'due_date'
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'paid_at'
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
    tableName: 'nursing_home_invoices',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['invoice_number']
      },
      {
        fields: ['facility_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['billing_period_start', 'billing_period_end']
      }
    ]
  });

  NursingHomeInvoice.associate = function(models) {
    NursingHomeInvoice.belongsTo(models.NursingHomeFacility, {
      foreignKey: 'facilityId',
      as: 'facility'
    });
  };

  return NursingHomeInvoice;
};
