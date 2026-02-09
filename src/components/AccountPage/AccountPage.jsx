import './AccountPage.scss';
import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import Footer from '../Footer/Footer';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../context/CartContext';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import { formatPhoneNumber, formatPhoneForInput } from '../../utils/phoneFormatter';
import apiClient from '../../lib/api';
import {
  fetchUserProfile,
  updateUserProfile,
  fetchUserOrders,
  fetchOrderById,
  reorderItems,
  fetchUserStats,
  fetchUserPreferences,
  updateUserPreferences,
  fetchUserLoginActivity,
  deleteUserAccount,
  subscribeToOrderUpdates,
  unsubscribeFromOrderUpdates
} from '../../services/accountServices';
import AddressManagementModal from '../AddressManagementModal/AddressManagementModal';
import { Navigate } from 'react-router-dom';

const ProfileEditModal = ({ isOpen, onClose, profile, onSave, getPrimaryAddress }) => {
  const getFormattedPrimaryAddress = useCallback(() => {
    const addr = getPrimaryAddress && getPrimaryAddress();
    if (!addr) return '';
    if (addr.address && typeof addr.address === 'object') {
      const a = addr.address;
      return [a.street, a.city, a.state, a.zip].filter(Boolean).join(', ');
    }
    if (addr.street) {
      return [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
    }
    if (typeof addr === 'string') return addr;
    return Object.values(addr).filter(Boolean).join(', ');
  }, [getPrimaryAddress]);

  const [formData, setFormData] = useState({
    first_name: profile?.firstName || '',
    last_name: profile?.lastName || '',
    phone: profile?.phone || '',
    address: getFormattedPrimaryAddress()
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        address: getFormattedPrimaryAddress()
      }));
    }
  }, [isOpen, profile, getFormattedPrimaryAddress]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // eslint-disable-next-line no-unused-vars
      const { address, ...profileUpdates } = formData;
      await onSave(profileUpdates);
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    }
    
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="account-modal-overlay" onClick={onClose}>
      <div className="account-modal account-modal--profile-edit" onClick={(e) => e.stopPropagation()}>
        <div className="account-modal__header">
          <h2 className="account-modal__title">Edit Profile</h2>
          <button className="account-modal__close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="account-modal__form">
          <div className="account-modal__form-row">
            <div className="account-modal__form-group">
              <label className="account-modal__label">First Name</label>
              <input
                type="text"
                className="account-modal__input"
                value={formData.first_name}
                onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                required
              />
            </div>
            <div className="account-modal__form-group">
              <label className="account-modal__label">Last Name</label>
              <input
                type="text"
                className="account-modal__input"
                value={formData.last_name}
                onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                required
              />
            </div>
          </div>
          <div className="account-modal__form-group">
            <label className="account-modal__label">Phone Number (Optional)</label>
            <input
              type="tel"
              className="account-modal__input"
              value={formatPhoneForInput(formData.phone)}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 10) {
                  setFormData({...formData, phone: value});
                }
              }}
              placeholder="1234567890"
            />
          </div>
          <div className="account-modal__form-group">
            <label className="account-modal__label">Default Address (Optional)</label>
            <textarea
              className="account-modal__textarea"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              placeholder="Add your default delivery address"
              style={{resize: 'none'}}
            />
          </div>
          {error && (
            <div className="account-modal__error">
              {error}
            </div>
          )}
          <div className="account-modal__actions">
            <button type="button" className="account-modal__btn account-modal__btn--cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="account-modal__btn account-modal__btn--save" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

ProfileEditModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  profile: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  getPrimaryAddress: PropTypes.func.isRequired
};

