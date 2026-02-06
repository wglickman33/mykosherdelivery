import { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './LoginForm.scss';

const LoginForm = ({
  title,
  subtitle,
  logo,
  allowedRoles,
  redirectPath,
  errorMessage = 'Invalid credentials',
  footerText,
  className = ''
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await (login ? login(email, password) : signIn(email, password));
      
      if (result.success) {
        const userRole = result.user?.role;
        
        if (allowedRoles.includes(userRole)) {
          const path = typeof redirectPath === 'function' 
            ? redirectPath(userRole) 
            : redirectPath;
          navigate(path);
        } else {
          setError(errorMessage);
        }
      } else {
        setError(result.error || 'Login failed');
      }
    } catch {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`login-form-wrapper ${className}`}>
      <div className="login-form-container">
        <div className="login-form-header">
          {logo && <img src={logo} alt={title} className="login-logo" />}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <ErrorMessage 
              message={error} 
              type="error"
              onDismiss={() => setError('')}
            />
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <span className="login-btn-content">
                <LoadingSpinner size="small" />
                <span>Signing In...</span>
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {footerText && (
          <div className="login-form-footer">
            <p>{footerText}</p>
          </div>
        )}
      </div>
    </div>
  );
};

LoginForm.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  logo: PropTypes.string,
  allowedRoles: PropTypes.arrayOf(PropTypes.string).isRequired,
  redirectPath: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.func
  ]).isRequired,
  errorMessage: PropTypes.string,
  footerText: PropTypes.string,
  className: PropTypes.string
};

export default LoginForm;
