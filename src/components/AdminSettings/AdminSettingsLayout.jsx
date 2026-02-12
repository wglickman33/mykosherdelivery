import './AdminSettings.scss';
import { NavLink, Outlet } from 'react-router-dom';

const SETTINGS_TABS = [
  { id: 'countdown-timer', label: 'Countdown Timer', path: 'countdown-timer' },
  { id: 'promo-codes', label: 'Promo Codes', path: 'promo-codes' },
  { id: 'logs', label: 'Logs', path: 'logs' }
];

const AdminSettingsLayout = () => {
  return (
    <div className="admin-settings">
      <div className="settings-header">
        <div className="header-content">
          <h1>Settings & Administration</h1>
          <p>Manage system settings, audit logs, and administrative functions</p>
        </div>
      </div>

      <div className="settings-tabs">
        {SETTINGS_TABS.map(tab => (
          <NavLink
            key={tab.id}
            to={tab.path}
            className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}
            end={false}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <div className="settings-content">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminSettingsLayout;
