module.exports = (sequelize, DataTypes) => {
  const TicketResponse = sequelize.define('TicketResponse', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ticketId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'ticket_id',
      references: {
        model: 'support_tickets',
        key: 'id'
      }
    },
    responderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'responder_id',
      references: {
        model: 'profiles',
        key: 'id'
      }
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isInternal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_internal'
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'ticket_responses',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['ticket_id']
      },
      {
        fields: ['responder_id']
      },
      {
        fields: ['is_internal']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  TicketResponse.associate = function(models) {
    // TicketResponse belongs to SupportTicket
    TicketResponse.belongsTo(models.SupportTicket, {
      foreignKey: 'ticketId',
      as: 'ticket'
    });
    
    // TicketResponse belongs to Profile (responder)
    TicketResponse.belongsTo(models.Profile, {
      foreignKey: 'responderId',
      as: 'responder'
    });
  };

  return TicketResponse;
}; 