module.exports = (sequelize, DataTypes) => {
  const GiftCard = sequelize.define('GiftCard', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true
    },
    initialBalance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'initial_balance'
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    purchasedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'purchased_by_user_id',
      references: { model: 'profiles', key: 'id' }
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'order_id',
      references: { model: 'orders', key: 'id' }
    },
    recipientEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'recipient_email'
    },
    status: {
      type: DataTypes.ENUM('active', 'used', 'void'),
      allowNull: false,
      defaultValue: 'active'
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
    tableName: 'gift_cards',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['code'] },
      { fields: ['purchased_by_user_id'] },
      { fields: ['order_id'] },
      { fields: ['status'] }
    ]
  });

  GiftCard.associate = function(models) {
    GiftCard.belongsTo(models.Profile, {
      foreignKey: 'purchasedByUserId',
      as: 'purchasedBy'
    });
    GiftCard.belongsTo(models.Order, {
      foreignKey: 'orderId',
      as: 'order'
    });
  };

  return GiftCard;
};
