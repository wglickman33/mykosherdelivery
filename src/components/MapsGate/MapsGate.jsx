import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { MapsThemeProvider, MapsThemeRoot } from '../../context/MapsThemeContext';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './MapsGate.scss';

const MapsGate = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <MapsThemeProvider>
        <MapsThemeRoot>
          <div className="maps-gate maps-gate--loading">
            <LoadingSpinner size="large" text="Loading…" />
          </div>
        </MapsThemeRoot>
      </MapsThemeProvider>
    );
  }

  if (!user) {
    navigate('/signin', { state: { from: '/maps' }, replace: true });
    return null;
  }

  return (
    <MapsThemeProvider>
      <MapsThemeRoot>
        {children}
      </MapsThemeRoot>
    </MapsThemeProvider>
  );
};

MapsGate.propTypes = {
  children: PropTypes.node,
};

export default MapsGate;
