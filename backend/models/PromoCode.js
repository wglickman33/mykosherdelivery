module.exports = (sequelize, DataTypes) => {
  const PromoCode = sequelize.define('PromoCode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 50]
    }
  },
  discountType: {
    type: DataTypes.ENUM('percentage', 'fixed'),
    allowNull: false,
    defaultValue: 'percentage',
    field: 'discount_type'
  },
  discountValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'discount_value',
    validate: {
      min: 0
    }
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at'
  },
  usageLimit: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'usage_limit',
    validate: {
      min: 1
    }
  },
  usageCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'usage_count',
    validate: {
      min: 0
    }
  },
  stackable: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'promo_codes',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

  // Instance methods
  PromoCode.prototype.isValid = function() {
    if (!this.active) return false;
    if (this.expiresAt && new Date() > this.expiresAt) return false;
    if (this.usageLimit && this.usageCount >= this.usageLimit) return false;
    return true;
  };

  PromoCode.prototype.calculateDiscount = function(subtotal) {
    if (!this.isValid()) return 0;
    
    if (this.discountType === 'percentage') {
      return (subtotal * this.discountValue) / 100;
    } else if (this.discountType === 'fixed') {
      return Math.min(this.discountValue, subtotal);
    }
    
    return 0;
  };

  PromoCode.prototype.incrementUsage = async function() {
    this.usageCount += 1;
    await this.save();
  };

  return PromoCode;
}; 