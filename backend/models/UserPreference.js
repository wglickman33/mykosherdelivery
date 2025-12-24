module.exports = (sequelize, DataTypes) => {
  const UserPreference = sequelize.define('UserPreference', {
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
    preferences: {
      type: DataTypes.JSONB,
      defaultValue: {}
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
    tableName: 'user_preferences',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id']
      }
    ]
  });

  UserPreference.associate = function(models) {
    // UserPreference belongs to Profile
    UserPreference.belongsTo(models.Profile, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return UserPreference;
}; 