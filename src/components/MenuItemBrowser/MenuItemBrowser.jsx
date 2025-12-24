import './MenuItemBrowser.scss';
import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { fetchAllRestaurants, fetchAllMenuItems } from '../../services/adminServices';
import { fetchRestaurantMenuItems } from '../../services/menuItemService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import MenuItemModal from '../MenuItemModal/MenuItemModal';

const MenuItemBrowser = ({ onItemSelect, onClose }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [searchMode, setSearchMode] = useState('restaurant'); // 'restaurant' or 'item'
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [itemToConfigure, setItemToConfigure] = useState(null);
  const [restaurantForItem, setRestaurantForItem] = useState(null);

  const loadRestaurants = useCallback(async () => {
    setRestaurantsLoading(true);
      setError(null);
    try {
      const result = await fetchAllRestaurants();
      
      if (result.success) {
        const restaurantsList = result.data || [];
        setRestaurants(restaurantsList);
      } else {
        setError('Failed to load restaurants: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      setError('Failed to load restaurants: ' + (error.message || 'Unknown error'));
    } finally {
      setRestaurantsLoading(false);
    }
  }, []);

  const loadRestaurantMenu = useCallback(async (restaurantId) => {
    if (!restaurantId) {
      setMenuItems([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRestaurantMenuItems(restaurantId, {});
      const items = result?.data || result || [];
      
      if (Array.isArray(items) && items.length > 0) {
        const normalizedItems = items.map(item => ({
          ...item,
          restaurantId: item.restaurantId || restaurantId,
          restaurant: item.restaurant || { id: restaurantId, name: 'Unknown Restaurant' },
          options: item.options || item.itemOptions || null,
          itemType: item.itemType || 'simple'
        }));
        
        setMenuItems(normalizedItems);
      } else if (Array.isArray(items)) {
        setMenuItems([]);
      } else {
        setError('Unexpected response format from server');
      }
    } catch (error) {
      setError('Failed to load menu items: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  const searchMenuItems = useCallback(async (searchQuery) => {
    const trimmedQuery = searchQuery?.trim();
    if (!trimmedQuery) {
      setMenuItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchAllMenuItems({
        search: trimmedQuery,
        limit: 100
      });
      
      if (result.success) {
        const items = Array.isArray(result.data) ? result.data : [];
        const normalizedItems = items.map(item => ({
          ...item,
          restaurant: item.restaurant || { id: item.restaurantId, name: 'Unknown Restaurant' },
          options: item.options || item.itemOptions || null,
          itemType: item.itemType || 'simple',
          restaurantId: item.restaurantId || item.restaurant?.id
        }));
        
        setMenuItems(normalizedItems);
      } else {
        setError(result.error || result.message || 'Failed to search menu items');
      }
    } catch (error) {
      setError('Failed to search menu items: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    if (searchMode === 'restaurant' && selectedRestaurant) {
      loadRestaurantMenu(selectedRestaurant);
    } else if (searchMode === 'restaurant') {
      setMenuItems([]);
      setLoading(false);
    } else if (searchMode === 'item') {
      setMenuItems([]);
      setLoading(false);
    }
  }, [searchMode, selectedRestaurant, loadRestaurantMenu]);

  const handleSearch = () => {
    if (searchMode === 'item' && searchTerm.trim()) {
      searchMenuItems(searchTerm);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchMode === 'item') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleItemSelect = (item) => {
    // Check if item requires configuration (variety or builder)
    const requiresConfiguration = item.itemType === 'variety' || item.itemType === 'builder';
    
    if (requiresConfiguration) {
      // Open MenuItemModal for configuration
      setItemToConfigure(item);
      setRestaurantForItem({
        id: item.restaurantId || item.restaurant?.id,
        name: item.restaurant?.name || 'Unknown Restaurant'
      });
    } else {
      // Simple item - add directly
    onItemSelect({
      id: item.id,
      name: item.name,
      price: parseFloat(item.price),
      description: item.description,
        restaurantId: item.restaurantId || item.restaurant?.id,
      restaurantName: item.restaurant?.name || 'Unknown Restaurant',
      category: item.category,
      imageUrl: item.imageUrl,
        options: item.itemOptions || item.options || [],
        itemType: item.itemType || 'simple',
        quantity: 1
      });
    }
  };

  const handleConfiguredItemAdd = (configuredItem) => {
    // Item has been configured in MenuItemModal, now add it to order
    // Ensure restaurantId is included
    const restaurantId = configuredItem.restaurantId || itemToConfigure?.restaurantId || restaurantForItem?.id;
    const restaurantName = configuredItem.restaurantName || itemToConfigure?.restaurant?.name || restaurantForItem?.name || 'Unknown Restaurant';
    
    onItemSelect({
      ...configuredItem,
      restaurantId,
      restaurantName
    });
    setItemToConfigure(null);
    setRestaurantForItem(null);
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  return (
    <div className="menu-item-browser-overlay" onClick={onClose}>
      <div className="menu-item-browser" onClick={(e) => e.stopPropagation()}>
        <div className="menu-item-browser__header">
          <h2 className="menu-item-browser__title">Add Menu Items</h2>
          <button 
            className="menu-item-browser__close-btn"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="menu-item-browser__content">
          {/* Search Mode Toggle */}
          <div className="search-mode-toggle">
            <button
              className={`mode-btn ${searchMode === 'restaurant' ? 'active' : ''}`}
              onClick={() => {
                setSearchMode('restaurant');
                setSearchTerm('');
                setSelectedRestaurant('');
                setMenuItems([]);
              }}
            >
              By Restaurant
            </button>
            <button
              className={`mode-btn ${searchMode === 'item' ? 'active' : ''}`}
              onClick={() => {
                setSearchMode('item');
                setSelectedRestaurant('');
                setSearchTerm('');
                setMenuItems([]);
              }}
            >
              By Item
            </button>
          </div>

          {/* Search Controls */}
          <div className="search-controls">
            {searchMode === 'restaurant' ? (
              <div className="control-group">
                <label>Select Restaurant:</label>
                {restaurantsLoading ? (
                  <div className="loading-text">Loading restaurants...</div>
                ) : restaurants.length === 0 ? (
                  <div className="error-text">No restaurants available</div>
                ) : (
                  <select
                    value={selectedRestaurant}
                    onChange={(e) => setSelectedRestaurant(e.target.value)}
            >
                    <option value="">Select a restaurant...</option>
              {restaurants.map(restaurant => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
                )}
        </div>
            ) : (
              <div className="control-group">
                <label>Search Items:</label>
                <div className="search-input-wrapper">
          <input
            type="text"
                    placeholder="Type to search menu items, then press Enter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
          />
                  <button
                    type="button"
                    className="search-btn"
                    onClick={handleSearch}
                    disabled={!searchTerm.trim() || loading}
                  >
                    Search
                  </button>
        </div>
      </div>
            )}
          </div>

          {/* Menu Items Display */}
          <div className="menu-items-container">
        {error && (
              <div className="error-message">
            <p>{error}</p>
          </div>
        )}
        
        {loading ? (
          <div className="loading-container">
            <LoadingSpinner size="large" />
            <p>Loading menu items...</p>
          </div>
            ) : menuItems.length > 0 ? (
              <div className="menu-items-list">
                {menuItems.map(item => (
                      <div key={item.id} className="menu-item-card">
                        <div className="item-image">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} />
                          ) : (
                            <div className="no-image">No Image</div>
                          )}
                        </div>
                        <div className="item-info">
                          <h5 className="item-name">{item.name}</h5>
                      {item.description && (
                          <p className="item-description">{item.description}</p>
                      )}
                      {searchMode === 'item' && item.restaurant && (
                        <div className="item-restaurant">{item.restaurant.name}</div>
                      )}
                      {searchMode === 'item' && item.category && (
                        <div className="item-category">{item.category}</div>
                      )}
                          <div className="item-price">{formatCurrency(item.price)}</div>
                        </div>
                        <button 
                          className="add-item-btn"
                          onClick={() => handleItemSelect(item)}
                        >
                          Add to Order
                        </button>
                      </div>
                    ))}
                  </div>
            ) : (
              <div className="empty-state">
                <p>
                  {searchMode === 'restaurant' 
                    ? selectedRestaurant 
                      ? 'No menu items found for this restaurant.'
                      : 'Please select a restaurant to view its menu items.'
                    : searchTerm.trim()
                      ? 'No items found matching your search.'
                      : 'Start typing to search for menu items across all restaurants.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MenuItemModal for configuring variable/configurable items */}
      {itemToConfigure && (
        <MenuItemModal
          item={itemToConfigure}
          restaurant={restaurantForItem}
          isOpen={!!itemToConfigure}
          onClose={() => {
            setItemToConfigure(null);
            setRestaurantForItem(null);
          }}
          onAdd={handleConfiguredItemAdd}
        />
      )}
    </div>
  );
};

MenuItemBrowser.propTypes = {
  onItemSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};

export default MenuItemBrowser;