import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import NursingHomeMenu from '../NursingHomeMenu/NursingHomeMenu';

const MenuTab = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="admin-nursing-homes__menu-tab">
      <div className="admin-nursing-homes__menu-tab-header">
        <h2>Nursing Home Menu</h2>
        <p>View the breakfast, lunch, and dinner menu available for resident orders.</p>
        {isAdmin && (
          <button
            type="button"
            className="admin-nursing-homes__edit-menu-btn"
            onClick={() => navigate('/admin/restaurants/nursing-home-menus')}
          >
            Edit Menu (Restaurants)
          </button>
        )}
      </div>
      <NursingHomeMenu showInstructions={true} showEditLink={false} />
    </div>
  );
};

export default MenuTab;
