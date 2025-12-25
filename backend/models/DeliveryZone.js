module.exports = (sequelize, DataTypes) => {
  const DeliveryZone = sequelize.define('DeliveryZone', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    zipCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'zip_code'
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false
    },
    deliveryFee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'delivery_fee'
    },
    available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'delivery_zones',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['zip_code']
      },
      {
        fields: ['city']
      },
      {
        fields: ['state']
      },
      {
        fields: ['available']
      }
    ]
  });


  return DeliveryZone;
}; 