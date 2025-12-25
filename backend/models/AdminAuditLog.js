module.exports = (sequelize, DataTypes) => {
  const AdminAuditLog = sequelize.define('AdminAuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'admin_id',
      references: {
        model: 'profiles',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tableName: {
      type: DataTypes.STRING,
      field: 'table_name'
    },
    recordId: {
      type: DataTypes.STRING,
      field: 'record_id'
    },
    oldValues: {
      type: DataTypes.JSONB,
      field: 'old_values'
    },
    newValues: {
      type: DataTypes.JSONB,
      field: 'new_values'
    },
    ipAddress: {
      type: DataTypes.STRING,
      field: 'ip_address'
    },
    userAgent: {
      type: DataTypes.TEXT,
      field: 'user_agent'
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'admin_audit_logs',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['admin_id']
      },
      {
        fields: ['action']
      },
      {
        fields: ['table_name']
      },
      {
        fields: ['record_id']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  AdminAuditLog.associate = function(models) {
    AdminAuditLog.belongsTo(models.Profile, {
      foreignKey: 'adminId',
      as: 'admin'
    });
  };

  return AdminAuditLog;
}; 