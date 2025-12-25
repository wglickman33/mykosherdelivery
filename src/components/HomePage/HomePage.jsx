import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./HomePage.scss";
import Footer from "../Footer/Footer";
import Countdown from "../Countdown/Countdown";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";
import { fetchFeaturedRestaurants } from "../../services/restaurantsService";
import { useAuth } from "../../hooks/useAuth";
import { HeartIcon } from "../Icons/IconSet";
import { 
  addToFavorites, 
  removeFromFavorites, 
  checkIsFavorite 
} from "../../services/restaurantsService";

const HomePage = () => {
  const { user } = useAuth();
  const [featuredRestaurants, setFeaturedRestaurants] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFeaturedRestaurants = async () => {
      setLoading(true);
      const restaurants = await fetchFeaturedRestaurants();
      setFeaturedRestaurants(restaurants);
      setLoading(false);
    };

    loadFeaturedRestaurants();
  }, []);

  useEffect(() => {
    const loadFavorites = async () => {
      if (!user || featuredRestaurants.length === 0) return;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        const favoritePromises = featuredRestaurants.map(async (restaurant) => {
          try {
            const isFavorite = await checkIsFavorite(user.id, restaurant.id);
            return { restaurantId: restaurant.id, isFavorite };
          } catch (error) {
            if (error.message?.includes('406') || error.status === 406) {
              console.warn(`Skipping favorite check for ${restaurant.id} - restaurant may not be fully synchronized`);
              return { restaurantId: restaurant.id, isFavorite: false };
            }
            console.warn(`Failed to check favorite status for restaurant ${restaurant.id}:`, error);
            return { restaurantId: restaurant.id, isFavorite: false };
          }
        });
        
        const favoriteResults = await Promise.all(favoritePromises);
        
        const favoriteIds = new Set();
        favoriteResults.forEach(({ restaurantId, isFavorite }) => {
          if (isFavorite) {
            favoriteIds.add(restaurantId);
          }
        });
        
        setFavorites(favoriteIds);
      } catch (error) {
        console.error('Error loading favorites:', error);
      }
    };

    loadFavorites();
  }, [user, featuredRestaurants]);

  const handleFavoriteToggle = async (restaurantId) => {
    if (!user) {
      alert('Please log in to add favorites');
      return;
    }

    const isFavorite = favorites.has(restaurantId);
    
    try {
      let result;
      if (isFavorite) {
        result = await removeFromFavorites(user.id, restaurantId);
      } else {
        result = await addToFavorites(user.id, restaurantId);
      }
      
      if (result.success) {
        if (isFavorite) {
          setFavorites(prev => {
            const newFavorites = new Set(prev);
            newFavorites.delete(restaurantId);
            return newFavorites;
          });
        } else {
          setFavorites(prev => new Set(prev).add(restaurantId));
        }
      } else {
        console.error('Failed to update favorite:', result.error);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  return (
    <div className="home-page">
      <div className="home-content">
        <section className="hero-section">
          <div className="hero-content">
            <h1>Welcome to<br />My Kosher Delivery</h1>
            <p>Discover the finest kosher restaurants and get your favorite meals delivered fresh to your door.</p>
            <div className="hero-actions">
              <Link to="/restaurants" className="primary-button">Order Now</Link>
              <Link to="/restaurants" className="secondary-button">Browse Restaurants</Link>
            </div>
          </div>
        </section>

        <section className="countdown-section">
          <Countdown variant="homepage" />
        </section>

        <section className="features-section">
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" width="32" height="32">
                  <path fill="#5fb4f9" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h3>Premium Quality</h3>
              <p>All our partner restaurants are certified kosher and maintain the highest quality standards.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" width="32" height="32">
                  <path fill="#5fb4f9" d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/>
                </svg>
              </div>
              <h3>Reliable Delivery</h3>
              <p>Food delivered on Friday before Shabbat guaranteed or your money back.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" width="32" height="32">
                  <path fill="#5fb4f9" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3>Trusted Partners</h3>
              <p>We work with verified kosher establishments to ensure authenticity and reliability.</p>
            </div>
          </div>
        </section>

        <section className="popular-restaurants">
          <h2>Featured Restaurants</h2>
          {loading ? (
            <LoadingSpinner 
              size="medium" 
              text="Loading featured restaurants..." 
              variant="primary"
            />
          ) : (
            <div className="restaurant-grid">
              {featuredRestaurants.map((restaurant) => (
              <div key={restaurant.id} className="restaurant-card-wrapper">
                <Link to={`/restaurant/${restaurant.id}`} className="restaurant-card">
                  <div className="restaurant-image">
                  <img 
                    src={restaurant.logo} 
                    alt={`${restaurant.name} logo`} 
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }} 
                  />
                    <div className="fallback-icon" style={{display: 'none'}}>🍽️</div>
                  </div>
                  <div className="restaurant-info">
                    <h4>{restaurant.name}</h4>
                    <p className="restaurant-type">{restaurant.typeOfFood}</p>
                    <p className="restaurant-certification">{restaurant.kosherCertification} Certified</p>
                    <p className="restaurant-location">{restaurant.address.split(',')[0]}</p>
                  </div>
                </Link>
                {user && (
                  <button 
                    className={`favorite-btn ${favorites.has(restaurant.id) ? 'favorited' : ''}`}
                    onClick={() => handleFavoriteToggle(restaurant.id)}
                    aria-label={favorites.has(restaurant.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <HeartIcon filled={favorites.has(restaurant.id)} />
                  </button>
                )}
              </div>
              ))}
            </div>
          )}
        </section>

        <section className="cta-section">
          <div className="cta-content">
            <h2>Ready to Order?</h2>
            <p>Join thousands of satisfied customers who trust My Kosher Delivery for their meals.</p>
            <Link to="/restaurants" className="primary-button">My Kosher Delivery</Link>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default HomePage;