module.exports = (sequelize, DataTypes) => {
  const UserLoginActivity = sequelize.define('UserLoginActivity', {
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
    loginTime: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'login_time'
    },
    ipAddress: {
      type: DataTypes.STRING,
      field: 'ip_address'
    },
    userAgent: {
      type: DataTypes.TEXT,
      field: 'user_agent'
    },
    success: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'user_login_activities',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['login_time']
      },
      {
        fields: ['success']
      }
    ]
  });

  UserLoginActivity.associate = function(models) {
    UserLoginActivity.belongsTo(models.Profile, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return UserLoginActivity;
}; 