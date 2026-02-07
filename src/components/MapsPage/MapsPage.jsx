import { useState, useEffect, useCallback, useRef } from 'react';
import { getMapsRestaurants } from '../../services/mapsService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './MapsPage.scss';

const DEFAULT_CENTER = { lat: 40.7128, lng: -74.006 };
const DIET_OPTIONS = ['meat', 'dairy', 'parve', 'sushi', 'fish', 'vegan', 'vegetarian', 'bakery', 'pizza', 'deli'];

function getDirectionsUrl(place) {
  if (place.latitude != null && place.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
  }
  const addr = [place.address, place.city, place.state, place.zip].filter(Boolean).join(', ');
  if (addr) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
  return '#';
}

const MapsPage = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [dietFilter, setDietFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [userLocation, setUserLocation] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const mapInstanceRef = useRef(null);

  const loadRestaurants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { active: 'true' };
      if (search.trim()) params.search = search.trim();
      if (dietFilter.trim()) params.diet = dietFilter.trim();
      if (userLocation) {
        params.lat = userLocation.lat;
        params.lng = userLocation.lng;
      }
      const res = await getMapsRestaurants(params);
      let data = Array.isArray(res?.data) ? res.data : [];
      if (sortBy === 'name') {
        data = [...data].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } else if (sortBy === 'distance' && userLocation) {
        data = [...data].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
      } else if (sortBy === 'rating') {
        data = [...data].sort((a, b) => (b.googleRating ?? 0) - (a.googleRating ?? 0));
      }
      setList(data);
    } catch (err) {
      setError(err?.message || 'Failed to load restaurants');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [search, dietFilter, sortBy, userLocation]);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSortBy('distance');
      },
      () => setError('Could not get your location.')
    );
  };

  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) {
      setMapReady(true);
      return;
    }
    if (window.google?.maps) {
      setMapReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapReady(true);
    script.onerror = () => setError('Failed to load map.');
    document.head.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !window.google?.maps || !mapRef.current) return;
    const center = userLocation || DEFAULT_CENTER;
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: center.lat, lng: center.lng },
      zoom: 12,
      mapTypeControl: true,
      fullscreenControl: true,
      zoomControl: true
    });
    mapInstanceRef.current = map;
    const bounds = new window.google.maps.LatLngBounds();
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    list.forEach((place) => {
      if (place.latitude == null || place.longitude == null) return;
      const pos = { lat: Number(place.latitude), lng: Number(place.longitude) };
      bounds.extend(pos);
      const marker = new window.google.maps.Marker({
        position: pos,
        map,
        title: place.name
      });
      marker.addListener('click', () => setSelectedId(place.id));
      markersRef.current.push(marker);
    });
    if (list.length > 0 && list.some((p) => p.latitude != null)) {
      if (list.length === 1) map.setZoom(14);
      else map.fitBounds(bounds, 40);
    }
    if (userLocation) {
      map.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
    }
  }, [mapReady, list, userLocation]);

  useEffect(() => {
    if (!selectedId || !mapInstanceRef.current || !markersRef.current.length) return;
    const place = list.find((p) => p.id === selectedId);
    if (place?.latitude != null && place?.longitude != null) {
      mapInstanceRef.current.panTo({ lat: Number(place.latitude), lng: Number(place.longitude) });
      mapInstanceRef.current.setZoom(15);
    }
  }, [selectedId, list]);

  return (
    <div className="maps-page">
      <div className="maps-page__toolbar">
        <input
          type="text"
          placeholder="Search restaurants…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="maps-page__search"
        />
        <select
          value={dietFilter}
          onChange={(e) => setDietFilter(e.target.value)}
          className="maps-page__select"
        >
          <option value="">All diets</option>
          {DIET_OPTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="maps-page__select"
        >
          <option value="name">Sort by name</option>
          <option value="distance">Sort by distance</option>
          <option value="rating">Sort by rating</option>
        </select>
        <button type="button" className="maps-page__location-btn" onClick={requestLocation}>
          Use my location
        </button>
      </div>

      {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}

      <div className="maps-page__split">
        <div className="maps-page__map-wrap">
          <div ref={mapRef} className="maps-page__map" />
          {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
            <div className="maps-page__map-placeholder">
              <p>Add VITE_GOOGLE_MAPS_API_KEY to show the map.</p>
              <p>Restaurant list and directions links work without it.</p>
            </div>
          )}
        </div>

        <div className="maps-page__list-wrap">
          {loading ? (
            <LoadingSpinner size="large" />
          ) : list.length === 0 ? (
            <div className="maps-page__empty">
              <p>No restaurants match your filters.</p>
            </div>
          ) : (
            <ul className="maps-page__list">
              {list.map((place) => (
                <li
                  key={place.id}
                  className={`maps-page__card ${selectedId === place.id ? 'maps-page__card--selected' : ''}`}
                  onClick={() => setSelectedId(place.id)}
                >
                  <div className="maps-page__card-header">
                    <h3 className="maps-page__card-name">{place.name}</h3>
                    {place.googleRating != null && (
                      <span className="maps-page__card-rating">★ {place.googleRating}</span>
                    )}
                  </div>
                  <p className="maps-page__card-address">
                    {[place.address, place.city, place.state, place.zip].filter(Boolean).join(', ') || 'Address not set'}
                  </p>
                  {(place.dietTags || []).length > 0 && (
                    <div className="maps-page__card-tags">
                      {(place.dietTags || []).map((t) => (
                        <span key={t} className="maps-page__tag">{t}</span>
                      ))}
                    </div>
                  )}
                  {place.kosherCertification && (
                    <p className="maps-page__card-cert">{place.kosherCertification}</p>
                  )}
                  <div className="maps-page__card-meta">
                    {place.distance != null && <span>{place.distance} mi away</span>}
                    <a
                      href={getDirectionsUrl(place)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="maps-page__card-directions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Directions
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapsPage;
