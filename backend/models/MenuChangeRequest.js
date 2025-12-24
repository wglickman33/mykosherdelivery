module.exports = (sequelize, DataTypes) => {
  const MenuChangeRequest = sequelize.define('MenuChangeRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    restaurantId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'restaurant_id',
      references: {
        model: 'restaurants',
        key: 'id'
      }
    },
    requestedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'requested_by',
      references: {
        model: 'profiles',
        key: 'id'
      }
    },
    changeType: {
      type: DataTypes.ENUM('add', 'edit', 'remove', 'price_change'),
      allowNull: false,
      field: 'change_type'
    },
    itemData: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'item_data'
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    },
    adminNotes: {
      type: DataTypes.TEXT,
      field: 'admin_notes'
    },
    approvedBy: {
      type: DataTypes.UUID,
      field: 'approved_by',
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
    tableName: 'menu_change_requests',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['restaurant_id']
      },
      {
        fields: ['requested_by']
      },
      {
        fields: ['status']
      },
      {
        fields: ['change_type']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  MenuChangeRequest.associate = function(models) {
    // MenuChangeRequest belongs to Restaurant
    MenuChangeRequest.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant'
    });
    
    // MenuChangeRequest belongs to Profile (requester)
    MenuChangeRequest.belongsTo(models.Profile, {
      foreignKey: 'requestedBy',
      as: 'requester'
    });
    
    // MenuChangeRequest belongs to Profile (approver)
    MenuChangeRequest.belongsTo(models.Profile, {
      foreignKey: 'approvedBy',
      as: 'approver'
    });
  };

  return MenuChangeRequest;
}; 