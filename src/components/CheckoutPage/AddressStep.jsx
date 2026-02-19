import { useState, useCallback } from "react";
import { MapPin, Plus } from "lucide-react";
import PropTypes from "prop-types";
import { useAuth } from "../../hooks/useAuth";
import { validateDeliveryAddress } from "../../services/addressValidationService";
import AddressConfirmationModal from "./AddressConfirmationModal";

/**
 * Parse a pasted full-address string into street, city, state, zip.
 * Handles: "630 w 254th st Bronx NY 10471", "123 Main St, New York, NY 10001", etc.
 */
const parsePastedAddress = (str) => {
  const s = (str || "").trim();
  if (!s) return null;

  const zipMatch = s.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip_code = zipMatch ? zipMatch[1].slice(0, 5) : "";

  const stateMatch = s.match(/\b([A-Za-z]{2})\s*\d{5}/);
  const state = stateMatch ? stateMatch[1].toUpperCase() : "";

  if (!zip_code) return null;

  let withoutZip = s.replace(/\s*\d{5}(?:-\d{4})?\s*$/, "").trim();
  let withoutStateZip = state ? withoutZip.replace(new RegExp(`\\s*${state}\\s*$`, "i"), "").trim() : withoutZip;

  const parts = withoutStateZip.split(",").map((p) => p.trim()).filter(Boolean);
  let street = "";
  let city = "";

  if (parts.length >= 2) {
    street = parts[0];
    city = parts.slice(1).join(" ").trim();
  } else if (parts.length === 1) {
    const tokens = parts[0].split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      city = tokens[tokens.length - 1];
      street = tokens.slice(0, -1).join(" ");
    } else {
      street = parts[0];
    }
  }

  return { street: street.trim(), city: city.trim(), state, zip_code };
};

