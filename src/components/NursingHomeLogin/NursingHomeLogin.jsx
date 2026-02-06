import LoginForm from '../LoginForm/LoginForm';
import { USER_ROLES } from '../../config/constants';
import './NursingHomeLogin.scss';

const NursingHomeLogin = () => {
  const getRedirectPath = (role) => {
    if (role === USER_ROLES.NURSING_HOME_USER) {
      return '/nursing-homes/dashboard';
    } else if (role === USER_ROLES.NURSING_HOME_ADMIN) {
      return '/nursing-homes/admin/dashboard';
    }
    return '/nursing-homes/dashboard';
  };

  return (
    <LoginForm
      title="Nursing Home Portal"
      subtitle="Sign in to manage resident meals"
      allowedRoles={[USER_ROLES.NURSING_HOME_USER, USER_ROLES.NURSING_HOME_ADMIN]}
      redirectPath={getRedirectPath}
      errorMessage="Invalid credentials for nursing home portal"
      footerText="Need help? Contact your facility administrator"
      className="nursing-home-login"
    />
  );
};

export default NursingHomeLogin;
