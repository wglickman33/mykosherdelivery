import './AdminOrderEdit.scss';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchOrderById, updateOrder, fetchAllRestaurants, processRefund, fetchOrderRefunds } from '../../services/adminServices';
import { useNotification } from '../../hooks/useNotification';
import NotificationToast from '../NotificationToast/NotificationToast';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import MenuItemBrowser from '../MenuItemBrowser/MenuItemBrowser';

const AdminOrderEdit = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Order editing state
  const [editedOrder, setEditedOrder] = useState(null);
  const [originalOrder, setOriginalOrder] = useState(null);
  
  // UI state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showMenuItemBrowser, setShowMenuItemBrowser] = useState(false);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState(null);
  
  // Refund state
  const [refunds, setRefunds] = useState([]);
  const [refundType, setRefundType] = useState('full');
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');
  const [processingRefund, setProcessingRefund] = useState(false);
  const { notification, showNotification, clearNotification } = useNotification();

  useEffect(() => {
    fetchOrderData();
    fetchRestaurants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (order?.id) {
      fetchRefunds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [autoSaveTimeout]);

  useEffect(() => {
    if (order && refundType === 'full') {
      // Use original order total (the amount that was actually paid, including all fees)
      const orderTotal = parseFloat(originalOrder?.total || order.total || 0);
      const totalRefunded = refunds
        .filter(r => r.status === 'processed')
        .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
      setRefundAmount(orderTotal - totalRefunded);
    }
  }, [refundType, order, originalOrder, refunds]);

  const fetchOrderData = async () => {
    try {
      setLoading(true);
      const result = await fetchOrderById(orderId);
      if (result.success) {
        const orderData = result.data;
        setOrder(orderData);
        setEditedOrder(JSON.parse(JSON.stringify(orderData))); // Deep copy
        setOriginalOrder(JSON.parse(JSON.stringify(orderData))); // Deep copy
      } else {
        setError(result.error || 'Failed to fetch order');
      }
    } catch (err) {
      setError('Failed to fetch order');
      console.error('Error fetching order:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRefunds = async () => {
    try {
      const result = await fetchOrderRefunds(orderId);
      if (result.success) {
        setRefunds(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching refunds:', err);
    }
  };

  const handleProcessRefund = async () => {
    if (!refundReason.trim()) {
      showNotification('Please provide a reason for the refund', 'error');
      return;
    }

    if (refundAmount <= 0) {
      showNotification('Refund amount must be greater than 0', 'error');
      return;
    }

    // Use original order total (the amount that was actually paid, including all fees)
    const orderTotal = parseFloat(originalOrder?.total || order.total || 0);
    const totalRefunded = refunds
      .filter(r => r.status === 'processed')
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const remainingRefundable = orderTotal - totalRefunded;
    
    if (refundAmount > remainingRefundable) {
      showNotification(`Refund amount cannot exceed remaining refundable amount of ${formatCurrency(remainingRefundable)}`, 'error');
      return;
    }

    setProcessingRefund(true);
    try {
      const result = await processRefund(orderId, {
        amount: refundAmount,
        reason: refundReason.trim(),
        refundType: refundType
      });

      if (result.success) {
        showNotification('Refund processed successfully', 'success');
        setShowRefundModal(false);
        setRefundReason('');
        setRefundType('full');
        setRefundAmount(0);
        // Refresh order and refunds
        await fetchOrderData();
        await fetchRefunds();
      } else {
        showNotification(result.error || 'Failed to process refund', 'error');
      }
    } catch (err) {
      showNotification('Failed to process refund: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setProcessingRefund(false);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const result = await fetchAllRestaurants();
      if (result.success) {
        setRestaurants(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    }
  };

  // Calculate price differences
  const calculatePriceDifference = () => {
    if (!editedOrder || !originalOrder) return 0;
    
    const originalTotal = parseFloat(originalOrder.total || 0);
    const newTotal = calculateNewTotal();
    return newTotal - originalTotal;
  };

  const calculateNewTotal = () => {
    if (!editedOrder) return 0;
    
    let subtotal = 0;
    
    // Calculate subtotal from restaurant groups
    if (editedOrder.restaurantGroups) {
      Object.values(editedOrder.restaurantGroups).forEach(group => {
        const groupItems = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
        groupItems.forEach(item => {
          subtotal += (parseFloat(item.price || 0) * parseInt(item.quantity || 0));
        });
      });
    }
    
    const deliveryFee = parseFloat(editedOrder.deliveryFee || 0);
    const tip = parseFloat(editedOrder.tip || 0);
    const tax = parseFloat(editedOrder.tax || 0);
    const discountAmount = parseFloat(editedOrder.discountAmount || 0);
    
    return subtotal + deliveryFee + tip + tax - discountAmount;
  };

  // Update item quantity
  const updateItemQuantity = (restaurantId, itemIndex, newQuantity) => {
    if (!editedOrder || !editedOrder.restaurantGroups) return;
    
    const updatedOrder = { ...editedOrder };
    const group = updatedOrder.restaurantGroups[restaurantId];
    
    if (group && group.items) {
      const items = Array.isArray(group.items) ? group.items : Object.values(group.items);
      if (items[itemIndex]) {
        items[itemIndex].quantity = Math.max(0, parseInt(newQuantity));
        
        // Update the group
        updatedOrder.restaurantGroups[restaurantId] = {
          ...group,
          items: items,
          subtotal: items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        };
        
        setEditedOrder(updatedOrder);
        autoSave();
      }
    }
  };

  // Remove item
  const removeItem = (restaurantId, itemIndex) => {
    if (!editedOrder || !editedOrder.restaurantGroups) return;
    
    const updatedOrder = { ...editedOrder };
    const group = updatedOrder.restaurantGroups[restaurantId];
    
    if (group && group.items) {
      const items = Array.isArray(group.items) ? group.items : Object.values(group.items);
      items.splice(itemIndex, 1);
      
      // Update the group
      updatedOrder.restaurantGroups[restaurantId] = {
        ...group,
        items: items,
        subtotal: items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      };
      
      setEditedOrder(updatedOrder);
      autoSave();
    }
  };

  // Add item to order
  const addItemToOrder = (menuItem) => {
    if (!editedOrder) return;
    
    const updatedOrder = { ...editedOrder };
    
    // Initialize restaurantGroups if it doesn't exist
    if (!updatedOrder.restaurantGroups) {
      updatedOrder.restaurantGroups = {};
    }
    
    const restaurantId = menuItem.restaurantId;
    
    // Initialize restaurant group if it doesn't exist
    if (!updatedOrder.restaurantGroups[restaurantId]) {
      updatedOrder.restaurantGroups[restaurantId] = {
        items: [],
        subtotal: 0
      };
    }
    
    const group = updatedOrder.restaurantGroups[restaurantId];
    const items = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
    
    // For configured items (variety/builder), create a unique identifier based on configuration
    // This allows multiple configurations of the same item to be separate line items
    const itemKey = menuItem.selectedVariant || menuItem.selectedConfigurations
      ? `${menuItem.id}-${JSON.stringify(menuItem.selectedVariant || menuItem.selectedConfigurations)}`
      : menuItem.id;
    
    // Check if item with same configuration already exists
    const existingItemIndex = items.findIndex(item => {
      if (item.selectedVariant || item.selectedConfigurations) {
        const existingKey = `${item.id}-${JSON.stringify(item.selectedVariant || item.selectedConfigurations)}`;
        return existingKey === itemKey;
      }
      return item.id === menuItem.id;
    });
    
    const quantity = menuItem.quantity || 1;
    
    if (existingItemIndex >= 0) {
      // Increase quantity of existing item
      items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item with all configuration data
      const newItem = {
        id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price || parseFloat(menuItem.price),
        quantity: quantity,
        description: menuItem.description,
        imageUrl: menuItem.imageUrl,
        category: menuItem.category,
        options: menuItem.options || [],
        itemType: menuItem.itemType || 'simple'
      };
      
      // Add configuration data for variety items
      if (menuItem.selectedVariant) {
        newItem.selectedVariant = menuItem.selectedVariant;
        newItem.basePrice = menuItem.basePrice || menuItem.price;
      }
      
      // Add configuration data for builder items
      if (menuItem.selectedConfigurations) {
        newItem.selectedConfigurations = menuItem.selectedConfigurations;
        newItem.configurationPrice = menuItem.configurationPrice || 0;
        newItem.basePrice = menuItem.basePrice || menuItem.price;
      }
      
      items.push(newItem);
    }
    
    // Update the group
    updatedOrder.restaurantGroups[restaurantId] = {
      ...group,
      items: items,
      subtotal: items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };
    
    setEditedOrder(updatedOrder);
    setShowMenuItemBrowser(false);
      autoSave();
  };

  // Auto-save changes with debouncing (no automatic refunds)
  const autoSave = async () => {
    if (!editedOrder) return;
    
    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    
    // Set new timeout for auto-save (1 second delay)
    const timeout = setTimeout(async () => {
    try {
      setSaving(true);
      
      const newTotal = calculateNewTotal();
        
        // Update the order (no automatic refunds - user must manually process refunds)
        // Note: We don't update order.total here - it should remain as the original paid amount for refund purposes
        // The newTotal is calculated for display purposes only
      const updatedOrderData = {
        ...editedOrder,
        subtotal: editedOrder.restaurantGroups ? 
            Object.values(editedOrder.restaurantGroups).reduce((sum, group) => sum + (group.subtotal || 0), 0) : 0
          // Keep original total - don't update it so refunds can use the original paid amount
      };
      
      const result = await updateOrder(orderId, updatedOrderData);
      if (result.success) {
        setOrder(result.data);
        setOriginalOrder(JSON.parse(JSON.stringify(result.data)));
          showNotification('Order updated', 'success');
          await fetchOrderData();
      } else {
          showNotification(result.error || 'Failed to update order', 'error');
      }
    } catch (err) {
        console.error('Error auto-saving order:', err);
        showNotification('Failed to save changes: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
    }, 1000);
    
    setAutoSaveTimeout(timeout);
  };

  // Format currency
  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (loading) {
    return (
      <div className="admin-order-edit">
        <div className="loading-container">
          <LoadingSpinner size="large" />
          <p>Loading order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="admin-order-edit">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error || 'Order not found'}</p>
          <button onClick={() => navigate('/admin/orders')} className="back-btn">
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const priceDifference = calculatePriceDifference();
  const newTotal = calculateNewTotal();

  return (
    <div className="admin-order-edit">
      {/* Header */}
      <div className="order-edit-header">
        <div className="header-content">
          <button 
            onClick={() => navigate('/admin/orders')} 
            className="back-btn"
          >
            ← Back to Orders
          </button>
          <h1>Edit Order #{order.orderNumber || order.order_number || order.id}</h1>
          <div className="order-status">
            <span className={`status-badge ${order.status}`}>
              {order.status?.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
        </div>
        <div className="header-actions">
          {priceDifference !== 0 && (
            <div className="price-difference">
              <span className="difference-label">Price Difference:</span>
              <span className={`difference-amount ${priceDifference >= 0 ? 'positive' : 'negative'}`}>
                {priceDifference >= 0 ? '+' : ''}{formatCurrency(priceDifference)}
              </span>
            </div>
          )}
          {saving && (
            <div className="saving-indicator">
              Saving...
            </div>
          )}
        </div>
      </div>

      {/* Order Overview */}
      <div className="order-overview">
        <div className="overview-grid">
          <div className="overview-item">
            <label>Customer:</label>
            <span>
              {order.user ? 
                `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || 'User' :
                order.guestInfo ? 
                  `${order.guestInfo.firstName || ''} ${order.guestInfo.lastName || ''}`.trim() || 'Guest' :
                  'Guest'
              }
            </span>
          </div>
          <div className="overview-item">
            <label>Email:</label>
            <span>{order.user?.email || order.guestInfo?.email || '—'}</span>
          </div>
          <div className="overview-item">
            <label>Order Date:</label>
            <span>
              {order.createdAt ? 
                new Date(order.createdAt).toLocaleString('en-US', { 
                  month: 'short', day: 'numeric', year: 'numeric', 
                  hour: '2-digit', minute: '2-digit' 
                }) : '—'
              }
            </span>
          </div>
          <div className="overview-item">
            <label>Original Total:</label>
            <span>{formatCurrency(parseFloat(originalOrder?.total || order.total || 0))}</span>
          </div>
            <div className="overview-item">
            <label>Current Total:</label>
            <span className={priceDifference !== 0 ? 'new-total' : ''}>{formatCurrency(newTotal)}</span>
            </div>
        </div>
      </div>

      {/* Unified Content */}
      <div className="unified-content">
        {/* Order Items Section */}
        <div className="content-section items-section">
          <div className="section-header">
              <h3>Order Items</h3>
              <button 
                className="add-item-btn"
                onClick={() => setShowMenuItemBrowser(true)}
              >
                Add Items
              </button>
            </div>
            
            {editedOrder?.restaurantGroups && Object.entries(editedOrder.restaurantGroups).map(([restaurantId, group]) => {
              const restaurant = restaurants.find(r => r.id == restaurantId);
              const restaurantName = restaurant?.name || restaurantId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              const groupItems = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
              
              return (
                <div key={restaurantId} className="restaurant-group">
                  <h4 className="restaurant-name">{restaurantName}</h4>
                  <div className="items-list">
                    {groupItems.map((item, index) => (
                      <div key={index} className="order-item">
                        <div className="item-price-left">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.price || 0}
                            onChange={(e) => {
                              const newPrice = parseFloat(e.target.value) || 0;
                              const updatedOrder = { ...editedOrder };
                              const group = updatedOrder.restaurantGroups[restaurantId];
                              const items = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
                              if (items[index]) {
                                items[index].price = newPrice;
                                updatedOrder.restaurantGroups[restaurantId] = {
                                  ...group,
                                  items: items,
                                  subtotal: items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
                                };
                                setEditedOrder(updatedOrder);
                                autoSave();
                              }
                            }}
                            className="price-input"
                            title="Click to edit price (set to 0 for no charge)"
                          />
                        </div>
                        <div className="item-info-controls">
                          <div className="item-name">{item.name}</div>
                          {/* Display selected variant for variety items */}
                          {item.itemType === 'variety' && item.selectedVariant && (
                            <div className="item-customization">
                              <span className="customization-label">Variant:</span>
                              <span className="customization-value">{item.selectedVariant.name}</span>
                            </div>
                          )}
                          {/* Display selected configurations for builder items */}
                          {item.itemType === 'builder' && item.selectedConfigurations && (
                            <div className="item-customization">
                              <span className="customization-label">Customizations:</span>
                              <div className="customization-list">
                                {Array.isArray(item.selectedConfigurations) ? (
                                  // If it's an array of selected options
                                  item.selectedConfigurations.map((config, idx) => (
                                    <div key={idx} className="customization-item">
                                      <span>{config.category}: {config.option}</span>
                                    </div>
                                  ))
                                ) : (
                                  // If it's an object with category keys
                                  Object.entries(item.selectedConfigurations).map(([key, configs]) => (
                                    <div key={key} className="customization-category">
                                      {Array.isArray(configs) && configs.length > 0 && (
                                        <span>{configs.map(idx => {
                                          const categoryIndex = parseInt(key.replace('category_', ''));
                                          const category = item.options?.configurations?.[categoryIndex];
                                          const option = category?.options?.[idx];
                                          return option?.name;
                                        }).filter(Boolean).join(', ')}</span>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        <div className="item-controls">
                          <button 
                            onClick={() => updateItemQuantity(restaurantId, index, item.quantity - 1)}
                            className="quantity-btn"
                          >
                            −
                          </button>
                          <span className="quantity">{item.quantity}</span>
                          <button 
                            onClick={() => updateItemQuantity(restaurantId, index, item.quantity + 1)}
                            className="quantity-btn"
                          >
                            +
                          </button>
                          <button 
                            onClick={() => removeItem(restaurantId, index)}
                            className="remove-btn"
                          >
                            Remove
                          </button>
                        </div>
                        </div>
                        <div className="item-total-right">
                          {formatCurrency(item.price * item.quantity)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="group-subtotal">
                    Subtotal: {formatCurrency(group.subtotal || 0)}
                  </div>
                </div>
              );
            })}
          </div>

        {/* Pricing & Fees Section */}
        <div className="content-section pricing-section">
          <div className="section-header">
            <h3>Pricing & Fees</h3>
          </div>
            <div className="pricing-grid">
              <div className="pricing-item">
                <label>Delivery Fee:</label>
                <input
                  type="number"
                  step="0.01"
                  value={editedOrder?.deliveryFee || 0}
                  onChange={(e) => {
                    setEditedOrder({
                      ...editedOrder,
                      deliveryFee: parseFloat(e.target.value) || 0
                    });
                  autoSave();
                  }}
                />
              </div>
              <div className="pricing-item">
                <label>Tip:</label>
                <input
                  type="number"
                  step="0.01"
                  value={editedOrder?.tip || 0}
                  onChange={(e) => {
                    setEditedOrder({
                      ...editedOrder,
                      tip: parseFloat(e.target.value) || 0
                    });
                  autoSave();
                  }}
                />
              </div>
              <div className="pricing-item">
                <label>Tax:</label>
                <input
                  type="number"
                  step="0.01"
                  value={editedOrder?.tax || 0}
                  onChange={(e) => {
                    setEditedOrder({
                      ...editedOrder,
                      tax: parseFloat(e.target.value) || 0
                    });
                  autoSave();
                  }}
                />
              </div>
              <div className="pricing-item">
                <label>Discount Amount:</label>
                <input
                  type="number"
                  step="0.01"
                  value={editedOrder?.discountAmount || 0}
                  onChange={(e) => {
                    setEditedOrder({
                      ...editedOrder,
                      discountAmount: parseFloat(e.target.value) || 0
                    });
                  autoSave();
                  }}
                />
              </div>
            </div>
          </div>

        {/* Refunds Section */}
        <div className="content-section refunds-section">
          <div className="section-header">
            <h3>Refund Management</h3>
          </div>
            
            {/* Refund Summary */}
            <div className="refund-summary">
              <div className="refund-summary-item">
              <span className="label">Original Order Total (Paid):</span>
              <span className="value">{formatCurrency(parseFloat(originalOrder?.total || order?.total || 0))}</span>
              </div>
              <div className="refund-summary-item">
                <span className="label">Total Refunded:</span>
                <span className="value">
                  {formatCurrency(refunds
                    .filter(r => r.status === 'processed')
                    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
                  )}
                </span>
              </div>
              <div className="refund-summary-item">
                <span className="label">Remaining Refundable:</span>
                <span className="value">
                {formatCurrency(parseFloat(originalOrder?.total || order?.total || 0) - refunds
                    .filter(r => r.status === 'processed')
                    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
                  )}
                </span>
              </div>
            </div>

            {/* Existing Refunds */}
            {refunds.length > 0 && (
              <div className="existing-refunds">
                <h4>Refund History</h4>
                <div className="refunds-list">
                  {refunds.map((refund) => (
                    <div key={refund.id} className="refund-item">
                      <div className="refund-header">
                        <span className="refund-amount">{formatCurrency(parseFloat(refund.amount || 0))}</span>
                        <span className={`refund-status refund-status-${refund.status}`}>
                          {refund.status === 'processed' ? 'Processed' : refund.status === 'pending' ? 'Pending' : 'Failed'}
                        </span>
                      </div>
                      <div className="refund-details">
                        <p><strong>Reason:</strong> {refund.reason}</p>
                        <p><strong>Date:</strong> {new Date(refund.createdAt).toLocaleString()}</p>
                        {refund.processor && (
                          <p><strong>Processed by:</strong> {refund.processor.firstName} {refund.processor.lastName}</p>
                        )}
                        {refund.stripeRefundId && (
                          <p><strong>Stripe Refund ID:</strong> {refund.stripeRefundId}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Process New Refund Button */}
            <div className="refund-actions">
              <button 
                className="refund-btn full-refund"
                onClick={() => {
                  setRefundType('full');
                  setShowRefundModal(true);
                }}
              >
                Process Full Refund
              </button>
              <button 
                className="refund-btn partial-refund"
                onClick={() => {
                  setRefundType('partial');
                  setRefundAmount(0);
                  setShowRefundModal(true);
                }}
              >
                Process Partial Refund
              </button>
              {!order?.stripePaymentIntentId && (
                <p className="refund-info">
                  Note: Payment intent ID not stored in order. The system will automatically locate it from Stripe when processing a refund.
                </p>
              )}
            </div>
          </div>
      </div>

      {/* Menu Item Browser */}
      {showMenuItemBrowser && (
        <MenuItemBrowser
          onItemSelect={addItemToOrder}
          onClose={() => setShowMenuItemBrowser(false)}
        />
      )}

      {/* Refund Modal */}
      {showRefundModal && order && (
        <div className="modal-overlay" onClick={() => {
          if (!processingRefund) {
            setShowRefundModal(false);
            setRefundReason('');
            setRefundType('full');
            setRefundAmount(0);
          }
        }}>
          <div className="modal refund-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Process {refundType === 'full' ? 'Full' : 'Partial'} Refund</h3>
              <button 
                onClick={() => {
                  if (!processingRefund) {
                    setShowRefundModal(false);
                    setRefundReason('');
                    setRefundType('full');
                    setRefundAmount(0);
                  }
                }}
                disabled={processingRefund}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="refund-modal-content">
                <div className="refund-order-info">
                  <p><strong>Original Order Total (Paid):</strong> {formatCurrency(parseFloat(originalOrder?.total || order.total || 0))}</p>
                  <p><strong>Already Refunded:</strong> {formatCurrency(refunds
                    .filter(r => r.status === 'processed')
                    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
                  )}</p>
                  <p><strong>Remaining Refundable:</strong> {formatCurrency(parseFloat(originalOrder?.total || order.total || 0) - refunds
                    .filter(r => r.status === 'processed')
                    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
                  )}</p>
                </div>

                <div className="refund-form">
                  <div className="form-group">
                    <label>Refund Type</label>
                    <div className="refund-type-buttons">
                      <button
                        type="button"
                        className={`type-btn ${refundType === 'full' ? 'active' : ''}`}
                        onClick={() => {
                          setRefundType('full');
                          // Use original order total (the amount that was actually paid, including all fees)
                          const orderTotal = parseFloat(originalOrder?.total || order.total || 0);
                          const totalRefunded = refunds
                            .filter(r => r.status === 'processed')
                            .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
                          setRefundAmount(orderTotal - totalRefunded);
                        }}
                        disabled={processingRefund}
                      >
                        Full Refund
                      </button>
                      <button
                        type="button"
                        className={`type-btn ${refundType === 'partial' ? 'active' : ''}`}
                        onClick={() => {
                          setRefundType('partial');
                          setRefundAmount(0);
                        }}
                        disabled={processingRefund}
                      >
                        Partial Refund
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="refund-amount">
                      Refund Amount ($)
                    </label>
                    <input
                      id="refund-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={parseFloat(originalOrder?.total || order.total || 0) - refunds
                        .filter(r => r.status === 'processed')
                        .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
                      }
                      value={refundAmount}
                      onChange={(e) => {
                        const amount = parseFloat(e.target.value) || 0;
                        setRefundAmount(amount);
                        const orderTotal = parseFloat(originalOrder?.total || order.total || 0);
                        const totalRefunded = refunds
                          .filter(r => r.status === 'processed')
                          .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
                        const remainingRefundable = orderTotal - totalRefunded;
                        if (amount > 0 && amount < remainingRefundable) {
                          setRefundType('partial');
                        }
                      }}
                      disabled={refundType === 'full' || processingRefund}
                    />
                    <span className="input-hint">
                      Maximum: {formatCurrency(parseFloat(originalOrder?.total || order.total || 0) - refunds
                        .filter(r => r.status === 'processed')
                        .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
                      )}
                    </span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="refund-reason">
                      Reason for Refund <span className="required">*</span>
                    </label>
                    <textarea
                      id="refund-reason"
                      rows="4"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Enter the reason for this refund..."
                      disabled={processingRefund}
                      required
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      className="cancel-btn"
                      onClick={() => {
                        setShowRefundModal(false);
                        setRefundReason('');
                        setRefundType('full');
                        setRefundAmount(0);
                      }}
                      disabled={processingRefund}
                    >
                      Cancel
                    </button>
                    <button
                      className="confirm-btn"
                      onClick={handleProcessRefund}
                      disabled={processingRefund || !refundReason.trim() || refundAmount <= 0}
                    >
                      {processingRefund ? 'Processing...' : 'Process Refund'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      <NotificationToast notification={notification} onClear={clearNotification} />
    </div>
  );
};

export default AdminOrderEdit;
