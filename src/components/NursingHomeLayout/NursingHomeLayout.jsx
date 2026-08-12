import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchCurrentFacility,
  fetchFacilityBySlug,
  nhPath
} from '../../services/nursingHomeService';
import { buildImageUrl } from '../../services/imageService';
import { NursingHomeFacilityContext } from '../../context/NursingHomeFacilityContext';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import whiteMKDLogo from '../../assets/whiteMKDLogo.png';
import './NursingHomeLayout.scss';

function effectiveFacilityLogoUrl(logoUrl) {
  if (!logoUrl) return '';
  if (logoUrl.startsWith('http') || logoUrl.startsWith('https') || logoUrl.startsWith('/')) return logoUrl;
  return buildImageUrl('static/restaurant-logos/' + logoUrl);
}

const Icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  ),
  signOut: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
    </svg>
  ),
  menuPage: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  )
};

const ALLOWED_ROLES = ['nursing_home_user', 'nursing_home_admin', 'admin'];
const RESERVED_SLUGS = new Set(['login', 'admin', 'dashboard', 'menu', 'orders', 'order']);

const NursingHomeLayout = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { facilitySlug } = useParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [facility, setFacility] = useState(null);
  const [facilityLoading, setFacilityLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      navigate('/nursing-homes/login', { replace: true, state: { from: location.pathname } });
    }
  }, [user, loading, navigate, location.pathname]);

  useEffect(() => {
    const applyResponsive = () => {
      const w = window.innerWidth;
      if (w <= 1280) setSidebarCollapsed(true);
      else setSidebarCollapsed(false);
    };
    applyResponsive();
    window.addEventListener('resize', applyResponsive);
    return () => window.removeEventListener('resize', applyResponsive);
  }, []);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const loadFacility = useCallback(async () => {
    if (!user || !ALLOWED_ROLES.includes(user.role) || !facilitySlug) return;
    if (RESERVED_SLUGS.has(facilitySlug)) {
      setAccessDenied(true);
      setFacilityLoading(false);
      return;
    }

    setFacilityLoading(true);
    setAccessDenied(false);
    try {
      const bySlug = await fetchFacilityBySlug(facilitySlug);
      if (!bySlug?.id) {
        setFacility(null);
        setAccessDenied(true);
        return;
      }

      if (user.role === 'admin') {
        setFacility(bySlug);
        return;
      }

      const current = await fetchCurrentFacility();
      if (current?.id && current.id !== bySlug.id) {
        setFacility(null);
        setAccessDenied(true);
        return;
      }
      if (current?.slug && current.slug !== facilitySlug) {
        setFacility(null);
        setAccessDenied(true);
        return;
      }
      setFacility(bySlug);
    } catch {
      setFacility(null);
      setAccessDenied(true);
    } finally {
      setFacilityLoading(false);
    }
  }, [user, facilitySlug]);

  useEffect(() => {
    loadFacility();
  }, [loadFacility]);

  const handleSignOut = async () => {
    await signOut(() => navigate('/nursing-homes/login', { replace: true }));
  };

  const navTo = (path) => {
    navigate(path);
    setMobileSidebarOpen(false);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', path: nhPath(facilitySlug, 'dashboard'), icon: Icons.dashboard },
    { id: 'menu', label: 'Menu', path: nhPath(facilitySlug, 'menu'), icon: Icons.menuPage },
    { id: 'orders', label: 'Orders', path: nhPath(facilitySlug, 'orders'), icon: Icons.orders }
  ];

  const facilityDisplayName = facility?.name || 'Nursing Home';
  const facilityLogoUrl = facility ? effectiveFacilityLogoUrl(facility.logoUrl) : '';
  const facilityInitials = facility?.name
    ? (facility.name.slice(0, 2).toUpperCase().replace(/\s/g, '') || 'NH')
    : 'NH';

  if (loading || facilityLoading) {
    return (
      <div className="nh-auth-loading">
        <LoadingSpinner size="large" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return null;
  }

  if (accessDenied || !facility) {
    if (user.role === 'nursing_home_user' || user.role === 'nursing_home_admin') {
      return <Navigate to="/nursing-homes" replace />;
    }
    return (
      <div className="nh-auth-loading">
        <p>Facility not found or access denied.</p>
        <button type="button" onClick={() => navigate('/admin/nursing-homes')}>
          Back to Admin
        </button>
      </div>
    );
  }

  const roleLabel =
    user.role === 'admin'
      ? 'Super Admin'
      : user.role === 'nursing_home_admin'
        ? 'NH Admin'
        : user.role === 'nursing_home_user'
          ? 'NH User'
          : user.role;

  const showAdminBack = user.role === 'admin' || user.role === 'nursing_home_admin';

  return (
    <div className="nh-layout">
      <aside
        className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'open' : ''}`}
      >
        <div className="admin-sidebar__header">
          <div className="admin-logo">
            <img src={whiteMKDLogo} alt="MKD" />
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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

        <nav className="admin-sidebar__nav">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.id === 'orders' && location.pathname.includes('/orders'));
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navTo(item.path)}
              >
                <span className="nav-icon">{item.icon}</span>
                {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__community">
            {showAdminBack && (
              <button
                type="button"
                className="admin-sidebar__community-back"
                onClick={() => navigate('/admin/nursing-homes')}
                aria-label="Return to MKD Admin"
                title="Return to MKD Admin"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                </svg>
              </button>
            )}
            <div className="admin-sidebar__community-logo">
              {facilityLogoUrl ? (
                <img src={facilityLogoUrl} alt="" className="admin-sidebar__community-logo-img" />
              ) : (
                <span aria-hidden="true">{facilityInitials}</span>
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="admin-sidebar__community-info">
                <span className="admin-sidebar__community-label">Community</span>
                <span className="admin-sidebar__community-name">{facilityDisplayName}</span>
              </div>
            )}
          </div>
          <div className="admin-user">
            <div className="user-avatar" aria-hidden="true">
              {Icons.user}
            </div>
            {!sidebarCollapsed && (
              <div className="user-info">
                <span className="user-name">
                  {user.firstName} {user.lastName}
                </span>
                <span className="user-role">{roleLabel}</span>
              </div>
            )}
          </div>
          <button type="button" className="sign-out-btn" onClick={handleSignOut}>
            {Icons.signOut}
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {mobileSidebarOpen && (
        <div className="admin-overlay" onClick={() => setMobileSidebarOpen(false)} aria-hidden="true" />
      )}

      <main className="nh-main">
        <header className="nh-header">
          <div className="nh-header__title">
            <h1>{facilityDisplayName}</h1>
            <p>Resident meals &amp; orders</p>
          </div>
          <button
            type="button"
            className="nh-mobile-menu"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open menu"
          >
            {Icons.menu}
          </button>
        </header>

        <div className="nh-content">
          <NursingHomeFacilityContext.Provider
            value={{ facility, facilityLoading: false, facilitySlug }}
          >
            <Outlet />
          </NursingHomeFacilityContext.Provider>
        </div>
      </main>
    </div>
  );
};

export default NursingHomeLayout;
