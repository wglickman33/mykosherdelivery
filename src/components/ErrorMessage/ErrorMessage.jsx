import PropTypes from 'prop-types';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import './ErrorMessage.scss';

const ErrorMessage = ({ 
  message, 
  type = 'error', 
  onDismiss,
  showIcon = true 
}) => {
  if (!message) return null;

  const icons = {
    error: <AlertCircle size={20} />,
    success: <CheckCircle size={20} />,
    info: <Info size={20} />,
    warning: <AlertCircle size={20} />
  };

  return (
    <div className={`error-message error-message--${type}`}>
      {showIcon && (
        <span className="error-message__icon">
          {icons[type]}
        </span>
      )}
      <span className="error-message__text">{message}</span>
      {onDismiss && (
        <button 
          className="error-message__dismiss" 
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};

ErrorMessage.propTypes = {
  message: PropTypes.string,
  type: PropTypes.oneOf(['error', 'success', 'info', 'warning']),
  onDismiss: PropTypes.func,
  showIcon: PropTypes.bool
};

export default ErrorMessage;
