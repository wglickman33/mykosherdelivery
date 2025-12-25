module.exports = (sequelize, DataTypes) => {
  const Profile = sequelize.define('Profile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    firstName: {
      type: DataTypes.STRING,
      field: 'first_name'
    },
    lastName: {
      type: DataTypes.STRING,
      field: 'last_name'
    },
    phone: {
      type: DataTypes.STRING
    },
    preferredName: {
      type: DataTypes.STRING,
      field: 'preferred_name'
    },
    address: {
      type: DataTypes.JSONB
    },
    addresses: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    primaryAddressIndex: {
      type: DataTypes.INTEGER,
      field: 'primary_address_index',
      defaultValue: 0
    },
    role: {
      type: DataTypes.ENUM('user', 'restaurant_owner', 'admin'),
      defaultValue: 'user'
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
    tableName: 'profiles',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['email']
      }
    ]
  });

  Profile.associate = function(models) {
    Profile.hasMany(models.Order, {
      foreignKey: 'userId',
      as: 'orders'
    });
    
    Profile.hasMany(models.PaymentMethod, {
      foreignKey: 'userId',
      as: 'paymentMethods'
    });
    
    Profile.hasMany(models.UserRestaurantFavorite, {
      foreignKey: 'userId',
      as: 'favorites'
    });
    
    Profile.hasMany(models.UserLoginActivity, {
      foreignKey: 'userId',
      as: 'loginActivities'
    });
    
    Profile.hasOne(models.UserPreference, {
      foreignKey: 'userId',
      as: 'preferences'
    });
    
    Profile.hasMany(models.SupportTicket, {
      foreignKey: 'userId',
      as: 'supportTickets'
    });
    
    Profile.hasMany(models.Notification, {
      foreignKey: 'userId',
      as: 'notifications'
    });
  };

  return Profile;
}; 