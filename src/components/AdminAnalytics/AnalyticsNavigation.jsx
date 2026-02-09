import { useNavigate, useLocation } from 'react-router-dom';
import './AdminAnalytics.scss';

const AnalyticsNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'overview', label: 'Overview', path: '/admin/analytics/overview' },
    { id: 'revenue', label: 'Revenue', path: '/admin/analytics/revenue' },
    { id: 'orders', label: 'Orders', path: '/admin/analytics/orders' },
    { id: 'users', label: 'Users', path: '/admin/analytics/users' },
    { id: 'restaurants', label: 'Restaurants', path: '/admin/analytics/restaurants' },
    { id: 'gift-cards', label: 'Gift Cards', path: '/admin/analytics/gift-cards' }
  ];

  const getCurrentTab = () => {
    const currentPath = location.pathname;
    return tabs.find(tab => tab.path === currentPath);
  };

  const handleTabClick = (tab) => {
    navigate(tab.path);
  };

  const handleBackToHub = () => {
    navigate('/admin/analytics');
  };

  return (
    <>
      <div className="analytics-header">
        <div className="header-content">
          <h1>Analytics Dashboard</h1>
          <p>Comprehensive insights into your platform&apos;s performance</p>
        </div>
        <div className="header-controls">
          <button 
            onClick={handleBackToHub}
            className="back-to-hub-btn"
            style={{
              padding: '10px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              background: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '0.9rem',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = '#5fb4f9';
              e.target.style.color = '#5fb4f9';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = '#d1d5db';
              e.target.style.color = '#374151';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Back to Analytics Hub
          </button>
        </div>
      </div>

      <div className="analytics-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${getCurrentTab()?.id === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </>
  );
};

export default AnalyticsNavigation;
