import './AdminRestaurants.scss';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchAllRestaurants, createRestaurant, updateRestaurant, deleteRestaurant, logAdminAction } from '../../services/adminServices';
import { uploadRestaurantLogo, buildImageUrl } from '../../services/imageService';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import NotificationToast from '../NotificationToast/NotificationToast';
import { useNotification } from '../../hooks/useNotification';
import { restaurants as restaurantsData } from '../../data/restaurants';
import { formatPhoneNumber, formatPhoneForInput } from '../../utils/phoneFormatter';
import MenuItemModal from './MenuItemModal';
import { fetchRestaurantMenuItems, deleteMenuItem } from '../../services/menuItemService';

// Load all restaurant logos from frontend assets (Vite)
const logoModules = import.meta.glob('../../assets/restaurantlogos/*', { eager: true, import: 'default' });

// Normalize a restaurant record to expose both snake_case and camelCase keys
const normalizeRestaurant = (r = {}) => {
  const out = { ...r };
  out.type_of_food = r.type_of_food ?? r.typeOfFood ?? '';
  out.phone_number = r.phone_number ?? r.phone ?? '';
  out.kosher_certification = r.kosher_certification ?? r.kosherCertification ?? '';
  out.logo_url = r.logo_url ?? r.logoUrl ?? '';
  // keep address, featured as-is
  return out;
};

