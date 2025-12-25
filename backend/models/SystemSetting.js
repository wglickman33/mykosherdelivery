module.exports = (sequelize, DataTypes) => {
  const SystemSetting = sequelize.define('SystemSetting', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    settingKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'setting_key'
    },
    settingValue: {
      type: DataTypes.TEXT,
      field: 'setting_value'
    },
    settingType: {
      type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
      defaultValue: 'string',
      field: 'setting_type'
    },
    description: {
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
    tableName: 'system_settings',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['setting_key']
      },
      {
        fields: ['setting_type']
      }
    ]
  });


  return SystemSetting;
}; 