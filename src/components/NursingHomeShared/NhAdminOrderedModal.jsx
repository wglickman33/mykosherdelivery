import PropTypes from 'prop-types';
import { ADMIN_ALREADY_ORDERED_MESSAGE } from '../../utils/nursingHomeOrderUtils';
import './NhAdminOrderedModal.scss';

const NhAdminOrderedModal = ({
  open,
  message = ADMIN_ALREADY_ORDERED_MESSAGE,
  contactLabel = null,
  onClose,
  onViewOrder = null,
  viewLabel = 'View order'
}) => {
  if (!open) return null;

  return (
    <div className="nh-admin-ordered-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="nh-admin-ordered-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nh-admin-ordered-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="nh-admin-ordered-title">Order already placed</h2>
        <p>{message || ADMIN_ALREADY_ORDERED_MESSAGE}</p>
        {contactLabel && (
          <p className="nh-admin-ordered-modal__contact">
            Contact: {contactLabel}
          </p>
        )}
        <div className="nh-admin-ordered-modal__actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          {onViewOrder && (
            <button type="button" className="btn-primary" onClick={onViewOrder}>
              {viewLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

NhAdminOrderedModal.propTypes = {
  open: PropTypes.bool,
  message: PropTypes.string,
  contactLabel: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onViewOrder: PropTypes.func,
  viewLabel: PropTypes.string
};

export default NhAdminOrderedModal;
