import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import "./Header.scss";
import logoIcon from "../../assets/navyMKDIcon.png";
import { useMenu } from "../../context/menuContextShared.jsx";
import { useAuth } from "../../hooks/useAuth";
import AddressManagementModal from "../AddressManagementModal/AddressManagementModal";
import TempAddressModal from "../TempAddressModal/TempAddressModal";

const Header = () => {
  const { isMobileMenuOpen, toggleMobileMenu } = useMenu();
  const { user, profile, getCurrentAddress, selectAddress } = useAuth();
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showTempAddressModal, setShowTempAddressModal] = useState(false);
  const dropdownRef = useRef(null);

  const currentAddress = getCurrentAddress();
  // Ensure all addresses have IDs using consistent generation
  const savedAddresses = (profile?.addresses || []).map((address, index) => {
    if (address.id) {
      return address; // Already has an ID
    }
    
    // Generate a consistent ID based on address content
    const streetPart = (address.street || address.address?.street || 'unknown').replace(/\s+/g, '_').toLowerCase();
    const cityPart = (address.city || address.address?.city || 'city').replace(/\s+/g, '_').toLowerCase();
    
    return {
      ...address,
      id: `addr_${index}_${streetPart}_${cityPart}`,
    };
  });

  const extractAddressData = (address) => {
    if (!address) return null;
    
    // Handle nested structure
    let addressData = address;
    if (address?.address && typeof address.address === 'object') {
      addressData = address.address;
    }
    
    // Try different field name variations
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

  const toggleLocationDropdown = () => {
    setIsLocationDropdownOpen(!isLocationDropdownOpen);
  };

  const handleAddressSelect = (address) => {
    selectAddress(address);
    setIsLocationDropdownOpen(false);
  };

  const formatCurrentAddress = () => {
    // Get fresh address data on each call to prevent stale state
    const address = getCurrentAddress();
    
    if (!address) return "Enter delivery address";
    
    // Handle string addresses (temp addresses)
    if (typeof address === 'string') {
      return address.length > 30 ? address.substring(0, 30) + "..." : address;
    }
    
    // Handle object addresses - ensure we always return a string
    if (typeof address === 'object' && address !== null) {
      const parts = [];
      
      // Extract address parts safely
      if (address.street) parts.push(address.street);
      if (address.apartment) parts.push(address.apartment);
      if (address.city) parts.push(address.city);
      if (address.state) parts.push(address.state);
      if (address.zip_code) parts.push(address.zip_code);
      
      // If we have parts, join them
      if (parts.length > 0) {
        const fullAddress = parts.join(', ');
        return fullAddress.length > 30 ? fullAddress.substring(0, 30) + "..." : fullAddress;
      }
      
      // If no standard parts found, try to get street directly
      if (address.address && typeof address.address === 'object') {
        const nestedAddress = address.address;
        const nestedParts = [];
        
        if (nestedAddress.street) nestedParts.push(nestedAddress.street);
        if (nestedAddress.city) nestedParts.push(nestedAddress.city);
        if (nestedAddress.state) nestedParts.push(nestedAddress.state);
        
        if (nestedParts.length > 0) {
          const fullAddress = nestedParts.join(', ');
          return fullAddress.length > 30 ? fullAddress.substring(0, 30) + "..." : fullAddress;
      }
    }
    }
    
    return "Enter delivery address";
  };

  const getFullCurrentAddress = () => {
    const address = getCurrentAddress();
    
    if (!address) return "No delivery address selected";
    
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
      
      if (address.address && typeof address.address === 'object') {
        const nestedAddress = address.address;
        const nestedParts = [];
        
        if (nestedAddress.street) nestedParts.push(nestedAddress.street);
        if (nestedAddress.city) nestedParts.push(nestedAddress.city);
        if (nestedAddress.state) nestedParts.push(nestedAddress.state);
        
        if (nestedParts.length > 0) {
          return nestedParts.join(', ');
        }
      }
    }
    
    return "No delivery address selected";
  };

  // Close location dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsLocationDropdownOpen(false);
    }
  };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
    <header className="header">
        <div className="header-left">
          <Link to="/" className="logo-link">
            <img
              className="logo-icon"
              src={logoIcon}
              alt="MyKosherDelivery Icon"
            />
          </Link>
        </div>

        <div className="search-container">
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
          />
        </div>

        <div className="header-right">
          <div
            className="location-button"
            onClick={toggleLocationDropdown}
            ref={dropdownRef}
            title={getFullCurrentAddress()}
          >
            <div className="location-icon">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="#061757"
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                />
              </svg>
            </div>
            <span>{formatCurrentAddress()}</span>
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
                  {currentAddress ? (
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
                        {typeof currentAddress === 'string' ? (
                          <p className="address-line">{currentAddress}</p>
                        ) : currentAddress ? (
                          (() => {
                            const currentAddressData = extractAddressData(currentAddress);
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
                          <p className="address-line">No delivery address selected</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="no-address">
                      <p>No delivery address selected</p>
                    </div>
                  )}

                  {/* Show all saved addresses for easy selection */}
                  {savedAddresses.length > 0 && (
                    <div className="saved-addresses">
                      <h4>Saved addresses</h4>
                      {savedAddresses.map((address, index) => {
                        const addressData = extractAddressData(address);
                        if (!addressData) return null;
                        
                        return (
                          <div 
                            key={address.id || index}
                            className={`saved-address ${address.is_primary ? 'primary' : ''}`}
                            onClick={() => handleAddressSelect(address)}
                          >
                            <div className="address-info">
                              <p className="street">
                                {addressData.street}
                                {addressData.apartment && `, ${addressData.apartment}`}
                              </p>
                              <p className="city-state">
                                {addressData.city}, {addressData.state} {addressData.zipCode}
                              </p>
                            </div>
                            {address.is_primary && (
                              <div className="primary-badge">Primary</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  <div className="dropdown-actions">
                      <button 
                      className="manage-addresses-btn"
                        onClick={() => {
                          setShowAddressModal(true);
                          setIsLocationDropdownOpen(false);
                        }}
                      >
                      Manage Addresses
                      </button>
                        <button 
                      className="add-temp-address-btn"
                          onClick={() => {
                            setShowTempAddressModal(true);
                            setIsLocationDropdownOpen(false);
                          }}
                        >
                      Add Temporary Address
                        </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="user-section">
          {user ? (
              <Link to="/account" className="user-avatar">
                <div className="avatar-circle">
                  {profile?.firstName ? profile.firstName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
            </div>
              </Link>
          ) : (
              <Link to="/auth" className="auth-link">
                Sign In
              </Link>
            )}
          </div>

          <button
            className={`mobile-menu-toggle ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      {/* Modals */}
      {showAddressModal && (
      <AddressManagementModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />
      )}

      {showTempAddressModal && (
      <TempAddressModal
        isOpen={showTempAddressModal}
        onClose={() => setShowTempAddressModal(false)}
      />
      )}
    </>
  );
};

export default Header;
