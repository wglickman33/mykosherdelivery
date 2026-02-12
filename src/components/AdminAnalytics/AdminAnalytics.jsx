import './AdminAnalytics.scss';
import { useNavigate, useLocation } from 'react-router-dom';

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'overview', label: 'Overview', path: '/admin/analytics/overview' },
    { id: 'revenue', label: 'Revenue', path: '/admin/analytics/revenue' },
    { id: 'orders', label: 'Orders', path: '/admin/analytics/orders' },
    { id: 'users', label: 'Users', path: '/admin/analytics/users' },
    { id: 'restaurants', label: 'Restaurants', path: '/admin/analytics/restaurants' },
    { id: 'gift-cards', label: 'Gift Cards', path: '/admin/analytics/gift-cards' },
    { id: 'promos', label: 'Promos', path: '/admin/analytics/promos' },
    { id: 'refunds', label: 'Refunds', path: '/admin/analytics/refunds' },
    { id: 'support', label: 'Support', path: '/admin/analytics/support' },
    { id: 'nursing-home', label: 'Nursing Home', path: '/admin/analytics/nursing-home' },
    { id: 'tax-profit', label: 'Tax & Profit', path: '/admin/analytics/tax-profit' }
  ];

  const getCurrentTab = () => {
    const currentPath = location.pathname;
    return tabs.find(tab => tab.path === currentPath) || tabs[0];
  };

  const handleTabClick = (tab) => {
    navigate(tab.path);
  };

  return (
    <div className="admin-analytics">
      <div className="analytics-header">
        <div className="header-content">
          <h1>Analytics Dashboard</h1>
          <p>Comprehensive insights into your platform&apos;s performance</p>
        </div>
      </div>

      <div className="analytics-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${getCurrentTab().id === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="analytics-content">
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '400px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <h2 style={{ marginBottom: '16px', color: '#061757' }}>
            Select an Analytics Section
          </h2>
          <p style={{ marginBottom: '24px' }}>
            Choose from the tabs above to view detailed analytics for different aspects of your platform.
          </p>
          <div className="analytics-hub-cards">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className="analytics-card-button"
                style={{
                  padding: '20px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#5fb4f9';
                  e.target.style.boxShadow = '0 4px 12px rgba(95, 180, 249, 0.15)';
                  e.target.style.background = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                  e.target.style.background = 'white';
                }}
              >
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '8px', 
                  background: 'linear-gradient(135deg, #5fb4f9 0%, #3b82f6 100%)',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    {tab.id === 'overview' && <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>}
                    {tab.id === 'revenue' && <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>}
                    {tab.id === 'orders' && <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z"/>}
                    {tab.id === 'users' && <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>}
                    {tab.id === 'restaurants' && <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 000 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41-5.51-5.51z"/>}
                    {tab.id === 'gift-cards' && <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35L12 4l-1.32 1.35C10.04 3.54 9.05 3 8 3 6.34 3 5 4.34 5 6c0 .35.07.69.18 1H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM8 6c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm8 14H4V8h4.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v10z"/>}
                    {tab.id === 'tax-profit' && <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>}
                    {tab.id === 'promos' && <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>}
                    {tab.id === 'refunds' && <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>}
                    {tab.id === 'support' && <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>}
                    {tab.id === 'nursing-home' && <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>}
                  </svg>
                </div>
                <h4 style={{ margin: '0 0 8px 0', color: '#061757', fontSize: '1.1rem', fontWeight: '600' }}>{tab.label}</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: '1.4' }}>
                  {tab.id === 'overview' && 'Key metrics and trends overview'}
                  {tab.id === 'revenue' && 'Revenue analysis and breakdowns'}
                  {tab.id === 'orders' && 'Order volume and distribution'}
                  {tab.id === 'users' && 'User behavior and demographics'}
                  {tab.id === 'restaurants' && 'Restaurant performance metrics'}
                  {tab.id === 'gift-cards' && 'Gift card issuance, redemption, and balance'}
                  {tab.id === 'promos' && 'Redemption trends, usage by code, revenue impact'}
                  {tab.id === 'refunds' && 'Refund count, total amount, by period'}
                  {tab.id === 'support' && 'Ticket volume, open vs closed'}
                  {tab.id === 'nursing-home' && 'Facilities, orders, invoices, B2B revenue'}
                  {tab.id === 'tax-profit' && 'Revenue breakdown, deductions, net profit, and NY tax estimate'}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
