import { useState, useEffect, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { CartContext } from './CartContext';
import logger from '../utils/logger';
import { AuthContext } from './AuthContext';

const CART_STORAGE_KEY_BASE = 'mkd_cart_items';
const CART_TIMESTAMP_KEY_BASE = 'mkd_cart_timestamp';
const CART_SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

export const CartProvider = ({ children }) => {
  const { user, isGuest } = useContext(AuthContext);
  const [cartItems, setCartItems] = useState([]);

  const identitySuffix = useMemo(() => 
    user?.id ? `user_${user.id}` : (isGuest ? 'guest' : 'anonymous'),
    [user?.id, isGuest]
  );
  const CART_STORAGE_KEY = useMemo(() => `${CART_STORAGE_KEY_BASE}_${identitySuffix}`, [identitySuffix]);
  const CART_TIMESTAMP_KEY = useMemo(() => `${CART_TIMESTAMP_KEY_BASE}_${identitySuffix}`, [identitySuffix]);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      const savedTimestamp = localStorage.getItem(CART_TIMESTAMP_KEY);

      if (savedCart && savedTimestamp) {
        const timestamp = parseInt(savedTimestamp, 10);
        const now = Date.now();

        if (now - timestamp < CART_SESSION_DURATION) {
          const parsedCart = JSON.parse(savedCart);
          setCartItems(Array.isArray(parsedCart) ? parsedCart : []);
          logger.debug('Cart restored from localStorage for identity:', identitySuffix, 'items:', Array.isArray(parsedCart) ? parsedCart.length : 0);
        } else {
          localStorage.removeItem(CART_STORAGE_KEY);
          localStorage.removeItem(CART_TIMESTAMP_KEY);
          setCartItems([]);
          logger.debug('Cart expired, cleared from localStorage for identity:', identitySuffix);
        }
      } else {
        setCartItems([]);
      }
    } catch (error) {
      logger.error('Error loading cart from localStorage:', error);
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(CART_TIMESTAMP_KEY);
      setCartItems([]);
    }
  }, [identitySuffix, CART_STORAGE_KEY, CART_TIMESTAMP_KEY]);

  useEffect(() => {
    try {
      if (cartItems.length > 0) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
        localStorage.setItem(CART_TIMESTAMP_KEY, Date.now().toString());
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
        localStorage.removeItem(CART_TIMESTAMP_KEY);
      }
    } catch (error) {
      logger.error('Error saving cart to localStorage:', error);
    }
  }, [cartItems, CART_STORAGE_KEY, CART_TIMESTAMP_KEY]);

  useEffect(() => {
    const handleUserActivity = () => {
      if (cartItems.length > 0) {
        try {
          localStorage.setItem(CART_TIMESTAMP_KEY, Date.now().toString());
        } catch (error) {
          logger.error('Error extending cart timestamp:', error);
        }
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
    };
  }, [cartItems.length, CART_TIMESTAMP_KEY]);

  const addToCart = (item, quantity = 1, restaurantInfo = null) => {
    setCartItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(
        cartItem => cartItem.id === item.id && cartItem.restaurantId === (restaurantInfo?.id)
      );

      if (existingItemIndex >= 0) {
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + quantity
        };
        return updatedItems;
      } else {
        return [...prevItems, {
          ...item,
          quantity,
          restaurantId: restaurantInfo?.id,
          restaurantName: restaurantInfo?.name,
          cartItemId: `${item.id}-${restaurantInfo?.id}-${Date.now()}`
        }];
      }
    });
  };

  const removeFromCart = (cartItemId) => {
    setCartItems(prevItems => prevItems.filter(item => item.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.cartItemId === cartItemId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(CART_TIMESTAMP_KEY);
    } catch (error) {
      logger.error('Error clearing cart from localStorage:', error);
    }
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const getRestaurantGroups = () => {
    const groups = {};
    cartItems.forEach(item => {
      const restaurantId = item.restaurantId || 'unknown';
      if (!groups[restaurantId]) {
        groups[restaurantId] = {
          restaurantName: item.restaurantName || 'Unknown Restaurant',
          items: [],
          total: 0
        };
      }
      groups[restaurantId].items.push(item);
      groups[restaurantId].total += item.price * item.quantity;
    });
    return groups;
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartItemCount,
    getRestaurantGroups
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

CartProvider.propTypes = {
  children: PropTypes.node.isRequired,
}; 