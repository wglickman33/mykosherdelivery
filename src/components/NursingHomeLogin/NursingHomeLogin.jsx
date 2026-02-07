import LoginForm from '../LoginForm/LoginForm';
import { USER_ROLES } from '../../config/constants';
import './NursingHomeLogin.scss';

const NursingHomeLogin = () => {
  const getRedirectPath = () => '/nursing-homes/dashboard';

  return (
    <LoginForm
      title="Nursing Home Portal"
      subtitle="Sign in to manage resident meals"
      allowedRoles={[USER_ROLES.NURSING_HOME_USER, USER_ROLES.NURSING_HOME_ADMIN, USER_ROLES.ADMIN]}
      redirectPath={getRedirectPath}
      errorMessage="Invalid credentials for nursing home portal"
      footerText="Need help? Contact your facility administrator"
      className="nursing-home-login"
    />
  );
};

export default NursingHomeLogin;
