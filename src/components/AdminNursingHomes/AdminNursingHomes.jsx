import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import FacilitiesTab from './FacilitiesTab';
import MenuTab from './MenuTab';
import ResidentsTab from './ResidentsTab';
import StaffTab from './StaffTab';
import StaffAssignmentTab from './StaffAssignmentTab';
import OrdersTab from './OrdersTab';
import './AdminNursingHomes.scss';

const AdminNursingHomes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('residents');
  const [loading] = useState(false);

  const isSuperAdmin = user?.role === 'admin';

  const tabs = [
    { id: 'residents', label: 'Residents', roles: ['admin', 'nursing_home_admin'] },
    { id: 'staff', label: 'Staff', roles: ['admin', 'nursing_home_admin'] },
    { id: 'staff-assignment', label: 'Staff Assignment', roles: ['admin', 'nursing_home_admin'] },
    { id: 'orders', label: 'Orders', roles: ['admin', 'nursing_home_admin'] },
    { id: 'menu', label: 'Menu', roles: ['admin', 'nursing_home_admin', 'nursing_home_user'] },
    { id: 'facilities', label: 'Facilities', roles: ['admin'] },
  ].filter(tab => tab.roles.includes(user?.role));

  if (loading) {
    return (
      <div className="admin-nursing-homes">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-nursing-homes">
      <div className="page-header">
        <div className="header-content">
          <h1>Nursing Home Management</h1>
          <p>Manage facilities, residents, staff assignments, and orders</p>
        </div>
        <button
          type="button"
          className="page-header__portal-link"
          onClick={() => navigate('/nursing-homes/dashboard')}
        >
          Resident Portal →
        </button>
      </div>

      <div className="tabs-container">
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tab-content">
        {activeTab === 'residents' && <ResidentsTab />}
        {activeTab === 'staff' && <StaffTab />}
        {activeTab === 'staff-assignment' && <StaffAssignmentTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'menu' && <MenuTab />}
        {activeTab === 'facilities' && isSuperAdmin && <FacilitiesTab />}
      </div>
    </div>
  );
};

export default AdminNursingHomes;
