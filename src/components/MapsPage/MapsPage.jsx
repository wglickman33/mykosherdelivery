import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { getMapsRestaurants } from '../../services/mapsService';
import { isOpenNow } from '../../utils/mapsHoursUtils';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import logger from '../../utils/logger';
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

function formatHoursLine(line) {
  const parts = line.split(/\b(Closed)\b/i);
  return parts.map((part, i) =>
    part.toLowerCase() === 'closed' ? (
      <strong key={i} className="maps-page__hours-closed">Closed</strong>
    ) : (
      part
    )
  );
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
  const [mapInstanceReady, setMapInstanceReady] = useState(false);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const selectedCardRef = useRef(null);

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

  const openStatusById = useMemo(() => {
    const out = {};
    list.forEach((place) => {
      const status = isOpenNow(
        place.hoursOfOperation ?? place.hours_of_operation ?? '',
        place.latitude ?? null,
        place.longitude ?? null,
        place.timezone ?? null
      );
      out[place.id] = status;
    });
    return out;
  }, [list]);

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
    const key = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!key) {
      logger.debug('MapsPage: no API key, map placeholder only', null);
      setMapReady(true);
      return;
    }
    if (window.google?.maps) {
      logger.debug('MapsPage: Google Maps already loaded', null);
      setMapReady(true);
      return;
    }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      let attempts = 0;
      const maxAttempts = 150;
      const check = () => {
        if (window.google?.maps) {
          setMapReady(true);
          return;
        }
        if (++attempts < maxAttempts) requestAnimationFrame(check);
      };
      check();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      logger.debug('MapsPage: Maps script loaded', null);
      setMapReady(true);
    };
    script.onerror = () => {
      setError('Failed to load map.');
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapReady || !window.google?.maps || !mapRef.current) {
      if (mapReady && !window.google?.maps) logger.debug('MapsPage: mapReady but no window.google.maps', null);
      return;
    }
    logger.debug('MapsPage: initializing map', { listLength: list.length, hasUserLocation: !!userLocation });
    let cancelled = false;
    const center = userLocation || DEFAULT_CENTER;

    const clearMarkers = () => {
      markersRef.current.forEach((m) => {
        if (m && m.map !== undefined) m.map = null;
      });
      markersRef.current = [];
      if (userMarkerRef.current) {
        userMarkerRef.current.map = null;
        userMarkerRef.current = null;
      }
    };

    (async () => {
      try {
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker');
        if (cancelled) return;

        let map = mapInstanceRef.current;
        if (!map) {
          map = new window.google.maps.Map(mapRef.current, {
            mapId: 'DEMO_MAP_ID',
            center: { lat: center.lat, lng: center.lng },
            zoom: 12,
            mapTypeControl: true,
            fullscreenControl: true,
            zoomControl: true
          });
          mapInstanceRef.current = map;
          logger.debug('MapsPage: using AdvancedMarkerElement', null);
        }

        if (cancelled) return;
        clearMarkers();

        if (userLocation) {
          const userPin = document.createElement('div');
          userPin.className = 'maps-page__user-pin';
          userPin.title = 'Your location';
          userPin.setAttribute('aria-label', 'Your location');
          userMarkerRef.current = new AdvancedMarkerElement({
            position: { lat: userLocation.lat, lng: userLocation.lng },
            map,
            title: 'Your location',
            content: userPin
          });
        }

        const bounds = new window.google.maps.LatLngBounds();
        if (userLocation) bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });

        list.forEach((place) => {
          if (place.latitude == null || place.longitude == null) return;
          const pos = { lat: Number(place.latitude), lng: Number(place.longitude) };
          bounds.extend(pos);
          const isOpen = isOpenNow(
            place.hoursOfOperation ?? place.hours_of_operation ?? '',
            place.latitude,
            place.longitude,
            place.timezone ?? null
          );
          const pinEl = document.createElement('div');
          pinEl.className = 'maps-page__marker-pin'
            + (isOpen === true ? ' maps-page__marker-pin--open' : isOpen === false ? ' maps-page__marker-pin--closed' : '');
          pinEl.title = place.name;
          pinEl.setAttribute('aria-label', place.name);
          const marker = new AdvancedMarkerElement({
            position: pos,
            map,
            title: place.name,
            gmpClickable: true,
            content: pinEl
          });
          marker.addListener('click', () => setSelectedId(place.id));
          markersRef.current.push(marker);
        });

        if (cancelled) return;
        if (list.length > 0 && list.some((p) => p.latitude != null)) {
          if (list.length === 1 && !userLocation) map.setZoom(14);
          else map.fitBounds(bounds, 40);
        }
        if (userLocation && list.length === 0) {
          map.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
        }
        if (!cancelled) setMapInstanceReady(true);
      } catch (err) {
        logger.error('MapsPage: map init failed', err, { message: err?.message });
        if (!cancelled) {
          setError(err?.message || 'Map failed to load.');
          setMapInstanceReady(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, list, userLocation]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => {
        if (m && m.map !== undefined) m.map = null;
      });
      markersRef.current = [];
      if (userMarkerRef.current) {
        userMarkerRef.current.map = null;
        userMarkerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const place = list.find((p) => p.id == selectedId);
    if (!place || place.latitude == null || place.longitude == null) return;
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);

    const panToPlace = (map) => {
      if (map && typeof map.panTo === 'function') {
        map.panTo({ lat, lng });
        map.setZoom(15);
      }
    };

    const scrollId = requestAnimationFrame(() => {
      selectedCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });

    panToPlace(mapInstanceRef.current);
    const t1 = setTimeout(() => panToPlace(mapInstanceRef.current), 300);
    const t2 = setTimeout(() => panToPlace(mapInstanceRef.current), 700);
    const t3 = setTimeout(() => panToPlace(mapInstanceRef.current), 1200);

    return () => {
      cancelAnimationFrame(scrollId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [selectedId, list, mapInstanceReady]);

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
        <button type="button" className="maps-page__location-btn" onClick={requestLocation} title="Center map on your location and sort by distance">
          <MapPin size={18} className="maps-page__location-icon" aria-hidden />
          Use my location
        </button>
      </div>

      {error && <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />}

      <div className="maps-page__split">
        <div className="maps-page__map-wrap">
          <div ref={mapRef} className="maps-page__map" />
          {!import.meta.env.VITE_GOOGLE_PLACES_API_KEY && (
            <div className="maps-page__map-placeholder">
              <p>Add VITE_GOOGLE_PLACES_API_KEY to show the map.</p>
              <p>Restaurant list and directions links work without it.</p>
            </div>
          )}
        </div>

        <div className="maps-page__list-wrap">
          <div className="maps-page__as-callout" role="note">
            <strong>AS = After Shabbat</strong>
            <span> (~1 hour after sunset at the restaurant’s location)</span>
          </div>
          {loading ? (
            <LoadingSpinner size="large" />
          ) : list.length === 0 ? (
            <div className="maps-page__empty">
              <p>No restaurants match your filters.</p>
            </div>
          ) : (
            <ul className="maps-page__list">
              {list.map((place) => {
                const isOpen = openStatusById[place.id];
                const openClass = isOpen === true ? 'maps-page__card--open' : isOpen === false ? 'maps-page__card--closed' : '';
                return (
                <li
                  ref={selectedId === place.id ? selectedCardRef : null}
                  key={place.id}
                  className={`maps-page__card ${selectedId === place.id ? 'maps-page__card--selected' : ''} ${openClass}`}
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
                  {(place.hoursOfOperation || place.hours_of_operation) && (
                    <div className="maps-page__card-hours">
                      <span className="maps-page__card-hours-label">Hours</span>
                      <div className="maps-page__card-hours-text">
                        {(place.hoursOfOperation || place.hours_of_operation)
                          .trim()
                          .split(/\n/)
                          .filter(Boolean)
                          .map((line, i) => (
                            <div key={i} className="maps-page__card-hours-line">
                              {formatHoursLine(line.trim())}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  <div className="maps-page__card-meta">
                    {place.distance != null && <span>{place.distance} mi away</span>}
                    {isOpen !== undefined && isOpen !== null && (
                      <span className={`maps-page__card-status maps-page__card-status--${isOpen ? 'open' : 'closed'}`}>
                        {isOpen ? 'Open' : 'Closed'}
                      </span>
                    )}
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
              ); })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapsPage;
