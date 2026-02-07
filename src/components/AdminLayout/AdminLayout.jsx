import './AdminLayout.scss';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import { fetchNotificationCounts, fetchAdminNotifications, markNotificationRead, markAllNotificationsRead, fetchOrdersStreamToken, deleteNotification } from '../../services/adminServices';
import { fetchFacilitiesList } from '../../services/nursingHomeService';
import whiteMKDIcon from '../../assets/whiteMKDIcon.png';

const AdminLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [notifications, setNotifications] = useState({
    orders: 0,
    tickets: 0,
    users: 0
  });
  const [notifList, setNotifList] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [communities, setCommunities] = useState([]);
  const { user, loading: authContextLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const sseConnectionRef = useRef(null);
  const sseSetupRef = useRef(false);

  useEffect(() => {
    if (authContextLoading) return;
    const isAdmin = user && (user.role === 'admin' || user.role === 'nursing_home_admin');
    if (!isAdmin) {
      navigate('/admin/login', { replace: true });
      return;
    }
    setAuthLoading(false);
  }, [user, authContextLoading, navigate]);

  useEffect(() => {
    const applyResponsive = () => {
      const w = window.innerWidth;
      if (w <= 768) {
        setSidebarCollapsed(true);
      } else if (w <= 1280) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };
    applyResponsive();
    window.addEventListener('resize', applyResponsive);
    return () => window.removeEventListener('resize', applyResponsive);
  }, []);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (authLoading || !user) return;
    
    const loadInitialCounts = async () => {
      const result = await fetchNotificationCounts();
      if (result?.success) {
        setNotifications(result.data);
      }
    };

    loadInitialCounts();
  }, [authLoading, user]);

  useEffect(() => {
    const onActiveOrders = (e) => {
      const count = typeof e?.detail?.count === 'number' ? e.detail.count : undefined;
      if (typeof count === 'number') {
        setNotifications(prev => ({ ...prev, orders: count }));
      }
    };
    window.addEventListener('mkd-admin-active-orders', onActiveOrders);
    return () => window.removeEventListener('mkd-admin-active-orders', onActiveOrders);
  }, []);

  useEffect(() => {
    const onActiveRequests = (e) => {
      const count = typeof e?.detail?.count === 'number' ? e.detail.count : undefined;
      if (typeof count === 'number') {
        setNotifications(prev => ({ ...prev, tickets: count }));
      }
    };
    window.addEventListener('mkd-admin-active-requests', onActiveRequests);
    return () => window.removeEventListener('mkd-admin-active-requests', onActiveRequests);
  }, []);

  useEffect(() => {
      if (authLoading || !user) return;
    
    const loadInitialNotifications = async () => {
      const res = await fetchAdminNotifications(250);
      if (res?.success) {
        setNotifList(Array.isArray(res.data) ? res.data : []);
        setNotifUnread(typeof res.unreadCount === 'number' ? res.unreadCount : 0);
      }
    };

    loadInitialNotifications();
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user || user?.role !== 'admin' || sseSetupRef.current) {
      return;
    }

    sseSetupRef.current = true;

    const setupSSE = async () => {
      try {
        console.log('Setting up SSE connection (one time)...');
        const tokenRes = await fetchOrdersStreamToken();
        if (!tokenRes?.success || !tokenRes.token) {
          console.warn('Failed to get SSE token');
          return;
        }

        const streamUrl = `${import.meta.env.VITE_API_BASE_URL}/admin/orders/stream?token=${encodeURIComponent(tokenRes.token)}`;
        const es = new EventSource(streamUrl);
        sseConnectionRef.current = es;
        
        es.addEventListener('admin.notification.created', (e) => {
          try {
            const data = JSON.parse(e.data);
            console.log('New admin notification:', data);
            setNotifList(prev => [data, ...prev].slice(0, 250));
            setNotifUnread(prev => prev + 1);
          } catch (err) { 
            console.warn('notification parse error', err); 
          }
        });

        es.addEventListener('order.created', () => {
          console.log('Order created event received');
          window.dispatchEvent(new CustomEvent('mkd-refresh-counts'));
        });

        es.addEventListener('order.updated', () => {
          console.log('Order updated event received');
          window.dispatchEvent(new CustomEvent('mkd-refresh-counts'));
        });
        
        es.onopen = () => {
          console.log('✅ Admin SSE connected successfully');
        };
        
        es.onerror = () => {
          console.warn('❌ SSE connection error');
          fetch(streamUrl)
            .then(async (r) => {
              if (r.status === 401) {
                let detail = '';
                try {
                  const body = await r.json();
                  const parts = [body?.error, body?.message].filter(Boolean);
                  detail = parts.length ? parts.join(': ') : JSON.stringify(body);
                } catch {
                  detail = await r.text().catch(() => '');
                }
                console.warn(
                  'SSE stream 401:',
                  detail || 'Unauthorized. Ensure backend is deployed with app-level GET /api/admin/orders/stream and token is valid.'
                );
              } else if (!r.ok) {
                console.warn(`SSE stream returned ${r.status} ${r.statusText}`);
              }
            })
            .catch(() => {});
        };

        es.onclose = () => {
          console.log('SSE connection closed');
        };

      } catch (err) {
        console.warn('SSE setup error:', err);
      }
    };
    
    setupSSE();

    return () => {
      if (sseConnectionRef.current) {
        console.log('Cleaning up SSE connection');
        try {
          sseConnectionRef.current.close();
          sseConnectionRef.current = null;
        } catch {
          void 0;
        }
      }
      sseSetupRef.current = false;
    };
  }, [authLoading, user]);

  const loadCommunities = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const res = await fetchFacilitiesList({ limit: 50, isActive: 'true' });
      const list = res?.data;
      if (Array.isArray(list)) setCommunities(list);
    } catch {
      setCommunities([]);
    }
  }, [user?.role]);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    const onRefresh = () => loadCommunities();
    window.addEventListener('mkd-communities-refresh', onRefresh);
    return () => window.removeEventListener('mkd-communities-refresh', onRefresh);
  }, [loadCommunities]);

  useEffect(() => {
    const handleRefreshCounts = async () => {
      const result = await fetchNotificationCounts();
                if (result?.success) {
                  setNotifications(result.data);
                }
    };

    window.addEventListener('mkd-refresh-counts', handleRefreshCounts);
    return () => window.removeEventListener('mkd-refresh-counts', handleRefreshCounts);
  }, []);

  useEffect(() => {
    const handleRefreshNotifications = async () => {
      const [notifRes, countsRes] = await Promise.all([
        fetchAdminNotifications(250),
        fetchNotificationCounts()
      ]);
      
      if (notifRes?.success) {
        setNotifList(Array.isArray(notifRes.data) ? notifRes.data : []);
        setNotifUnread(typeof notifRes.unreadCount === 'number' ? notifRes.unreadCount : 0);
      }
      
      if (countsRes?.success) {
        setNotifications(countsRes.data);
      }
    };

    window.addEventListener('mkd-refresh-notifications', handleRefreshNotifications);
    return () => window.removeEventListener('mkd-refresh-notifications', handleRefreshNotifications);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  const handleNotifClick = async (n) => {
    if (!n.read) {
      const res = await markNotificationRead(n.id, true);
      if (res?.success) setNotifUnread(res.unreadCount ?? Math.max(0, notifUnread - 1));
      setNotifList(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    }
    
    setNotifOpen(false);
    
    if (n.data?.kind === 'order' && n.data?.id) {
      navigate(`/admin/orders`);
    } else if (n.data?.kind === 'ticket' && n.data?.id) {
      navigate(`/admin/requests`);
    } else if (n.data?.kind === 'tickets' && n.data?.status === 'closed') {
      navigate(`/admin/requests`);
    } else if (n.data?.kind === 'restaurant' && n.data?.id) {
      navigate(`/admin/restaurants`);
    } else if (n.data?.kind === 'user' && n.data?.id) {
      navigate(`/admin/users`);
    }
  };

  const toggleRead = async (n) => {
    const next = !n.read;
    const res = await markNotificationRead(n.id, next);
    if (res?.success) setNotifUnread(res.unreadCount ?? notifUnread);
    setNotifList(prev => prev.map(x => x.id === n.id ? { ...x, read: next } : x));
  };

  const markAllRead = async () => {
    const res = await markAllNotificationsRead();
    if (res?.success) setNotifUnread(0);
    setNotifList(prev => prev.map(x => ({ ...x, read: true })));
  };

  if (authLoading || authContextLoading) {
    return (
      <div className="admin-auth-loading">
        <LoadingSpinner size="large" />
        <p>Verifying admin access...</p>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'nursing_home_admin')) {
    return null;
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
      ), path: '/admin/dashboard', roles: ['admin', 'nursing_home_admin'] },
    { id: 'orders', label: 'Orders', icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z"/></svg>
      ), path: '/admin/orders', badge: notifications.orders, roles: ['admin'] },
    { id: 'users', label: 'Users', icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
      ), path: '/admin/users', roles: ['admin'] },
    { id: 'restaurants', label: 'Restaurants', icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 000 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41-5.51-5.51z"/></svg>
      ), path: '/admin/restaurants', roles: ['admin'] },
    { id: 'maps', label: 'Maps', icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
      ), path: '/admin/maps', roles: ['admin'] },
    { id: 'nursing-homes', label: 'Nursing Homes', icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 3L4 9v12h16V9l-8-6zm6 16h-3v-3h-2v3H10v-5H8v5H5V10l7-5 7 5v9z"/></svg>
      ), path: '/admin/nursing-homes', roles: ['admin', 'nursing_home_admin'] },
    { id: 'analytics', label: 'Analytics', icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 17h2v-7H3v7zm4 0h2V7H7v10zm4 0h2v-4h-2v4zm4 0h2V4h-2v13zm4 0h2V9h-2v8z"/></svg>
      ), path: '/admin/analytics', roles: ['admin'] },
    { id: 'requests', label: 'Requests', icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 4h18v2H3V4zm0 5h18v2H3V9zm0 5h12v2H3v-2z"/></svg>
      ), path: '/admin/requests', badge: notifications.tickets, roles: ['admin'] },
    { id: 'campaigns', label: 'Campaigns', icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
      ), path: '/admin/campaigns', roles: ['admin'] },
    { id: 'settings', label: 'Settings', icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M19.14 12.94C19.18 12.64 19.2 12.33 19.2 12C19.2 11.68 19.18 11.36 19.13 11.06L21.16 9.48C21.34 9.34 21.39 9.07 21.28 8.87L19.36 5.55C19.24 5.33 18.99 5.26 18.77 5.33L16.38 6.29C15.88 5.91 15.35 5.59 14.76 5.35L14.4 2.81C14.36 2.57 14.16 2.4 13.92 2.4H10.08C9.84 2.4 9.65 2.57 9.61 2.81L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33C5.02 5.25 4.77 5.33 4.65 5.55L2.74 8.87C2.62 9.08 2.66 9.34 2.86 9.48L4.89 11.06C4.84 11.36 4.8 11.69 4.8 12C4.8 12.31 4.82 12.64 4.87 12.94L2.84 14.52C2.66 14.66 2.61 14.93 2.72 15.13L4.64 18.45C4.76 18.67 5.01 18.74 5.23 18.67L7.62 17.71C8.12 18.09 8.65 18.41 9.24 18.65L9.6 21.19C9.65 21.43 9.84 21.6 10.08 21.6H13.92C14.16 21.6 14.36 21.43 14.39 21.19L14.75 18.65C15.34 18.41 15.88 18.09 16.37 17.71L18.76 18.67C18.98 18.75 19.23 18.67 19.35 18.45L21.27 15.13C21.39 14.91 21.34 14.66 21.15 14.52L19.14 12.94ZM12 15.6C10.02 15.6 8.4 13.98 8.4 12C8.4 10.02 10.02 8.4 12 8.4C13.98 8.4 15.6 10.02 15.6 12C15.6 13.98 13.98 15.6 12 15.6Z" fill="currentColor"/></svg>
      ), path: '/admin/settings', roles: ['admin'] }
  ].filter(item => !item.roles || item.roles.includes(user.role));

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar__header">
          <div className="admin-logo">
            <img src={whiteMKDIcon} alt="MKD" />
            {!sidebarCollapsed && <span>MKD Admin</span>}
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d={sidebarCollapsed 
                ? "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
                : "M3 18h13v-2H3v2zm0-5h10v-2H3v2zm0-7v2h13V6H3z"
              }/>
            </svg>
          </button>
        </div>

        <nav className="admin-sidebar__nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              {!sidebarCollapsed && (
                <>
                  <span className="nav-label">{item.label}</span>
                  {item.badge ? (
                    <span className="nav-badge">{item.badge}</span>
                  ) : null}
                </>
              )}
            </button>
          ))}
          {user?.role === 'admin' && communities.length > 0 && !sidebarCollapsed && (
            <div className="admin-sidebar__communities">
              <div className="admin-sidebar__communities-label">Enter community</div>
              {communities.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="nav-item nav-item--community"
                  onClick={() => navigate(`/nursing-homes/dashboard?facilityId=${f.id}`)}
                >
                  <span className="nav-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M12 3L4 9v12h16V9l-8-6zm6 16h-3v-3h-2v3H10v-5H8v5H5V10l7-5 7 5v9z" />
                    </svg>
                  </span>
                  <span className="nav-label">{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </nav>

        <div className="admin-sidebar__footer">
          <div className="admin-user">
            <div className="user-avatar">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div className="user-info">
                <span className="user-name">{user.firstName} {user.lastName}</span>
                <span className="user-role">
                  {user.role === 'admin' ? 'Super Admin' : user.role === 'nursing_home_admin' ? 'NH Admin' : user.role}
                </span>
              </div>
            )}
          </div>
          <button className="sign-out-btn" onClick={handleSignOut}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {mobileSidebarOpen && <div className="admin-overlay" onClick={() => setMobileSidebarOpen(false)} />}

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-header__title">
            <h1>MyKosherDelivery Admin Portal</h1>
            <p>Comprehensive platform management</p>
          </div>
          <div className="admin-header__actions">
            <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/>
              </svg>
            </button>
            <div className="notif-wrap">
              <button 
                className="notification-btn" 
                onClick={async () => {
                  if (!notifOpen) {
                    const res = await fetchAdminNotifications(250);
                    if (res?.success) {
                      setNotifList(Array.isArray(res.data) ? res.data : []);
                      setNotifUnread(typeof res.unreadCount === 'number' ? res.unreadCount : 0);
                    }
                  }
                  setNotifOpen(!notifOpen);
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                </svg>
                {notifUnread > 0 && <span className="notification-count">{notifUnread}</span>}
              </button>
              {notifOpen && (
                <div className="notif-dropdown" onMouseLeave={() => setNotifOpen(false)}>
                  <div className="notif-header">
                    <span>Notifications</span>
                    {notifUnread > 0 && <button className="notif-markall" onClick={markAllRead}>Mark all read</button>}
                  </div>
                  <ul className="notif-list">
                    {notifList.length === 0 && <li className="notif-empty">No notifications</li>}
                    {notifList.map((n) => (
                      <li key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                        <button className="notif-main" onClick={() => handleNotifClick(n)}>
                          <span className="notif-icon" aria-hidden="true">
                            {n.type?.startsWith('order') ? (
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6z"/></svg>
                            ) : n.type?.startsWith('ticket') ? (
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 5h18v6a2 2 0 0 1-2 2h-1v2h1a2 2 0 0 1 2 2v2H3v-2a2 2 0 0 1 2-2h1v-2H5a2 2 0 0 1-2-2V5zm6 5h6v2H9v-2z"/></svg>
                            ) : n.type === 'tickets.bulk_deleted' ? (
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 7h12v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7zm3-4h6l1 1h4v2H4V4h4l1-1z"/></svg>
                            ) : n.type?.startsWith('restaurant') ? (
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/></svg>
                            ) : n.type?.startsWith('user') ? (
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                            ) : n.type?.includes('menu') ? (
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 4h18v2H3V4zm0 5h18v2H3V9zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>
                            )}
                          </span>
                          <div className="notif-text">
                            <div className="notif-title">{n.title}</div>
                            <div className="notif-sub">{n.message}</div>
                          </div>
                          {n.createdAt && (
                            <time className="notif-time" dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                          )}
                        </button>
                        <button className="notif-toggle" title={n.read? 'Mark unread':'Mark read'} onClick={() => toggleRead(n)}>
                          {n.read ? 'Unread' : 'Read'}
                        </button>
                        <button className="notif-delete" title="Delete" onClick={async ()=>{
                          const res = await deleteNotification(n.id);
                          setNotifList(prev => prev.filter(x => x.id !== n.id));
                          if (res?.success && typeof res.unreadCount === 'number') setNotifUnread(res.unreadCount);
                        }}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 7h12v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7zm3-4h6l1 1h4v2H4V4h4l1-1z"/></svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout; 