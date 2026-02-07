import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getMapsAccess } from '../../services/mapsService';
import { MapsThemeProvider, MapsThemeRoot } from '../../context/MapsThemeContext';
import MapsThemeToggle from '../MapsLayout/MapsThemeToggle';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './MapsGate.scss';

const MapsGate = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [accessLoading, setAccessLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!user) {
      setAccessLoading(false);
      setHasAccess(false);
      return;
    }
    let cancelled = false;
    getMapsAccess()
      .then((res) => {
        if (!cancelled) setHasAccess(!!res?.hasAccess);
      })
      .catch(() => {
        if (!cancelled) setHasAccess(false);
      })
      .finally(() => {
        if (!cancelled) setAccessLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  if (authLoading || accessLoading) {
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

  if (!hasAccess) {
    return (
      <MapsThemeProvider>
        <MapsThemeRoot>
<div className="maps-gate maps-gate--no-access">
          <div className="maps-gate__card">
            <div className="maps-gate__card-corner">
              <MapsThemeToggle />
            </div>
            <h1>My Kosher Maps</h1>
              <p>An active subscription is required to access the kosher restaurant directory.</p>
              <p className="maps-gate__hint">Subscribe to My Kosher Maps to see every kosher restaurant, filter by diet, get directions, and more.</p>
              <div className="maps-gate__actions">
                <button type="button" className="maps-gate__btn-primary" onClick={() => navigate('/account')}>
                  Manage subscription
                </button>
                <button type="button" className="maps-gate__btn-secondary" onClick={() => navigate('/home')}>
                  Back to home
                </button>
              </div>
            </div>
          </div>
        </MapsThemeRoot>
      </MapsThemeProvider>
    );
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
