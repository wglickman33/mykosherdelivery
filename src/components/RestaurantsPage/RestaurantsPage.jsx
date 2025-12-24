import './RestaurantsPage.scss';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { HeartIcon } from '../Icons/IconSet';
import Footer from '../Footer/Footer';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import navyMKDIcon from '../../assets/navyMKDIcon.png';
import { 
  fetchRestaurants, 
  addToFavorites, 
  removeFromFavorites, 
  fetchUserFavorites
} from '../../services/restaurantsService';

export default function RestaurantsPage() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Smart cuisine categories based on existing typeOfFood data
  const cuisineCategories = {
    'all': { label: 'All Restaurants', keywords: [] },
    'favorites': { label: 'Favorites', keywords: [] },
    'featured': { label: 'Featured', keywords: [] },
    'dairy': { label: 'Dairy, Breakfast, & Bakery', keywords: ['dairy', 'bagels', 'breakfast', 'coffee', 'cheese', 'bakery'] },
    'meat': { label: 'Meat & Grill', keywords: ['meat', 'grill', 'bbq', 'steak', 'burger', 'chicken'] },
    'sushi': { label: 'Sushi & Asian', keywords: ['sushi', 'asian', 'japanese', 'chinese', 'thai'] },
    'prepared': { label: 'Prepared Foods', keywords: ['prepared', 'deli', 'sandwiches', 'salads', 'soups'] }
  };

  const loadRestaurants = async () => {
    setLoading(true);
    try {
      const data = await fetchRestaurants();
      setRestaurants(data);
    } catch (error) {
      console.error('Error loading restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = useCallback(async () => {
    if (!user) return;
    
    setFavoritesLoading(true);
    console.log('🔄 Loading user favorites...');
    
    try {
      // Fetch all user favorites (returns an array of restaurantId strings)
      const userFavoriteIds = await fetchUserFavorites(user.id);
      
      const favoriteIds = new Set(
        Array.isArray(userFavoriteIds) ? userFavoriteIds : []
      );
      
      setFavorites(favoriteIds);
      console.log(`✅ Loaded ${favoriteIds.size} favorites instantly`);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setFavoritesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRestaurants();
  }, []);

  useEffect(() => {
    if (user) {
      loadFavorites();
    } else {
      setFavorites(new Set());
    }
  }, [user, loadFavorites]);

  const handleFavoriteToggle = async (restaurantId) => {
    if (!user) {
      // You could show a login modal here
      alert('Please log in to add favorites');
      return;
    }

    const isFavorite = favorites.has(restaurantId);
    
    // Optimistically update the UI
    if (isFavorite) {
      setFavorites(prev => {
        const newFavorites = new Set(prev);
        newFavorites.delete(restaurantId);
        return newFavorites;
      });
    } else {
      setFavorites(prev => new Set(prev).add(restaurantId));
    }
    
    try {
      let result;
      if (isFavorite) {
        result = await removeFromFavorites(restaurantId);
      } else {
        result = await addToFavorites(restaurantId);
      }
      
      if (!result.success) {
        // Revert the optimistic update if the API call failed
        if (isFavorite) {
          setFavorites(prev => new Set(prev).add(restaurantId));
        } else {
          setFavorites(prev => {
            const newFavorites = new Set(prev);
            newFavorites.delete(restaurantId);
            return newFavorites;
          });
        }
        console.error('Failed to update favorite:', result.error);
      }
    } catch (error) {
      // Revert the optimistic update if there was an error
      if (isFavorite) {
        setFavorites(prev => new Set(prev).add(restaurantId));
      } else {
        setFavorites(prev => {
          const newFavorites = new Set(prev);
          newFavorites.delete(restaurantId);
          return newFavorites;
        });
      }
      console.error('Error toggling favorite:', error);
    }
  };

  const filteredRestaurants = restaurants.filter(restaurant => {
    const matchesSearch = restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (restaurant.typeOfFood && restaurant.typeOfFood.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (restaurant.address && restaurant.address.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'favorites') return matchesSearch && favorites.has(restaurant.id);
    if (filter === 'featured') return matchesSearch && restaurant.featured;
    
    // Check cuisine category keywords
    const category = cuisineCategories[filter];
    if (category && category.keywords.length > 0) {
      const restaurantType = restaurant.typeOfFood?.toLowerCase() || '';
      return matchesSearch && category.keywords.some(keyword => 
        restaurantType.includes(keyword)
      );
    }
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="restaurants-page">
        <div className="restaurants-page__content">
          <LoadingSpinner 
            size="large" 
            text="Loading restaurants..." 
            variant="navy"
            className="loading-spinner--fullpage"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="restaurants-page">
      <div className="restaurants-page__content">
        <div className="restaurants-header">
          <h1>Our Restaurant Partners</h1>
          <p>Discover amazing local restaurants and order your favorite meals</p>
        </div>

        <div className="restaurants-controls">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search restaurants or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-tabs">
            {Object.entries(cuisineCategories).map(([key, category]) => {
              // Skip favorites filter if user is not logged in
              if (key === 'favorites' && !user) return null;
              
              // Show favorites count for logged-in users
              const label = key === 'favorites' && user 
                ? `${category.label} (${favoritesLoading ? '...' : favorites.size})`
                : category.label;
              
              return (
            <button 
                  key={key}
                  className={filter === key ? 'active' : ''}
                  onClick={() => setFilter(key)}
                  disabled={key === 'favorites' && favoritesLoading}
            >
                  {label}
            </button>
              );
            })}
          </div>
        </div>

        <div className="restaurants-grid">
          {filteredRestaurants.map(restaurant => (
            <div key={restaurant.id} className="restaurant-card-wrapper">
              <Link to={`/restaurant/${restaurant.id}`} className="restaurant-card">
                <div className="restaurant-image">
                  <img 
                    src={restaurant.logo} 
                    alt={`${restaurant.name} logo`} 
                    onError={(e) => {
                      e.target.src = navyMKDIcon;
                      e.target.classList.add('placeholder-image');
                    }} 
                  />
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

        {filteredRestaurants.length === 0 && (
          <div className="empty-state">
            <h3>No restaurants found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
} 