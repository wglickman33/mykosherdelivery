import LoginForm from '../LoginForm/LoginForm';
import { USER_ROLES } from '../../config/constants';
import './NursingHomeAdminLogin.scss';

const NursingHomeAdminLogin = () => {
  return (
    <LoginForm
      title="Nursing Home Admin Portal"
      subtitle="Manage residents, staff, and orders"
      allowedRoles={[USER_ROLES.NURSING_HOME_ADMIN, USER_ROLES.ADMIN]}
      redirectPath="/nursing-homes/admin/dashboard"
      errorMessage="Invalid credentials for nursing home admin portal"
      footerText="Need help? Contact MKD support"
      className="nursing-home-admin-login"
    />
  );
};

export default NursingHomeAdminLogin;
