import PropTypes from 'prop-types';
import './DeleteConfirmModal.scss';

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Delete", cancelText = "Cancel" }) => {
  if (!isOpen) return null;

  return (
    <div className="delete-confirm-overlay" onClick={onClose}>
      <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-confirm-header">
          <div className="delete-icon">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="#dc3545" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </div>
          <h3>{title}</h3>
        </div>
        
        <div className="delete-confirm-content">
          <p>{message}</p>
        </div>
        
        <div className="delete-confirm-actions">
          <button 
            className="cancel-button"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button 
            className="delete-button"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

DeleteConfirmModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string
};

export default DeleteConfirmModal; 