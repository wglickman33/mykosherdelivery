import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './AdminNursingHomes.scss';

const AdminNursingHomes = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('residents');
  const [loading] = useState(false);

  const isSuperAdmin = user?.role === 'admin';

  const tabs = [
    { id: 'residents', label: 'Residents', roles: ['admin', 'nursing_home_admin'] },
    { id: 'staff', label: 'Staff Assignment', roles: ['admin', 'nursing_home_admin'] },
    { id: 'orders', label: 'Orders', roles: ['admin', 'nursing_home_admin'] },
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
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'facilities' && isSuperAdmin && <FacilitiesTab />}
      </div>
    </div>
  );
};

const ResidentsTab = () => {
  return (
    <div className="residents-tab">
      <div className="tab-header">
        <h2>Residents</h2>
        <button className="btn-primary">Add Resident</button>
      </div>
      <div className="content-placeholder">
        <p>Resident management coming soon...</p>
        <p>Features: Add/Edit/Delete residents, manage dietary restrictions, allergies, room assignments</p>
      </div>
    </div>
  );
};

const StaffTab = () => {
  return (
    <div className="staff-tab">
      <div className="tab-header">
        <h2>Staff Assignment</h2>
      </div>
      <div className="content-placeholder">
        <p>Staff assignment coming soon...</p>
        <p>Features: Assign residents to nursing home users, manage workload distribution</p>
      </div>
    </div>
  );
};

const OrdersTab = () => {
  return (
    <div className="orders-tab">
      <div className="tab-header">
        <h2>Nursing Home Orders</h2>
      </div>
      <div className="content-placeholder">
        <p>Orders management coming soon...</p>
        <p>Features: View all NH orders, filter by facility/resident/status, export data</p>
      </div>
    </div>
  );
};

const FacilitiesTab = () => {
  return (
    <div className="facilities-tab">
      <div className="tab-header">
        <h2>Facilities</h2>
        <button className="btn-primary">Add Facility</button>
      </div>
      <div className="content-placeholder">
        <p>Facility management coming soon...</p>
        <p>Features: Add/Edit/Delete facilities, manage facility details, contact information</p>
      </div>
    </div>
  );
};

export default AdminNursingHomes;
