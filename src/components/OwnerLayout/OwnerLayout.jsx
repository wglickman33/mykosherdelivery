import { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import { getOwnerRestaurants } from '../../services/ownerService';
import { fetchRestaurants } from '../../services/restaurantsService';
import { buildImageUrl } from '../../services/imageService';
import whiteMKDLogo from '../../assets/whiteMKDLogo.png';
import './OwnerLayout.scss';

function effectiveRestaurantLogoUrl(restaurant) {
  const logoUrl = restaurant?.logoUrl ?? restaurant?.logo_url ?? '';
  if (!logoUrl) {
    const fn = restaurant?.logoFileName ?? '';
    return fn ? buildImageUrl('static/restaurant-logos/' + fn) : '';
  }
  if (logoUrl.startsWith('http') || logoUrl.startsWith('https') || logoUrl.startsWith('/')) return logoUrl;
  return buildImageUrl('static/restaurant-logos/' + (restaurant?.logoFileName ?? logoUrl.split('/').pop() ?? logoUrl));
}

const OwnerIcons = {
  dashboard: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 
      0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.16 14h9.53c.75 0 1.4-.41 
      1.73-1.03L21 8H6.21L5.27 6H3v2h1l3.6 7.59-1.35 2.45C6.89 18.37 7 18.68 7 
      19h2c0-.34-.09-.66-.24-.94L9.1 17h7.45c.75 0 1.4-.41 1.73-1.03L21 10H7.16l-1-2H3v2h1l3.16 6z" />
    </svg>
  ),
};

