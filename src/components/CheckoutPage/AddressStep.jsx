import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import PropTypes from "prop-types";
import { useAuth } from "../../hooks/useAuth";
import { validateDeliveryAddress } from "../../services/addressValidationService";
import AddressConfirmationModal from "./AddressConfirmationModal";

const AddressStep = ({ onNext }) => {
  const { profile } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedAddressForConfirm, setSelectedAddressForConfirm] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [formData, setFormData] = useState({
    type: "",
    address: "",
    apartment: ""
  });

  const savedAddresses = profile?.addresses || [];

  const handleAddressSelect = (address) => {
    setSelectedAddressForConfirm(address);
    setShowConfirmModal(true);
  };

  const handleConfirmAddress = (address) => {
    onNext(address);
  };

  const parseAddress = (addressString, validationResult) => {
    // Try to extract components from the formatted address
    const address = addressString || "";
    
    // Extract zip code first (most reliable)
    const zipMatch = address.match(/\b(\d{5}(?:-\d{4})?)\b/);
    const zip_code = zipMatch ? zipMatch[1] : (validationResult?.zipCode || "");
    
    // Extract state (2-letter code before zip)
    const stateMatch = address.match(/\b([A-Z]{2})\s+\d{5}/);
    const state = stateMatch ? stateMatch[1] : "";
    
    // Split by comma and try to parse
    const parts = address.split(',').map(p => p.trim()).filter(p => p);
    
    let street = "";
    let city = "";
    
    if (parts.length >= 3) {
      // Format: "Street, City, State ZIP"
      street = parts[0];
      city = parts[1];
    } else if (parts.length === 2) {
      // Format: "Street, City State ZIP" or "Street, City"
      street = parts[0];
      const cityStateZip = parts[1];
      // Try to extract city (everything before state)
      const cityMatch = cityStateZip.match(/^(.+?)\s+[A-Z]{2}\s+\d{5}/);
      city = cityMatch ? cityMatch[1].trim() : cityStateZip.replace(/\s+[A-Z]{2}\s+\d{5}.*$/, '').trim();
    } else if (parts.length === 1) {
      // Single part - might be just street or full address
      street = parts[0].replace(/\s+[A-Z]{2}\s+\d{5}.*$/, '').trim();
    }
    
    // Fallback: use original address if parsing fails
    if (!street && address) {
      street = address.replace(/,\s*[^,]+,\s*[A-Z]{2}\s+\d{5}.*$/, '').trim() || address;
    }
    
    return {
      street: street || formData.address.trim(),
      city: city || "",
      state: state || "",
      zip_code: zip_code || ""
    };
  };

  const handleAddNewAddress = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!formData.address.trim()) {
      setAddressError("Please enter a delivery address");
      return;
    }

    if (isValidating) {
      return;
    }

    setIsValidating(true);
    setAddressError("");

    try {
      const validation = await validateDeliveryAddress(formData.address.trim());
      
      if (validation.isValid) {
        const validatedAddress = validation.formattedAddress || formData.address.trim();
        const parsed = parseAddress(validatedAddress, validation);

        const newAddress = {
          id: Date.now().toString(),
          type: formData.type || "New Address",
          address: validatedAddress,
          street: parsed.street,
          apartment: formData.apartment.trim().substring(0, 20), // Limit to 20 chars
          city: parsed.city,
          state: parsed.state,
          zip_code: parsed.zip_code,
          zone: validation.zone
        };
        onNext(newAddress);
      } else {
        // Show the specific validation error
        const errorMessage = validation.error || "Sorry, we don't deliver to this area yet. Please try a different address.";
        setAddressError(errorMessage);
      }
    } catch (error) {
      console.error("Address validation error:", error);
      // Provide more specific error message
      const errorMessage = error.message || "Unable to validate address. Please check your connection and try again.";
      setAddressError(errorMessage);
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewAddress(e);
    }
  };

  return (
    <div className="address-step">
      <div className="step-header">
        <h2 className="step-title">
          Delivery Address
        </h2>
        <p className="step-description">
          Choose where you&apos;d like your order delivered
        </p>
      </div>

      <div className="addresses-list">
        {}
        {savedAddresses.map((address) => (
          <div
            key={address.id}
            className="address-card"
            onClick={() => handleAddressSelect(address)}
          >
            <div className="address-content">
              <div className="address-row">
                <MapPin className="address-icon" />
                <div className="address-info">
                  <span className="address-type">
                    {address.label || address.type || "Address"}
                  </span>
                  {address.is_primary && (
                    <span className="primary-badge">
                      Primary
                    </span>
                  )}
                  <span className="address-text">
                    {`${address.street || ''}${address.apartment ? `, ${address.apartment}` : ''}, ${address.city || ''}, ${address.state || ''} ${address.zip_code || ''}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!showAddForm ? (
        <button
          className="add-address-button"
          onClick={() => {
            setShowAddForm(true);
            setAddressError("");
            setFormData({
              type: "",
              address: "",
              apartment: ""
            });
          }}
        >
          <Plus className="plus-icon" />
          Add New Address
        </button>
      ) : (
        <div className="add-address-form">
          <form className="form-card" onSubmit={handleAddNewAddress}>
            <h3 className="form-title">Add New Address</h3>
            
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="address-type" className="form-label">Address Type</label>
                <input
                  id="address-type"
                  className="form-input"
                  placeholder="Home, Work, etc."
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('address')?.focus();
                    }
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="address" className="form-label">
                Full Address *
                <span className="label-hint">(Street, City, State, ZIP Code)</span>
              </label>
              <input
                id="address"
                className={`form-input ${addressError ? 'error' : ''}`}
                placeholder="Enter complete address: 123 Main St, New York, NY 10001"
                value={formData.address}
                onChange={(e) => {
                  setFormData({ ...formData, address: e.target.value });
                  if (addressError) setAddressError("");
                }}
                onKeyDown={handleKeyDown}
                required
                disabled={isValidating}
              />
              {addressError ? (
                <p className="error-text">
                  {addressError}
                </p>
              ) : (
                <p className="form-hint">
                  Please include street address, city, state, and ZIP code
                </p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="apartment" className="form-label">
                Apartment / Unit Number (Optional)
                <span className="label-hint">(Max 20 characters)</span>
              </label>
              <input
                id="apartment"
                className="form-input"
                placeholder="Apt 4B, Unit 302, etc."
                value={formData.apartment}
                onChange={(e) => {
                  const value = e.target.value.substring(0, 20);
                  setFormData({ ...formData, apartment: value });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!isValidating) {
                      handleAddNewAddress(e);
                    }
                  }
                }}
                maxLength={20}
                disabled={isValidating}
              />
              <p className="form-hint">
                For delivery instructions, use the next step
              </p>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="submit-button"
                disabled={!formData.address.trim() || isValidating}
              >
                {isValidating ? 'Validating...' : 'Use This Address'}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setShowAddForm(false);
                  setAddressError("");
                  setFormData({
                    type: "",
                    address: "",
                    apartment: ""
                  });
                }}
                disabled={isValidating}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <AddressConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        address={selectedAddressForConfirm}
        onConfirm={handleConfirmAddress}
      />
    </div>
  );
};

AddressStep.propTypes = {
  onNext: PropTypes.func.isRequired,
};

export default AddressStep; 