import PropTypes from 'prop-types';
import './NotificationToast.scss';

const NotificationToast = ({ notification, onClose }) => {
  if (!notification) return null;

  return (
    <div className={`notification-toast notification-toast--${notification.type}`}>
      <div className="notification-content">
        <div className="notification-icon">
          {notification.type === 'success' ? '✓' : '✕'}
        </div>
        <span className="notification-message">{notification.message}</span>
      </div>
      <button 
        className="notification-close"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
};

NotificationToast.propTypes = {
  notification: PropTypes.shape({
    type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
    message: PropTypes.string
  }),
  onClose: PropTypes.func.isRequired
};

export default NotificationToast;
