import LoginForm from '../LoginForm/LoginForm';
import { USER_ROLES } from '../../config/constants';
import navyMKDLogo from '../../assets/navyMKDLogo.png';
import './AdminLogin.scss';

const AdminLogin = () => {
  const getRedirectPath = (role) => {
    if (role === USER_ROLES.NURSING_HOME_USER) return '/nursing-homes/dashboard';
    if (role === USER_ROLES.NURSING_HOME_ADMIN) return '/admin/nursing-homes';
    return '/admin/dashboard';
  };

  return (
    <LoginForm
      title="Admin Portal"
      subtitle="MyKosherDelivery Management System"
      logo={navyMKDLogo}
      allowedRoles={[USER_ROLES.ADMIN, USER_ROLES.NURSING_HOME_ADMIN, USER_ROLES.NURSING_HOME_USER]}
      redirectPath={getRedirectPath}
      errorMessage="Access denied. Admin or nursing home credentials required."
      footerText="© 2025 MyKosherDelivery. Admin Portal v1.0"
      className="admin-login"
    />
  );
};

export default AdminLogin;
