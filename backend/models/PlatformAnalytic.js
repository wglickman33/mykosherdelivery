module.exports = (sequelize, DataTypes) => {
  const PlatformAnalytic = sequelize.define('PlatformAnalytic', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
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
    tableName: 'platform_analytics',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['metric_name']
      },
      {
        fields: ['date']
      },
      {
        unique: true,
        fields: ['metric_name', 'date']
      }
    ]
  });

  // No associations needed for this model

  return PlatformAnalytic;
}; 