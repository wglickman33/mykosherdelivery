module.exports = (sequelize, DataTypes) => {
  const SupportTicket = sequelize.define('SupportTicket', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true, // Allow null for guest tickets
      field: 'user_id',
      references: {
        model: 'profiles',
        key: 'id'
      }
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('open', 'in_progress', 'waiting', 'resolved', 'closed'),
      defaultValue: 'open'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium'
    },
    assignedTo: {
      type: DataTypes.UUID,
      field: 'assigned_to',
      references: {
        model: 'profiles',
        key: 'id'
      }
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
    tableName: 'support_tickets',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['assigned_to']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  SupportTicket.associate = function(models) {
    // SupportTicket belongs to Profile (customer)
    SupportTicket.belongsTo(models.Profile, {
      foreignKey: 'userId',
      as: 'customer'
    });
    
    // SupportTicket belongs to Profile (assigned admin)
    SupportTicket.belongsTo(models.Profile, {
      foreignKey: 'assignedTo',
      as: 'assignedAdmin'
    });
    
    // SupportTicket has many responses
    SupportTicket.hasMany(models.TicketResponse, {
      foreignKey: 'ticketId',
      as: 'responses'
    });
  };

  return SupportTicket;
}; 