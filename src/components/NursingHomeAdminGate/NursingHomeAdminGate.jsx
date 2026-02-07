import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './NursingHomeAdminGate.scss';

const NursingHomeAdminGate = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="nursing-home-admin-gate">
        <LoadingSpinner size="large" text="Checking session..." />
      </div>
    );
  }

  if (user && (user.role === 'admin' || user.role === 'nursing_home_admin')) {
    return <Navigate to="/admin/nursing-homes" replace />;
  }

  return <Navigate to="/nursing-homes/admin/login" replace />;
};

export default NursingHomeAdminGate;
