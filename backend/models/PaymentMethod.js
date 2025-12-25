module.exports = (sequelize, DataTypes) => {
  const PaymentMethod = sequelize.define('PaymentMethod', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'profiles',
        key: 'id'
      }
    },
    cardLastFour: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'card_last_four'
    },
    cardBrand: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'card_brand'
    },
    cardExpMonth: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'card_exp_month'
    },
    cardExpYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'card_exp_year'
    },
    cardholderName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'cardholder_name'
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_default'
    },
    stripePaymentMethodId: {
      type: DataTypes.STRING,
      field: 'stripe_payment_method_id'
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
    tableName: 'payment_methods',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['is_default']
      }
    ]
  });

  PaymentMethod.associate = function(models) {
    PaymentMethod.belongsTo(models.Profile, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return PaymentMethod;
}; 