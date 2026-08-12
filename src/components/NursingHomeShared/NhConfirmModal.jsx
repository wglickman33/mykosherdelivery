import PropTypes from 'prop-types';
import './NhConfirmModal.scss';

const NhConfirmModal = ({
  open,
  title,
  message,
  confirmLabel = 'Leave',
  cancelLabel = 'Stay',
  onConfirm,
  onCancel,
  danger = false
}) => {
  if (!open) return null;

  return (
    <div className="nh-confirm-modal-overlay" onClick={onCancel} role="presentation">
      <div
        className="nh-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nh-confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="nh-confirm-modal-title">{title}</h2>
        <p>{message}</p>
        <div className="nh-confirm-modal__actions">
          <button type="button" className="nh-confirm-modal__btn nh-confirm-modal__btn--secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`nh-confirm-modal__btn nh-confirm-modal__btn--primary${danger ? ' nh-confirm-modal__btn--danger' : ''}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

NhConfirmModal.propTypes = {
  open: PropTypes.bool,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  danger: PropTypes.bool
};

export default NhConfirmModal;
