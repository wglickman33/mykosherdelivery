module.exports = (sequelize, DataTypes) => {
  const PlatformExpense = sequelize.define('PlatformExpense', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    expenseDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'expense_date'
    },
    category: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: 'e.g. driver_pay, other'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 }
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by',
      references: {
        model: 'profiles',
        key: 'id'
      }
    }
  }, {
    tableName: 'platform_expenses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['expense_date'] },
      { fields: ['category'] }
    ]
  });

  PlatformExpense.associate = function(models) {
    PlatformExpense.belongsTo(models.Profile, {
      foreignKey: 'createdBy',
      as: 'creator'
    });
  };

  return PlatformExpense;
};
