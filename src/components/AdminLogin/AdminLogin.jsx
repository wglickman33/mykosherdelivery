import './AdminLogin.scss';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import navyMKDLogo from '../../assets/navyMKDLogo.png';

const AdminLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn(formData.email, formData.password);
      
      if (result.success) {
        if (result.user?.role === 'admin') {
          navigate('/admin/dashboard');
        } else {
          setError('Access denied. Admin credentials required.');
          setIsLoading(false);
        }
      } else {
        setError(result.error || 'Invalid credentials');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Admin login error:', error);
      setError('Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <div className="admin-login__container">
        <div className="admin-login__header">
          <img src={navyMKDLogo} alt="MKD Admin" className="admin-logo" />
          <h1>Admin Portal</h1>
          <p>MyKosherDelivery Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login__form">
          <div className="form-group">
            <label htmlFor="email">Admin Email</label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="admin@mykosherdelivery.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="error-message">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="admin-login__btn" disabled={isLoading}>
            {isLoading ? (
              <span className="admin-login__btn-content">
                <LoadingSpinner size="small" color="white" />
                <span>Signing In...</span>
              </span>
            ) : (
              'Sign In to Admin Portal'
            )}
          </button>
        </form>

        <div className="admin-login__footer">
          <p>&copy; 2025 MyKosherDelivery. Admin Portal v1.0</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin; 