const OwnerLayout = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { restaurantId } = useParams();

  useEffect(() => {
    if (authLoading) return;
    const allowed = user && (user.role === 'restaurant_owner' || user.role === 'admin');
    if (!allowed) {
      navigate('/home', { replace: true });
      return;
    }
    (async () => {
      try {
        const [ownerList, publicList] = await Promise.all([
          getOwnerRestaurants(),
          fetchRestaurants()
        ]);
        const publicById = new Map((Array.isArray(publicList) ? publicList : []).map((r) => [r.id, r]));
        const merged = (Array.isArray(ownerList) ? ownerList : []).map((o) => publicById.get(o.id) || o);
        setRestaurants(merged);
      } catch {
        setRestaurants([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, navigate]);

  // Match admin / nursing homes responsive sidebar behavior
  useEffect(() => {
    const applyResponsive = () => {
      const w = window.innerWidth;
      if (w <= 768 || w <= 1280) setSidebarCollapsed(true);
      else setSidebarCollapsed(false);
    };
    applyResponsive();
    window.addEventListener('resize', applyResponsive);
    return () => window.removeEventListener('resize', applyResponsive);
  }, []);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (loading || restaurants.length === 0) return;
    const pathRestaurantId = location.pathname.match(/\/owner\/restaurant\/([^/]+)/)?.[1];
    if (pathRestaurantId && !restaurants.some(r => r.id === pathRestaurantId)) {
      const first = restaurants[0]?.id;
      if (first) navigate(`/owner/restaurant/${first}${location.pathname.includes('/menu') ? '/menu' : '/orders'}`, { replace: true });
    }
  }, [loading, restaurants, location.pathname, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/home', { replace: true });
  };

  const currentRestaurant = useMemo(
    () => (restaurantId ? restaurants.find(r => r.id === restaurantId) : restaurants[0]),
    [restaurantId, restaurants]
  );
  const currentLogoUrl = currentRestaurant ? effectiveRestaurantLogoUrl(currentRestaurant) : '';
  const currentInitials = currentRestaurant?.name
    ? currentRestaurant.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('') || 'MK'
    : 'MK';
  const showRestaurantSwitcher = restaurants.length > 1;

  if (authLoading || (loading && restaurants.length === 0)) {
    return (
      <div className="owner-auth-loading">
        <LoadingSpinner size="large" />
        <p>Loading restaurant owner portal...</p>
      </div>
    );
  }

  if (!user || (user.role !== 'restaurant_owner' && user.role !== 'admin')) {
    return null;
  }

  if (!loading && restaurants.length === 0) {
    return (
      <div className="owner-auth-loading">
        <p>No restaurant assigned to your account.</p>
        <button type="button" className="owner-btn owner-btn--primary" onClick={() => navigate('/home')}>
          Back to home
        </button>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/owner/dashboard', icon: OwnerIcons.dashboard },
    { id: 'menu', label: 'Menu', path: currentRestaurant ? `/owner/restaurant/${currentRestaurant.id}/menu` : '/owner/dashboard', icon: OwnerIcons.menu },
    { id: 'orders', label: 'Orders', path: currentRestaurant ? `/owner/restaurant/${currentRestaurant.id}/orders` : '/owner/dashboard', icon: OwnerIcons.orders }
  ];

  return (
    <div className="owner-layout">
      <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar__header">
          <div className="admin-logo">
            <img src={whiteMKDLogo} alt="MKD" />
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path
                d={
                  sidebarCollapsed
                    ? 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z'
                    : 'M3 18h13v-2H3v2zm0-5h10v-2H3v2zm0-7v2h13V6H3z'
                }
              />
            </svg>
          </button>
        </div>
        {showRestaurantSwitcher && (
          <div className="admin-sidebar__switcher">
            <label>Restaurant</label>
            <select
              value={currentRestaurant?.id || ''}
              onChange={(e) => {
                const id = e.target.value;
                if (id) navigate(`/owner/restaurant/${id}/menu`);
              }}
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
        <nav className="admin-sidebar__nav">
          {navItems.map((item) => {
            const active =
              location.pathname === item.path ||
              (item.path !== '/owner/dashboard' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="nav-icon">{item.icon}</span>
                {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="admin-sidebar__footer">
          {currentRestaurant && (
            <div className="admin-sidebar__community">
              <button
                type="button"
                className="admin-sidebar__community-back"
                onClick={() => {
                  if (user?.role === 'admin') navigate('/admin/restaurants');
                  else navigate('/home');
                }}
                aria-label={user?.role === 'admin' ? 'Return to Admin' : 'Back to site'}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                </svg>
              </button>
              <div className="admin-sidebar__community-logo">
                {currentLogoUrl ? (
                  <img src={currentLogoUrl} alt="" className="admin-sidebar__community-logo-img" />
                ) : (
                  <span aria-hidden="true">{currentInitials}</span>
                )}
              </div>
              {!sidebarCollapsed && (
                <div className="admin-sidebar__community-info">
                  <span className="admin-sidebar__community-label">Restaurant</span>
                  <span className="admin-sidebar__community-name">{currentRestaurant.name}</span>
                </div>
              )}
            </div>
          )}
          {user && (
            <div className="admin-user">
              <div className="user-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
              {!sidebarCollapsed && (
                <div className="user-info">
                  <span className="user-name">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="user-role">
                    {user.role === 'admin'
                      ? 'Super Admin'
                      : user.role === 'restaurant_owner'
                        ? 'Restaurant Owner'
                        : user.role}
                  </span>
                </div>
              )}
            </div>
          )}
          <button type="button" className="sign-out-btn" onClick={handleSignOut}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M17 7l-1.41 1.41L18.17 11H9v2h9.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
            </svg>
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
      {mobileSidebarOpen && (
        <div className="admin-overlay" onClick={() => setMobileSidebarOpen(false)} aria-hidden="true" />
      )}
      <main className="owner-main">
        <header className="owner-header">
          <div className="owner-header__title">
            <h1>{currentRestaurant?.name || 'Restaurant Owner'}</h1>
            <p>Manage menu and orders</p>
          </div>
          <button
            type="button"
            className="owner-mobile-menu"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
            </svg>
          </button>
        </header>
        <div className="owner-content">
          <Outlet context={{ restaurants, currentRestaurant, currentLogoUrl }} />
        </div>
      </main>
    </div>
  );
};

export default OwnerLayout;
