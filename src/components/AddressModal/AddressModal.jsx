import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { validateDeliveryAddress } from '../../services/addressValidationService';
import DeleteConfirmModal from '../DeleteConfirmModal/DeleteConfirmModal';
import './AddressModal.scss';

const AddressModal = ({ isOpen, onClose, mode = 'add', addressToEdit = null }) => {
  const { user, profile, addAddress, updateAddress, deleteAddress, setPrimaryAddress, tempAddress, setTempAddress, getCurrentAddress } = useAuth();
  const [formData, setFormData] = useState({
    street: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    deliveryInstructions: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && addressToEdit) {
      let addressData;
      if (addressToEdit?.address && typeof addressToEdit.address === 'object') {
        addressData = addressToEdit.address;
      } else {
        addressData = addressToEdit;
      }
      
      setFormData({
        street: addressData?.street || '',
        apartment: addressData?.apartment || '',
        city: addressData?.city || '',
        state: addressData?.state || '',
        zipCode: addressData?.zip_code || '',
        deliveryInstructions: addressData?.delivery_instructions || ''
      });
    } else if (mode === 'add') {
      setFormData({
        street: '',
        apartment: '',
        city: '',
        state: '',
        zipCode: '',
        deliveryInstructions: ''
      });
    } else if (!user && tempAddress) {
      const currentAddr = getCurrentAddress();
      if (typeof currentAddr === 'string') {
        const parts = currentAddr.split(', ');
        const street = parts[0] || '';
        const cityStateZip = parts.slice(1).join(', ');
        const cityStateZipMatch = cityStateZip.match(/^(.*?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?\s*(.*)$/);
        
        setFormData({
          street: street,
          apartment: '',
          city: cityStateZipMatch ? cityStateZipMatch[1] : '',
          state: cityStateZipMatch ? cityStateZipMatch[2] : '',
          zipCode: cityStateZipMatch ? cityStateZipMatch[3] || '' : '',
          deliveryInstructions: ''
        });
      } else {
        setFormData({
          street: '',
          apartment: '',
          city: '',
          state: '',
          zipCode: '',
          deliveryInstructions: ''
        });
      }
    }
    setError('');
  }, [mode, addressToEdit, isOpen, user, tempAddress, getCurrentAddress]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
    
    validateField(name, value);
  };

  const validateField = (name, value) => {
    let error = '';
    
    switch (name) {
      case 'street':
        if (!value.trim()) error = 'Street address is required';
        break;
      case 'city':
        if (!value.trim()) error = 'City is required';
        break;
      case 'state':
        if (!value.trim()) error = 'State is required';
        break;
      case 'zipCode':
        if (!value.trim()) {
          error = 'ZIP code is required';
        } else if (!/^\d{5}(-\d{4})?$/.test(value)) {
          error = 'Please enter a valid ZIP code';
        }
        break;
    }
    
    setValidationErrors(prev => ({
      ...prev,
      [name]: error
    }));
    
    return error === '';
  };

  const validateForm = async () => {
    let isValid = true;
    
    const requiredFields = ['street', 'city', 'state', 'zipCode'];
    requiredFields.forEach(field => {
      if (!validateField(field, formData[field])) {
        isValid = false;
      }
    });
    
    if (formData.street && formData.city && formData.state && formData.zipCode) {
      const fullAddress = `${formData.street}, ${formData.city}, ${formData.state} ${formData.zipCode}`;
      try {
        const deliveryValidation = await validateDeliveryAddress(fullAddress);
        
        if (!deliveryValidation.isValid) {
          setValidationErrors(prev => ({
            ...prev,
            zipCode: deliveryValidation.error || 'Sorry, we don\'t deliver to this area yet. Please try a different address.'
          }));
          isValid = false;
        }
      } catch (error) {
        console.error('Address validation error:', error);
        setValidationErrors(prev => ({
          ...prev,
          zipCode: 'Unable to validate address. Please try again.'
        }));
        isValid = false;
      }
    }
    
    const touchedFields = {};
    requiredFields.forEach(field => {
      touchedFields[field] = true;
    });
    setTouched(touchedFields);
    
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (loading) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    const isValid = await validateForm();
    if (!isValid) {
      setError('Please fix the errors below');
      setLoading(false);
      return;
    }

    try {
      if (!user) {
        const fullAddress = `${formData.street.trim()}${formData.apartment.trim() ? `, ${formData.apartment.trim()}` : ''}, ${formData.city.trim()}, ${formData.state.trim()} ${formData.zipCode.trim()}`;
        setTempAddress(fullAddress);
        onClose();
      } else {
        const addressData = {
          street: formData.street.trim(),
          apartment: formData.apartment.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          zip_code: formData.zipCode.trim(),
          delivery_instructions: formData.deliveryInstructions.trim()
        };

        if (mode === 'edit' && addressToEdit) {
          await updateAddress(addressToEdit.id, addressData);
        } else {
          await addAddress(addressData);
        }

        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!addressToEdit) return;

    setLoading(true);
    try {
      await deleteAddress(addressToEdit.id);
      setShowDeleteModal(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete address');
      setShowDeleteModal(false);
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
  };

  const handleSetPrimary = async () => {
    if (!addressToEdit) return;

    setLoading(true);
    try {
      await setPrimaryAddress(addressToEdit.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to set primary address');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isFormValid = formData.street && formData.city && formData.state && formData.zipCode;
  const addressCount = profile?.addresses?.length || 0;
  const canAddMore = addressCount < 3;

  return (
    <div className="address-modal-overlay" onClick={onClose}>
      <div className="address-modal" onClick={(e) => e.stopPropagation()}>
        <div className="address-modal-header">
          <h2>
            {!user ? 'Edit Delivery Address' : mode === 'edit' ? 'Edit Address' : 'Add New Address'}
          </h2>
          <button className="close-button" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="#6c757d" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <form className="address-form" onSubmit={handleSubmit}>
          {error && (
            <div className="error-message">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#dc3545" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="street">Street Address *</label>
            <input
              type="text"
              id="street"
              name="street"
              value={formData.street}
              onChange={handleInputChange}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!loading) {
                    document.getElementById('city')?.focus();
                  }
                }
              }}
              placeholder="123 Main Street"
              className={touched.street && validationErrors.street ? 'error' : ''}
              required
            />
            {touched.street && validationErrors.street && (
              <div className="field-error">{validationErrors.street}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="apartment">Apartment, Suite, etc.</label>
            <input
              type="text"
              id="apartment"
              name="apartment"
              value={formData.apartment}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Apt 4B, Suite 200, etc."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="city">City *</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="New York"
                className={touched.city && validationErrors.city ? 'error' : ''}
                required
              />
              {touched.city && validationErrors.city && (
                <div className="field-error">{validationErrors.city}</div>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="state">State *</label>
              <select
                id="state"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                onBlur={handleBlur}
                className={touched.state && validationErrors.state ? 'error' : ''}
                required
              >
                <option value="">Select State</option>
                <option value="NY">New York</option>
                <option value="NJ">New Jersey</option>
                <option value="CT">Connecticut</option>
                <option value="CA">California</option>
                <option value="FL">Florida</option>
                {}
              </select>
              {touched.state && validationErrors.state && (
                <div className="field-error">{validationErrors.state}</div>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="zipCode">ZIP Code *</label>
              <input
                type="text"
                id="zipCode"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleInputChange}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!loading) {
                      handleSubmit(e);
                    }
                  }
                }}
                placeholder="10001"
                pattern="[0-9]{5}(-[0-9]{4})?"
                className={touched.zipCode && validationErrors.zipCode ? 'error' : ''}
                required
              />
              {touched.zipCode && validationErrors.zipCode && (
                <div className="field-error">{validationErrors.zipCode}</div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="deliveryInstructions">Delivery Instructions</label>
            <textarea
              id="deliveryInstructions"
              name="deliveryInstructions"
              value={formData.deliveryInstructions}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Ring doorbell, leave at door, etc."
              rows="3"
            />
          </div>

          <div className="form-actions">
            {mode === 'edit' && user && (
              <div className="secondary-actions">
                {!addressToEdit?.is_primary && (
                  <button
                    type="button"
                    className="set-primary-button"
                    onClick={handleSetPrimary}
                    disabled={loading}
                  >
                    Set as Primary
                  </button>
                )}
                <button
                  type="button"
                  className="delete-button"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  Delete
                </button>
              </div>
            )}
            
            <div className="primary-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="save-button"
                disabled={loading || !isFormValid || (mode === 'add' && user && !canAddMore)}
                onClick={(e) => {
                  if (loading) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                {loading ? 'Saving...' : !user ? 'Update Address' : mode === 'edit' ? 'Update Address' : 'Add Address'}
              </button>
            </div>
          </div>

          {mode === 'add' && !canAddMore && (
            <div className="limit-message">
              You can only save up to 3 addresses. Delete an existing address to add a new one.
            </div>
          )}
        </form>
      </div>

      {}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Address"
        message={`Are you sure you want to delete this address? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

AddressModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  mode: PropTypes.oneOf(['add', 'edit']),
  addressToEdit: PropTypes.object
};

export default AddressModal; 