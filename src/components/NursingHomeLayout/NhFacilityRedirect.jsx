import { useState, useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { fetchCurrentFacility, nhPath } from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';

/**
 * Resolves the signed-in user's facility and redirects to a slug-prefixed portal path.
 * Used for /nursing-homes index and legacy flat URLs.
 */
const NhFacilityRedirect = ({ suffix = 'dashboard' }) => {
  const location = useLocation();
  const params = useParams();
  const [target, setTarget] = useState(null);
  const [failed, setFailed] = useState(false);

  const resolvedSuffix =
    typeof suffix === 'function' ? suffix(params, location) : suffix;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const facility = await fetchCurrentFacility();
        if (cancelled) return;
        if (facility?.slug) {
          const search = location.search || '';
          setTarget(`${nhPath(facility.slug, resolvedSuffix)}${search}`);
        } else {
          setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedSuffix, location.search]);

  if (failed) {
    return <Navigate to="/nursing-homes/login" replace />;
  }

  if (!target) {
    return (
      <div className="nh-auth-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: '1rem' }}>
        <LoadingSpinner size="large" />
        <p>Opening facility portal…</p>
      </div>
    );
  }

  return <Navigate to={target} replace />;
};

export default NhFacilityRedirect;
