import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useNavigateWithScroll } from "../../hooks/useNavigateWithScroll";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../context/CartContext";
import AddressModal from "../AddressModal/AddressModal";
import AddressManagementModal from "../AddressManagementModal/AddressManagementModal";

import "./Header.scss";
import logoImg from "../../assets/navyMKDLogo.png";
import logoIcon from "../../assets/navyMKDIcon.png";
import { useMenu } from "../../context/menuContextShared.jsx";

const Header = () => {
  const { isMobileMenuOpen, toggleMobileMenu } = useMenu();
  const { user, getCurrentAddress, signOut, profile, selectAddress } = useAuth();
  const { getCartItemCount } = useCart();
  const navigate = useNavigateWithScroll();
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  const searchData = {
    restaurants: [
      { name: 'Bagel Boys', type: 'Bagels, Breakfast Eats, Dairy', url: '/restaurant/bagel-boys' },
      { name: 'The Cheese Store', type: 'Cheese, Coffee, Dairy', url: '/restaurant/the-cheese-store' },
      { name: 'Stop Chop & Roll', type: 'Sushi', url: '/restaurant/stop-chop-and-roll' },
      { name: 'Five Fifty', type: 'Premium Prepared Food, Meat', url: '/restaurant/five-fifty' },
      { name: 'Graze Smokehouse', type: 'BBQ, Smokehouse, Jerky, Meat', url: '/restaurant/graze-smokehouse' },
      { name: 'Mazza & More', type: 'Israeli Food, Meat', url: '/restaurant/mazza-and-more' },
      { name: 'Ruthy\'s Grocery & Deli', type: 'Israeli Food, Meat', url: '/restaurant/ruthys-grocery-and-deli' },
      { name: 'Spruce D\'Vine', type: 'Wine and Spirits, Alcohol', url: '/restaurant/spruce-dvine' },
      { name: 'Traditions Eatery', type: 'Deli, Meat', url: '/restaurant/traditions-eatery' },
      { name: 'Oh! Nuts', type: 'Nuts, Chocolates, Candy', url: '/restaurant/oh-nuts' },
      { name: 'Alan\'s Bakery', type: 'Bakery', url: '/restaurant/alans-bakery' },
      { name: 'Central Perk Cafe', type: 'Breakfast and Brunch Cafe, Dairy', url: '/restaurant/central-perk-cafe' }
    ],
    faqs: [
      { question: 'What is My Kosher Delivery?', url: '/faq' },
      { question: 'How can I order?', url: '/faq' },
      { question: 'What if you don\'t deliver to my area?', url: '/faq' },
      { question: 'When is the latest I can order?', url: '/faq' },
      { question: 'How will I know when my delivery will arrive?', url: '/faq' }
    ],
    blogs: [
      { title: 'The Rise of Kosher Ghost Kitchens: A New Trend?', url: '/blog/rise-of-kosher-ghost-kitchens' },
      { title: 'The Most Anticipated Kosher Food Festivals in 2025', url: '/blog/kosher-food-festivals-2025' },
      { title: 'Finding Kosher Food While Traveling', url: '/blog/finding-kosher-food-while-traveling' },
      { title: 'Kosher Meals for Busy Weeknights', url: '/blog/kosher-meals-for-busy-weeknights' },
      { title: 'The Future of Kosher Food', url: '/blog/future-of-kosher-food' }
    ]
  };

  const performSearch = (term) => {
    if (!term || term.length < 2) return [];
    
    const results = [];
    const searchTerm = term.toLowerCase();
    
    searchData.restaurants.forEach(restaurant => {
      if (restaurant.name.toLowerCase().includes(searchTerm) || 
          restaurant.type.toLowerCase().includes(searchTerm)) {
        results.push({ ...restaurant, category: 'restaurant' });
      }
    });
    
    searchData.faqs.forEach(faq => {
      if (faq.question.toLowerCase().includes(searchTerm)) {
        results.push({ ...faq, category: 'faq' });
      }
    });
    
    searchData.blogs.forEach(blog => {
      if (blog.title.toLowerCase().includes(searchTerm)) {
        results.push({ ...blog, category: 'blog' });
      }
    });
    
    return results.slice(0, 10);
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (term.length >= 2) {
      setShowSearchDropdown(true);
    } else {
      setShowSearchDropdown(false);
    }
  };

  const handleSearchResultClick = (result) => {
    console.log('🔍 Search result clicked:', result);
    
    setSearchTerm('');
    setShowSearchDropdown(false);
    
    navigate(result.url);
  };

  const extractAddressData = (address) => {
    if (!address) return null;
    
    let addressData = address;
    if (address?.address && typeof address.address === 'object') {
      addressData = address.address;
    }
    
    const street = addressData?.street || addressData?.address_line_1 || addressData?.line1 || addressData?.street_address || 'Unknown Street';
    const apartment = addressData?.apartment || addressData?.address_line_2 || addressData?.line2 || addressData?.unit || addressData?.apt;
    const city = addressData?.city || addressData?.locality || 'Unknown City';
    const state = addressData?.state || addressData?.region || addressData?.province || 'Unknown State';
    const zipCode = addressData?.zip_code || addressData?.postal_code || addressData?.zip || 'Unknown ZIP';
    
    return {
      street,
      apartment,
      city,
      state,
      zipCode,
      id: address.id,
      is_primary: address.is_primary
    };
  };

  const savedAddresses = (profile?.addresses || []).map((address, index) => {
    if (address.id) {
      return address;
    }
    
    const streetPart = (address.street || address.address?.street || 'unknown').replace(/\s+/g, '_').toLowerCase();
    const cityPart = (address.city || address.address?.city || 'city').replace(/\s+/g, '_').toLowerCase();
    
    return {
      ...address,
      id: `addr_${index}_${streetPart}_${cityPart}`,
    };
  });

  const toggleLocationDropdown = () => {
    setIsLocationDropdownOpen(!isLocationDropdownOpen);
  };

  const handleSignOut = async () => {
    await signOut(() => navigate('/landing'));
  };

  const handleAddAddress = () => {
    setIsAddressModalOpen(true);
    setIsLocationDropdownOpen(false);
  };

  const handleManageAddresses = () => {
    setIsManageModalOpen(true);
    setIsLocationDropdownOpen(false);
  };

  const handleAddressSelect = (address) => {
    selectAddress(address);
    setIsLocationDropdownOpen(false);
  };

  const handleCartClick = () => {
    navigate('/cart');
  };

  const formatCurrentAddress = () => {
    const address = getCurrentAddress();
    
    if (!address) return "Enter your address";
    
    if (typeof address === 'string') {
      return address.length > 30 ? address.substring(0, 30) + "..." : address;
    }
    
    if (typeof address === 'object' && address !== null) {
      const parts = [];
      
      if (address.street) parts.push(address.street);
      if (address.apartment) parts.push(address.apartment);
      if (address.city) parts.push(address.city);
      if (address.state) parts.push(address.state);
      if (address.zip_code) parts.push(address.zip_code);
      
      if (parts.length > 0) {
        const fullAddress = parts.join(', ');
        return fullAddress.length > 30 ? fullAddress.substring(0, 30) + "..." : fullAddress;
      }
      
      if (address.street) {
        return address.street.length > 30 ? address.street.substring(0, 30) + "..." : address.street;
      }
      
      const addressString = address.address || address.description || address.formatted_address;
      if (addressString && typeof addressString === 'string') {
        return addressString.length > 30 ? addressString.substring(0, 30) + "..." : addressString;
      }
    }
    
    return "Enter your address";
  };

  const getFullCurrentAddress = () => {
    const address = getCurrentAddress();
    
    if (!address) return "No address selected";
    
    if (typeof address === 'string') {
      return address;
    }
    
    if (typeof address === 'object' && address !== null) {
      const parts = [];
      if (address.street) parts.push(address.street);
      if (address.apartment) parts.push(address.apartment);
      if (address.city) parts.push(address.city);
      if (address.state) parts.push(address.state);
      if (address.zip_code) parts.push(address.zip_code);
      
      if (parts.length > 0) {
        return parts.join(', ');
      }
      
      return address.address || address.description || address.formatted_address || "Address available";
    }
    
    return "No address selected";
  };

  const currentAddress = formatCurrentAddress();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsLocationDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleSearchClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    };

    if (showSearchDropdown) {
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleSearchClickOutside);
      }, 300);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleSearchClickOutside);
      };
    }
  }, [showSearchDropdown]);

  return (
    <>
      <header className="header">
        <div className="header-container">
          <div className="hamburger-menu">
            <button
              className={`hamburger-button ${isMobileMenuOpen ? "active" : ""}`}
              onClick={toggleMobileMenu}
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="#061757"
                  d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
                />
              </svg>
            </button>
          </div>

          <div className="header-left">
            <Link to="/home" className="logo">
              <img
                className="logo-full"
                src={logoImg}
                alt="MyKosherDelivery Logo"
              />
              <img
                className="logo-icon"
                src={logoIcon}
                alt="MyKosherDelivery Icon"
              />
            </Link>
          </div>

          <div className="search-container" ref={searchRef}>
            <div className="search-icon">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="#767676"
                  d="M10 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"
                />
                <path
                  fill="#767676"
                  d="M20 20l-4-4"
                  strokeWidth="2"
                  stroke="#767676"
                />
              </svg>
            </div>
            <input 
              type="text" 
              placeholder="Search MyKosherDelivery" 
              value={searchTerm}
              onChange={handleSearchChange}
              aria-label="Search for restaurants and food"
            />
            
            {}
            {showSearchDropdown && (
              <div className="search-dropdown">
                {performSearch(searchTerm).map((result, index) => (
                  <button
                    key={index}
                    className="search-result"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSearchResultClick(result);
                    }}
                    type="button"
                  >
                    {result.category === 'restaurant' && (
                      <>
                        <div className="search-result-header">
                          <span className="search-result-title">{result.name}</span>
                        </div>
                        <span className="search-result-subtitle">{result.type}</span>
                      </>
                    )}
                    {result.category === 'faq' && (
                      <>
                        <div className="search-result-header">
                          <span className="search-result-title">{result.question}</span>
                        </div>
                        <span className="search-result-subtitle">FAQ</span>
                      </>
                    )}
                    {result.category === 'blog' && (
                      <>
                        <div className="search-result-header">
                          <span className="search-result-title">{result.title}</span>
                        </div>
                        <span className="search-result-subtitle">Blog Post</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="header-right">
            <div
              className={`location-button ${isLocationDropdownOpen ? 'dropdown-open' : ''}`}
              onClick={toggleLocationDropdown}
              ref={dropdownRef}
              data-address={currentAddress}
              title={getFullCurrentAddress()}
              role="button"
              tabIndex="0"
              aria-label={`Change delivery address: ${currentAddress}`}
              aria-expanded={isLocationDropdownOpen}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleLocationDropdown();
                }
              }}
            >
              <div className="location-icon">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path
                    fill="#061757"
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                  />
                </svg>
              </div>
              <span className="address-text">{currentAddress}</span>
              <div className="chevron-icon">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    fill="#061757"
                    d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"
                  />
                </svg>
              </div>

              {isLocationDropdownOpen && (
                <div className="location-dropdown">
                  <div className="dropdown-header">
                    <h3>Delivery address</h3>
                  </div>
                  <div className="dropdown-content">
                    {getCurrentAddress() ? (
                      <div className="current-location">
                        <div className="location-marker">
                          <svg viewBox="0 0 24 24" width="20" height="20">
                            <path
                              fill="#5fb4f9"
                              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                            />
                          </svg>
                        </div>
                        <div className="address-details">
                          <p className="address-label">Current delivery address</p>
                          {typeof getCurrentAddress() === 'string' ? (
                            <p className="address-line">{getCurrentAddress()}</p>
                          ) : getCurrentAddress() ? (
                            (() => {
                              const currentAddressData = extractAddressData(getCurrentAddress());
                              return currentAddressData ? (
                                <>
                                  <p className="address-line">
                                    {currentAddressData.street}
                                    {currentAddressData.apartment && `, ${currentAddressData.apartment}`}
                                  </p>
                                  <p className="address-city">
                                    {currentAddressData.city}, {currentAddressData.state} {currentAddressData.zipCode}
                                  </p>
                                </>
                              ) : (
                                <p className="address-line">Invalid address data</p>
                              );
                            })()
                          ) : (
                            <p className="address-line">No address selected</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="no-address">
                        <p>No delivery address selected</p>
                      </div>
                    )}

                    {}
                    {savedAddresses.length > 0 && (
                      <div className="saved-addresses">
                        <h4>Your addresses:</h4>
                        {savedAddresses.map((address) => {
                          const addressData = extractAddressData(address);
                          if (!addressData) return null;
                          
                          return (
                            <div 
                              key={address.id}
                              className={`saved-address-item`}
                              onClick={() => handleAddressSelect(address)}
                              title={`${addressData.street}${addressData.apartment ? `, ${addressData.apartment}` : ''}, ${addressData.city}, ${addressData.state} ${addressData.zipCode}`}
                            >
                              <div className="address-info">
                                <div className="address-label">
                                  {addressData.street}
                                </div>
                                <div className="address-text">
                                  {addressData.apartment && `${addressData.apartment}, `}
                                  {addressData.city}, {addressData.state} {addressData.zipCode}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {user ? (
                      <>
                        <button className="add-address-btn" onClick={handleAddAddress}>
                          Add address
                        </button>
                        {profile?.addresses?.length > 0 && (
                          <button className="manage-address-btn" onClick={handleManageAddresses}>
                            Manage addresses
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {getCurrentAddress() && (
                          <button 
                            className="edit-address-btn"
                            onClick={() => {
                              setIsAddressModalOpen(true);
                              setIsLocationDropdownOpen(false);
                            }}
                          >
                            Edit address
                          </button>
                        )}
                        <Link to="/signin" className="add-address-btn">
                          Sign in to save addresses
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div 
              className="cart-button"
              role="button"
              tabIndex="0"
              aria-label={`View shopping cart (${getCartItemCount()} items)`}
              title="View shopping cart"
              onClick={handleCartClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCartClick();
                }
              }}
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="#061757"
                  d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"
                />
              </svg>
              <span className="cart-count">{getCartItemCount()}</span>
            </div>

            {user ? (
              <button onClick={handleSignOut} className="sign-out-button">
                Sign Out
              </button>
            ) : (
              <>
                <Link to="/signin" className="sign-in-button">
                  Sign In
                </Link>
                <Link to="/signup" className="sign-up-button">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <AddressModal 
        isOpen={isAddressModalOpen} 
        onClose={() => setIsAddressModalOpen(false)} 
      />
      
      <AddressManagementModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
      />
    </>
  );
  };

export default Header; 