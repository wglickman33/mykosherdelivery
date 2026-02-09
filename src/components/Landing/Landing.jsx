import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useNavigateWithScroll } from "../../hooks/useNavigateWithScroll";
import { useAuth } from "../../hooks/useAuth";
import { validateAddressWithGeocoding } from "../../data/deliveryZones";
import logoImg from "../../assets/navyMKDLogo.png";
import logoIcon from "../../assets/navyMKDIcon.png";
import Countdown from "../Countdown/Countdown";
import AboutCards from "../AboutCards/AboutCards";
import ContactForm from "../ContactForm/ContactForm";
import Footer from "../Footer/Footer";
import "./Landing.scss";

const Landing = () => {
  const navigate = useNavigateWithScroll();
  const { setTempAddressPersistent } = useAuth();
  
  const [address, setAddress] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    const initializeGooglePlaces = () => {
      console.log('[Google Places] Initializing...');
      
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log('[Google Places] Already loaded, skipping initialization');
        return;
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        console.log('[Google Places] Script already exists, waiting for load...');
        
        const checkLoaded = setInterval(() => {
          if (window.google && window.google.maps && window.google.maps.places) {
            console.log('[Google Places] API loaded after script check');
            clearInterval(checkLoaded);
          }
        }, 500);
        
        setTimeout(() => clearInterval(checkLoaded), 10000);
        return;
      }

      const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

      if (!apiKey || apiKey === 'your_api_key_here') {
        console.warn('[Google Places] API key not configured or is placeholder');
        setAddressError("Address autocomplete is temporarily unavailable. Please enter your full address manually.");
        return;
      }

      window.gm_authFailure = () => {
        console.error('[Google Places] Authentication failure detected');
        console.error('[Google Places] This usually means:');
        console.error('  1. API key is invalid');
        console.error('  2. API key restrictions are blocking this domain');
        console.error('  3. Required APIs are not enabled in Google Cloud Console');
        console.error('[Google Places] Current domain:', window.location.hostname);
        console.error('[Google Places] Current origin:', window.location.origin);
        console.error('[Google Places] Fix: Go to Google Cloud Console → APIs & Services → Credentials');
        console.error('[Google Places] Add this domain to HTTP referrers:', window.location.origin);
        console.error('[Google Places] Error message will only show when user tries to use autocomplete');
      };

      const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geocoding&loading=async&callback=initGoogleMaps`;

      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      script.id = "google-maps-script";
      script.setAttribute('loading', 'async');
      
      window.initGoogleMaps = () => {
        console.log('[Google Places] Callback fired');
        console.log('[Google Places] Checking API availability...');
        
        if (window.google) {
          console.log('[Google Places] window.google exists');
          if (window.google.maps) {
            console.log('[Google Places] window.google.maps exists');
            if (window.google.maps.places) {
              console.log('[Google Places] window.google.maps.places exists');
              if (window.google.maps.places.AutocompleteService) {
                console.log('[Google Places] AutocompleteService available');
                console.log('[Google Places] API fully loaded and ready');
              } else {
                console.error('[Google Places] AutocompleteService NOT available');
                console.error('[Google Places] Available properties:', Object.keys(window.google.maps.places || {}));
              }
            } else {
              console.error('[Google Places] Places library NOT loaded');
              console.error('[Google Places] Available libraries:', Object.keys(window.google.maps || {}));
            }
          } else {
            console.error('[Google Places] Maps object NOT available');
          }
        } else {
          console.error('[Google Places] window.google NOT available');
        }
        
        delete window.initGoogleMaps;
      };
      
      script.onerror = (error) => {
        console.error('[Google Places] Script load error:', error);
        console.error('[Google Places] Error details:', {
          message: error.message,
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno
        });
        console.error('[Google Places] This could mean:');
        console.error('  1. Network connectivity issue');
        console.error('  2. Invalid API key');
        console.error('  3. API key restrictions blocking the request');
        console.error('  4. Required APIs not enabled');
        console.error('[Google Places] Users can still enter addresses manually - error will only show when autocomplete is attempted');
      };
      
      script.onload = () => {
        console.log('[Google Places] Script loaded successfully, waiting for callback...');
      };
      
      document.head.appendChild(script);
      console.log('[Google Places] Script appended to document head');
    };

    initializeGooglePlaces();
  }, []);

  const handleAddressChange = async (e) => {
    const value = e.target.value;
    setAddress(value);
    setAddressError("");

    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    console.log('[Google Autocomplete] Input changed:', value);

    if (window.google) {
      console.log('[Google Autocomplete] window.google exists');
      if (window.google.maps) {
        console.log('[Google Autocomplete] window.google.maps exists');
        if (window.google.maps.places) {
          console.log('[Google Autocomplete] window.google.maps.places exists');
          if (window.google.maps.places.AutocompleteService) {
            console.log('[Google Autocomplete] AutocompleteService available, making request...');
            try {
      const service = new window.google.maps.places.AutocompleteService();
              console.log('[Google Autocomplete] Service created, calling getPlacePredictions...');
      
              const request = {
          input: value,
          types: ['address'],
          componentRestrictions: { country: 'us' }
              };
              console.log('[Google Autocomplete] Request:', request);
              
              service.getPlacePredictions(
                request,
        (predictions, status) => {
                  console.log('[Google Autocomplete] Response received:', {
                    status,
                    statusName: Object.keys(window.google.maps.places.PlacesServiceStatus).find(
                      key => window.google.maps.places.PlacesServiceStatus[key] === status
                    ),
                    predictionsCount: predictions?.length || 0,
                    hasPredictions: !!predictions
                  });
                  
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                    console.log('[Google Autocomplete] Success! Processing', predictions.length, 'predictions');
            const formattedSuggestions = predictions.slice(0, 10).map(prediction => ({
              id: prediction.place_id,
              description: prediction.description,
              main_text: prediction.structured_formatting.main_text,
              secondary_text: prediction.structured_formatting.secondary_text
            }));
            
                    console.log('[Google Autocomplete] Formatted suggestions:', formattedSuggestions);
            setSuggestions(formattedSuggestions);
            setShowSuggestions(formattedSuggestions.length > 0);
                  } else if (status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
                    console.error('[Google Autocomplete] REQUEST_DENIED');
                    console.error('[Google Autocomplete] This means the API key is not authorized for this domain');
                    console.error('[Google Autocomplete] Current domain:', window.location.hostname);
                    console.error('[Google Autocomplete] Current origin:', window.location.origin);
                    console.error('[Google Autocomplete] Fix: Go to Google Cloud Console → APIs & Services → Credentials');
                    console.error('[Google Autocomplete] Edit your API key and add to HTTP referrers:');
                    console.error('[Google Autocomplete]   - https://mykosherdelivery.netlify.app/*');
                    console.error('[Google Autocomplete]   - https://*.netlify.app/*');
                    console.error('[Google Autocomplete]   - http://localhost:* (for development)');
                    setAddressError("Address autocomplete is temporarily unavailable. Please enter your full address manually.");
                    setSuggestions([]);
                    setShowSuggestions(false);
                  } else if (status === window.google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) {
                    console.warn('[Google Autocomplete] OVER_QUERY_LIMIT - API quota exceeded');
                    setSuggestions([]);
                    setShowSuggestions(false);
                  } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    console.log('[Google Autocomplete] ZERO_RESULTS - No addresses found for:', value);
                    setSuggestions([]);
                    setShowSuggestions(false);
                  } else if (status === window.google.maps.places.PlacesServiceStatus.INVALID_REQUEST) {
                    console.error('[Google Autocomplete] INVALID_REQUEST - Request was malformed');
                    console.error('[Google Autocomplete] Request was:', request);
                    setSuggestions([]);
                    setShowSuggestions(false);
                  } else {
                    console.warn('[Google Autocomplete] Unknown status:', status);
                    console.warn('[Google Autocomplete] Available statuses:', Object.keys(window.google.maps.places.PlacesServiceStatus));
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }
                  setIsLoading(false);
                }
              );
            } catch (error) {
              console.error('[Google Autocomplete] Exception caught:', error);
              console.error('[Google Autocomplete] Error stack:', error.stack);
              console.error('[Google Autocomplete] Error name:', error.name);
              console.error('[Google Autocomplete] Error message:', error.message);
              setSuggestions([]);
              setShowSuggestions(false);
              setIsLoading(false);
            }
          } else {
            console.error('[Google Autocomplete] AutocompleteService NOT available');
            console.error('[Google Autocomplete] Available places methods:', Object.keys(window.google.maps.places || {}));
            setSuggestions([]);
            setShowSuggestions(false);
            setIsLoading(false);
          }
        } else {
          console.error('[Google Autocomplete] Places library NOT loaded');
          console.error('[Google Autocomplete] Available maps properties:', Object.keys(window.google.maps || {}));
          setSuggestions([]);
          setShowSuggestions(false);
          setIsLoading(false);
        }
      } else {
        console.error('[Google Autocomplete] Maps object NOT available');
        setSuggestions([]);
        setShowSuggestions(false);
        setIsLoading(false);
      }
    } else {
      console.error('[Google Autocomplete] window.google NOT available');
      console.error('[Google Autocomplete] API may still be loading or failed to load');
      setSuggestions([]);
      setShowSuggestions(false);
        setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setAddress(suggestion.description);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isLoading) {
      return;
    }
    
    if (!address.trim()) {
      setAddressError("Please enter a delivery address");
      return;
    }

    setIsLoading(true);
    setAddressError("");

    try {
      const validation = await validateAddressWithGeocoding(address);
      
      if (validation.isValid) {
        setTempAddressPersistent(validation.formattedAddress || address);
        navigate('/home');
      } else {
        setAddressError("Sorry, we don't deliver to this area yet. Please try a different address.");
      }
    } catch (error) {
      console.error("Address validation error:", error);
      setAddressError("Unable to validate address. Please try again or enter a different address.");
    } finally {
      setIsLoading(false);
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

  return (
    <div className="landing-page-wrapper">
      <div className="landing-page">
        <div className="landing-page__background-elements">
          <div className="landing-page__square landing-page__square--1">
            <img src={logoIcon} alt="" className="landing-page__square-icon" />
          </div>
          <div className="landing-page__square landing-page__square--2">
            <img src={logoIcon} alt="" className="landing-page__square-icon" />
          </div>
          <div className="landing-page__square landing-page__square--3">
            <img src={logoIcon} alt="" className="landing-page__square-icon" />
          </div>
          <div className="landing-page__square landing-page__square--4">
            <img src={logoIcon} alt="" className="landing-page__square-icon" />
          </div>
        </div>

        <header className="landing-page__header">
          <div className="landing-page__logo">
            <img src={logoImg} alt="My Kosher Delivery" />
          </div>

          <div className="landing-page__auth">
            <Link to="/signin" className="landing-page__auth-btn landing-page__auth-btn--signin">
              Sign In
            </Link>
            <Link to="/signup" className="landing-page__auth-btn landing-page__auth-btn--signup">
              Sign Up
            </Link>
          </div>
        </header>

        <main className="landing-page__main">
          <div className="landing-page__content-container">
            <div className="landing-page__hero">
              <h1 className="landing-page__title">Let&apos;s get started.</h1>

              <div className="landing-page__search">
                <form onSubmit={handleSubmit} className="landing-page__search-bar">
                  <span className="landing-page__location-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <div className="landing-page__input-container">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Enter delivery address"
                      className={`landing-page__input ${addressError ? 'landing-page__input--error' : ''}`}
                      value={address}
                      onChange={handleAddressChange}
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !address.trim()) {
                          e.preventDefault();
                          setAddressError("Please enter a delivery address");
                        }
                      }}
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div ref={suggestionsRef} className="landing-page__suggestions">
                        {isLoading && (
                          <div className="landing-page__suggestion landing-page__suggestion--loading">
                            Searching addresses...
                          </div>
                        )}
                        {!isLoading && suggestions.map((suggestion) => (
                          <div
                            key={suggestion.id}
                            className="landing-page__suggestion"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            <div className="landing-page__suggestion-main">
                              {suggestion.main_text}
                            </div>
                            <div className="landing-page__suggestion-secondary">
                              {suggestion.secondary_text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button 
                    type="submit" 
                    className="landing-page__submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="loading-spinner"></div>
                    ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                    )}
                  </button>
                </form>

                {addressError && (
                  <div className="landing-page__error">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M15 9l-6 6" />
                      <path d="M9 9l6 6" />
                    </svg>
                    {addressError}
                  </div>
                )}

                <div className="landing-page__saved">
                  <Link to="/signin" className="landing-page__saved-btn">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Sign in for saved address
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-page__images"></div>
        </main>
      </div>

      <div className="landing-page__countdown-section">
        <Countdown />
      </div>

      <div className="landing-page__about-section">
        <AboutCards />
      </div>

      <div className="landing-page__contact-section">
        <ContactForm />
        <Footer />
      </div>
    </div>
  );
};

export default Landing;