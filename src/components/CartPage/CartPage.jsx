import { Link } from "react-router-dom";
import Footer from "../Footer/Footer";
import { useCart } from "../../context/CartContext";
import navyMKDIcon from '../../assets/navyMKDIcon.png';
import "./CartPage.scss";

const CartPage = () => {
  const { cartItems, getCartTotal, getRestaurantGroups, updateQuantity, removeFromCart } = useCart();

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const renderEmptyCart = () => (
    <div className="cart-main">
      <div className="cart-header">
        <h1>Your Cart</h1>
      </div>
      <div className="cart-body">
        <div className="empty-cart">
          <div className="empty-cart-icon">
            <svg viewBox="0 0 24 24" width="64" height="64">
              <path
                fill="#d1d5db"
                d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"
              />
            </svg>
          </div>
          <h2>Your cart is empty</h2>
          <p>Add some delicious kosher food to get started!</p>
          <Link to="/restaurants" className="browse-button">
            Browse Restaurants
          </Link>
        </div>
      </div>
    </div>
  );

  const renderCartItems = () => {
    const restaurantGroups = getRestaurantGroups();

    return (
      <>
        <div className="cart-main">
          <div className="cart-header">
            <h1>Your Cart</h1>
          </div>
          <div className="cart-body">
            <div className="cart-items">
              {Object.entries(restaurantGroups).map(([restaurantId, group]) => (
                <div key={restaurantId} className="restaurant-group">
                  <h3 className="restaurant-name">{group.restaurantName}</h3>
                  <div className="items-list">
                    {group.items.map((item) => (
                      <div key={item.cartItemId} className="cart-item">
                        <div className="item-image">
                          <img 
                            src={item.image || navyMKDIcon} 
                            alt={item.name}
                            className={!item.image ? 'placeholder-image' : ''}
                            onError={(e) => {
                              e.target.src = navyMKDIcon;
                              e.target.classList.add('placeholder-image');
                            }}
                          />
                        </div>
                        <div className="item-details">
                          <h4 className="item-name">{item.name}</h4>
                          <p className="item-description">{item.description}</p>
                          
                          {}
                          {item.itemType === 'variety' && item.selectedVariant && (
                            <div className="item-customization">
                              <span className="customization-label">Selected:</span>
                              <span className="customization-value">{item.selectedVariant.name}</span>
                              {item.selectedVariant.priceModifier !== 0 && item.selectedVariant.priceModifier && (
                                <span className="customization-price-modifier">
                                  {item.selectedVariant.priceModifier > 0 ? '+' : ''}${item.selectedVariant.priceModifier.toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {}
                          {item.itemType === 'builder' && item.selectedConfigurations && item.selectedConfigurations.length > 0 && (
                            <div className="item-customization">
                              <div className="customization-list">
                                {item.selectedConfigurations.map((config, idx) => (
                                  <div key={idx} className="customization-item">
                                    <span className="customization-category">{config.category}:</span>
                                    <span className="customization-option">{config.option}</span>
                                    {config.priceModifier !== 0 && (
                                      <span className="customization-price-modifier">
                                        {config.priceModifier > 0 ? '+' : ''}${config.priceModifier.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {}
                          {(item.itemType === 'variety' || item.itemType === 'builder') && (
                            <div className="item-price-breakdown">
                              {(() => {
                                const basePrice = item.basePrice !== undefined 
                                  ? item.basePrice
                                  : (item.itemType === 'variety' 
                                    ? item.price - (item.selectedVariant?.priceModifier || 0)
                                    : item.price - (item.configurationPrice || 0));
                                
                                return (
                                  <>
                                    <div className="price-line">
                                      <span>Base price:</span>
                                      <span>${basePrice.toFixed(2)}</span>
                                    </div>
                                    {item.itemType === 'variety' && item.selectedVariant?.priceModifier !== 0 && item.selectedVariant?.priceModifier && (
                                      <div className="price-line">
                                        <span>{item.selectedVariant.name} modifier:</span>
                                        <span>{item.selectedVariant.priceModifier > 0 ? '+' : ''}${item.selectedVariant.priceModifier.toFixed(2)}</span>
                                      </div>
                                    )}
                                    {item.itemType === 'builder' && item.configurationPrice !== 0 && item.configurationPrice && (
                                      <div className="price-line">
                                        <span>Customizations:</span>
                                        <span>+${item.configurationPrice.toFixed(2)}</span>
                                      </div>
                                    )}
                                    <div className="price-line price-line--total">
                                      <span>Price each:</span>
                                      <span>${item.price.toFixed(2)}</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                          
                          {}
                          {(!item.itemType || item.itemType === 'simple') && (
                          <div className="item-price">${item.price.toFixed(2)} each</div>
                          )}
                        </div>
                        <div className="item-controls">
                          <div className="quantity-controls">
                            <button 
                              className="quantity-btn"
                              onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                              aria-label="Decrease quantity"
                            >
                              -
                            </button>
                            <span className="quantity">{item.quantity}</span>
                            <button 
                              className="quantity-btn"
                              onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                          <div className="item-total">${(item.price * item.quantity).toFixed(2)}</div>
                          <button 
                            className="remove-btn"
                            onClick={() => removeFromCart(item.cartItemId)}
                            aria-label={`Remove ${item.name} from cart`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="group-total">
                    Subtotal: ${group.total.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="cart-sidebar">
          <div className="cart-summary">
            <h3>Order Summary</h3>
            <div className="order-summary-items">
              {Object.entries(restaurantGroups).map(([, group]) => 
                group.items.map((item) => (
                  <div key={item.cartItemId} className="summary-item">
                    <span className="item-name">{item.name} × {item.quantity}</span>
                    <span className="item-total">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="total-section">
              <div className="total-line">
                <span className="total-label">Subtotal:</span>
                <span className="total-amount">${getCartTotal().toFixed(2)}</span>
              </div>
              <div className="total-line delivery-fee-line">
                <span className="total-label">Delivery Fee:</span>
                <span className="total-amount">TBD</span>
              </div>
              <div className="total-line tax-line">
                <span className="total-label">Tax:</span>
                <span className="total-amount">${(getCartTotal() * 0.0825).toFixed(2)}</span>
              </div>
              <div className="tax-note-line">
                <span className="tax-note">*Estimated - calculated at checkout</span>
              </div>
              <div className="total-line">
                <span className="total-label">Total:</span>
                <span className="total-amount">{formatCurrency(getCartTotal() + (getCartTotal() * 0.0825))}</span>
              </div>
            </div>
            <Link to="/checkout" className="checkout-btn">
              Proceed to Checkout
            </Link>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="cart-page">
      <div className="cart-container">
        <div className="cart-content">
          {cartItems.length === 0 ? renderEmptyCart() : renderCartItems()}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CartPage; 