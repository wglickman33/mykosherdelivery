import { useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import AddressModal from '../AddressModal/AddressModal';
import DeleteConfirmModal from '../DeleteConfirmModal/DeleteConfirmModal';
import './AddressManagementModal.scss';

const AddressManagementModal = ({ isOpen, onClose, onAddressSelect }) => {
  const { profile, deleteAddress, setPrimaryAddress, selectAddress } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState(null);

  const addresses = (profile?.addresses || []).map((address, index) => {
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

  const handleSelectAddress = (address) => {
    selectAddress(address);
    if (onAddressSelect) {
      onAddressSelect(address);
    }
    onClose();
  };

  const handleEditAddress = (address) => {
    setSelectedAddress(address);
    setShowEditModal(true);
  };

  const handleDeleteAddress = (address) => {
    setAddressToDelete(address);
    setShowDeleteModal(true);
  };

  const confirmDeleteAddress = async () => {
    if (!addressToDelete) return;

    setLoading(true);
    try {
      await deleteAddress(addressToDelete.id);
      setShowDeleteModal(false);
      setAddressToDelete(null);
    } catch (error) {
      console.error('Error deleting address:', error);
    } finally {
      setLoading(false);
    }
  };

  const cancelDeleteAddress = () => {
    setShowDeleteModal(false);
    setAddressToDelete(null);
  };

  const handleSetPrimary = async (addressId) => {
    if (!addressId) {
      console.error('Address ID is undefined');
      return;
    }
    
    setLoading(true);
    try {
      await setPrimaryAddress(addressId);
    } catch (error) {
      console.error('Error setting primary address:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDeliveryInstructions = (address) => {
    if (address?.address && typeof address.address === 'object') {
      return address.address.delivery_instructions;
    }
    return address?.delivery_instructions;
  };

  const formatAddress = (address) => {
    let addressData;
    if (address?.address && typeof address.address === 'object') {
      addressData = address.address;
    } else {
      addressData = address;
    }
    
    const parts = [];
    if (addressData?.street) parts.push(addressData.street);
    if (addressData?.apartment) parts.push(addressData.apartment);
    if (addressData?.city) parts.push(addressData.city);
    if (addressData?.state) parts.push(addressData.state);
    if (addressData?.zip_code) parts.push(addressData.zip_code);
    return parts.join(', ');
  };

  const getAddressIcon = () => {
    return '📍';
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="address-management-overlay" onClick={onClose}>
        <div className="address-management-modal" onClick={(e) => e.stopPropagation()}>
          <div className="address-management-header">
            <h2>Your Addresses</h2>
            <button className="close-button" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="#6c757d" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          <div className="address-management-content">
            {addresses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <path fill="#6c757d" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                </div>
                <h3>No saved addresses</h3>
                <p>Add your first address to get started with delivery</p>
                <button 
                  className="add-first-address-button"
                  onClick={() => setShowAddModal(true)}
                >
                  Add Address
                </button>
              </div>
            ) : (
              <>
                <div className="addresses-list">
                  {addresses.map((address) => (
                    <div 
                      key={address.id} 
                      className={`address-item ${address.is_primary ? 'primary' : ''}`}
                    >
                      <div className="address-main" onClick={() => handleSelectAddress(address)}>
                        <div className="address-icon">
                          {getAddressIcon()}
                        </div>
                        <div className="address-details">
                          <div className="address-label">
                            {address.street || formatAddress(address).split(',')[0]}
                            {address.is_primary && (
                              <span className="primary-badge">Primary</span>
                            )}
                          </div>
                          <div className="address-text">
                            {formatAddress(address)}
                          </div>
                          {getDeliveryInstructions(address) && (
                            <div className="delivery-instructions">
                              📝 {getDeliveryInstructions(address)}
                            </div>
                          )}
                        </div>
                        <div className="select-indicator">
                          <svg viewBox="0 0 24 24" width="20" height="20">
                            <path fill="#6c757d" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                        </div>
                      </div>
                      
                      <div className="address-actions">
                        {!address.is_primary && (
                          <button
                            className="action-button set-primary"
                            onClick={() => handleSetPrimary(address.id)}
                            disabled={loading}
                            title="Set as primary address"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16">
                              <path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                          </button>
                        )}
                        <button
                          className="action-button edit"
                          onClick={() => handleEditAddress(address)}
                          disabled={loading}
                          title="Edit address"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                          </svg>
                        </button>
                        <button
                          className="action-button delete"
                          onClick={() => handleDeleteAddress(address)}
                          disabled={loading}
                          title="Delete address"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {addresses.length < 3 && (
                  <button 
                    className="add-address-button"
                    onClick={() => setShowAddModal(true)}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    Add New Address
                  </button>
                )}
              </>
            )}

            {addresses.length >= 3 && (
              <div className="limit-notice">
                You have reached the maximum of 3 saved addresses. Delete an address to add a new one.
              </div>
            )}
          </div>
        </div>
      </div>

      {}
      <AddressModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        mode="add"
      />

      {}
      <AddressModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedAddress(null);
        }}
        mode="edit"
        addressToEdit={selectedAddress}
      />

      {}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={cancelDeleteAddress}
        onConfirm={confirmDeleteAddress}
        title="Delete Address"
        message={`Are you sure you want to delete "${addressToDelete ? formatAddress(addressToDelete) : 'this address'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
};

AddressManagementModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAddressSelect: PropTypes.func
};

export default AddressManagementModal; 