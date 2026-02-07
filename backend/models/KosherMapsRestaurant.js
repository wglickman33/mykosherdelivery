module.exports = (sequelize, DataTypes) => {
  const KosherMapsRestaurant = sequelize.define('KosherMapsRestaurant', {
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
      type: DataTypes.TEXT
    },
    city: {
      type: DataTypes.STRING
    },
    state: {
      type: DataTypes.STRING
    },
    zip: {
      type: DataTypes.STRING
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7)
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7)
    },
    phone: {
      type: DataTypes.STRING
    },
    website: {
      type: DataTypes.STRING
    },
    kosherCertification: {
      type: DataTypes.STRING,
      field: 'kosher_certification'
    },
    googleRating: {
      type: DataTypes.DECIMAL(3, 2),
      field: 'google_rating'
    },
    googlePlaceId: {
      type: DataTypes.STRING,
      field: 'google_place_id'
    },
    dietTags: {
      type: DataTypes.JSONB,
      defaultValue: [],
      field: 'diet_tags'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_active'
    },
    deactivationReason: {
      type: DataTypes.STRING,
      field: 'deactivation_reason'
    },
    notes: {
      type: DataTypes.TEXT
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
    tableName: 'kosher_maps_restaurants',
    timestamps: true,
    underscored: true
  });

  return KosherMapsRestaurant;
};
