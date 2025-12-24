import './GiftCardPage.scss';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../Footer/Footer';
import { useCart } from '../../context/CartContext';
import navyMKDIcon from '../../assets/navyMKDIcon.png';

const giftCardOptions = [
  { id: 'gc-25', value: 25, label: '$25.00' },
  { id: 'gc-50', value: 50, label: '$50.00' },
  { id: 'gc-75', value: 75, label: '$75.00' },
  { id: 'gc-100', value: 100, label: '$100.00' },
  { id: 'gc-125', value: 125, label: '$125.00' },
  { id: 'gc-150', value: 150, label: '$150.00' },
  { id: 'gc-175', value: 175, label: '$175.00' },
  { id: 'gc-200', value: 200, label: '$200.00' },
];

export default function GiftCardPage() {
  const [selectedValue, setSelectedValue] = useState(25);
  const [showAddedToCart, setShowAddedToCart] = useState(false);
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    const giftCardItem = {
      id: `gift-card-${selectedValue}`,
      name: 'MKD Gift Card',
      price: selectedValue,
      description: `My Kosher Delivery Gift Card - $${selectedValue}`,
      image: '/src/assets/navyMKDIcon.png',
      category: 'Gift Card'
    };

    const giftCardRestaurant = {
      id: 'mkd-gift-cards',
      name: 'My Kosher Delivery',
      logo: '/src/assets/navyMKDIcon.png'
    };

    addToCart(giftCardItem, 1, giftCardRestaurant);
    
    // Show success message
    setShowAddedToCart(true);
    setTimeout(() => {
      setShowAddedToCart(false);
    }, 2000);
  };

  return (
    <div className="gift-card-page">
      <div className="gift-card-page__content">
        <div className="gift-card-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <div className="gift-card-hero">
            <div className="gift-card-logo">
              <img 
                src={navyMKDIcon} 
                alt="My Kosher Delivery logo"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="logo-fallback" style={{display: 'none'}}>🎁</div>
            </div>
            <div className="gift-card-details">
              <h1 className="gift-card-title">MKD GIFT CARD!</h1>
              <p className="gift-card-subtitle">Give the gift of kosher convenience</p>
              <p className="gift-card-description">
                Perfect for any occasion - birthdays, holidays, or just because! 
                Our gift cards can be used for any order on My Kosher Delivery.
              </p>
            </div>
          </div>
        </div>

        <div className="gift-card-section">
          <h2 className="section-title">Select Gift Card Value</h2>
          <div className="gift-card-grid">
            {giftCardOptions.map(option => (
              <div 
                className={`gift-card-option ${selectedValue === option.value ? 'selected' : ''}`}
                key={option.id}
                onClick={() => setSelectedValue(option.value)}
              >
                <div className="gift-card-option__content">
                  <div className="gift-card-option__image">
                    <img 
                      src={navyMKDIcon} 
                      alt="MKD Gift Card"
                    />
                  </div>
                  <div className="gift-card-option__details">
                    <h3 className="gift-card-option__name">MKD Gift Card</h3>
                    <p className="gift-card-option__desc">
                      Redeemable for any order on My Kosher Delivery
                    </p>
                    <div className="gift-card-option__price">{option.label}</div>
                  </div>
                </div>
                {selectedValue === option.value && (
                  <div className="gift-card-option__selected-indicator">
                    ✓ Selected
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="gift-card-actions">
            <div className="selected-value">
              Selected Value: <span className="selected-amount">${selectedValue}.00</span>
            </div>
            <button 
              className={`add-to-cart-btn ${showAddedToCart ? 'added' : ''}`}
              onClick={handleAddToCart}
              disabled={showAddedToCart}
            >
              {showAddedToCart ? '✓ Added to Cart!' : 'Add Gift Card to Cart'}
            </button>
          </div>
        </div>

        <div className="gift-card-info">
          <h3>Gift Card Information</h3>
          <ul>
            <li>Gift cards are delivered digitally via email</li>
            <li>No expiration date - use anytime!</li>
            <li>Can be used for any restaurant on our platform</li>
            <li>Perfect for gifting to friends and family</li>
            <li>Remaining balance can be used for future orders</li>
          </ul>
        </div>
      </div>
      <Footer />
    </div>
  );
} 