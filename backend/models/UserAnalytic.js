module.exports = (sequelize, DataTypes) => {
  const UserAnalytic = sequelize.define('UserAnalytic', {
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
    metricName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'metric_name'
    },
    metricValue: {
      type: DataTypes.DECIMAL(15, 2),
      field: 'metric_value'
    },
    metricData: {
      type: DataTypes.JSONB,
      field: 'metric_data'
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'user_analytics',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['metric_name']
      },
      {
        fields: ['date']
      },
      {
        unique: true,
        fields: ['user_id', 'metric_name', 'date']
      }
    ]
  });

  UserAnalytic.associate = function(models) {
    UserAnalytic.belongsTo(models.Profile, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return UserAnalytic;
}; 