import LoginForm from '../LoginForm/LoginForm';
import { USER_ROLES } from '../../config/constants';
import navyMKDLogo from '../../assets/navyMKDLogo.png';
import './AdminLogin.scss';

const AdminLogin = () => {
  return (
    <LoginForm
      title="Admin Portal"
      subtitle="MyKosherDelivery Management System"
      logo={navyMKDLogo}
      allowedRoles={[USER_ROLES.ADMIN]}
      redirectPath="/admin/dashboard"
      errorMessage="Access denied. Admin credentials required."
      footerText="© 2025 MyKosherDelivery. Admin Portal v1.0"
      className="admin-login"
    />
  );
};

export default AdminLogin;
