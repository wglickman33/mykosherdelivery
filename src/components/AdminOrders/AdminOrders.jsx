import './AdminOrders.scss';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAllOrders, updateOrderStatus, fetchAllRestaurants, deleteOrder } from '../../services/adminServices';
import apiClient from '../../lib/api';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import NotificationToast from '../NotificationToast/NotificationToast';
import { useNotification } from '../../hooks/useNotification';

const getOrderDateValue = (order) => {
  const v = order.createdAt || order.created_at || order.created_at_utc || order.created || order.updatedAt || order.updated_at;
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};

const getActiveOrdersCount = (orders) => orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;

const formatItemDetails = (item) => {
  let details = item.name || 'Unknown Item';
  
  const variant = item.selectedVariant || item.variant || item.type;
  if (variant) {
    const variantName = variant.name || (typeof variant === 'string' ? variant : null);
    if (variantName) {
      details += ` - ${variantName}`;
    }
  }
  
  const configs = item.selectedConfigurations || item.configurations || item.config || item.selections;
  if (configs) {
    let configStrings = [];
    if (Array.isArray(configs) && configs.length > 0) {
      configStrings = configs.map(config => {
        if (typeof config === 'object' && config.category && config.option) {
          return `${config.category}: ${config.option}`;
        } else if (typeof config === 'string') {
          return config;
        } else if (config && config.name) {
          return config.name;
        }
        return String(config);
      }).filter(Boolean);
    } else if (typeof configs === 'object' && Object.keys(configs).length > 0) {
      configStrings = Object.entries(configs).map(([key, value]) => {
        if (typeof value === 'object' && value.category && value.option) {
          return `${value.category}: ${value.option}`;
        } else if (typeof value === 'string') {
          return `${key}: ${value}`;
        }
        return `${key}: ${String(value)}`;
      }).filter(Boolean);
    }
    
    if (configStrings.length > 0) {
      details += ` (${configStrings.join(', ')})`;
    }
  }
  
  return details;
};

const formatAddress = (deliveryAddress) => {
  if (!deliveryAddress) return '—';
  
  const parts = [];
  
  const street = deliveryAddress.street || deliveryAddress.address || deliveryAddress.line1 || '';
  const apartment = deliveryAddress.apartment || deliveryAddress.unit || '';
  const limitedApartment = apartment ? String(apartment).substring(0, 20) : '';
  const city = deliveryAddress.city || '';
  const state = deliveryAddress.state || '';
  const zip = deliveryAddress.zip_code || deliveryAddress.zipCode || deliveryAddress.postal_code || '';
  
  if (street) {
    parts.push(street);
    if (limitedApartment) {
      parts[parts.length - 1] += `, ${limitedApartment}`;
    }
  }
  
  const cityStateZip = [city, state, zip].filter(Boolean).join(', ');
  if (cityStateZip) {
    parts.push(cityStateZip);
  }
  
  if (parts.length === 0) {
    if (deliveryAddress.formattedAddress) {
      return deliveryAddress.formattedAddress;
    }
    if (typeof deliveryAddress === 'string') {
      return deliveryAddress;
    }
    return '—';
  }
  
  return parts.join('\n');
};

const getMKDWeekWindow = (offsetWeeks = 0) => {
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = todayMid.getDay();

  const daysSinceFri = (day + 2) % 7;

  const start = new Date(todayMid);
  start.setDate(todayMid.getDate() - daysSinceFri);
  start.setHours(18, 0, 0, 0);

  if (now < start) {
    start.setDate(start.getDate() - 7);
  }

  if (offsetWeeks && Number.isFinite(offsetWeeks)) {
    start.setDate(start.getDate() - (7 * offsetWeeks));
  }

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(18, 0, 0, 0);

  return { start, end };
};

const monthKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const buildMonthOptions = (count = 12) => {
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const opts = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({ value: monthKey(d), label: `${names[d.getMonth()]} ${d.getFullYear()}` });
  }
  return opts;
};

