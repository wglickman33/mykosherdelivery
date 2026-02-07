import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getMapsAccess } from '../../services/mapsService';
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
      <div className="maps-gate maps-gate--loading">
        <LoadingSpinner size="large" text="Loading…" />
      </div>
    );
  }

  if (!user) {
    navigate('/signin', { state: { from: '/maps' }, replace: true });
    return null;
  }

  if (!hasAccess) {
    return (
      <div className="maps-gate maps-gate--no-access">
        <div className="maps-gate__card">
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
    );
  }

  return children;
};

export default MapsGate;
