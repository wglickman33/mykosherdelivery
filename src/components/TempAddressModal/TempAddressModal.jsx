import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { isValidZipCode, extractZipCode } from '../../data/deliveryZones';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './TempAddressModal.scss';

const TempAddressModal = ({ isOpen, onClose }) => {
  const { tempAddress, setTempAddress } = useAuth();
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [addressError, setAddressError] = useState('');
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    if (isOpen && tempAddress) {
      setAddress(tempAddress);
    }
  }, [isOpen, tempAddress]);

  useEffect(() => {
    const initializeGooglePlaces = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        return;
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        return;
      }

      const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
      
      if (!apiKey || apiKey === 'your_api_key_here') {
        console.warn("Google Places API key not found. Using mock suggestions instead.");
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.id = "google-maps-script";
      document.head.appendChild(script);
    };

    initializeGooglePlaces();
  }, []);

  const filterValidSuggestions = (suggestions) => {
    return suggestions.filter(suggestion => {
      const address = suggestion.description;
      
      const zipCode = extractZipCode(address);
      if (zipCode && isValidZipCode(zipCode)) {
        return true;
      }
      
      const validAreas = [
        'New York, NY', 'Manhattan, NY', 'Brooklyn, NY', 'Queens, NY', 'Bronx, NY', 'The Bronx, NY',
        'Cedarhurst, NY', 'Lawrence, NY', 'Woodmere, NY', 'Hewlett, NY', 'Inwood, NY', 'Far Rockaway, NY',
        'Long Beach, NY', 'Oceanside, NY', 'Hempstead, NY', 'Garden City, NY', 'Westbury, NY', 'Mineola, NY',
        'Hicksville, NY', 'Levittown, NY', 'Massapequa, NY', 'Plainview, NY', 'Syosset, NY', 'Jericho, NY',
        'White Plains, NY', 'Yonkers, NY', 'New Rochelle, NY', 'Mount Vernon, NY', 'Scarsdale, NY', 'Rye, NY',
        'Harrison, NY', 'Mamaroneck, NY', 'Larchmont, NY', 'Bronxville, NY', 'Eastchester, NY', 'Tuckahoe, NY',
        'East Hampton, NY', 'Southampton, NY', 'Bridgehampton, NY', 'Westhampton, NY', 'Sag Harbor, NY',
        'Montauk, NY', 'Amagansett, NY', 'Water Mill, NY', 'Sagaponack, NY', 'Westhampton Beach, NY'
      ];
      
      return validAreas.some(area => address.includes(area));
    });
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setAddress(value);
    setAddressError('');

    if (value.length > 2) {
      setIsLoading(true);
      
      if (window.google && window.google.maps && window.google.maps.places) {
        const service = new window.google.maps.places.AutocompleteService();
        
        service.getPlacePredictions(
          {
            input: value,
            types: ['address'],
            componentRestrictions: { country: 'us' }
          },
          (predictions, status) => {
            setIsLoading(false);
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              const formattedSuggestions = predictions.slice(0, 10).map(prediction => ({
                id: prediction.place_id,
                description: prediction.description,
                main_text: prediction.structured_formatting.main_text,
                secondary_text: prediction.structured_formatting.secondary_text
              }));
              
              const validSuggestions = filterValidSuggestions(formattedSuggestions);
              setSuggestions(validSuggestions);
              setShowSuggestions(validSuggestions.length > 0);
            } else {
              const mockSuggestions = generateMockSuggestions(value);
              const validMockSuggestions = filterValidSuggestions(mockSuggestions);
              setSuggestions(validMockSuggestions);
              setShowSuggestions(validMockSuggestions.length > 0);
            }
          }
        );
      } else {
        setTimeout(() => {
          setIsLoading(false);
          const mockSuggestions = generateMockSuggestions(value);
          const validMockSuggestions = filterValidSuggestions(mockSuggestions);
          setSuggestions(validMockSuggestions);
          setShowSuggestions(validMockSuggestions.length > 0);
        }, 300);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const generateMockSuggestions = (input) => {
    const mockAddresses = [
      { main_text: `${input} Main St`, secondary_text: "New York, NY 10001" },
      { main_text: `${input} Broadway`, secondary_text: "New York, NY 10019" },
      { main_text: `${input} Park Ave`, secondary_text: "New York, NY 10016" },
      { main_text: `${input} 5th Ave`, secondary_text: "New York, NY 10003" },
      { main_text: `${input} Central Ave`, secondary_text: "Cedarhurst, NY 11516" },
      { main_text: `${input} Ocean Ave`, secondary_text: "Brooklyn, NY 11235" },
      { main_text: `${input} Northern Blvd`, secondary_text: "Queens, NY 11354" },
      { main_text: `${input} Grand Concourse`, secondary_text: "Bronx, NY 10451" }
    ];

    return mockAddresses.map((addr, index) => ({
      id: `mock_${index}`,
      description: `${addr.main_text}, ${addr.secondary_text}`,
      main_text: addr.main_text,
      secondary_text: addr.secondary_text
    }));
  };

  const handleSuggestionClick = (suggestion) => {
    setAddress(suggestion.description);
    setShowSuggestions(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (address.trim()) {
      setAddressError("");
      
      setTempAddress(address.trim());
      onClose();
    } else {
      setAddressError("Please enter a delivery address");
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="temp-address-modal-overlay" onClick={onClose}>
      <div className="temp-address-modal" onClick={(e) => e.stopPropagation()}>
        <div className="temp-address-modal-header">
          <h2>Edit Delivery Address</h2>
          <button className="close-button" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="#6c757d" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <form className="temp-address-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="address">Delivery Address</label>
            <div className="address-input-container">
              <input
                ref={inputRef}
                type="text"
                id="address"
                value={address}
                onChange={handleInputChange}
                placeholder="Enter your delivery address"
                className="address-input"
                autoComplete="off"
                required
              />
              {isLoading && (
                <div className="loading-indicator">
                  <LoadingSpinner 
                    size="small" 
                    text="" 
                    variant="minimal"
                    className="loading-spinner--inline"
                  />
                </div>
              )}
              
              {showSuggestions && suggestions.length > 0 && (
                <div ref={suggestionsRef} className="suggestions-dropdown">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id || suggestion.place_id}
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <div className="suggestion-main">{suggestion.main_text}</div>
                      <div className="suggestion-secondary">{suggestion.secondary_text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {addressError && (
              <div className="address-error">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <path d="M15 9l-6 6" stroke="currentColor" strokeWidth="2"/>
                  <path d="M9 9l6 6" stroke="currentColor" strokeWidth="2"/>
                </svg>
                {addressError}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="save-button"
              disabled={!address.trim()}
            >
              Update Address
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

TempAddressModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

export default TempAddressModal; 