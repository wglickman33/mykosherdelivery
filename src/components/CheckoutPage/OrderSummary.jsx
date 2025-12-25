import { ShoppingBag } from "lucide-react";
import PropTypes from "prop-types";

const OrderSummary = ({
  items,
  subtotal,
  deliveryFee,
  tip,
  tax,
  total,
  className = "",
  promoCode = "",
  onPromoCodeChange = () => {},
  onApplyPromo = () => {},
  appliedPromo = null,
  onRemovePromo = () => {},
  promoError = "",
  isValidatingPromo = false,
  discountAmount = 0
}) => {
  return (
    <div className={`order-summary ${className}`}>
      <h3 className="summary-title">
        <ShoppingBag className="summary-icon" />
        Order Summary
      </h3>
      
      <div className="summary-content">
        {}
        <div className="order-items">
          {items.map((item) => (
            <div key={item.id} className="order-item">
              <div className="item-image">
                {item.image ? (
                  <img 
                    src={item.image} 
                    alt={item.name}
                    className="item-img"
                  />
                ) : (
                  <div className="item-placeholder">
                    <ShoppingBag className="placeholder-icon" />
                  </div>
                )}
              </div>
              <div className="item-details">
                <div className="item-header">
                  <div className="item-info">
                    <h4 className="item-name">{item.name}</h4>
                    {item.customizations && item.customizations.length > 0 && (
                      <p className="item-customizations">
                        {item.customizations.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="item-pricing">
                    <div className="item-total">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                    <div className="item-quantity">
                      Qty: {item.quantity}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="summary-divider" />

        {}
        <div className="promo-section">
          {!appliedPromo ? (
            <div className="promo-input-group">
              <input 
                className="promo-input"
                placeholder="Enter promo code"
                value={promoCode}
                onChange={(e) => onPromoCodeChange(e.target.value)}
              />
              <button 
                className="promo-button"
                onClick={onApplyPromo}
                disabled={isValidatingPromo || !promoCode.trim()}
              >
                {isValidatingPromo ? "Validating..." : "Apply"}
              </button>
            </div>
          ) : (
            <div className="promo-applied">
              <div className="promo-applied-info">
                <span className="promo-code-text">Code: {appliedPromo.code}</span>
                <span className="promo-discount-text">
                  -{appliedPromo.discountType === 'percentage' 
                    ? `${appliedPromo.discountValue}%` 
                    : `${appliedPromo.discountValue}`}
                </span>
              </div>
              <button className="promo-remove-button" onClick={onRemovePromo}>
                Remove
              </button>
            </div>
          )}
          {promoError && (
            <div className="promo-error">
              {promoError}
            </div>
          )}
        </div>

        <div className="summary-divider" />

        {}
        <div className="pricing-breakdown">
          <div className="pricing-line">
            <span className="pricing-label">Subtotal</span>
            <span className="pricing-value">${subtotal.toFixed(2)}</span>
          </div>
          
          {discountAmount > 0 && (
            <div className="pricing-line discount-line">
              <span className="pricing-label">Promo Discount</span>
              <span className="pricing-value discount-value">-${discountAmount.toFixed(2)}</span>
            </div>
          )}
          
          <div className="pricing-line">
            <span className="pricing-label">Delivery Fee</span>
            <span className="pricing-value">${deliveryFee.toFixed(2)}</span>
          </div>
          
          <div className="pricing-line">
            <span className="pricing-label">Driver Tip</span>
            <span className="pricing-value">${tip.toFixed(2)}</span>
          </div>
          
          <div className="pricing-line">
            <span className="pricing-label">Tax</span>
            <span className="pricing-value">${tax.toFixed(2)}</span>
          </div>
        </div>

        <div className="summary-divider" />

        {}
        <div className="total-line">
          <span className="total-label">Total</span>
          <span className="total-value">${total.toFixed(2)}</span>
        </div>


      </div>
    </div>
  );
};

OrderSummary.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    quantity: PropTypes.number.isRequired,
    price: PropTypes.number.isRequired,
    image: PropTypes.string,
    customizations: PropTypes.arrayOf(PropTypes.string),
  })).isRequired,
  subtotal: PropTypes.number.isRequired,
  deliveryFee: PropTypes.number.isRequired,
  tip: PropTypes.number.isRequired,
  tax: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  className: PropTypes.string,
  promoCode: PropTypes.string,
  onPromoCodeChange: PropTypes.func,
  onApplyPromo: PropTypes.func,
  appliedPromo: PropTypes.object,
  onRemovePromo: PropTypes.func,
  promoError: PropTypes.string,
  isValidatingPromo: PropTypes.bool,
  discountAmount: PropTypes.number,
};

export default OrderSummary; 