import './RestaurantDetailPage.scss';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Footer from '../Footer/Footer';
import MenuItemModal from '../MenuItemModal/MenuItemModal';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import { useCart } from '../../context/CartContext';
import { fetchRestaurantById } from '../../services/restaurantsService';
import navyMKDIcon from '../../assets/navyMKDIcon.png';

import { AVAILABLE_LABELS } from '../../data/labels';

const labelMap = AVAILABLE_LABELS;

export default function RestaurantDetailPage() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addedItems, setAddedItems] = useState(new Set()); // Track added items
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { addToCart } = useCart();

  useEffect(() => {
    const loadRestaurant = async () => {
      setLoading(true);
      const foundRestaurant = await fetchRestaurantById(id);
      setRestaurant(foundRestaurant);
      setLoading(false);
    };

    loadRestaurant();
  }, [id]);

  const handleAddToCart = (item, e) => {
    e.stopPropagation();
    
    // Don't allow direct add to cart for variety or builder items
    // These require selections/modifications that must be made in the modal
    if (item.itemType === 'variety' || item.itemType === 'builder') {
      return;
    }
    
    addToCart(item, 1, restaurant);
    
    // Show "Added" feedback
    setAddedItems(prev => new Set([...prev, item.id]));
    
    // Remove "Added" feedback after 1.5 seconds
    setTimeout(() => {
      setAddedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }, 1500);
  };
  
  // Check if item can be added directly to cart (only simple items)
  const canAddDirectlyToCart = (item) => {
    return !item.itemType || item.itemType === 'simple';
  };

  // Get unique categories from menu items
  const getCategories = () => {
    if (!restaurant?.menuItems) return [];
    const categories = [...new Set(restaurant.menuItems.map(item => item.category).filter(Boolean))];
    return categories.sort();
  };

  // Filter menu items based on search term and category
  const getFilteredMenuItems = () => {
    if (!restaurant?.menuItems) return [];
    
    return restaurant.menuItems.filter(item => {
      const matchesSearch = !searchTerm || 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  };

  if (loading) {
    return (
      <div className="restaurant-detail-page">
        <div className="restaurant-detail-page__content">
          <LoadingSpinner 
            size="large" 
            text="Loading restaurant details..." 
            variant="navy"
            className="loading-spinner--fullpage"
          />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="restaurant-detail-page">
        <div className="restaurant-detail-page__content">
          <div className="not-found">
            <h1>Restaurant Not Found</h1>
            <Link to="/restaurants" className="back-link">← Back to Restaurants</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="restaurant-detail-page">
      <div className="restaurant-detail-page__content">
        <div className="restaurant-header">
          <Link to="/restaurants" className="back-link">← Back to Restaurants</Link>
          <div className="restaurant-info">
            <div className="restaurant-logo">
              <img 
                src={restaurant.logo} 
                alt={`${restaurant.name} logo`}
                onError={(e) => {
                  e.target.src = navyMKDIcon;
                  e.target.classList.add('placeholder-image');
                }}
              />
            </div>
            <div className="restaurant-details">
              <h1 className="restaurant-name">{restaurant.name}</h1>
              <p className="restaurant-type">{restaurant.typeOfFood}</p>
              <p className="restaurant-certification">{restaurant.kosherCertification} Certified</p>
              <p className="restaurant-address">{restaurant.address}</p>
              <p className="restaurant-phone">{restaurant.phone}</p>
            </div>
          </div>
        </div>

        <div className="menu-section">
          <h2 className="menu-title">Menu</h2>
          
          {/* Search and Filter Controls */}
          <div className="menu-controls">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <svg className="search-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </div>
            
            <div className="filter-container">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="category-filter"
              >
                <option value="all">All Categories</option>
                {getCategories().map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="results-info">
            <p>
              Showing {getFilteredMenuItems().length} of {restaurant.menuItems.length} items
              {searchTerm && ` for "${searchTerm}"`}
              {selectedCategory !== 'all' && ` in ${selectedCategory}`}
            </p>
          </div>

          <div className="menu-grid">
            {getFilteredMenuItems().map(item => (
              <div className="menu-card" key={item.id}>
                <div 
                  className="menu-card__clickable"
                  onClick={() => {
                    setSelectedItem(item);
                    setIsModalOpen(true);
                  }}
                >
                  <div className="menu-card__image-wrapper">
                    <img 
                      src={item.image || navyMKDIcon} 
                      alt={item.name} 
                      className={`menu-card__image ${!item.image ? 'placeholder-image' : ''}`}
                      onError={(e) => {
                        e.target.src = navyMKDIcon;
                        e.target.classList.add('placeholder-image');
                      }}
                    />
                  </div>
                  <div className="menu-card__content">
                    <h3 className="menu-card__name">{item.name}</h3>
                    <p className="menu-card__desc">{item.description}</p>
                    {item.labels && item.labels.length > 0 && (
                      <div className="menu-card__labels">
                        {item.labels.map(label => (
                          <span
                            className="menu-card__label"
                            key={label}
                            title={labelMap[label] || label}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="menu-card__price">${item.price.toFixed(2)}</div>
                  </div>
                </div>
                <div className="menu-card__actions">
                  {canAddDirectlyToCart(item) ? (
                  <button 
                    className={`add-to-cart-btn ${addedItems.has(item.id) ? 'added' : ''}`}
                    onClick={(e) => handleAddToCart(item, e)}
                    disabled={addedItems.has(item.id)}
                  >
                    {addedItems.has(item.id) ? 'Added!' : 'Add to Cart'}
                  </button>
                  ) : (
                    <button 
                      className="add-to-cart-btn add-to-cart-btn--customize"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(item);
                        setIsModalOpen(true);
                      }}
                    >
                      Customize & Add
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
      
      <MenuItemModal
        item={selectedItem}
        restaurant={restaurant}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedItem(null);
        }}
      />
    </div>
  );
} 