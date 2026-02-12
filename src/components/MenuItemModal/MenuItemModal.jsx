import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useCart } from '../../context/CartContext';
import './MenuItemModal.scss';
import navyMKDIcon from '../../assets/navyMKDIcon.png';

import { AVAILABLE_LABELS } from '../../data/labels';

const labelMap = AVAILABLE_LABELS;

const MenuItemModal = ({ item, restaurant, isOpen, onClose, onAdd }) => {
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedConfigurations, setSelectedConfigurations] = useState({});
  const { addToCart: contextAddToCart } = useCart();
  
  const addToCart = onAdd || contextAddToCart;

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setIsAdded(false);
      setSelectedVariant(null);
      setSelectedConfigurations({});
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleQuantityChange = (change) => {
    const newQuantity = quantity + change;
    if (newQuantity >= 1) {
      setQuantity(newQuantity);
    }
  };

  const handleConfigurationChange = (categoryIndex, optionIndex, addOne) => {
    setSelectedConfigurations(prev => {
      const newConfigurations = { ...prev };
      const categoryKey = `category_${categoryIndex}`;
      const config = item?.options?.configurations?.[categoryIndex];
      const maxSelections = config?.maxSelections ?? 1;

      if (!newConfigurations[categoryKey]) {
        newConfigurations[categoryKey] = [];
      }
      const arr = newConfigurations[categoryKey];

      if (addOne) {
        if (arr.length < maxSelections) {
          newConfigurations[categoryKey] = [...arr, optionIndex];
        }
      } else {
        const idx = arr.indexOf(optionIndex);
        if (idx !== -1) {
          newConfigurations[categoryKey] = [...arr.slice(0, idx), ...arr.slice(idx + 1)];
        }
      }

      return newConfigurations;
    });
  };

  const handleAddToCart = () => {
    let itemToAdd = item;
    const basePrice = item.price;
    let finalPrice = item.price;
    
    if (item.itemType === 'variety' && selectedVariant) {
      finalPrice += selectedVariant.priceModifier || 0;
      itemToAdd = { 
        ...item, 
        selectedVariant, 
        basePrice,
        price: finalPrice 
      };
    }
    
    if (item.itemType === 'builder' && item.options?.configurations) {
      let configurationPrice = 0;
      const selectedOptions = [];
      
      item.options.configurations.forEach((config, categoryIndex) => {
        const categoryKey = `category_${categoryIndex}`;
        const selectedIndices = selectedConfigurations[categoryKey] || [];
        
        selectedIndices.forEach(optionIndex => {
          const option = config.options[optionIndex];
          if (option && option.available) {
            configurationPrice += option.priceModifier || 0;
            selectedOptions.push({
              category: config.category,
              option: option.name,
              priceModifier: option.priceModifier || 0
            });
          }
        });
      });
      
      finalPrice += configurationPrice;
      itemToAdd = { 
        ...item, 
        selectedConfigurations: selectedOptions,
        configurationPrice,
        basePrice,
        price: finalPrice
      };
    }
    
    if (onAdd) {
      onAdd({
        ...itemToAdd,
        quantity,
        restaurantId: restaurant?.id || item.restaurantId,
        restaurantName: restaurant?.name
      });
    } else {
    addToCart(itemToAdd, quantity, restaurant);
    }
    
    setIsAdded(true);
    
    setTimeout(() => {
      setIsAdded(false);
      onClose();
      setQuantity(1);
    }, 1500);
  };

  const getCurrentPrice = () => {
    let basePrice = item.price;
    
    if (item.itemType === 'variety' && selectedVariant) {
      basePrice += selectedVariant.priceModifier || 0;
    }
    
    if (item.itemType === 'builder' && item.options?.configurations) {
      item.options.configurations.forEach((config, categoryIndex) => {
        const categoryKey = `category_${categoryIndex}`;
        const selectedIndices = selectedConfigurations[categoryKey] || [];
        
        selectedIndices.forEach(optionIndex => {
          const option = config.options[optionIndex];
          if (option && option.available) {
            basePrice += option.priceModifier || 0;
          }
        });
      });
    }
    
    return basePrice;
  };

  const isBuilderConfigurationValid = () => {
    if (item.itemType !== 'builder' || !item.options?.configurations) {
      return true;
    }
    
    return item.options.configurations.every((config, categoryIndex) => {
      const categoryKey = `category_${categoryIndex}`;
      const selectedCount = selectedConfigurations[categoryKey]?.length || 0;
      
      if (config.required && selectedCount === 0) {
        return false;
      }
      
      if (selectedCount > config.maxSelections) {
        return false;
      }
      
      return true;
    });
  };

  const currentPrice = getCurrentPrice();
  const totalPrice = (currentPrice * quantity).toFixed(2);

  return (
    <div className="menu-item-modal-overlay" onClick={onClose}>
      <div className="menu-item-modal" onClick={(e) => e.stopPropagation()}>
        <button className="menu-item-close-button" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="#6c757d" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>

        <div className="modal-image">
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

        <div className="modal-content">
          <h2 className="modal-title">{item.name}</h2>
          
          {item.labels && item.labels.length > 0 && (
            <div className="modal-labels">
              {item.labels.map(label => (
                <span
                  className="modal-label"
                  key={label}
                  title={labelMap[label] || label}
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          <p className="modal-description">{item.description}</p>
          
          {item.itemType === 'variety' && item.options?.variants && item.options.variants.length > 0 && (
            <div className="modal-variants">
              <h4 className="variants-title">Choose Your Option:</h4>
              <div className="variants-list">
                {item.options.variants.map((variant, index) => (
                  <div 
                    key={variant.id || index}
                    className={`variant-option ${selectedVariant?.id === variant.id ? 'selected' : ''}`}
                    onClick={() => setSelectedVariant(variant)}
                  >
                    <div className="variant-info">
                      <span className="variant-name">{variant.name}</span>
                      {variant.priceModifier !== 0 && variant.priceModifier !== null && variant.priceModifier !== undefined && (
                        <span className="variant-price-modifier">
                          {variant.priceModifier > 0 ? `+${variant.priceModifier.toFixed(2)}` : `-${Math.abs(variant.priceModifier).toFixed(2)}`}
                        </span>
                      )}
                    </div>
                    <div className="variant-total-price">
                      ${(item.price + (variant.priceModifier || 0)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.itemType === 'builder' && item.options?.configurations && item.options.configurations.length > 0 && (
            <div className="modal-configurations">
              <h4 className="configurations-title">Customize Your Order:</h4>
              {item.options.configurations.map((config, categoryIndex) => (
                <div key={categoryIndex} className="configuration-category">
                  <div className="category-header">
                    <h5 className="category-title">
                      {config.category}
                      {config.required && <span className="required-indicator">*</span>}
                    </h5>
                    <span className="category-limit">
                      {(selectedConfigurations[`category_${categoryIndex}`]?.length || 0)} / {config.maxSelections} selected
                    </span>
                  </div>
                  
                  <div className="category-options">
                    {config.options.filter(option => option.available).map((option, optionIndex) => {
                      const categoryKey = `category_${categoryIndex}`;
                      const selectedArr = selectedConfigurations[categoryKey] || [];
                      const count = selectedArr.filter(i => i === optionIndex).length;
                      const totalSelected = selectedArr.length;
                      const canAddOne = totalSelected < config.maxSelections;
                      const hasSelection = count > 0;
                      
                      return (
                        <div 
                          key={optionIndex}
                          className={`configuration-option ${hasSelection ? 'selected' : ''} ${!canAddOne && !hasSelection ? 'disabled' : ''}`}
                        >
                          <div
                            className={`option-info ${canAddOne ? 'clickable' : ''}`}
                            onClick={() => {
                              if (canAddOne) {
                                handleConfigurationChange(categoryIndex, optionIndex, true);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (canAddOne && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                handleConfigurationChange(categoryIndex, optionIndex, true);
                              }
                            }}
                            role={canAddOne ? 'button' : undefined}
                            tabIndex={canAddOne ? 0 : undefined}
                            aria-label={canAddOne ? `Add ${option.name}` : undefined}
                          >
                            <span className="option-name">{option.name}</span>
                            {option.priceModifier !== 0 && (
                              <span className="option-price-modifier">
                                {option.priceModifier > 0 ? `+${option.priceModifier.toFixed(2)}` : `-${Math.abs(option.priceModifier).toFixed(2)}`}
                              </span>
                            )}
                          </div>
                          {hasSelection ? (
                            <div className="option-selected-controls">
                              <span className="option-selected-indicator" aria-hidden="true">
                                {count === 1 ? '✓' : `✓ × ${count}`}
                              </span>
                              <button
                                type="button"
                                className="option-remove-one"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfigurationChange(categoryIndex, optionIndex, false);
                                }}
                                aria-label={`Remove one ${option.name}`}
                              >
                                −
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="modal-price">
            <span className="price-label">Price:</span>
            <span className="price-value">${currentPrice.toFixed(2)}</span>
          </div>

          <div className="quantity-section">
            <label className="quantity-label">Quantity:</label>
            <div className="quantity-controls">
              <button 
                className="quantity-btn"
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
              >
                -
              </button>
              <span className="quantity-display">{quantity}</span>
              <button 
                className="quantity-btn"
                onClick={() => handleQuantityChange(1)}
              >
                +
              </button>
            </div>
          </div>

          <div className="total-price">
            <span className="total-label">Total:</span>
            <span className="total-value">${totalPrice}</span>
          </div>

          <button 
            className={`add-to-cart-btn ${isAdded ? 'added' : ''}`}
            onClick={handleAddToCart}
            disabled={isAdded || 
              (item.itemType === 'variety' && !selectedVariant) ||
              (item.itemType === 'builder' && !isBuilderConfigurationValid())}
          >
            {isAdded ? 'Added!' : 
             item.itemType === 'variety' && !selectedVariant ? 'Please select an option' :
             item.itemType === 'builder' && !isBuilderConfigurationValid() ? 'Please complete required selections' :
             `Add to Cart - ${totalPrice}`}
          </button>
        </div>
      </div>
    </div>
  );
};

MenuItemModal.propTypes = {
  item: PropTypes.object,
  restaurant: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAdd: PropTypes.func
};

export default MenuItemModal; 