const OrderDetailsModal = ({ isOpen, onClose, order }) => {
  if (!isOpen || !order) return null;

  const getOrderProgress = (status) => {
    const steps = [
      { key: 'pending', label: 'Order Placed' },
      { key: 'confirmed', label: 'Confirmed' },
      { key: 'preparing', label: 'Preparing' },
      { key: 'out_for_delivery', label: 'Out for Delivery' },
      { key: 'delivered', label: 'Delivered' }
    ];

    const currentIndex = steps.findIndex(step => step.key === status);
    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
      active: index === currentIndex
    }));
  };

  const progressSteps = getOrderProgress(order.status);
  

  return (
    <div className="account-modal-overlay" onClick={onClose}>
      <div className="account-modal account-modal--order-details" onClick={(e) => e.stopPropagation()}>
        <div className="account-modal__header">
          <h2 className="account-modal__title">Order Details</h2>
          <button className="account-modal__close-btn" onClick={onClose}>×</button>
        </div>
        <div className="account-modal__content">
          <div className="order-info">
            <div className="order-header">
              <h3>
                Order #{order.orderNumber || order.order_number || order.id}
              </h3>
              <div className={`order-status ${order.status.replace(/_/g, '-')}`}>
                {order.status.replace(/_/g, ' ').toUpperCase()}
              </div>
            </div>
            <div className="order-meta">
              {(() => {
                try {
                  const isMultiRestaurant = order.restaurantGroups && Object.keys(order.restaurantGroups).length > 1;
                  
                  if (isMultiRestaurant) {
                    const restaurantNames = [];
                    Object.keys(order.restaurantGroups).forEach(restaurantId => {
                      const restaurant = order.restaurants?.find(r => r.id == restaurantId);
                      if (restaurant) {
                        restaurantNames.push(restaurant.name);
                      } else {
                        restaurantNames.push(restaurantId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
                      }
                    });
                    
                    return (
                      <>
                        <p><strong>Restaurants:</strong> {restaurantNames.join(', ')}</p>
                        <p><strong>Restaurant Count:</strong> {restaurantNames.length}</p>
                      </>
                    );
                  } else if (order.restaurants && order.restaurants.length === 1) {
                    return <p><strong>Restaurant:</strong> {order.restaurants[0].name}</p>;
                  } else if (order.restaurant?.name) {
                    return <p><strong>Restaurant:</strong> {order.restaurant.name}</p>;
                  } else if (order.restaurantGroups && Object.keys(order.restaurantGroups).length === 1) {
                    const restaurantId = Object.keys(order.restaurantGroups)[0];
                    const restaurant = order.restaurants?.find(r => r.id == restaurantId);
                    const restaurantName = restaurant?.name || restaurantId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    return <p><strong>Restaurant:</strong> {restaurantName}</p>;
                  } else {
                    return <p><strong>Restaurant:</strong> Restaurant not available</p>;
                  }
                } catch (error) {
                  console.error('Error displaying restaurant info:', error);
                  return <p><strong>Restaurant:</strong> Restaurant not available</p>;
                }
              })()}
                              <p><strong>Order Date:</strong> {(() => {
                  const date = order.createdAt || order.created_at;
                  if (!date) return 'Date not available';
                  try {
                    return new Date(date).toLocaleDateString();
                  } catch (error) {
                    console.error('Invalid date in modal:', date, error);
                    return 'Invalid date';
                  }
                })()}</p>
              
              {}
              <div className="price-breakdown">
                <h4>Order Summary</h4>
                <div className="breakdown-line">
                  <span>Subtotal:</span>
                  <span>${parseFloat(order.subtotal || 0).toFixed(2)}</span>
                </div>
                
                {order.discountAmount && parseFloat(order.discountAmount) > 0 && (
                  <div className="breakdown-line discount-line">
                    <span>Promo Discount{order.appliedPromo?.code ? ` (${order.appliedPromo.code})` : ''}:</span>
                    <span className="discount-value">-${parseFloat(order.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                
                <div className="breakdown-line">
                  <span>Delivery Fee:</span>
                  <span>${parseFloat(order.deliveryFee || order.delivery_fee || 5.99).toFixed(2)}</span>
                </div>
                <div className="breakdown-line">
                  <span>Tip:</span>
                  <span>${parseFloat(order.tip || 0).toFixed(2)}</span>
                </div>
                <div className="breakdown-line">
                  <span>Tax:</span>
                  <span>${parseFloat(order.tax || 0).toFixed(2)}</span>
                </div>
                <div className="breakdown-line total-line">
                  <span><strong>Total:</strong></span>
                  <span><strong>${parseFloat(order.total || 0).toFixed(2)}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="order-progress">
            <h4>Order Progress</h4>
            <div className="progress-steps">
              {progressSteps.map((step, index) => (
                <div key={step.key} className={`progress-step ${step.completed ? 'completed' : ''} ${step.active ? 'active' : ''}`}>
                  <div className="step-icon">{step.completed ? '✓' : index + 1}</div>
                  <div className="step-label">{step.label}</div>
                  {index < progressSteps.length - 1 && <div className="step-line"></div>}
                </div>
              ))}
            </div>
          </div>

          <div className="order-items">
            <h4>Items Ordered</h4>
            {order.restaurantGroups ? (
              Object.entries(order.restaurantGroups).map(([restaurantId, group]) => {
                const restaurant = order.restaurants?.find(r => r.id == restaurantId);
                const restaurantName = restaurant?.name || restaurantId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                return (
                  <div key={restaurantId} className="restaurant-order-group">
                    <h5 className="restaurant-name">{restaurantName}</h5>
                    {(() => {
                      const groupItems = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
                      const restaurantSubtotal = groupItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                      
                      return groupItems.length > 0 ? (
                        <>
                          {groupItems.map((item, index) => (
                            <div key={`${restaurantId}-${index}`} className="order-item">
                              <div className="item-name">{item.name}</div>
                              <div className="item-quantity">x{item.quantity}</div>
                              <div className="item-price">${(item.price * item.quantity).toFixed(2)}</div>
                            </div>
                          ))}
                          <div className="restaurant-subtotal">
                            <strong>Restaurant Subtotal: ${restaurantSubtotal.toFixed(2)}</strong>
                          </div>
                        </>
                      ) : <p>No items found for this restaurant</p>;
                    })()}
                  </div>
                );
              })
            ) : (
              (() => {
                let itemsToDisplay = [];
                
                if (Array.isArray(order.items)) {
                  itemsToDisplay = order.items;
                } else if (order.items && typeof order.items === 'object') {
                  itemsToDisplay = Object.values(order.items);
                }
                
                return itemsToDisplay.length > 0 ? itemsToDisplay.map((item, index) => (
                  <div key={index} className="order-item">
                    <div className="item-name">{item.name}</div>
                    <div className="item-quantity">x{item.quantity}</div>
                    <div className="item-price">${(item.price * item.quantity).toFixed(2)}</div>
                  </div>
                )) : <p>No items found</p>;
              })()
            )}
          </div>

          <div className="order-total">
            <strong>Total: ${order.total}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

OrderDetailsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  order: PropTypes.object
};


const DeleteAccountModal = ({ isOpen, onClose, onDelete, error }) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    await onDelete(password);
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="account-modal-overlay" onClick={onClose}>
      <div className="account-modal account-modal--delete-account" onClick={(e) => e.stopPropagation()}>
        <div className="account-modal__header">
          <h2 className="account-modal__title">Delete Account</h2>
          <button className="account-modal__close-btn" onClick={onClose}>×</button>
        </div>
        {error && (
          <div className="account-modal__error" role="alert">
            {error}
          </div>
        )}
        <div className="account-modal__warning">
          <p>⚠️ This action cannot be undone. This will permanently delete your account and all associated data.</p>
          <p>Please enter your password to confirm:</p>
        </div>
        <form onSubmit={handleSubmit} className="account-modal__form">
          <div className="account-modal__form-group">
            <label className="account-modal__label">Password</label>
            <input
              type="password"
              className="account-modal__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="account-modal__actions">
            <button type="button" className="account-modal__btn account-modal__btn--cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="account-modal__btn account-modal__btn--delete" disabled={isLoading}>
              {isLoading ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

DeleteAccountModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  error: PropTypes.string
};

export default function AccountPage() {
  const { user, profile: authProfile, signOut, getPrimaryAddress } = useAuth();
  const { addToCart, clearCart } = useCart();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ totalOrders: 0, totalSpent: 0, favoriteRestaurantsCount: 0 });
  const [preferences, setPreferences] = useState(null);
  const [loginActivity, setLoginActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orderFilters, setOrderFilters] = useState({ status: 'all', dateRange: null });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [giftCards, setGiftCards] = useState([]);
  const [giftCardsLoading, setGiftCardsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
  }, [user]);

  const loadUserData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profileData, ordersData, statsData, preferencesData, loginActivityData] = await Promise.all([
        fetchUserProfile(user.id),
        fetchUserOrders(user.id, orderFilters),
        fetchUserStats(user.id),
        fetchUserPreferences(user.id),
        fetchUserLoginActivity(user.id)
      ]);
      setProfile(profileData || authProfile);
      setOrders(ordersData);
      setStats(statsData);
      setPreferences(preferencesData);
      setLoginActivity(loginActivityData);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, orderFilters, authProfile]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user, loadUserData]);

  useEffect(() => {
    if (!user) return;
    const subscription = subscribeToOrderUpdates(user.id, () => {
      fetchUserOrders(user.id, orderFilters).then(setOrders);
      fetchUserStats(user.id).then(setStats);
    });
    return () => {
      if (subscription) {
        unsubscribeFromOrderUpdates(subscription);
      }
    };
  }, [user, orderFilters]);

  useEffect(() => {
    if (activeTab !== 'gift-cards' || !user) return;
    setGiftCardsLoading(true);
    apiClient.getMyGiftCards()
      .then((res) => {
        if (res && res.data) setGiftCards(Array.isArray(res.data) ? res.data : []);
        else setGiftCards([]);
      })
      .catch(() => setGiftCards([]))
      .finally(() => setGiftCardsLoading(false));
  }, [activeTab, user]);

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  const handleProfileSave = async (formData) => {
    try {
      const result = await updateUserProfile(user.id, formData);
      if (result.success) {
        setProfile(result.data);
        setShowProfileModal(false);
      } else {
        console.error('Failed to update profile:', result.error);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleOrderFilter = async (filters) => {
    setOrderFilters(filters);
    const ordersData = await fetchUserOrders(user.id, filters);
    setOrders(ordersData);
  };

  const handleOrderDetails = async (orderId) => {
    const orderData = await fetchOrderById(orderId);
    setSelectedOrder(orderData);
    setShowOrderModal(true);
  };

  const handleReorder = async (orderId) => {
    const result = await reorderItems(orderId);
    if (result.success && result.data) {
      clearCart();
      
      if (result.data.isMultiRestaurant && result.data.restaurantGroups) {
        const restaurants = result.data.restaurants || [];
        
        Object.entries(result.data.restaurantGroups).forEach(([restaurantId, group]) => {
          const restaurant = restaurants.find(r => r.id == restaurantId) || { 
            id: restaurantId, 
            name: restaurantId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) 
          };
          
          const groupItems = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
          
          groupItems.forEach(item => {
            const cartItem = {
              ...item,
              restaurantId: restaurant.id,
              restaurantName: restaurant.name
            };
            addToCart(cartItem, item.quantity || 1, restaurant);
          });
        });
        
        navigate('/cart');
      } else {
        const items = result.data.items || [];
        const restaurant = result.data.restaurant || { id: 'unknown', name: 'Restaurant' };
        
        if (items.length > 0) {
          items.forEach(item => {
            const cartItem = {
              ...item,
              restaurantId: restaurant.id,
              restaurantName: restaurant.name
            };
            addToCart(cartItem, item.quantity || 1, restaurant);
          });
          navigate('/cart');
        } else {
          console.error('No items found in reorder response');
        }
      }
    } else {
      console.error('Reorder failed:', result);
    }
  };

  const handlePreferencesUpdate = async (newPreferences) => {
    const result = await updateUserPreferences(user.id, newPreferences);
    if (result.success) {
      setPreferences(result.data);
    }
  };


  const handleDeleteAccount = async (password) => {
    setDeleteAccountError(null);
    const result = await deleteUserAccount(user.id, password);
    if (result.success) {
      await signOut();
      navigate('/');
    } else {
      const msg = result.error || 'Failed to delete account';
      setDeleteAccountError(msg);
      console.error('[AccountPage] Delete account failed:', msg, result);
    }
  };

  if (loading) {
    return (
      <div className="account-page">
        <div className="account-page__content">
          <LoadingSpinner 
            size="large" 
            text="Loading your account..." 
            variant="primary"
            className="loading-spinner--fullpage"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="account-page__content">
        {}
        <div className="dashboard-header">
          <div className="user-welcome">
            <div className="user-avatar">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path
                  fill="#061757"
                  d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z"
                />
              </svg>
            </div>
            <div className="user-info">
              <h1 className="user-name">
                Welcome back, {profile?.firstName || 'User'}!
              </h1>
              <p className="user-subtitle">Manage your account and track your orders</p>
            </div>
          </div>
          
          {}
          <div className="quick-stats">
            <div className="stat-card">
              <div className="stat-number">{stats.totalOrders}</div>
              <div className="stat-label">Total Orders</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.favoriteRestaurantsCount}</div>
              <div className="stat-label">Favorite Restaurants</div>
            </div>
          </div>
        </div>

        {}
        <div className="dashboard-nav">
          <button 
            className={`nav-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            Profile
          </button>
          <button 
            className={`nav-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z"/>
            </svg>
            Orders
          </button>
          <button 
            className={`nav-tab ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
            </svg>
            Preferences
          </button>
          <button 
            className={`nav-tab ${activeTab === 'gift-cards' ? 'active' : ''}`}
            onClick={() => setActiveTab('gift-cards')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M20 6H4C2.9 6 2 6.9 2 8v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 2v2H4V8h16zm-2 10H4v-4h14v4zm2-6h2v4h-2v-4z"/>
            </svg>
            Gift Cards
          </button>
          <button 
            className={`nav-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11.5C15.4,11.5 16,12.4 16,13V16C16,16.6 15.6,17 15,17H9C8.4,17 8,16.6 8,16V13C8,12.4 8.4,11.5 9,11.5V10C9,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.2,9.2 10.2,10V11.5H13.8V10C13.8,9.2 12.8,8.2 12,8.2Z"/>
            </svg>
            Security
          </button>
        </div>

        {}
        <div className="dashboard-content">
          {activeTab === 'profile' && (
            <div className="profile-section">
              <div className="section-header">
                <h2>Profile Information</h2>
                <button className="edit-btn" onClick={() => setShowProfileModal(true)}>
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                  </svg>
                  Edit
                </button>
              </div>
              <div className="profile-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input type="text" value={profile?.firstName || ''} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input type="text" value={profile?.lastName || ''} readOnly />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" value={user?.email || ''} readOnly />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="tel" value={formatPhoneNumber(profile?.phone) || ''} placeholder="Add your phone number" readOnly />
                </div>
                <div className="form-group">
                  <label>Default Address</label>
                  <div className="address-display">
                    <textarea
                      value={(() => {
                        const addr = getPrimaryAddress && getPrimaryAddress();
                        if (!addr) return '';
                        if (addr.address && typeof addr.address === 'object') {
                          const a = addr.address;
                          return [a.street, a.city, a.state, a.zip].filter(Boolean).join(', ');
                        }
                        if (addr.street) {
                          return [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
                        }
                        if (typeof addr === 'string') return addr;
                        return Object.values(addr).filter(Boolean).join(', ');
                      })()}
                      placeholder="Add your default delivery address"
                      readOnly
                      style={{resize: 'none'}}
                    ></textarea>

                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gift-cards' && (
            <div className="gift-cards-section">
              <div className="section-header">
                <h2>My Gift Cards</h2>
              </div>
              {giftCardsLoading ? (
                <p>Loading...</p>
              ) : giftCards.length === 0 ? (
                <p>You have no gift cards yet. <a href="/gift-card">Purchase a gift card</a> or use one at checkout.</p>
              ) : (
                <ul className="gift-cards-list" style={{ listStyle: 'none', padding: 0 }}>
                  {giftCards.map((gc) => (
                    <li key={gc.id} style={{ padding: '12px 0', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <strong style={{ fontFamily: 'monospace' }}>{gc.code}</strong>
                        <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                          ${Number(gc.balance).toFixed(2)} of ${Number(gc.initialBalance).toFixed(2)} left
                        </span>
                        {gc.status !== 'active' && <span style={{ marginLeft: '8px', color: '#9ca3af' }}>({gc.status})</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="orders-section">
              <div className="section-header">
                <h2>Order History</h2>
                <div className="filter-controls">
                  <div className="filter-buttons">
                    <button 
                      className={`filter-btn ${orderFilters.status === 'all' ? 'active' : ''}`}
                      onClick={() => handleOrderFilter({ ...orderFilters, status: 'all' })}
                    >
                      All
                    </button>
                    <button 
                      className={`filter-btn ${orderFilters.status === 'delivered' ? 'active' : ''}`}
                      onClick={() => handleOrderFilter({ ...orderFilters, status: 'delivered' })}
                    >
                      Delivered
                    </button>
                    <button 
                      className={`filter-btn ${orderFilters.status === 'in_progress' ? 'active' : ''}`}
                      onClick={() => handleOrderFilter({ ...orderFilters, status: 'in_progress' })}
                    >
                      In Progress
                    </button>
                  </div>
                  <div className="date-filters">
                    <select 
                      value={orderFilters.dateRange || ''}
                      onChange={(e) => handleOrderFilter({ ...orderFilters, dateRange: e.target.value || null })}
                    >
                      <option value="">All Time</option>
                      <option value="recent">Recent (7 days)</option>
                      <option value="30_days">Last 30 days</option>
                      <option value="3_months">Last 3 months</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="orders-list">
                {orders.length === 0 ? (
                  <div className="empty-state">
                    <p>No orders found matching your filters.</p>
                  </div>
                ) : (
                  orders.map(order => (
                    <div key={order.id} className="order-card">
                      <div className="order-header">
                        <div className="order-id">#{order.checkout_session_id || order.id}</div>
                        <div className={`order-status ${order.status.replace(/_/g, '-')}`}>
                          {order.status.replace(/_/g, ' ').toUpperCase()}
                        </div>
                      </div>
                      <div className="order-details">
                        <div className="order-restaurant">
                          {(() => {
                            try {
                              if (Array.isArray(order.restaurants) && order.restaurants.length > 0) {
                                return order.restaurants
                                  .map(r => r?.name || '')
                                  .filter(Boolean)
                                  .join(', ') || 'Restaurant not available';
                              }

                              if (order.restaurantGroups && typeof order.restaurantGroups === 'object') {
                                return Object.keys(order.restaurantGroups)
                                  .map(id => id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
                                  .join(', ') || 'Restaurant not available';
                              }

                              if (order.restaurant?.name) {
                                return order.restaurant.name;
                              }

                              return 'Restaurant not available';
                            } catch (error) {
                              console.error('Error displaying restaurant name:', error);
                              return 'Restaurant not available';
                            }
                          })()}
                        </div>
                        <div className="order-date">
                  {(() => {
                    const date = order.createdAt || order.created_at;
                    if (!date) return 'Date not available';
                    try {
                      return new Date(date).toLocaleDateString();
                    } catch (error) {
                      console.error('Invalid date:', date, error);
                      return 'Invalid date';
                    }
                  })()}
                </div>
                      </div>
                      <div className="order-summary">
                        <div className="order-items">
                          {(() => {
                            try {
                              if (order.restaurantGroups && Object.keys(order.restaurantGroups).length > 0) {
                                const totalItems = Object.values(order.restaurantGroups).reduce((total, group) => {
                                  const groupItems = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
                                  return total + groupItems.length;
                                }, 0);
                                return totalItems + ' items';
                              } else if (Array.isArray(order.items)) {
                                return order.items.length + ' items';
                              } else if (order.items && typeof order.items === 'object') {
                                return Object.keys(order.items).length + ' items';
                              }
                              return '0 items';
                            } catch (error) {
                              console.error('Error calculating item count:', error);
                              return '0 items';
                            }
                          })()}
                        </div>
                        <div className="order-total">${parseFloat(order.total || 0).toFixed(2)}</div>
                      </div>
                      <div className="order-actions">
                        <button className="action-btn" onClick={() => handleOrderDetails(order.checkout_session_id || order.id)}>
                          View Details
                        </button>
                        <button className="action-btn secondary" onClick={() => handleReorder(order.checkout_session_id || order.id)}>
                          Reorder
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="preferences-section">
              <div className="section-header">
                <h2>Preferences</h2>
              </div>
              <div className="preferences-grid">
                <div className="preference-card">
                  <div className="preference-header">
                    <h3>Delivery Preferences</h3>
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="#061757" d="M18,18.5A1.5,1.5 0 0,1 16.5,17A1.5,1.5 0 0,1 18,15.5A1.5,1.5 0 0,1 19.5,17A1.5,1.5 0 0,1 18,18.5M19.5,9.5L21.46,12H17V9.5M6,18.5A1.5,1.5 0 0,1 4.5,17A1.5,1.5 0 0,1 6,15.5A1.5,1.5 0 0,1 7.5,17A1.5,1.5 0 0,1 6,18.5M20,8H17V4H3C1.89,4 1,4.89 1,6V17H3A3,3 0 0,0 6,20A3,3 0 0,0 9,17H15A3,3 0 0,0 18,20A3,3 0 0,0 21,17H23V12L20,8Z"/>
                    </svg>
                  </div>
                  <div className="preference-options">
                    <div className="option-item">
                      <span>Delivery instructions</span>
                      <input 
                        type="text" 
                        value={preferences?.delivery_instructions || ''}
                        onChange={(e) => handlePreferencesUpdate({ ...preferences, delivery_instructions: e.target.value })}
                        placeholder="Leave at door, ring bell, etc." 
                      />
                    </div>
                  </div>
                </div>

                <div className="preference-card">
                  <div className="preference-header">
                    <h3>Notifications</h3>
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="#061757" d="M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.19 14,4.29 16.97,5.17 19,7.9 19,11V17L21,19M14,21A2,2 0 0,1 12,23A2,2 0 0,1 10,21"/>
                    </svg>
                  </div>
                  <div className="preference-options">
                    <div className="option-item">
                      <span>Order updates</span>
                      <label className="toggle">
                        <input 
                          type="checkbox" 
                          checked={preferences?.order_updates !== false}
                          onChange={(e) => handlePreferencesUpdate({ ...preferences, order_updates: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                    <div className="option-item">
                      <span>Promotional emails</span>
                      <label className="toggle">
                        <input 
                          type="checkbox" 
                          checked={preferences?.promotional_emails !== false}
                          onChange={(e) => handlePreferencesUpdate({ ...preferences, promotional_emails: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="security-section">
              <div className="section-header">
                <h2>Security Settings</h2>
              </div>
              <div className="security-options">
                <div className="security-card">
                  <div className="security-item">
                    <div className="security-info">
                      <h3>Login Activity</h3>
                      <p>Review recent login activity</p>
                    </div>
                  </div>
                  <div className="login-activity-list">
                    {loginActivity.map((activity, index) => (
                      <div key={index} className="login-activity-item">
                        <div className="activity-info">
                          <span className="device">{activity.device_type}</span>
                          <span className="location">{activity.location}</span>
                        </div>
                        <div className="activity-time">
                          {new Date(activity.login_time).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="security-card danger">
                  <div className="security-item">
                    <div className="security-info">
                      <h3>Delete Account</h3>
                      <p>Permanently delete your account and all data</p>
                    </div>
                    <button className="security-btn danger" onClick={() => setShowDeleteModal(true)}>
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {}
      <ProfileEditModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        profile={profile}
        onSave={handleProfileSave}
        getPrimaryAddress={getPrimaryAddress}
      />

      <OrderDetailsModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        order={selectedOrder}
      />


      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => { setDeleteAccountError(null); setShowDeleteModal(false); }}
        onDelete={handleDeleteAccount}
        error={deleteAccountError}
      />

      <AddressManagementModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />

      <Footer />
    </div>
  );
} 