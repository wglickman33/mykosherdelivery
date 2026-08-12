import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchFacilitiesList, nhPath } from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './NursingHomeCommunityPicker.scss';

const formatFacilityLocation = (facility) => {
  const address = facility?.address;
  if (!address || typeof address !== 'object') return null;
  const city = address.city || address.City;
  const state = address.state || address.State;
  const parts = [city, state].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};

const facilityInitials = (name) => {
  const words = String(name || 'NH').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  }
  return (words[0] || 'NH').slice(0, 2).toUpperCase();
};

const NursingHomeCommunityPicker = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return facilities;
    return facilities.filter((f) => {
      const hay = [f.name, f.slug, formatFacilityLocation(f)].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [facilities, query]);

  const enterFacility = (f) => {
    if (f?.slug) {
      navigate(nhPath(f.slug, 'dashboard'));
      return;
    }
    if (f?.id) {
      navigate(`/nursing-homes/dashboard?facilityId=${f.id}`);
    }
  };

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Admin';

  return (
    <div className="nh-community-picker">
      <div className="nh-community-picker__shell">
        <div className="nh-community-picker__brand">
          <p className="nh-community-picker__brand-name">My Kosher Delivery</p>
          <p className="nh-community-picker__brand-tag">Nursing Home Portal</p>
        </div>

        <div className="nh-community-picker__panel">
          <header className="nh-community-picker__header">
            <h1>Choose a community</h1>
            <p>
              Open a facility&apos;s resident ordering portal
              {user?.firstName ? ` as ${user.firstName}` : ''}.
              You&apos;ll place and manage weekly meal orders for residents at that community.
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
              <button
                type="button"
                className="nh-community-picker__btn nh-community-picker__btn--primary"
                onClick={() => navigate('/admin/nursing-homes')}
              >
                Set up facilities
              </button>
            </div>
          ) : (
            <>
              {facilities.length > 4 && (
                <div className="nh-community-picker__search">
                  <label htmlFor="nh-community-search" className="nh-community-picker__sr-only">
                    Search communities
                  </label>
                  <input
                    id="nh-community-search"
                    type="search"
                    placeholder="Search by name or city…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              )}

              <p className="nh-community-picker__count" aria-live="polite">
                {filtered.length} communit{filtered.length === 1 ? 'y' : 'ies'}
              </p>

              {filtered.length === 0 ? (
                <div className="nh-community-picker__empty nh-community-picker__empty--compact">
                  <p>No communities match “{query.trim()}”.</p>
                </div>
              ) : (
                <ul className="nh-community-picker__list">
                  {filtered.map((f) => {
                    const location = formatFacilityLocation(f);
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          className="nh-community-picker__card"
                          onClick={() => enterFacility(f)}
                        >
                          <span className="nh-community-picker__initials" aria-hidden="true">
                            {facilityInitials(f.name)}
                          </span>
                          <span className="nh-community-picker__meta">
                            <span className="nh-community-picker__name">{f.name}</span>
                            {location ? (
                              <span className="nh-community-picker__slug">{location}</span>
                            ) : f.slug ? (
                              <span className="nh-community-picker__slug">{f.slug}</span>
                            ) : null}
                          </span>
                          <span className="nh-community-picker__enter">
                            Open portal
                            <span aria-hidden="true"> →</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          <aside className="nh-community-picker__admin" aria-label="Platform administration">
            <div className="nh-community-picker__admin-copy">
              <h2>Need to manage facilities?</h2>
              <p>
                Use platform admin to add or edit nursing homes, residents, staff logins,
                menus, and billing - not for placing weekly resident orders.
              </p>
            </div>
            <button
              type="button"
              className="nh-community-picker__btn nh-community-picker__btn--secondary"
              onClick={() => navigate('/admin/nursing-homes')}
            >
              Manage facilities &amp; residents
            </button>
          </aside>

          <footer className="nh-community-picker__footer">
            <p className="nh-community-picker__signed-in">
              Signed in as <strong>{displayName}</strong>
              {user?.role === 'admin' ? ' · Super Admin' : ''}
            </p>
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
    </div>
  );
};

export default NursingHomeCommunityPicker;
