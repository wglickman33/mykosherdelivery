import { useNavigate } from 'react-router-dom';
import './NotFoundPage.scss';

const NotFoundPage = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/home');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="not-found-page">
      <div className="not-found-container">
        <div className="not-found-content">
          <div className="not-found-illustration">
            <div className="not-found-number">404</div>
            <div className="not-found-icon">
              <svg viewBox="0 0 200 200" width="120" height="120" fill="currentColor">
                <path d="M100 20C50 20 10 60 10 110C10 160 50 200 100 200C150 200 190 160 190 110C190 60 150 20 100 20ZM100 180C60 180 30 150 30 110C30 70 60 40 100 40C140 40 170 70 170 110C170 150 140 180 100 180Z"/>
                <circle cx="70" cy="90" r="8"/>
                <circle cx="130" cy="90" r="8"/>
                <path d="M60 140C60 140 80 160 100 160C120 160 140 140 140 140" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          
          <div className="not-found-text">
            <h1>Oops! Page Not Found</h1>
            <p className="not-found-subtitle">
              Looks like this page went on a delivery run and got lost! 
              Don&apos;t worry, even our best drivers sometimes take a wrong turn.
            </p>
            <p className="not-found-description">
              The page you&apos;re looking for might have been moved, deleted, or never existed in the first place. 
              But hey, at least you found our secret 404 page!
            </p>
          </div>

          <div className="not-found-actions">
            <button className="not-found-btn not-found-btn--primary" onClick={handleGoHome}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
              Take Me Home
            </button>
            <button className="not-found-btn not-found-btn--secondary" onClick={handleGoBack}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
              Go Back
            </button>
          </div>

          <div className="not-found-suggestions">
            <h3>Maybe you were looking for:</h3>
            <div className="not-found-links">
              <button onClick={() => navigate('/restaurants')} className="not-found-link">
                🍽️ Browse Restaurants
              </button>
              <button onClick={() => navigate('/home')} className="not-found-link">
                🏠 Home Page
              </button>
              <button onClick={() => navigate('/cart')} className="not-found-link">
                🛒 Your Cart
              </button>
              <button onClick={() => navigate('/help')} className="not-found-link">
                ❓ Help Center
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
