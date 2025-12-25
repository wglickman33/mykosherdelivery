module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
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
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    data: {
      type: DataTypes.JSONB
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'notifications',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['read']
      },
      {
        fields: ['type']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  Notification.associate = function(models) {
    Notification.belongsTo(models.Profile, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return Notification;
}; 