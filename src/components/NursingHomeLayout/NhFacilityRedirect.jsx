import { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { fetchCurrentFacility, nhPath } from '../../services/nursingHomeService';
import { useAuth } from '../../hooks/useAuth';
import NursingHomeCommunityPicker from '../NursingHomeCommunityPicker/NursingHomeCommunityPicker';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './NursingHomeLayout.scss';

const DEFAULT_NOT_ASSIGNED =
  'You are not assigned to a facility yet. Contact your administrator.';

const NhFacilityRedirect = ({ suffix = 'dashboard' }) => {
  const location = useLocation();
  const params = useParams();
  const { user, signOut } = useAuth();
  const [target, setTarget] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  const resolvedSuffix =
    typeof suffix === 'function' ? suffix(params, location) : suffix;
  const facilityIdParam = new URLSearchParams(location.search || '').get('facilityId');
  const isPlatformAdmin = user?.role === 'admin';

  useEffect(() => {
    let cancelled = false;

    if (isPlatformAdmin && !facilityIdParam) {
      setShowPicker(true);
      setTarget(null);
      setBlocked(null);
      return undefined;
    }

    setShowPicker(false);
    (async () => {
      try {
        const facility = await fetchCurrentFacility(facilityIdParam || undefined);
        if (cancelled) return;
        if (facility?.slug) {
          const nextSearch = new URLSearchParams(location.search || '');
          nextSearch.delete('facilityId');
          const qs = nextSearch.toString();
          setTarget(`${nhPath(facility.slug, resolvedSuffix)}${qs ? `?${qs}` : ''}`);
        } else if (isPlatformAdmin) {
          setShowPicker(true);
        } else {
          setBlocked({
            code: 'NOT_ASSIGNED',
            message: DEFAULT_NOT_ASSIGNED
          });
        }
      } catch (err) {
        if (cancelled) return;
        if (isPlatformAdmin) {
          setShowPicker(true);
          return;
        }
        setBlocked({
          code: err?.code || 'NOT_ASSIGNED',
          message: err?.message || DEFAULT_NOT_ASSIGNED
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedSuffix, location.search, facilityIdParam, isPlatformAdmin]);

  if (showPicker) {
    return <NursingHomeCommunityPicker />;
  }

  if (blocked) {
    const isNhAdmin = user?.role === 'nursing_home_admin';
    return (
      <div className="nh-facility-blocked">
        <div className="nh-facility-blocked__card">
          <h1>Facility access</h1>
          <p>{blocked.message || DEFAULT_NOT_ASSIGNED}</p>
          <div className="nh-facility-blocked__actions">
            {(isPlatformAdmin || isNhAdmin) && (
              <Link to="/admin/nursing-homes" className="nh-facility-blocked__btn nh-facility-blocked__btn--primary">
                Manage facilities &amp; residents
              </Link>
            )}
            <button
              type="button"
              className="nh-facility-blocked__btn nh-facility-blocked__btn--secondary"
              onClick={() => signOut(() => { window.location.href = '/nursing-homes/login'; })}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="nh-auth-loading">
        <LoadingSpinner size="large" />
        <p>Opening facility portal…</p>
      </div>
    );
  }

  return <Navigate to={target} replace />;
};

export default NhFacilityRedirect;
