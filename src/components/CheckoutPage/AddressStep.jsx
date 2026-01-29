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
    details: ""
  });

  const savedAddresses = profile?.addresses || [];

  const handleAddressSelect = (address) => {
    setSelectedAddressForConfirm(address);
    setShowConfirmModal(true);
  };

  const handleConfirmAddress = (address) => {
    onNext(address);
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
        
        const addressParts = validatedAddress.split(',').map(part => part.trim());
        const street = addressParts[0] || formData.address.trim();
        const city = addressParts[1] || "";
        const stateZip = addressParts[2] || "";
        const stateZipMatch = stateZip.match(/^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/);
        const state = stateZipMatch ? stateZipMatch[1] : "";
        const zip_code = stateZipMatch ? stateZipMatch[2] : (validation.zipCode || "");

        const newAddress = {
          id: Date.now().toString(),
          type: formData.type || "New Address",
          address: validatedAddress,
          details: formData.details,
          street: street,
          apartment: formData.details,
          city: city,
          state: state,
          zip_code: zip_code,
          zone: validation.zone
        };
        onNext(newAddress);
      } else {
        setAddressError(validation.error || "Sorry, we don't deliver to this area yet. Please try a different address.");
      }
    } catch (error) {
      console.error("Address validation error:", error);
      setAddressError("Unable to validate address. Please try again or enter a different address.");
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
          onClick={() => setShowAddForm(true)}
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
              <label htmlFor="address" className="form-label">Street Address</label>
              <input
                id="address"
                className={`form-input ${addressError ? 'error' : ''}`}
                placeholder="Enter your address"
                value={formData.address}
                onChange={(e) => {
                  setFormData({ ...formData, address: e.target.value });
                  if (addressError) setAddressError("");
                }}
                onKeyDown={handleKeyDown}
                required
              />
              {addressError && (
                <p className="error-text">
                  {addressError}
                </p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="details" className="form-label">Additional Details (Optional)</label>
              <textarea
                id="details"
                className="form-textarea"
                placeholder="Apartment, suite, building instructions..."
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddNewAddress(e);
                  }
                }}
                rows={2}
              />
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
                onClick={() => setShowAddForm(false)}
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