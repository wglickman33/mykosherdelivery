import { MapPin } from "lucide-react";
import PropTypes from "prop-types";
import "./AddressConfirmationModal.scss";

const AddressConfirmationModal = ({ isOpen, onClose, address, onConfirm }) => {
  if (!isOpen || !address) return null;

  const handleConfirm = () => {
    onConfirm(address);
    onClose();
  };

  const formatAddress = (addr) => {
    if (typeof addr === 'string') return addr;
    return `${addr.street || ''}${addr.apartment ? `, ${addr.apartment}` : ''}, ${addr.city || ''}, ${addr.state || ''} ${addr.zip_code || ''}`;
  };

  return (
    <div className="address-confirmation-modal-overlay" onClick={onClose}>
      <div className="address-confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Confirm Delivery Address</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <div className="address-preview">
            <MapPin className="address-icon" />
            <div className="address-details">
              <div className="address-label-row">
                <span className="address-type">
                  {address.label || address.type || "Address"}
                </span>
                {address.is_primary && (
                  <span className="primary-badge">Primary</span>
                )}
              </div>
              <p className="address-text">{formatAddress(address)}</p>
              {address.details && (
                <p className="address-notes">{address.details}</p>
              )}
            </div>
          </div>
          
          <p className="confirmation-text">
            Would you like to deliver your order to this address?
          </p>
        </div>
        
        <div className="modal-actions">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="confirm-button" onClick={handleConfirm}>
            Confirm Address
          </button>
        </div>
      </div>
    </div>
  );
};

AddressConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  address: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
};

export default AddressConfirmationModal; 