const AdminOrders = () => {
  const navigate = useNavigate();
  const [allOrders, setAllOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { notification, showNotification, hideNotification } = useNotification();
  const [filters, setFilters] = useState({
    status: 'all',
    timeMode: 'all',
    weekOffset: 0,
    monthKey: monthKey(new Date()),
    restaurant: '',
    orderNumber: '',
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [restaurants, setRestaurants] = useState([]);

  useEffect(() => {
    const count = getActiveOrdersCount(allOrders);
    window.dispatchEvent(new CustomEvent('mkd-admin-active-orders', { detail: { count } }));
  }, [allOrders]);

  const fetchOrders = async () => {
    setLoading(true);
    const result = await fetchAllOrders({});
    if (result.success) {
      setAllOrders(Array.isArray(result.data) ? result.data : []);
    }
    setLoading(false);
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

  useEffect(() => {
    fetchOrders();
    fetchRestaurants();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdown = document.querySelector('.export-dropdown');
      if (dropdown && !dropdown.contains(event.target)) {
        dropdown.classList.remove('active');
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const normalizeStatusForUI = (status) => (status === 'ready' ? 'preparing' : status);

  const getWeekOrders = useCallback(() => {
    let list = [...allOrders];
    
    if (filters.timeMode === 'week') {
      const { start, end } = getMKDWeekWindow(filters.weekOffset || 0);
      list = list.filter(o => {
        const d = getOrderDateValue(o);
        return d && d >= start && d <= end;
      });
    } else {
      const { start, end } = getMKDWeekWindow(0);
      list = list.filter(o => {
        const d = getOrderDateValue(o);
        return d && d >= start && d <= end;
      });
    }
    
    return list;
  }, [allOrders, filters.timeMode, filters.weekOffset]);

  const getRestaurantNameForItem = (order, item) => {
    if (item.restaurantId) {
      const restaurant = restaurants.find(r => r.id === item.restaurantId);
      if (restaurant) return restaurant.name;
    }
    
    if (order.restaurantGroups) {
      for (const [restaurantId, group] of Object.entries(order.restaurantGroups)) {
        const groupItems = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
        if (groupItems.some(gi => gi.name === item.name && gi.quantity === item.quantity)) {
          const restaurant = order.restaurants?.find(r => r.id === restaurantId) || 
                           restaurants.find(r => r.id === restaurantId);
          if (restaurant) return restaurant.name;
        }
      }
    }
    
    if (order.restaurant?.name) return order.restaurant.name;
    if (order.restaurants && Array.isArray(order.restaurants) && order.restaurants.length > 0) {
      return order.restaurants[0].name;
    }
    
    return 'Unknown Restaurant';
  };

  const exportIndividualOrders = async () => {
    const { start, end } = getMKDWeekWindow(filters.timeMode === 'week' ? filters.weekOffset : 0);
    const filename = `orders_individual_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.xlsx`;
    try {
      const blob = await apiClient.getBlob('/admin/orders/export/individual', {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showNotification(err.message || 'Export failed', 'error');
    }
  };

  const exportTotalledItems = async () => {
    const { start, end } = getMKDWeekWindow(filters.timeMode === 'week' ? filters.weekOffset : 0);
    const filename = `orders_totalled_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.xlsx`;
    try {
      const blob = await apiClient.getBlob('/admin/orders/export/totalled', {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showNotification(err.message || 'Export failed', 'error');
    }
  };

  const applyFiltersAndPaginate = useCallback(() => {
    let list = [...allOrders];

    if (filters.status && filters.status !== 'all') {
      list = list.filter(o => normalizeStatusForUI(o.status) === filters.status);
    }

    if (filters.restaurant) {
      const rid = String(filters.restaurant);
      list = list.filter(o => {
        if (o.restaurant?.id && String(o.restaurant.id) === rid) return true;
        if (Array.isArray(o.restaurants) && o.restaurants.some(r => String(r.id) === rid)) return true;
        if (o.restaurantGroups && typeof o.restaurantGroups === 'object' && Object.prototype.hasOwnProperty.call(o.restaurantGroups, rid)) return true;
        return false;
      });
    }

    if (filters.orderNumber && filters.orderNumber.trim() !== '') {
      const q = filters.orderNumber.trim().toLowerCase();
      list = list.filter(o => (
        (o.orderNumber && String(o.orderNumber).toLowerCase().includes(q)) ||
        (o.order_number && String(o.order_number).toLowerCase().includes(q)) ||
        (o.id && String(o.id).toLowerCase().includes(q))
      ));
    }

    if (filters.timeMode === 'week') {
      const { start, end } = getMKDWeekWindow(filters.weekOffset || 0);
      list = list.filter(o => {
        const d = getOrderDateValue(o);
        return d && d >= start && d <= end;
      });
    } else if (filters.timeMode === 'month') {
      const sel = filters.monthKey;
      list = list.filter(o => {
        const d = getOrderDateValue(o);
        return d && monthKey(d) === sel;
      });
    }

    list.sort((a, b) => {
      const da = getOrderDateValue(a)?.getTime() || 0;
      const db = getOrderDateValue(b)?.getTime() || 0;
      return db - da;
    });

    const total = list.length;
    const limit = filters.limit || 20;
    const page = Math.max(1, Math.min(filters.page || 1, Math.max(1, Math.ceil(total / limit))));
    const startIdx = (page - 1) * limit;
    const paged = list.slice(startIdx, startIdx + limit);
    setOrders(paged);
    setPagination({ total, totalPages: Math.max(1, Math.ceil(total / limit)), page, limit });
  }, [allOrders, filters]);

  useEffect(() => {
    applyFiltersAndPaginate();
  }, [applyFiltersAndPaginate]);

  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    const startStream = async () => {
      try {
        const resp = await fetch(`${base}/admin/orders/stream-token`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('mkd-auth-token')}` }
        });
        
        if (!resp.ok) {
          console.warn('Failed to get SSE token:', resp.status, resp.statusText);
          return () => {};
        }
        
        const data = await resp.json();
        if (!data || !data.token) {
          console.warn('No token in SSE token response');
          return () => {};
        }
        
        const es = new EventSource(`${base}/admin/orders/stream?token=${encodeURIComponent(data.token)}`);
        const safeParse = (payload) => { try { return JSON.parse(payload); } catch { return null; } };
        
        es.addEventListener('order.created', (e) => {
          const order = safeParse(e.data);
          if (!order) return;
          setAllOrders(prev => [order, ...prev]);
        });
        es.addEventListener('order.updated', (e) => {
          const updated = safeParse(e.data);
          if (!updated) return;
          setAllOrders(prev => prev.map(o => (o.id === updated.id ? { ...o, ...updated } : o)));
        });
        
        es.onopen = () => {
          console.log('✅ Orders SSE connected successfully');
        };
        
        es.onerror = (error) => {
          console.warn('❌ SSE connection error', error);
          try {
            es.close();
          } catch (closeErr) {
            console.warn('SSE close error', closeErr);
          }
        };
        
        return () => {
          try {
            es.close();
          } catch (closeErr) {
            console.warn('SSE cleanup close error', closeErr);
          }
        };
      } catch (streamErr) {
        console.warn('SSE stream unavailable, continuing without live updates', streamErr);
        return () => {};
      }
    };
    let cleanup;
    startStream().then(fn => { cleanup = fn; });
    return () => {
      if (cleanup) {
        try {
          cleanup();
        } catch (err) {
          console.warn('SSE cleanup error', err);
        }
      }
    };
  }, []);

  const handleStatusUpdate = async (orderId, newStatus) => {
    const result = await updateOrderStatus(orderId, newStatus);
    if (result.success) {
      setAllOrders(prev => prev.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    
    try {
      setLoading(true);
      const result = await deleteOrder(selectedOrder.id);
      
      if (result.success) {
        setOrders(orders.filter(order => order.id !== selectedOrder.id));
        setAllOrders(allOrders.filter(order => order.id !== selectedOrder.id));
        
        setShowDeleteConfirm(false);
        setSelectedOrder(null);
        
        window.dispatchEvent(new CustomEvent('mkd-refresh-notifications'));
        
        showNotification('Order deleted successfully', 'success');
      } else {
        showNotification('Failed to delete order: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      showNotification('Failed to delete order: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const getStatusColor = (status) => {
    const normalized = normalizeStatusForUI(status);
    const statusColors = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      preparing: '#8b5cf6',
      out_for_delivery: '#10b981',
      delivered: '#059669',
      cancelled: '#ef4444'
    };
    return statusColors[normalized] || '#6b7280';
  };

  const weekOptions = [
    { value: 0, label: 'This Delivery Week' },
    { value: 1, label: 'Last Delivery Week' },
    { value: 2, label: '2 Weeks Ago' },
    { value: 3, label: '3 Weeks Ago' },
    { value: 4, label: '4 Weeks Ago' },
  ];
  const monthOptions = buildMonthOptions(12);

  const getOrderProgress = (status) => {
    const steps = [
      { key: 'pending', label: 'Order Placed' },
      { key: 'confirmed', label: 'Confirmed' },
      { key: 'preparing', label: 'Preparing' },
      { key: 'out_for_delivery', label: 'Out for Delivery' },
      { key: 'delivered', label: 'Delivered' }
    ];

    const normalized = normalizeStatusForUI(status);
    const currentIndex = steps.findIndex(step => step.key === normalized);
    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
      active: index === currentIndex
    }));
  };

  return (
    <div className="admin-orders">
      <div className="orders-header">
        <div className="header-content">
          <h1>Order Management</h1>
          <p>Monitor and manage all customer orders in real-time</p>
        </div>
        <div className="header-actions">
          <div className="export-dropdown">
            <button className="export-btn" onClick={(e) => {
              e.stopPropagation();
              const dropdown = e.currentTarget.closest('.export-dropdown');
              dropdown.classList.toggle('active');
            }}>
              Export
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>
            <div className="export-dropdown-menu">
              <button 
                className="export-option"
                onClick={() => {
                  exportIndividualOrders();
                  document.querySelector('.export-dropdown')?.classList.remove('active');
                }}
              >
                Individual Orders Breakdown
              </button>
              <button 
                className="export-option"
                onClick={() => {
                  exportTotalledItems();
                  document.querySelector('.export-dropdown')?.classList.remove('active');
                }}
              >
                Totalled Items by Restaurant
              </button>
            </div>
        </div>
        <div className="header-stats">
          <div className="stat-card">
            <span className="stat-label">Total Orders</span>
            <span className="stat-value">{pagination.total || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Active Orders</span>
            <span className="stat-value">{allOrders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length}</span>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="orders-filters">
        <div className="filter-group">
          <label>Status</label>
          <select 
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
          >
            <option value="all">All Orders</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Time Range</label>
          <div className="time-range">
            <select
              value={filters.timeMode}
              onChange={(e) => setFilters({ ...filters, timeMode: e.target.value, page: 1 })}
            >
              <option value="all">All Time</option>
              <option value="week">Delivery Week</option>
              <option value="month">Month</option>
            </select>
            {filters.timeMode === 'week' && (
              <select
                value={filters.weekOffset}
                onChange={(e) => setFilters({ ...filters, weekOffset: parseInt(e.target.value), page: 1 })}
              >
                {weekOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            {filters.timeMode === 'month' && (
              <select
                value={filters.monthKey}
                onChange={(e) => setFilters({ ...filters, monthKey: e.target.value, page: 1 })}
              >
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="filter-group">
          <label>Restaurant</label>
          <select 
            value={filters.restaurant}
            onChange={(e) => setFilters({ ...filters, restaurant: e.target.value, page: 1 })}
          >
            <option value="">All Restaurants</option>
            {restaurants.map(restaurant => (
              <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Order Number</label>
          <input
            type="text"
            placeholder="Order # or ID"
            value={filters.orderNumber}
            onChange={(e) => setFilters({ ...filters, orderNumber: e.target.value, page: 1 })}
          />
        </div>

        <div className="filter-group">
          <label>Per Page</label>
          <select 
            value={filters.limit}
            onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), page: 1 })}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {}
      <div className="orders-table-container">
        {loading ? (
          <div className="orders-loading">
            <LoadingSpinner size="large" />
            <p>Loading orders...</p>
          </div>
        ) : (
          <>
            <div className="orders-table-scroll">
              <table className="orders-table">
                <colgroup>
                  <col className="col-order" />
                  <col className="col-customer" />
                  <col className="col-restaurant" />
                  <col className="col-items" />
                  <col className="col-total" />
                  <col className="col-status" />
                  <col className="col-address" />
                  <col className="col-date" />
                  <col className="col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Restaurant</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Address</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="order-number" title={order.orderNumber || order.order_number || order.id}>
                        {order.orderNumber || order.order_number || (order.id && order.id.slice ? order.id.slice(0, 8) : '')}
                      </td>
                      <td className="customer-info" title={(() => {
                        const name = order.user ? `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || 'User' : (order.guestInfo ? `${order.guestInfo.firstName || ''} ${order.guestInfo.lastName || ''}`.trim() || 'Guest' : 'Guest');
                        const email = order.user?.email || order.guestInfo?.email || '—';
                        return `${name} • ${email}`;
                      })()}>
                        <div className="customer-name">
                          {order.user ? 
                            `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || 'User' :
                            order.guestInfo ? 
                              `${order.guestInfo.firstName || ''} ${order.guestInfo.lastName || ''}`.trim() || 'Guest' :
                              'Guest'
                          }
                        </div>
                        <div className="customer-email">{order.user?.email || order.guestInfo?.email || '—'}</div>
                      </td>
                      <td className="restaurant-name" title={order.restaurant?.name || (order.restaurants && Array.isArray(order.restaurants) ? order.restaurants.map(r => r.name).join(', ') : (order.restaurants?.name || '—'))}>
                        {order.restaurant?.name || (order.restaurants && Array.isArray(order.restaurants) ? order.restaurants.map(r => r.name).join(', ') : (order.restaurants?.name || '—'))}
                      </td>
                      <td className="order-items">
                        {(() => {
                          let itemCount = 0;
                          if (order.restaurantGroups) {
                            Object.entries(order.restaurantGroups).forEach(([, group]) => {
                              const groupItems = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
                              itemCount += groupItems.length;
                            });
                          } else if (Array.isArray(order.items)) {
                            itemCount = order.items.length;
                          } else if (order.items && typeof order.items === 'object') {
                            itemCount = Object.keys(order.items).length;
                          }
                          return `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
                        })()}
                      </td>
                      <td className="order-total" title={String(formatCurrency(parseFloat(order.total || order.orderTotal || 0)))}>
                        {formatCurrency(parseFloat(order.total || order.orderTotal || 0))}
                      </td>
                      <td className="order-status">
                        <select
                          value={normalizeStatusForUI(order.status)}
                          onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                          style={{ color: getStatusColor(order.status) }}
                          className="status-select"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="preparing">Preparing</option>
                          <option value="out_for_delivery">Out for Delivery</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="order-address" title={formatAddress(order.deliveryAddress || order.delivery_address)}>
                        <div className="address-display">
                          {formatAddress(order.deliveryAddress || order.delivery_address)}
                        </div>
                      </td>
                      <td className="order-date">
                        {(() => {
                          const d = getOrderDateValue(order);
                          return d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                        })()}
                      </td>
                      <td className="order-actions">
                        <div className="order-actions-container">
                          <button
                            className="view-btn"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowOrderModal(true);
                            }}
                          >
                            View
                          </button>
                          <button
                            className="edit-btn"
                            onClick={() => {
                              navigate(`/admin/orders/${order.id}`);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowDeleteConfirm(true);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {}
            <div className="pagination">
              <div className="pagination-info">
                Showing {pagination.total > 0 ? ((pagination.page - 1) * pagination.limit) + 1 : 0} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total || 0} orders
              </div>
              <div className="pagination-controls">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {pagination.page || 1} of {pagination.totalPages || 1}
                </span>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {}
      {showOrderModal && selectedOrder && (
        <div className="account-modal-overlay" onClick={() => setShowOrderModal(false)}>
          <div className="account-modal account-modal--order-details" onClick={(e) => e.stopPropagation()}>
            <div className="account-modal__header">
              <h2 className="account-modal__title">Order Details</h2>
              <button 
                className="account-modal__close-btn"
                onClick={() => setShowOrderModal(false)}
              >
                ×
              </button>
            </div>
            <div className="account-modal__content">
              <div className="order-info">
                <div className="order-header">
                  <h3>
                    Order #{selectedOrder.orderNumber || selectedOrder.order_number || selectedOrder.id}
                  </h3>
                  <div className={`order-status ${normalizeStatusForUI(selectedOrder.status).replace(/_/g, '-')}`}>
                    {normalizeStatusForUI(selectedOrder.status).replace(/_/g, ' ').toUpperCase()}
                  </div>
                </div>
                <div className="order-meta">
                  {(() => {
                    try {
                      const isMultiRestaurant = selectedOrder.restaurantGroups && Object.keys(selectedOrder.restaurantGroups).length > 1;
                      if (isMultiRestaurant) {
                        const restaurantNames = [];
                        Object.keys(selectedOrder.restaurantGroups).forEach(restaurantId => {
                          const restaurant = selectedOrder.restaurants?.find(r => r.id == restaurantId);
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
                      } else if (selectedOrder.restaurants && selectedOrder.restaurants.length === 1) {
                        return <p><strong>Restaurant:</strong> {selectedOrder.restaurants[0].name}</p>;
                      } else if (selectedOrder.restaurant?.name) {
                        return <p><strong>Restaurant:</strong> {selectedOrder.restaurant.name}</p>;
                      } else if (selectedOrder.restaurantGroups && Object.keys(selectedOrder.restaurantGroups).length === 1) {
                        const restaurantId = Object.keys(selectedOrder.restaurantGroups)[0];
                        const restaurant = selectedOrder.restaurants?.find(r => r.id == restaurantId);
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
                  <p><strong>Customer:</strong> {
                    selectedOrder.user ? 
                      `${selectedOrder.user.firstName || ''} ${selectedOrder.user.lastName || ''}`.trim() || 'User' :
                      selectedOrder.guestInfo ? 
                        `${selectedOrder.guestInfo.firstName || ''} ${selectedOrder.guestInfo.lastName || ''}`.trim() || 'Guest' :
                        'Guest'
                  }</p>
                  <p><strong>Email:</strong> {selectedOrder.user?.email || selectedOrder.guestInfo?.email || '—'}</p>
                  <p><strong>Order Date:</strong> {(() => {
                    const d = getOrderDateValue(selectedOrder);
                    return d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                  })()}</p>
                  <p><strong>Order Number:</strong> {selectedOrder.order_number || selectedOrder.id}</p>
                </div>
              </div>

              <div className="order-progress">
                <h4>Order Progress</h4>
                <div className="progress-steps">
                  {getOrderProgress(selectedOrder.status).map((step, index) => (
                    <div key={step.key} className={`progress-step ${step.completed ? 'completed' : ''} ${step.active ? 'active' : ''}`}>
                      <div className="step-icon">{step.completed ? '✓' : index + 1}</div>
                      <div className="step-label">{step.label}</div>
                      {index < getOrderProgress(selectedOrder.status).length - 1 && <div className="step-line"></div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="order-items">
                <h4>Items Ordered</h4>
                {selectedOrder.restaurantGroups ? (
                  Object.entries(selectedOrder.restaurantGroups).map(([restaurantId, group]) => {
                    const restaurant = selectedOrder.restaurants?.find(r => r.id == restaurantId);
                    const restaurantName = restaurant?.name || restaurantId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const groupItems = Array.isArray(group.items) ? group.items : Object.values(group.items || {});
                    return (
                      <div key={restaurantId} className="restaurant-order-group">
                        <h5 className="restaurant-name">{restaurantName}</h5>
                        {groupItems.length > 0 ? groupItems.map((item, index) => (
                          <div key={`${restaurantId}-${index}`} className="order-item">
                            <div className="item-details">
                            <div className="item-name">
                              {item.name}
                              {(() => {
                                if (import.meta.env.DEV) {
                                  console.log('Item data:', {
                                    name: item.name,
                                    itemType: item.itemType,
                                    selectedVariant: item.selectedVariant,
                                    variant: item.variant,
                                    type: item.type,
                                    selectedConfigurations: item.selectedConfigurations,
                                    configurations: item.configurations,
                                    config: item.config,
                                    selections: item.selections,
                                    options: item.options,
                                    fullItem: item
                                  });
                                }
                                
                                const variant = item.selectedVariant || item.variant || item.type || 
                                               (item.options && item.options.selectedVariant) ||
                                               (item.options && item.options.variant);
                                if (variant) {
                                  const variantName = (typeof variant === 'object' && variant.name) 
                                    ? variant.name 
                                    : (typeof variant === 'string' ? variant : null);
                                  if (variantName) {
                                    return <span className="item-variant-inline"> - {variantName}</span>;
                                  }
                                }
                                
                                const configs = item.selectedConfigurations || item.configurations || item.config || item.selections ||
                                               (item.options && item.options.selectedConfigurations) ||
                                               (item.options && item.options.configurations);
                                if (configs) {
                                  let configStrings = [];
                                  if (Array.isArray(configs) && configs.length > 0) {
                                    configStrings = configs.map((config) => {
                                      if (typeof config === 'object' && config.category && config.option) {
                                        return `${config.category}: ${config.option}`;
                                      } else if (typeof config === 'object' && config.name) {
                                        return config.name;
                                      } else if (typeof config === 'string') {
                                        return config;
                                      }
                                      return String(config);
                                    }).filter(Boolean);
                                  } else if (typeof configs === 'object' && !Array.isArray(configs)) {
                                    configStrings = Object.entries(configs).map(([key, value]) => {
                                      if (typeof value === 'object' && value.category && value.option) {
                                        return `${value.category}: ${value.option}`;
                                      } else if (typeof value === 'object' && value.name) {
                                        return `${key}: ${value.name}`;
                                      } else if (typeof value === 'string') {
                                        return `${key}: ${value}`;
                                      } else if (Array.isArray(value)) {
                                        return `${key}: ${value.join(', ')}`;
                                      }
                                      return `${key}: ${String(value)}`;
                                    }).filter(Boolean);
                                  }
                                  
                                  if (configStrings.length > 0) {
                                    return <span className="item-config-inline"> ({configStrings.join(', ')})</span>;
                                  }
                                }
                                
                                return null;
                              })()}
                            </div>
                              
                              {}
                              {item.itemType === 'variety' && item.selectedVariant && item.selectedVariant.priceModifier !== 0 && (
                                <div className="item-variant">
                                  <span className="variant-label">Variant:</span>
                                  <span className="variant-name">{item.selectedVariant.name}</span>
                                  <span className="variant-price-modifier">
                                    ({item.selectedVariant.priceModifier > 0 ? '+' : ''}${item.selectedVariant.priceModifier.toFixed(2)})
                                  </span>
                                </div>
                              )}
                              
                              {}
                              {item.itemType === 'builder' && item.selectedConfigurations && item.selectedConfigurations.length > 0 && (
                                <div className="item-customizations">
                                  <div className="customizations-label">Size & Options:</div>
                                  <div className="customization-list">
                                    {Array.isArray(item.selectedConfigurations) ? (
                                      item.selectedConfigurations.map((config, idx) => (
                                        <div key={idx} className="customization-item">
                                          <span className="customization-category">{config.category}:</span>
                                          <span className="customization-option">{config.option}</span>
                                          {config.priceModifier !== 0 && (
                                            <span className="customization-price-modifier">
                                              ({config.priceModifier > 0 ? '+' : ''}${config.priceModifier.toFixed(2)})
                                            </span>
                                          )}
                                        </div>
                                      ))
                                    ) : (
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
                            </div>
                            <div className="item-quantity">x{item.quantity}</div>
                            <div className="item-price">{formatCurrency((item.price || 0) * (item.quantity || 0))}</div>
                          </div>
                        )) : <p>No items found for this restaurant</p>}
                        <div className="restaurant-subtotal">
                          <strong>Restaurant Subtotal: {formatCurrency(parseFloat(group.subtotal || 0))}</strong>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  (() => {
                    let itemsToDisplay = [];
                    if (Array.isArray(selectedOrder.items)) {
                      itemsToDisplay = selectedOrder.items;
                    } else if (selectedOrder.items && typeof selectedOrder.items === 'object') {
                      itemsToDisplay = Object.values(selectedOrder.items);
                    }
                    return itemsToDisplay.length > 0 ? itemsToDisplay.map((item, index) => (
                      <div key={index} className="order-item">
                        <div className="item-details">
                        <div className="item-name">
                          {item.name}
                          {(() => {
                            const variant = item.selectedVariant || item.variant || item.type || 
                                           (item.options && item.options.selectedVariant) ||
                                           (item.options && item.options.variant);
                            if (variant) {
                              const variantName = (typeof variant === 'object' && variant.name) 
                                ? variant.name 
                                : (typeof variant === 'string' ? variant : null);
                              if (variantName) {
                                return <span className="item-variant-inline"> - {variantName}</span>;
                              }
                            }
                            
                            const configs = item.selectedConfigurations || item.configurations || item.config || item.selections ||
                                           (item.options && item.options.selectedConfigurations) ||
                                           (item.options && item.options.configurations);
                            if (configs) {
                              let configStrings = [];
                              if (Array.isArray(configs) && configs.length > 0) {
                                configStrings = configs.map((config) => {
                                  if (typeof config === 'object' && config.category && config.option) {
                                    return `${config.category}: ${config.option}`;
                                  } else if (typeof config === 'object' && config.name) {
                                    return config.name;
                                  } else if (typeof config === 'string') {
                                    return config;
                                  }
                                  return String(config);
                                }).filter(Boolean);
                              } else if (typeof configs === 'object' && !Array.isArray(configs)) {
                                configStrings = Object.entries(configs).map(([key, value]) => {
                                  if (typeof value === 'object' && value.category && value.option) {
                                    return `${value.category}: ${value.option}`;
                                  } else if (typeof value === 'object' && value.name) {
                                    return `${key}: ${value.name}`;
                                  } else if (typeof value === 'string') {
                                    return `${key}: ${value}`;
                                  } else if (Array.isArray(value)) {
                                    return `${key}: ${value.join(', ')}`;
                                  }
                                  return `${key}: ${String(value)}`;
                                }).filter(Boolean);
                              }
                              
                              if (configStrings.length > 0) {
                                return <span className="item-config-inline"> ({configStrings.join(', ')})</span>;
                              }
                            }
                            
                            return null;
                          })()}
                        </div>
                          
                          {}
                          {item.itemType === 'variety' && item.selectedVariant && item.selectedVariant.priceModifier !== 0 && (
                            <div className="item-variant">
                              <span className="variant-label">Variant:</span>
                              <span className="variant-name">{item.selectedVariant.name}</span>
                              <span className="variant-price-modifier">
                                ({item.selectedVariant.priceModifier > 0 ? '+' : ''}${item.selectedVariant.priceModifier.toFixed(2)})
                              </span>
                            </div>
                          )}
                          
                          {}
                          {item.itemType === 'builder' && item.selectedConfigurations && item.selectedConfigurations.length > 0 && (
                            <div className="item-customizations">
                              <div className="customizations-label">Size & Options:</div>
                              <div className="customization-list">
                                {Array.isArray(item.selectedConfigurations) ? (
                                  item.selectedConfigurations.map((config, idx) => (
                                    <div key={idx} className="customization-item">
                                      <span className="customization-category">{config.category}:</span>
                                      <span className="customization-option">{config.option}</span>
                                      {config.priceModifier !== 0 && (
                                        <span className="customization-price-modifier">
                                          ({config.priceModifier > 0 ? '+' : ''}${config.priceModifier.toFixed(2)})
                                        </span>
                                      )}
                                    </div>
                                  ))
                                ) : (
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
                        </div>
                        <div className="item-quantity">x{item.quantity}</div>
                        <div className="item-price">{formatCurrency((item.price || 0) * (item.quantity || 0))}</div>
                      </div>
                    )) : <p>No items found</p>;
                  })()
                )}
              </div>

              {}
              {selectedOrder.deliveryInstructions && (
                <div className="delivery-instructions-section">
                  <h4>Delivery Instructions</h4>
                  <p className="delivery-instructions-text">{selectedOrder.deliveryInstructions}</p>
                </div>
              )}

              {}
              <div className="price-breakdown">
                <h4>Order Summary</h4>
                <div className="breakdown-line">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(parseFloat(selectedOrder.subtotal || 0))}</span>
                </div>
                
                {selectedOrder.discountAmount && parseFloat(selectedOrder.discountAmount) > 0 && (
                  <div className="breakdown-line discount-line">
                    <span>Promo Discount{selectedOrder.appliedPromo?.code ? ` (${selectedOrder.appliedPromo.code})` : ''}:</span>
                    <span className="discount-value">-{formatCurrency(parseFloat(selectedOrder.discountAmount))}</span>
                  </div>
                )}
                
                <div className="breakdown-line">
                  <span>Delivery Fee:</span>
                  <span>{formatCurrency(parseFloat(selectedOrder.deliveryFee || selectedOrder.delivery_fee || 5.99))}</span>
                </div>
                <div className="breakdown-line">
                  <span>Tip:</span>
                  <span>{formatCurrency(parseFloat(selectedOrder.tip || 0))}</span>
                </div>
                <div className="breakdown-line">
                  <span>Tax:</span>
                  <span>{formatCurrency(parseFloat(selectedOrder.tax || 0))}</span>
                </div>
                <div className="breakdown-line total-line">
                  <span><strong>Total:</strong></span>
                  <span><strong>{formatCurrency(parseFloat(selectedOrder.total || 0))}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {showDeleteConfirm && selectedOrder && (
        <div className="account-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="account-modal" onClick={(e) => e.stopPropagation()}>
            <div className="account-modal__header">
              <h2 className="account-modal__title">Delete Order</h2>
              <button 
                className="account-modal__close-btn"
                onClick={() => setShowDeleteConfirm(false)}
              >
                ×
              </button>
            </div>
            <div className="account-modal__content">
              <div className="delete-warning">
                <h3>Are you sure you want to delete this order?</h3>
                <p>
                  <strong>Order #{selectedOrder.orderNumber || selectedOrder.order_number || selectedOrder.id}</strong>
                </p>
                <p>
                  This action will permanently delete the order from the system. 
                  <strong>This will NOT automatically process a refund</strong> - you must handle any refunds separately.
                </p>
                <div className="warning-details">
                  <p><strong>Customer:</strong> {selectedOrder.user?.firstName} {selectedOrder.user?.lastName}</p>
                  <p><strong>Total:</strong> {formatCurrency(parseFloat(selectedOrder.total || 0))}</p>
                  <p><strong>Status:</strong> {normalizeStatusForUI(selectedOrder.status).replace(/_/g, ' ').toUpperCase()}</p>
                </div>
              </div>
              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button 
                  className="delete-btn"
                  onClick={handleDeleteOrder}
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      <NotificationToast 
        notification={notification} 
        onClose={hideNotification} 
      />
    </div>
  );
};

export default AdminOrders; 