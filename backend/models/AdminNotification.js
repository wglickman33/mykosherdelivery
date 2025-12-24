module.exports = (sequelize, DataTypes) => {
  const AdminNotification = sequelize.define('AdminNotification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
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
    readBy: {
      type: DataTypes.JSONB,
      defaultValue: [],
      field: 'read_by'
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
    tableName: 'admin_notifications',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['read_by']
      },
      {
        fields: ['type']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return AdminNotification;
};
