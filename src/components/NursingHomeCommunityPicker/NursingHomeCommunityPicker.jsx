import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchFacilitiesList, nhPath } from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './NursingHomeCommunityPicker.scss';

const NursingHomeCommunityPicker = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchFacilitiesList({ limit: 200, isActive: 'true' });
      setFacilities(Array.isArray(res?.data) ? res.data.filter((f) => f.isActive !== false) : []);
    } catch (err) {
      setError(err.message || 'Failed to load communities');
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enterFacility = (f) => {
    if (f?.slug) {
      navigate(nhPath(f.slug, 'dashboard'));
      return;
    }
    if (f?.id) {
      navigate(`/nursing-homes/dashboard?facilityId=${f.id}`);
    }
  };

  return (
    <div className="nh-community-picker">
      <div className="nh-community-picker__panel">
        <header className="nh-community-picker__header">
          <h1>Select a community</h1>
          <p>
            Choose a nursing home facility to open its resident portal
            {user?.firstName ? ` as ${user.firstName}` : ''}.
          </p>
        </header>

        {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}

        {loading ? (
          <div className="nh-community-picker__loading">
            <LoadingSpinner size="large" />
            <p>Loading communities…</p>
          </div>
        ) : facilities.length === 0 ? (
          <div className="nh-community-picker__empty">
            <p>No active facilities found.</p>
            <button type="button" className="nh-community-picker__btn nh-community-picker__btn--primary" onClick={() => navigate('/admin/nursing-homes')}>
              Manage facilities
            </button>
          </div>
        ) : (
          <ul className="nh-community-picker__list">
            {facilities.map((f) => (
              <li key={f.id}>
                <button type="button" className="nh-community-picker__card" onClick={() => enterFacility(f)}>
                  <span className="nh-community-picker__initials">
                    {(f.name || 'NH').slice(0, 2).toUpperCase()}
                  </span>
                  <span className="nh-community-picker__meta">
                    <span className="nh-community-picker__name">{f.name}</span>
                    {f.slug ? <span className="nh-community-picker__slug">{f.slug}</span> : null}
                  </span>
                  <span className="nh-community-picker__enter">Enter</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className="nh-community-picker__footer">
          <button type="button" className="nh-community-picker__btn nh-community-picker__btn--secondary" onClick={() => navigate('/admin/nursing-homes')}>
            Nursing Home Admin
          </button>
          <button
            type="button"
            className="nh-community-picker__btn nh-community-picker__btn--ghost"
            onClick={() => signOut(() => { window.location.href = '/nursing-homes/login'; })}
          >
            Sign out
          </button>
        </footer>
      </div>
    </div>
  );
};

export default NursingHomeCommunityPicker;
