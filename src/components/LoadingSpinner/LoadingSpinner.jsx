import PropTypes from 'prop-types';
import './LoadingSpinner.scss';

const LoadingSpinner = ({ 
  size = 'medium', 
  text = 'Loading...', 
  variant = 'default',
  className = '' 
}) => {
  const sizeClasses = {
    small: 'loading-spinner--small',
    medium: 'loading-spinner--medium',
    large: 'loading-spinner--large'
  };

  const variantClasses = {
    default: 'loading-spinner--default',
    primary: 'loading-spinner--primary',
    navy: 'loading-spinner--navy',
    minimal: 'loading-spinner--minimal'
  };

  return (
    <div className={`loading-spinner ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
      <div className="loading-spinner__icon">
        <div className="loading-spinner__circle"></div>
      </div>
      {text && <p className="loading-spinner__text">{text}</p>}
    </div>
  );
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  text: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'primary', 'navy', 'minimal']),
  className: PropTypes.string
};

export default LoadingSpinner; 