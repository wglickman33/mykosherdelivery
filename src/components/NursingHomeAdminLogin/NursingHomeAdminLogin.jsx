import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './NursingHomeAdminLogin.scss';

const NursingHomeAdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      
      if (result.success) {
        // Check if user is nursing home admin
        if (result.user.role === 'nursing_home_admin') {
          navigate('/nursing-homes/admin/dashboard');
        } else if (result.user.role === 'admin') {
          navigate('/nursing-homes/admin/dashboard');
        } else {
          setError('Invalid credentials for nursing home admin portal');
        }
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nursing-home-admin-login">
      <div className="login-container">
        <div className="login-header">
          <h1>Nursing Home Admin Portal</h1>
          <p>Manage residents, staff, and orders</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

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
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? <LoadingSpinner size="small" /> : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p>Need help? Contact MKD support</p>
        </div>
      </div>
    </div>
  );
};

export default NursingHomeAdminLogin;
