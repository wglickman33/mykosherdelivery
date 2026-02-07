import { Link, useNavigate } from 'react-router-dom';
import './MapsLayout.scss';

const MapsLayout = ({ children }) => {
  const navigate = useNavigate();

  return (
    <div className="maps-layout">
      <header className="maps-layout__header">
        <div className="maps-layout__header-inner">
          <Link to="/maps" className="maps-layout__logo" aria-label="My Kosher Maps home">
            <span className="maps-layout__logo-text">My Kosher Maps</span>
            <svg className="maps-layout__logo-icon" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </Link>
          <nav className="maps-layout__nav">
            <button type="button" className="maps-layout__nav-link" onClick={() => navigate('/home')}>
              Back to MKD
            </button>
            <Link to="/account" className="maps-layout__nav-link">Account</Link>
          </nav>
        </div>
      </header>
      <main className="maps-layout__main">
        {children}
      </main>
    </div>
  );
};

export default MapsLayout;
