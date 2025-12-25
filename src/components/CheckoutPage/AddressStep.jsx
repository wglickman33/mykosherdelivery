import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import PropTypes from "prop-types";
import { useAuth } from "../../hooks/useAuth";
import AddressConfirmationModal from "./AddressConfirmationModal";

const AddressStep = ({ onNext }) => {
  const { profile } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedAddressForConfirm, setSelectedAddressForConfirm] = useState(null);
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

  const handleAddNewAddress = () => {
    if (formData.address) {
      const newAddress = {
        id: Date.now().toString(),
        type: formData.type || "New Address",
        address: formData.address,
        details: formData.details,
        street: formData.address,
        apartment: formData.details,
        city: "",
        state: "",
        zip_code: ""
      };
      onNext(newAddress);
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
          <div className="form-card">
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
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="address" className="form-label">Street Address</label>
              <input
                id="address"
                className="form-input"
                placeholder="Enter your address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="details" className="form-label">Additional Details (Optional)</label>
              <textarea
                id="details"
                className="form-textarea"
                placeholder="Apartment, suite, building instructions..."
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                rows={2}
              />
            </div>

            <div className="form-actions">
              <button
                className="submit-button"
                onClick={handleAddNewAddress}
                disabled={!formData.address}
              >
                Use This Address
              </button>
              <button
                className="cancel-button"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
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