import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import { getOwnerRestaurants } from '../../services/ownerService';
import './OwnerLayout.scss';

const OwnerLayout = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
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
        const list = await getOwnerRestaurants();
        setRestaurants(Array.isArray(list) ? list : []);
      } catch {
        setRestaurants([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, navigate]);

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

  const currentRestaurant = restaurantId ? restaurants.find(r => r.id === restaurantId) : restaurants[0];
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
    { id: 'dashboard', label: 'Dashboard', path: '/owner/dashboard' },
    { id: 'menu', label: 'Menu', path: currentRestaurant ? `/owner/restaurant/${currentRestaurant.id}/menu` : '/owner/dashboard' },
    { id: 'orders', label: 'Orders', path: currentRestaurant ? `/owner/restaurant/${currentRestaurant.id}/orders` : '/owner/dashboard' }
  ];

  return (
    <div className="owner-layout">
      <aside className="owner-sidebar">
        <div className="owner-sidebar__header">
          <span className="owner-logo">Restaurant Owner</span>
          {user?.role === 'admin' && (
            <span className="owner-badge owner-badge--admin" title="Viewing as admin">Admin</span>
          )}
        </div>
        {showRestaurantSwitcher && (
          <div className="owner-sidebar__switcher">
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
        <nav className="owner-sidebar__nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`owner-nav-item ${location.pathname === item.path || (item.path !== '/owner/dashboard' && location.pathname.startsWith(item.path)) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="owner-sidebar__footer">
          <button type="button" className="owner-nav-item" onClick={() => navigate('/home')}>
            Back to main site
          </button>
          <button type="button" className="owner-sign-out" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="owner-main">
        <div className="owner-content">
          <Outlet context={{ restaurants, currentRestaurant }} />
        </div>
      </main>
    </div>
  );
};

export default OwnerLayout;
