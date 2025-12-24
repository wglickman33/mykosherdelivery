import { useNavigate } from 'react-router-dom';
import './AdminNotFoundPage.scss';

const AdminNotFoundPage = () => {
  const navigate = useNavigate();

  const handleGoDashboard = () => {
    navigate('/admin/dashboard');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="admin-not-found">
      <div className="admin-not-found__container">
        <div className="admin-not-found__content">
          <div className="admin-not-found__illustration">
            <div className="admin-not-found__number">404</div>
            <div className="admin-not-found__icon">
              <svg viewBox="0 0 200 200" width="100" height="100" fill="currentColor">
                <path d="M100 20C50 20 10 60 10 110C10 160 50 200 100 200C150 200 190 160 190 110C190 60 150 20 100 20ZM100 180C60 180 30 150 30 110C30 70 60 40 100 40C140 40 170 70 170 110C170 150 140 180 100 180Z"/>
                <circle cx="70" cy="90" r="8"/>
                <circle cx="130" cy="90" r="8"/>
                <path d="M60 140C60 140 80 160 100 160C120 160 140 140 140 140" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          
          <div className="admin-not-found__text">
            <h1>Admin Page Not Found</h1>
            <p className="admin-not-found__subtitle">
              Looks like this admin page got lost in the system! 
              Even our best admins sometimes click the wrong link.
            </p>
            <p className="admin-not-found__description">
              The admin page you&apos;re looking for might have been moved, deleted, or never existed. 
              Don&apos;t worry, this happens to the best of us!
            </p>
          </div>

          <div className="admin-not-found__actions">
            <button className="admin-not-found__btn admin-not-found__btn--primary" onClick={handleGoDashboard}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
              </svg>
              Go to Dashboard
            </button>
            <button className="admin-not-found__btn admin-not-found__btn--secondary" onClick={handleGoBack}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
              Go Back
            </button>
          </div>

          <div className="admin-not-found__suggestions">
            <h3>Quick Admin Links:</h3>
            <div className="admin-not-found__links">
              <button onClick={() => navigate('/admin/dashboard')} className="admin-not-found__link">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                </svg>
                Dashboard
              </button>
              <button onClick={() => navigate('/admin/orders')} className="admin-not-found__link">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6z"/>
                </svg>
                Orders
              </button>
              <button onClick={() => navigate('/admin/restaurants')} className="admin-not-found__link">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/>
                </svg>
                Restaurants
              </button>
              <button onClick={() => navigate('/admin/users')} className="admin-not-found__link">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Users
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminNotFoundPage;