const AddressStep = ({ onNext }) => {
  const { user, profile } = useAuth();
  const isGuest = !user;
  const [showAddForm, setShowAddForm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedAddressForConfirm, setSelectedAddressForConfirm] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formData, setFormData] = useState({
    type: "",
    street: "",
    city: "",
    state: "",
    zip_code: "",
    apartment: "",
    pasteField: ""
  });

  const savedAddresses = profile?.addresses || [];

  const handleAddressSelect = (address) => {
    setSelectedAddressForConfirm(address);
    setShowConfirmModal(true);
  };

  const handleConfirmAddress = (address) => {
    onNext(address);
  };

  const handlePastedAddress = useCallback((pastedText) => {
    const text = (pastedText || "").trim();
    if (!text || text.length < 10) return false;

    const parsed = parsePastedAddress(text);
    if (parsed && parsed.zip_code && parsed.street) {
      setFormData((prev) => ({
        ...prev,
        street: prev.street || parsed.street,
        city: prev.city || parsed.city,
        state: prev.state || parsed.state,
        zip_code: prev.zip_code || parsed.zip_code,
        pasteField: ""
      }));
      setFieldErrors({});
      return true;
    }
    return false;
  }, []);

  const handlePasteFieldPaste = useCallback((e) => {
    const text = e.clipboardData?.getData?.("text/plain") || "";
    if (handlePastedAddress(text)) {
      e.preventDefault();
    }
  }, [handlePastedAddress]);

  const validateFields = () => {
    const errs = {};
    const street = formData.street.trim();
    const city = formData.city.trim();
    const state = formData.state.trim().toUpperCase();
    const zip = formData.zip_code.replace(/\D/g, "").slice(0, 5);

    if (!street) {
      errs.street = "Street address is required";
    } else if (street.length < 4) {
      errs.street = "Please enter a complete street address";
    }

    if (!city) {
      errs.city = "City is required";
    } else if (city.length < 2) {
      errs.city = "Please enter a valid city name";
    }

    if (!state) {
      errs.state = "State is required";
    } else if (!/^[A-Za-z]{2}$/.test(state)) {
      errs.state = "Enter 2-letter state (e.g. NY)";
    }

    if (!zip) {
      errs.zip_code = "ZIP code is required";
    } else if (zip.length !== 5) {
      errs.zip_code = "ZIP must be 5 digits";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddNewAddress = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!validateFields()) {
      setAddressError("Please fill in all required fields correctly.");
      return;
    }

    if (isValidating) return;

    const street = formData.street.trim();
    const city = formData.city.trim();
    const state = formData.state.trim().toUpperCase().slice(0, 2);
    const zip_code = formData.zip_code.replace(/\D/g, "").slice(0, 5);
    const addressString = `${street}, ${city}, ${state} ${zip_code}`;

    setIsValidating(true);
    setAddressError("");
    setFieldErrors({});

    try {
      const validation = await validateDeliveryAddress(addressString);

      if (validation.isValid) {
        const newAddress = {
          id: Date.now().toString(),
          type: formData.type || "New Address",
          address: validation.formattedAddress || addressString,
          street,
          apartment: formData.apartment.trim().substring(0, 20),
          city,
          state,
          zip_code,
          zone: validation.zone
        };
        onNext(newAddress);
      } else {
        setAddressError(validation.error || "Sorry, we don't deliver to this area yet. Please try a different address.");
      }
    } catch (error) {
      console.error("Address validation error:", error);
      setAddressError(error.message || "Unable to validate address. Please check your connection and try again.");
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

  const showAddressForm = isGuest || showAddForm;

  return (
    <div className="address-step">
      <div className="step-header">
        <h2 className="step-title">
          Delivery Address
        </h2>
        <p className="step-description">
          {isGuest
            ? "Enter your delivery address. We'll validate it against our delivery zones."
            : "Choose where you&apos;d like your order delivered"}
        </p>
      </div>

      {!isGuest && (
        <div className="addresses-list">
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
      )}

      {!isGuest && !showAddForm ? (
        <button
          className="add-address-button"
          onClick={() => {
            setShowAddForm(true);
            setAddressError("");
            setFieldErrors({});
            setFormData({
              type: "",
              street: "",
              city: "",
              state: "",
              zip_code: "",
              apartment: "",
              pasteField: ""
            });
          }}
        >
          <Plus className="plus-icon" />
          Add New Address
        </button>
      ) : null}

      {showAddressForm ? (
        <div className="add-address-form">
          <form className="form-card" onSubmit={handleAddNewAddress}>
            <h3 className="form-title">
              {isGuest ? "Enter your delivery address" : "Add New Address"}
            </h3>
            
            <div className="form-group form-group-paste">
              <label htmlFor="paste-address" className="form-label paste-label">
                Paste your full address to auto-fill fields below
              </label>
              <input
                id="paste-address"
                className="form-input form-input-paste"
                placeholder="e.g. 630 W 254th St, Bronx, NY 10471"
                value={formData.pasteField}
                onChange={(e) => setFormData({ ...formData, pasteField: e.target.value })}
                onPaste={handlePasteFieldPaste}
                onBlur={(e) => handlePastedAddress(e.target.value)}
                disabled={isValidating}
                autoFocus
              />
            </div>

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
                      document.getElementById('street')?.focus();
                    }
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="street" className="form-label">Street Address *</label>
              <input
                id="street"
                className={`form-input ${fieldErrors.street ? 'error' : ''}`}
                placeholder="123 Main St"
                value={formData.street}
                onChange={(e) => {
                  setFormData({ ...formData, street: e.target.value });
                  if (fieldErrors.street) setFieldErrors({ ...fieldErrors, street: undefined });
                  if (addressError) setAddressError("");
                }}
                onKeyDown={handleKeyDown}
                disabled={isValidating}
              />
              {fieldErrors.street && <p className="error-text">{fieldErrors.street}</p>}
            </div>

            <div className="form-grid form-grid-two">
              <div className="form-group">
                <label htmlFor="city" className="form-label">City *</label>
                <input
                  id="city"
                  className={`form-input ${fieldErrors.city ? 'error' : ''}`}
                  placeholder="New York"
                  value={formData.city}
                  onChange={(e) => {
                    setFormData({ ...formData, city: e.target.value });
                    if (fieldErrors.city) setFieldErrors({ ...fieldErrors, city: undefined });
                    if (addressError) setAddressError("");
                  }}
                  disabled={isValidating}
                />
                {fieldErrors.city && <p className="error-text">{fieldErrors.city}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="state" className="form-label">State *</label>
                <input
                  id="state"
                  className={`form-input form-input-state ${fieldErrors.state ? 'error' : ''}`}
                  placeholder="NY"
                  value={formData.state}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase().replace(/[^A-Za-z]/g, "").slice(0, 2);
                    setFormData({ ...formData, state: v });
                    if (fieldErrors.state) setFieldErrors({ ...fieldErrors, state: undefined });
                    if (addressError) setAddressError("");
                  }}
                  maxLength={2}
                  disabled={isValidating}
                />
                {fieldErrors.state && <p className="error-text">{fieldErrors.state}</p>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="zip_code" className="form-label">ZIP Code *</label>
              <input
                id="zip_code"
                className={`form-input form-input-zip ${fieldErrors.zip_code ? 'error' : ''}`}
                placeholder="10001"
                value={formData.zip_code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                  setFormData({ ...formData, zip_code: v });
                  if (fieldErrors.zip_code) setFieldErrors({ ...fieldErrors, zip_code: undefined });
                  if (addressError) setAddressError("");
                }}
                maxLength={5}
                disabled={isValidating}
              />
              {fieldErrors.zip_code && <p className="error-text">{fieldErrors.zip_code}</p>}
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

            {addressError && (
              <p className="error-text error-text-form">{addressError}</p>
            )}

            <div className="form-actions">
              <button
                type="submit"
                className="submit-button"
                disabled={
                  !formData.street.trim() ||
                  !formData.city.trim() ||
                  !formData.state.trim() ||
                  formData.zip_code.replace(/\D/g, "").length !== 5 ||
                  isValidating
                }
              >
                {isValidating ? 'Validating...' : (isGuest ? 'Continue' : 'Use This Address')}
              </button>
              {!isGuest && (
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddressError("");
                    setFieldErrors({});
                    setFormData({
                      type: "",
                      street: "",
                      city: "",
                      state: "",
                      zip_code: "",
                      apartment: "",
                      pasteField: ""
                    });
                  }}
                  disabled={isValidating}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      ) : null}

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