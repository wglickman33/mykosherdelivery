import { Link, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import MapsThemeToggle from './MapsThemeToggle';
import whiteMKMLogo from '../../assets/whiteMKMLogo.png';
import './MapsLayout.scss';

const MapsLayout = ({ children }) => {
  const navigate = useNavigate();

  return (
    <div className="maps-layout">
      <header className="maps-layout__header">
        <div className="maps-layout__header-inner">
          <Link to="/maps" className="maps-layout__logo" aria-label="My Kosher Maps home">
            <img src={whiteMKMLogo} alt="My Kosher Maps" className="maps-layout__logo-img" />
          </Link>
          <nav className="maps-layout__nav">
            <MapsThemeToggle />
            <button type="button" className="maps-layout__btn maps-layout__btn--secondary" onClick={() => navigate('/home')}>
              Back to MKD
            </button>
            <Link to="/account" className="maps-layout__btn maps-layout__btn--account">Account</Link>
          </nav>
        </div>
      </header>
      <main className="maps-layout__main">
        {children}
      </main>
    </div>
  );
};

MapsLayout.propTypes = {
  children: PropTypes.node,
};

export default MapsLayout;
