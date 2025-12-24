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

  // Initialize Google Places API
  useEffect(() => {
    const initializeGooglePlaces = () => {
      // Check if script is already loaded
      if (window.google && window.google.maps && window.google.maps.places) {
        return;
      }

      // Check if script is already in the DOM
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        return;
      }

      const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
      
      if (!apiKey || apiKey === 'your_api_key_here') {
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geocoding&callback=initGoogleMaps`;
      script.async = true;
      script.defer = true;
      script.id = "google-maps-script";
      
      // Add global callback function
      window.initGoogleMaps = () => {
        delete window.initGoogleMaps; // Clean up
      };
      
      script.onerror = () => {
        console.error("Failed to load Google Places API");
      };
      
      document.head.appendChild(script);
    };

    initializeGooglePlaces();
  }, []);

  // Handle address input changes
  const handleAddressChange = async (e) => {
    const value = e.target.value;
    setAddress(value);
    setAddressError(""); // Clear any previous errors

    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);

    // Try Google Places API first
    if (window.google && window.google.maps && window.google.maps.places && window.google.maps.places.AutocompleteService) {
      const service = new window.google.maps.places.AutocompleteService();
      
      service.getPlacePredictions(
        {
          input: value,
          types: ['address'],
          componentRestrictions: { country: 'us' }
        },
        (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            const formattedSuggestions = predictions.slice(0, 10).map(prediction => ({
              id: prediction.place_id,
              description: prediction.description,
              main_text: prediction.structured_formatting.main_text,
              secondary_text: prediction.structured_formatting.secondary_text
            }));
            
            // Show all suggestions - validation happens on submission
            setSuggestions(formattedSuggestions);
            setShowSuggestions(formattedSuggestions.length > 0);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
          setIsLoading(false);
        }
      );
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
        setIsLoading(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion) => {
    setAddress(suggestion.description);
    setShowSuggestions(false);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!address.trim()) {
      setAddressError("Please enter a delivery address");
      return;
    }

    setIsLoading(true);
    setAddressError("");

    try {
      // Validate the address using Google Geocoding API (static delivery zones for landing page)
      const validation = await validateAddressWithGeocoding(address);
      
      if (validation.isValid) {
        // Address is valid for delivery
        setTempAddressPersistent(validation.formattedAddress || address);
        navigate('/home');
      } else {
        // Address is not in a valid delivery zone
        setAddressError("Sorry, we don't deliver to this area yet. Please try a different address.");
      }
    } catch (error) {
      console.error("Address validation error:", error);
      setAddressError("Unable to validate address. Please try again or enter a different address.");
    } finally {
      setIsLoading(false);
    }
  };

  // Close suggestions when clicking outside
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
                        // Prevent Enter key from submitting without valid address
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