const AdminRestaurants = () => {
  const [allRestaurants, setAllRestaurants] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({});
  const { notification, showNotification, hideNotification } = useNotification();
  const [filters, setFilters] = useState({
    search: '',
    featured: undefined,
    sort: 'name_asc', // name_asc | name_desc | featured
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [activeTab, setActiveTab] = useState('restaurants'); // 'restaurants' | 'menus'
  const [showMenuItemModal, setShowMenuItemModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [selectedRestaurantForMenu, setSelectedRestaurantForMenu] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [menuItemsLoading, setMenuItemsLoading] = useState(false);
  const [showMenuItemDeleteConfirm, setShowMenuItemDeleteConfirm] = useState(false);
  const [selectedMenuItemToDelete, setSelectedMenuItemToDelete] = useState(null);
  const [menuItemsFilters, setMenuItemsFilters] = useState({
    search: '',
    page: 1,
    limit: 20
  });
  const [menuItemsPagination, setMenuItemsPagination] = useState({ 
    page: 1, 
    limit: 20, 
    total: 0, 
    totalPages: 1 
  });
  const lastSearchRef = useRef('');
  const { user: adminUser } = useAuth();

  // Map asset basenames (e.g., grazeLogo.png) to URLs
  const assetsLogoByName = useMemo(() => {
    const map = {};
    Object.entries(logoModules).forEach(([path, url]) => {
      const base = path.split('/').pop();
      if (base) map[base.toLowerCase()] = url;
    });
    return map;
  }, []);

  const assetsLogoByBase = useMemo(() => {
    const map = {};
    Object.entries(logoModules).forEach(([path, url]) => {
      const base = path.split('/').pop();
      if (base) {
        const noext = base.toLowerCase().replace(/\.[^.]+$/, '');
        map[noext] = url;
      }
    });
    return map;
  }, []);

  useEffect(() => {
    fetchRestaurants();
  }, []); // initial load only

  const fetchRestaurants = async () => {
    setLoading(true);
    const result = await fetchAllRestaurants({});
    if (result.success) {
      const rows = Array.isArray(result.data) ? result.data : [];
      setAllRestaurants(rows.map(normalizeRestaurant));
    }
    setLoading(false);
  };

  const fetchMenuItems = useCallback(async (restaurantId, filters = menuItemsFilters) => {
    if (!restaurantId) return;
    
    setMenuItemsLoading(true);
    try {
      const result = await fetchRestaurantMenuItems(restaurantId, {
        search: filters.search,
        limit: filters.limit,
        offset: (filters.page - 1) * filters.limit
      });
      setMenuItems(result.data || []);
      setMenuItemsPagination(result.pagination || { 
        page: 1, 
        limit: 20, 
        total: 0, 
        totalPages: 1 
      });
    } catch (error) {
      console.error('Error fetching menu items:', error);
      showNotification('Error loading menu items', 'error');
    } finally {
      setMenuItemsLoading(false);
    }
  }, [menuItemsFilters, showNotification]);

  // Handle menu item search - only trigger API call on Enter or button click
  const handleMenuItemsSearch = useCallback(() => {
    if (selectedRestaurantForMenu && menuItemsFilters.search !== lastSearchRef.current) {
      lastSearchRef.current = menuItemsFilters.search;
      const newFilters = {
        ...menuItemsFilters,
        page: 1 // Reset to first page when searching
      };
      fetchMenuItems(selectedRestaurantForMenu.id, newFilters);
    }
  }, [menuItemsFilters, selectedRestaurantForMenu, fetchMenuItems]);

  // Handle search input change (just update state, don't trigger API)
  const handleSearchInputChange = useCallback((searchTerm) => {
    setMenuItemsFilters(prev => ({
      ...prev,
      search: searchTerm,
      page: 1
    }));
  }, []);

  // Handle Enter key press in search input
  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleMenuItemsSearch();
    }
  }, [handleMenuItemsSearch]);

  // Handle menu item pagination
  const handleMenuItemsPageChange = useCallback((newPage) => {
    const newFilters = {
      ...menuItemsFilters,
      page: newPage
    };
    setMenuItemsFilters(newFilters);
    if (selectedRestaurantForMenu) {
      fetchMenuItems(selectedRestaurantForMenu.id, newFilters);
    }
  }, [menuItemsFilters, selectedRestaurantForMenu, fetchMenuItems]);

  const applyFilters = useCallback(() => {
    let list = Array.isArray(allRestaurants) ? [...allRestaurants] : [];

    // Search (name, cuisine, address)
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(r => (
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.type_of_food && r.type_of_food.toLowerCase().includes(q)) ||
        (r.address && r.address.toLowerCase().includes(q))
      ));
    }

    // Featured filter
    if (typeof filters.featured === 'boolean') {
      list = list.filter(r => !!r.featured === filters.featured);
    }

    // Sort
    switch (filters.sort) {
      case 'name_desc':
        list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      case 'featured':
        list.sort((a, b) => (b.featured === a.featured ? (a.name || '').localeCompare(b.name || '') : (b.featured ? 1 : -1)));
        break;
      case 'name_asc':
      default:
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    // Pagination (client-side)
    const total = list.length;
    const limit = filters.limit || 20;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(Math.max(1, filters.page || 1), totalPages);
    const startIdx = (page - 1) * limit;
    const paged = list.slice(startIdx, startIdx + limit);

    setRestaurants(paged);
    setPagination({ page, limit, total, totalPages });
  }, [allRestaurants, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const slugify = (name) => String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `restaurant-${Date.now()}`;

  const mapToApi = (data, isCreate = false) => {
    // sanitize logo to store just filename when it maps to a bundled asset
    const inputLogo = data.logo_url || data.logoUrl || '';
    const fname = String(inputLogo).split('/').pop()?.toLowerCase() || '';
    const base = fname.replace(/\.[^.]+$/, '');
    const logoFromAssets = (fname && assetsLogoByName[fname]) || (base && assetsLogoByBase[base]);
    const storedLogo = logoFromAssets ? (fname || `${base}.png`) : inputLogo;
    const payload = {
      // DB-first camelCase schema expected by backend
      name: data.name || '',
      address: data.address || '',
      phone: data.phone_number || data.phone || '',
      typeOfFood: data.type_of_food || data.typeOfFood || '',
      kosherCertification: data.kosher_certification || data.kosherCertification || '',
      logoUrl: storedLogo,
      featured: !!data.featured,
      active: data.active !== false,
    };
    if (isCreate) payload.id = data.id || slugify(payload.name);
    return payload;
  };

  const handleCreateRestaurant = async (data) => {
    console.log("Form data:", data);
    const payload = mapToApi(data, true);
    console.log("API payload:", payload);
    const result = await createRestaurant(payload);
    if (result.success) {
      await logAdminAction(adminUser.id, 'CREATE', 'restaurants', result.data.id, null, payload);
      setShowCreateModal(false);
      setFormData({});
      
      // Refresh notifications
      window.dispatchEvent(new CustomEvent('mkd-refresh-notifications'));
      
      showNotification('Restaurant created successfully', 'success');
      fetchRestaurants();
    }
  };

  const handleUpdateRestaurant = async (data) => {
    const payload = mapToApi(data, false);
    const result = await updateRestaurant(selectedRestaurant.id, payload);
    if (result.success) {
      await logAdminAction(adminUser.id, 'UPDATE', 'restaurants', selectedRestaurant.id, selectedRestaurant, payload);
      setShowEditModal(false);
      setSelectedRestaurant(null);
      
      // Refresh notifications
      window.dispatchEvent(new CustomEvent('mkd-refresh-notifications'));
      
      showNotification('Restaurant updated successfully', 'success');
      fetchRestaurants();
    }
  };

  const handleDeleteRestaurant = async () => {
    const result = await deleteRestaurant(selectedRestaurant.id);
    
    if (result.success) {
      await logAdminAction(
        adminUser.id,
        'DELETE',
        'restaurants',
        selectedRestaurant.id,
        selectedRestaurant,
        null
      );
      
      setShowDeleteConfirm(false);
      setSelectedRestaurant(null);
      
      // Refresh notifications
      window.dispatchEvent(new CustomEvent('mkd-refresh-notifications'));
      
      showNotification('Restaurant deleted successfully', 'success');
      await fetchRestaurants();
    }
  };

  const handleDeleteMenuItem = async () => {
    if (!selectedMenuItemToDelete || !selectedRestaurantForMenu) return;
    
    try {
      const result = await deleteMenuItem(selectedRestaurantForMenu.id, selectedMenuItemToDelete.id);
      
      if (result.success) {
        await logAdminAction(
          adminUser.id,
          'DELETE',
          'menu-items',
          selectedMenuItemToDelete.id,
          selectedMenuItemToDelete,
          null
        );
        
        setShowMenuItemDeleteConfirm(false);
        setSelectedMenuItemToDelete(null);
        showNotification('Menu item deleted successfully', 'success');
        
        // Refresh menu items
        await fetchMenuItems(selectedRestaurantForMenu.id);
      }
    } catch (error) {
      console.error('Error deleting menu item:', error);
      showNotification('Error deleting menu item', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type_of_food: '',
      featured: false,
      active: true,
      kosher_certified: false,
      pickup_time: 30,
      delivery_fee: 5.99,
      minimum_order: 25.00,
      phone_number: '',
      address: '',
      description: ''
    });
  };

  // currency formatting no longer needed in view modal

  // Resolve a usable logo URL from stored value
  const resolveLogoUrl = (raw) => {
    if (!raw) return '';
    const val = String(raw).trim();
    
    // Handle absolute URLs first
    if (/^https?:\/\//i.test(val)) return val;
    if (val.startsWith('/')) return val; // server-relative (Vite-built assets or same-origin)
    
    // Extract filename for matching
    const filename = val.split('/').pop()?.toLowerCase();
    
    // Check if it's a frontend asset first (for existing bundled logos)
    if (filename && assetsLogoByName[filename]) return assetsLogoByName[filename];
    const base = filename ? filename.replace(/\.[^.]+$/, '') : '';
    if (base && assetsLogoByBase[base]) return assetsLogoByBase[base];
    
    // For new uploaded files, use the new image service
    if (val.startsWith('images/')) {
      return buildImageUrl(val);
    }
    
    // Legacy support for old uploaded files
    return buildImageUrl(`static/restaurant-logos/${val}`);
  };

  const getFallbackByIdOrName = (r) => {
    if (!Array.isArray(restaurantsData)) return null;
    const byId = restaurantsData.find(x => x.id === r.id);
    if (byId) return byId;
    const byName = restaurantsData.find(x => (x.name || '').toLowerCase() === (r.name || '').toLowerCase());
    return byName || null;
  };

  return (
    <div className="admin-restaurants">
      <div className="admin-restaurants__header">
        <div className="admin-restaurants__header-content">
          <h1>Restaurant Management</h1>
          <p>Manage restaurant listings, menus, and operational settings</p>
        </div>
        <div className="admin-restaurants__header-actions">
          {activeTab === 'restaurants' && (
            <button
              className="admin-restaurants__create-btn"
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
            >
              Add Restaurant
            </button>
          )}
          {activeTab === 'menus' && (
            <button
              className="admin-restaurants__create-btn"
              onClick={() => {
                if (selectedRestaurantForMenu) {
                  setSelectedMenuItem(null);
                  setShowMenuItemModal(true);
                } else {
                  showNotification('Please select a restaurant first', 'warning');
                }
              }}
            >
              Add Menu Item
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-restaurants__tabs">
        <button 
          className={`admin-restaurants__tab ${activeTab === 'restaurants' ? 'active' : ''}`} 
          onClick={() => setActiveTab('restaurants')}
        >
          Restaurants
        </button>
        <button 
          className={`admin-restaurants__tab ${activeTab === 'menus' ? 'active' : ''}`} 
          onClick={() => setActiveTab('menus')}
        >
          Menus
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'restaurants' && (
        <>
          {/* Filters */}
          <div className="admin-restaurants__filters">
            <div className="admin-restaurants__filter-group">
              <label>Search</label>
              <input
                type="text"
                placeholder="Restaurant name, cuisine type..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              />
            </div>

            <div className="admin-restaurants__filter-group">
              <label>Featured Status</label>
              <select 
                value={filters.featured === undefined ? 'all' : String(filters.featured)}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  featured: e.target.value === 'all' ? undefined : e.target.value === 'true',
                  page: 1 
                })}
              >
                <option value="all">All Restaurants</option>
                <option value="true">Featured Only</option>
                <option value="false">Not Featured</option>
              </select>
            </div>

            <div className="admin-restaurants__filter-group">
              <label>Sort By</label>
              <select 
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value, page: 1 })}
              >
                <option value="name_asc">Name (A→Z)</option>
                <option value="name_desc">Name (Z→A)</option>
                <option value="featured">Featured First</option>
              </select>
            </div>

            <div className="admin-restaurants__filter-group">
              <label>Per Page</label>
              <select 
                value={filters.limit}
                onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), page: 1 })}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

      {/* Restaurants Grid */}
      <div className="admin-restaurants__content">
        {loading ? (
          <div className="admin-restaurants__loading">
            <LoadingSpinner size="large" />
            <p>Loading restaurants...</p>
          </div>
        ) : (
          <>
            <div className="admin-restaurants__grid">
              {restaurants.map((restaurant) => (
                <div key={restaurant.id} className={`admin-restaurants__card ${restaurant.active === false ? 'inactive' : ''}`}>
                  {restaurant.active === false && (
                    <div className="admin-restaurants__inactive-overlay">
                      <span className="admin-restaurants__inactive-text">INACTIVE</span>
                    </div>
                  )}
                  <div className="admin-restaurants__card-header">
                    <h3>{restaurant.name}</h3>
                    <div className="admin-restaurants__badges">
                      {restaurant.featured && (
                        <span className="admin-restaurants__badge admin-restaurants__badge--featured">Featured</span>
                      )}
                      {restaurant.kosher_certified && (
                        <span className="admin-restaurants__badge admin-restaurants__badge--kosher">Kosher Certified</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="admin-restaurants__info">
                    <p className="admin-restaurants__info-cuisine">{restaurant.type_of_food}</p>
                    <p className="admin-restaurants__info-phone">{formatPhoneNumber(restaurant.phone_number)}</p>
                    <p className="admin-restaurants__info-address">{restaurant.address}</p>
                  </div>

                  <div className="admin-restaurants__actions">
                    <button
                      className="admin-restaurants__btn admin-restaurants__btn--primary"
                      onClick={() => {
                        setSelectedRestaurant(normalizeRestaurant(restaurant));
                        setShowRestaurantModal(true);
                      }}
                    >
                      View Details
                    </button>
                    <button
                      className="admin-restaurants__btn admin-restaurants__btn--icon admin-restaurants__btn--edit"
                      aria-label="Edit restaurant"
                      title="Edit"
                      onClick={() => {
                        const normalized = normalizeRestaurant(restaurant);
                        setSelectedRestaurant(normalized);
                        const fb = getFallbackByIdOrName(normalized) || {};
                        setFormData({
                          name: normalized.name || fb.name || '',
                          type_of_food: normalized.type_of_food || fb.typeOfFood || '',
                          featured: typeof normalized.featured === 'boolean' ? normalized.featured : !!fb.featured,
                          active: typeof normalized.active === 'boolean' ? normalized.active : fb.active !== false,
                          kosher_certification: normalized.kosher_certification || fb.kosherCertification || '',
                          logo_url: normalized.logo_url || fb.logo || '',
                          phone_number: normalized.phone_number || fb.phone || '',
                          address: normalized.address || fb.address || '',
                          description: normalized.description || ''
                        });
                        setShowEditModal(true);
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33h-.84v-.84l9.64-9.64.84.84-9.64 9.64zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
                      </svg>
                    </button>
                    <button
                      className="admin-restaurants__btn admin-restaurants__btn--icon admin-restaurants__btn--delete"
                      aria-label="Delete restaurant"
                      title="Delete"
                      onClick={() => {
                        setSelectedRestaurant(restaurant);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                        <path d="M6 7h12v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7zm3-4h6l1 1h4v2H4V4h4l1-1z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="admin-restaurants__pagination">
              <div className="admin-restaurants__pagination-info">
                Showing {pagination.total > 0 ? ((pagination.page - 1) * pagination.limit) + 1 : 0} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} restaurants
              </div>
              <div className="admin-restaurants__pagination-controls">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                >
                  Previous
                </button>
                <span className="admin-restaurants__page-info">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
        </div>
        </>
      )}

      {activeTab === 'menus' && (
        <div className="admin-restaurants__menus-tab">
          <div className="admin-restaurants__menus-placeholder">
            <h3>Menu Management</h3>
            <p>Select a restaurant to manage its menu items</p>
            <div className="admin-restaurants__restaurant-selector">
              <label>Choose Restaurant:</label>
              <select
                value={selectedRestaurantForMenu?.id || ''}
                onChange={(e) => {
                  const restaurantId = e.target.value;
                  const restaurant = allRestaurants.find(r => r.id === restaurantId);
                  setSelectedRestaurantForMenu(restaurant || null);
                  
                  // Reset filters when switching restaurants
                  const resetFilters = {
                    search: '',
                    page: 1,
                    limit: 20
                  };
                  setMenuItemsFilters(resetFilters);
                  lastSearchRef.current = ''; // Reset search ref
                  
                  // Fetch menu items when restaurant is selected
                  if (restaurant) {
                    fetchMenuItems(restaurant.id, resetFilters);
                  } else {
                    setMenuItems([]);
                    setMenuItemsPagination({ page: 1, limit: 20, total: 0, totalPages: 1 });
                  }
                }}
              >
                <option value="">Select a restaurant...</option>
                {allRestaurants.map(restaurant => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
              {allRestaurants.length === 0 && (
                <p className="admin-restaurants__no-restaurants">No restaurants available</p>
              )}
            </div>
            
            {/* Menu Items Display */}
            {selectedRestaurantForMenu && (
              <div className="admin-restaurants__menu-items-section">
                <div className="admin-restaurants__menu-items-header">
                  <h4>Menu Items for {selectedRestaurantForMenu.name}</h4>
                  <button
                    className="admin-restaurants__add-menu-item-btn"
                    onClick={() => {
                      setSelectedMenuItem(null);
                      setShowMenuItemModal(true);
                    }}
                  >
                    Add Menu Item
                  </button>
                </div>

                {/* Search and Pagination Controls */}
                <div className="admin-restaurants__menu-items-controls">
                  <div className="admin-restaurants__search-container">
                    <input
                      type="text"
                      placeholder="Search menu items by name or category..."
                      value={menuItemsFilters.search}
                      onChange={(e) => handleSearchInputChange(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className="admin-restaurants__search-input"
                    />
                    <button
                      onClick={handleMenuItemsSearch}
                      className="admin-restaurants__search-btn"
                      type="button"
                    >
                      Search
                    </button>
                  </div>
                  
                  <div className="admin-restaurants__pagination-info">
                    {menuItemsPagination.total > 0 && (
                      <span className="admin-restaurants__pagination-text">
                        Showing {((menuItemsPagination.page - 1) * menuItemsPagination.limit) + 1} - {Math.min(menuItemsPagination.page * menuItemsPagination.limit, menuItemsPagination.total)} of {menuItemsPagination.total} items
                      </span>
                    )}
                  </div>
                </div>
                
                {menuItemsLoading ? (
                  <div className="admin-restaurants__loading">
                    <LoadingSpinner />
                    <p>Loading menu items...</p>
                  </div>
                ) : (
                  <div className="admin-restaurants__menu-items-list">
                    {menuItems.length === 0 ? (
                      <div className="admin-restaurants__no-menu-items">
                        <p>No menu items found for this restaurant.</p>
                        <p>Click &quot;Add Menu Item&quot; to create the first one!</p>
                      </div>
                    ) : (
                      <div className="admin-restaurants__menu-items-grid">
                        {menuItems.map(item => (
                          <div key={item.id} className={`admin-restaurants__menu-item-card ${!item.available ? 'unavailable' : ''}`}>
                            {!item.available && (
                              <div className="admin-restaurants__unavailable-overlay">
                                <span className="admin-restaurants__unavailable-text">UNAVAILABLE</span>
                              </div>
                            )}
                            <div className="admin-restaurants__menu-item-image">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} />
                              ) : (
                                <div className="admin-restaurants__menu-item-placeholder">
                                  No Image
                                </div>
                              )}
                            </div>
                            <div className="admin-restaurants__menu-item-info">
                              <h5>{item.name}</h5>
                              <p className="admin-restaurants__menu-item-category">{item.category}</p>
                              <p className="admin-restaurants__menu-item-price">${(parseFloat(item.price) || 0).toFixed(2)}</p>
                              <p className="admin-restaurants__menu-item-type">{item.itemType}</p>
                              {item.description && (
                                <p className="admin-restaurants__menu-item-description">{item.description}</p>
                              )}
                            </div>
                            <div className="admin-restaurants__menu-item-actions">
                              <button
                                className="admin-restaurants__btn admin-restaurants__btn--primary"
                                onClick={() => {
                                  setSelectedMenuItem(item);
                                  setShowMenuItemModal(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="admin-restaurants__btn admin-restaurants__btn--delete"
                                onClick={() => {
                                  setSelectedMenuItemToDelete(item);
                                  setShowMenuItemDeleteConfirm(true);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Pagination Controls */}
                {menuItemsPagination.totalPages > 1 && (
                  <div className="admin-restaurants__pagination">
                    <button
                      className="admin-restaurants__pagination-btn"
                      onClick={() => handleMenuItemsPageChange(menuItemsPagination.page - 1)}
                      disabled={menuItemsPagination.page <= 1}
                    >
                      Previous
                    </button>
                    
                    <div className="admin-restaurants__pagination-pages">
                      {Array.from({ length: Math.min(5, menuItemsPagination.totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, menuItemsPagination.page - 2) + i;
                        if (pageNum > menuItemsPagination.totalPages) return null;
                        
                        return (
                          <button
                            key={pageNum}
                            className={`admin-restaurants__pagination-page ${pageNum === menuItemsPagination.page ? 'active' : ''}`}
                            onClick={() => handleMenuItemsPageChange(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      className="admin-restaurants__pagination-btn"
                      onClick={() => handleMenuItemsPageChange(menuItemsPagination.page + 1)}
                      disabled={menuItemsPagination.page >= menuItemsPagination.totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restaurant Details Modal */}
      {showRestaurantModal && selectedRestaurant && (
        <div className="admin-restaurants__overlay" onClick={() => setShowRestaurantModal(false)}>
          <div className="admin-restaurants__modal admin-restaurants__modal--view" onClick={(e) => e.stopPropagation()}>
            <div className="admin-restaurants__modal-header">
              <h2>Restaurant Details</h2>
              <button 
                className="admin-restaurants__modal-close"
                onClick={() => setShowRestaurantModal(false)}
              >
                ×
              </button>
            </div>
            <div className="admin-restaurants__modal-content">
              <div className="admin-restaurants__overview">
                <h3>{selectedRestaurant.name}</h3>
                <p className="admin-restaurants__description">{selectedRestaurant.description}</p>
                
                {(() => {
                  const fb = getFallbackByIdOrName(selectedRestaurant) || {};
                  const categories = selectedRestaurant.type_of_food || selectedRestaurant.typeOfFood || fb.typeOfFood || '';
                  const phone = selectedRestaurant.phone_number || selectedRestaurant.phone || fb.phone || '';
                  const address = selectedRestaurant.address || fb.address || '';
                  const featured = (typeof selectedRestaurant.featured === 'boolean' ? selectedRestaurant.featured : fb.featured) ? 'Yes' : 'No';
                  const kosher = selectedRestaurant.kosher_certification || selectedRestaurant.kosherCertification || (fb.kosherCertification || (selectedRestaurant.kosher_certified ? 'Yes' : '')) || '';
                  const logoRaw = selectedRestaurant.logo_url || selectedRestaurant.logoUrl || fb.logo || '';
                  const logoSrc = /^https?:\/\//i.test(String(logoRaw)) || String(logoRaw).startsWith('/') ? String(logoRaw) : resolveLogoUrl(logoRaw);
                  return (
                    <div className="admin-restaurants__info-grid">
                      <div className="admin-restaurants__info-item">
                        <label>Categories:</label>
                        <span>{categories}</span>
                      </div>
                      <div className="admin-restaurants__info-item">
                        <label>Phone:</label>
                        <span>{formatPhoneNumber(phone)}</span>
                      </div>
                      <div className="admin-restaurants__info-item">
                        <label>Address:</label>
                        <span>{address}</span>
                      </div>
                      <div className="admin-restaurants__info-item">
                        <label>Featured:</label>
                        <span>{featured}</span>
                      </div>
                      <div className="admin-restaurants__info-item">
                        <label>Kosher Certification:</label>
                        <span>{kosher}</span>
                      </div>
                      <div className="admin-restaurants__info-item">
                        <label>Logo URL:</label>
                        <span>{String(logoRaw)}</span>
                      </div>
                      {logoSrc && (
                        <div className="admin-restaurants__info-item">
                          <label>Logo Preview:</label>
                          <span>
                            <img src={logoSrc} alt={`${selectedRestaurant.name} logo`} onError={(e)=>{ e.currentTarget.style.display='none'; }} style={{ width: '92px', height: '92px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff' }} />
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Restaurant Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="admin-restaurants__overlay" onClick={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
        }}>
          <div className="admin-restaurants__modal admin-restaurants__modal--edit" onClick={(e) => e.stopPropagation()}>
            <div className="admin-restaurants__modal-header">
              <h2>{showCreateModal ? 'Add New Restaurant' : 'Edit Restaurant'}</h2>
              <button 
                className="admin-restaurants__modal-close"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
              >
                ×
              </button>
            </div>
            <div className="admin-restaurants__modal-content">
              <form onSubmit={(e) => {
                e.preventDefault();
                if (showCreateModal) {
                  handleCreateRestaurant(formData);
                } else {
                  handleUpdateRestaurant(formData);
                }
              }}>
                <div className="admin-restaurants__form-grid">
                  <div className="admin-restaurants__form-group">
                    <label>Restaurant Name *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="admin-restaurants__form-group">
                    <label>Categories *</label>
                    <input
                      type="text"
                      value={formData.type_of_food || ''}
                      onChange={(e) => setFormData({ ...formData, type_of_food: e.target.value })}
                      required
                    />
                  </div>
                  <div className="admin-restaurants__form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      value={formatPhoneForInput(formData.phone_number)}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                          setFormData({ ...formData, phone_number: value });
                        }
                      }}
                      placeholder="1234567890"
                    />
                  </div>
                  <div className="admin-restaurants__form-group">
                    <label>Address</label>
                    <input
                      type="text"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="admin-restaurants__form-group">
                    <label>Kosher Certification</label>
                    <input
                      type="text"
                      value={formData.kosher_certification || ''}
                      onChange={(e) => setFormData({ ...formData, kosher_certification: e.target.value })}
                      placeholder="e.g., OU, OK, Star-K"
                    />
                  </div>
                  <div className="admin-restaurants__form-group">
                    <label>Logo URL or Filename</label>
                    <input
                      type="text"
                      value={formData.logo_url || ''}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                      placeholder="https://... or filename.png"
                    />
                  </div>
                  <div className="admin-restaurants__form-group admin-restaurants__form-group--full">
                    <label>Or Upload Logo</label>
                    <input type="file" accept="image/*" onChange={async (e) => {
                      const file = e.target.files && e.target.files[0];
                      if (!file) return;
                      const res = await uploadRestaurantLogo(file);
                      if (res?.success && res.data?.originalUrl) {
                        setFormData({ ...formData, logo_url: res.data.originalUrl });
                      }
                    }} />
                  </div>
                  <div className="admin-restaurants__form-group admin-restaurants__form-group--checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.featured || false}
                        onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                      />
                      Featured Restaurant
                    </label>
                  </div>
                  <div className="admin-restaurants__form-group admin-restaurants__form-group--checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.active !== false}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      />
                      Active Restaurant
                    </label>
                  </div>
                  <div className="admin-restaurants__form-group admin-restaurants__form-group--full">
                    <label>Description</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="admin-restaurants__form-actions">
                  <button type="button" onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                  }}>
                    Cancel
                  </button>
                  <button type="submit" className="admin-restaurants__save-btn">
                    {showCreateModal ? 'Create Restaurant' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedRestaurant && (
        <div className="admin-restaurants__overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="admin-restaurants__modal admin-restaurants__modal--delete" onClick={(e) => e.stopPropagation()}>
            <div className="admin-restaurants__modal-header">
              <h2>Confirm Delete</h2>
              <button 
                className="admin-restaurants__modal-close"
                onClick={() => setShowDeleteConfirm(false)}
              >
                ×
              </button>
            </div>
            <div className="admin-restaurants__modal-content">
              <p>
                Are you sure you want to delete <strong>{selectedRestaurant.name}</strong>?
              </p>
              <p className="admin-restaurants__warning">
                This action cannot be undone and will permanently delete the restaurant, all its menu items, and associated data.
              </p>
              <div className="admin-restaurants__form-actions">
                <button type="button" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </button>
                <button className="admin-restaurants__delete-confirm-btn" onClick={handleDeleteRestaurant}>
                  Delete Restaurant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Item Delete Confirmation Modal */}
      {showMenuItemDeleteConfirm && selectedMenuItemToDelete && (
        <div className="admin-restaurants__overlay" onClick={() => setShowMenuItemDeleteConfirm(false)}>
          <div className="admin-restaurants__modal admin-restaurants__modal--delete" onClick={(e) => e.stopPropagation()}>
            <div className="admin-restaurants__modal-header">
              <h2>Confirm Delete</h2>
              <button 
                className="admin-restaurants__modal-close"
                onClick={() => setShowMenuItemDeleteConfirm(false)}
              >
                ×
              </button>
            </div>
            <div className="admin-restaurants__modal-content">
              <p>
                Are you sure you want to delete <strong>{selectedMenuItemToDelete.name}</strong>?
              </p>
              <p className="admin-restaurants__warning">
                This action cannot be undone and will permanently delete this menu item.
              </p>
              <div className="admin-restaurants__form-actions">
                <button type="button" onClick={() => setShowMenuItemDeleteConfirm(false)}>
                  Cancel
                </button>
                <button className="admin-restaurants__delete-confirm-btn" onClick={handleDeleteMenuItem}>
                  Delete Menu Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Item Modal */}
      {showMenuItemModal && selectedRestaurantForMenu && (
        <MenuItemModal
          isOpen={showMenuItemModal}
          onClose={() => {
            setShowMenuItemModal(false);
            setSelectedMenuItem(null);
          }}
          restaurant={selectedRestaurantForMenu}
          menuItem={selectedMenuItem}
          onSave={(savedMenuItem) => {
            showNotification(`Menu item "${savedMenuItem.name}" ${selectedMenuItem ? 'updated' : 'created'} successfully`, 'success');
            
            // Refresh menu items list
            if (selectedRestaurantForMenu) {
              fetchMenuItems(selectedRestaurantForMenu.id);
            }
          }}
        />
      )}
      
      {/* Notification Toast */}
      <NotificationToast 
        notification={notification} 
        onClose={hideNotification} 
      />
    </div>
  );
};

export default AdminRestaurants; 