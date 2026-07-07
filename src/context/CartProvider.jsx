import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
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
  const [cartHydrated, setCartHydrated] = useState(false);

  const identitySuffix = useMemo(() => 
    user?.id ? `user_${user.id}` : (isGuest ? 'guest' : 'anonymous'),
    [user?.id, isGuest]
  );
  const CART_STORAGE_KEY = useMemo(() => `${CART_STORAGE_KEY_BASE}_${identitySuffix}`, [identitySuffix]);
  const CART_TIMESTAMP_KEY = useMemo(() => `${CART_TIMESTAMP_KEY_BASE}_${identitySuffix}`, [identitySuffix]);

  const normalizeCartItems = useCallback((items) => {
    if (!Array.isArray(items)) return [];
    return items.map((item, index) => ({
      ...item,
      cartItemId:
        item.cartItemId ||
        `${item.id}-${item.restaurantId || 'unknown'}-${index}`
    }));
  }, []);

  const persistCart = useCallback((items) => {
    try {
      if (items.length > 0) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        localStorage.setItem(CART_TIMESTAMP_KEY, Date.now().toString());
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
        localStorage.removeItem(CART_TIMESTAMP_KEY);
      }
    } catch (error) {
      logger.error('Error saving cart to localStorage:', error);
    }
  }, [CART_STORAGE_KEY, CART_TIMESTAMP_KEY]);

  useEffect(() => {
    setCartHydrated(false);
    let nextItems = [];

    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      const savedTimestamp = localStorage.getItem(CART_TIMESTAMP_KEY);

      if (savedCart && savedTimestamp) {
        const timestamp = parseInt(savedTimestamp, 10);
        const now = Date.now();

        if (now - timestamp < CART_SESSION_DURATION) {
          nextItems = normalizeCartItems(JSON.parse(savedCart));
          logger.debug('Cart restored from localStorage for identity:', identitySuffix, 'items:', nextItems.length);
        } else {
          localStorage.removeItem(CART_STORAGE_KEY);
          localStorage.removeItem(CART_TIMESTAMP_KEY);
          logger.debug('Cart expired, cleared from localStorage for identity:', identitySuffix);
        }
      }
    } catch (error) {
      logger.error('Error loading cart from localStorage:', error);
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(CART_TIMESTAMP_KEY);
    }

    setCartItems(nextItems);
    setCartHydrated(true);
  }, [identitySuffix, CART_STORAGE_KEY, CART_TIMESTAMP_KEY, normalizeCartItems]);

  useEffect(() => {
    if (!cartHydrated) return;
    persistCart(cartItems);
  }, [cartItems, cartHydrated, persistCart]);

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
      const restaurantId = restaurantInfo?.id;
      const existingItemIndex = prevItems.findIndex((cartItem) => {
        if (
          item.configurationSignature &&
          cartItem.configurationSignature === item.configurationSignature &&
          cartItem.restaurantId === restaurantId
        ) {
          return true;
        }
        return cartItem.id === item.id && cartItem.restaurantId === restaurantId;
      });

      if (existingItemIndex >= 0) {
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + quantity
        };
        return updatedItems;
      }

      const cartItemId = item.cartItemId || `${item.id}-${restaurantId}-${Date.now()}`;
      return [...prevItems, {
        ...item,
        quantity,
        restaurantId,
        restaurantName: restaurantInfo?.name,
        cartItemId
      }];
    });
  };

  const removeFromCart = (cartItemId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.cartItemId === cartItemId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
    persistCart([]);
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