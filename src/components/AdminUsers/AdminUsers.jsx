import './AdminUsers.scss';
import { useState, useEffect } from 'react';
import { fetchAllUsers, updateUserProfile, deleteUser, createUser, logAdminAction } from '../../services/adminServices';
import { fetchFacilitiesList } from '../../services/nursingHomeService';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import NotificationToast from '../NotificationToast/NotificationToast';
import { useNotification } from '../../hooks/useNotification';
import { formatPhoneNumber, formatPhoneForInput } from '../../utils/phoneFormatter';
import { USER_ROLES, ROLE_LABELS } from '../../config/constants';

const USER_ROLES_FILTER = [
  { value: 'all', label: 'All Roles' },
  { value: USER_ROLES.USER, label: 'Users' },
  { value: USER_ROLES.ADMIN, label: 'Admins' },
  { value: USER_ROLES.RESTAURANT_OWNER, label: 'Restaurant Owners' },
  { value: USER_ROLES.NURSING_HOME_ADMIN, label: 'Nursing Home Admins' },
  { value: USER_ROLES.NURSING_HOME_USER, label: 'Nursing Home Users' }
];

const ROLE_BADGE_COLORS = {
  [USER_ROLES.USER]: '#10b981',
  [USER_ROLES.ADMIN]: '#ef4444',
  [USER_ROLES.RESTAURANT_OWNER]: '#3b82f6',
  [USER_ROLES.NURSING_HOME_ADMIN]: '#ec4899',
  [USER_ROLES.NURSING_HOME_USER]: '#a855f7'
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { notification, showNotification, hideNotification } = useNotification();
  const [editFormData, setEditFormData] = useState({});
  const [createFormData, setCreateFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: USER_ROLES.USER,
    phone: '',
    nursingHomeFacilityId: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [filters, setFilters] = useState({
    role: 'all',
    search: '',
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({});
  const [facilities, setFacilities] = useState([]);
  const { user: adminUser } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchFacilitiesList({ limit: 200 });
        setFacilities(Array.isArray(res?.data) ? res.data : []);
      } catch {
        setFacilities([]);
      }
    };
    load();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = async () => {
    setLoading(true);
    const result = await fetchAllUsers(filters);
    if (result.success) {
      setUsers(Array.isArray(result.data) ? result.data : []);
      setPagination(result.pagination || {});
    } else {
      setUsers([]);
      setPagination({});
    }
    setLoading(false);
  };

  const handleEditUser = async (formData) => {
    setSaving(true);
    try {
      const result = await updateUserProfile(selectedUser.id, formData);
      if (result.success) {
        await logAdminAction(
          adminUser.id,
          'UPDATE',
          'profiles',
          selectedUser.id,
          selectedUser,
          formData
        );
        const updatedUser = result.data?.data || result.data;
        setUsers(users.map(user =>
          user.id === selectedUser.id ? { ...user, ...(updatedUser || formData) } : user
        ));
        setShowEditModal(false);
        setSelectedUser(null);
        window.dispatchEvent(new CustomEvent('mkd-refresh-notifications'));
        showNotification('User updated successfully', 'success');
      } else {
        const msg = result.error || 'Failed to update user';
        showNotification(msg.split('\n')[0], 'error');
        if (result.serverErrorName || result.serverStack) {
          console.error('[Admin Users] Update failed:', result.serverErrorName || result.error, result.serverStack || '');
        }
      }
    } catch (err) {
      const msg = err?.message || 'Failed to update user profile';
      showNotification(msg.split('\n')[0], 'error');
      console.error('[Admin Users] Update error:', err?.serverErrorName || err?.name, err?.message, err?.serverStack || '');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (formData) => {
    const payload = {
      ...formData,
      nursing_home_facility_id: formData.nursingHomeFacilityId && formData.nursingHomeFacilityId.trim() ? formData.nursingHomeFacilityId.trim() : undefined
    };
    const result = await createUser(payload);
    
    if (result.success) {
      await logAdminAction(
        adminUser.id,
        'CREATE',
        'profiles',
        result.data.id,
        null,
        formData
      );
      
      setUsers([result.data, ...users]);
      
      setShowCreateModal(false);
      setCreateFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: USER_ROLES.USER,
        phone: ''
      });
      setShowPassword(false);
      
      window.dispatchEvent(new CustomEvent('mkd-refresh-notifications'));
      
      showNotification('User created successfully', 'success');
    } else {
      showNotification(`Failed to create user: ${result.error}`, 'error');
    }
  };

  const handleDeleteUser = async () => {
    const result = await deleteUser(selectedUser.id);
    
    if (result.success) {
      await logAdminAction(
        adminUser.id,
        'DELETE',
        'profiles',
        selectedUser.id,
        selectedUser,
        null
      );
      
      setUsers(users.filter(user => user.id !== selectedUser.id));
      
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      
      window.dispatchEvent(new CustomEvent('mkd-refresh-notifications'));
      
      showNotification('User deleted successfully', 'success');
    } else {
      console.error('Failed to delete user:', result.error);
      showNotification(`Failed to delete user: ${result.error}`, 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getRoleBadgeColor = (role) => ROLE_BADGE_COLORS[role] || '#6b7280';
  const getRoleLabel = (role) => ROLE_LABELS[role] || 'User';

  return (
    <div className="admin-users">
      <div className="users-header">
        <div className="header-content">
          <h1>User Management</h1>
          <p>Manage users, restaurant owners, admins, and nursing home staff</p>
        </div>
        <div className="header-actions">
          <button 
            className="create-user-btn"
            onClick={() => setShowCreateModal(true)}
          >
            Create User
          </button>
        </div>
      </div>

      {}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Users</span>
          <span className="stat-value">{users.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Users</span>
          <span className="stat-value">
            {users.filter(u => u.last_login && u.last_login !== 'Never').length}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Users</span>
          <span className="stat-value">
            {users.filter(u => u.role === USER_ROLES.USER).length}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Admins</span>
          <span className="stat-value">
            {users.filter(u => u.role === USER_ROLES.ADMIN).length}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Restaurant Owners</span>
          <span className="stat-value">
            {users.filter(u => u.role === USER_ROLES.RESTAURANT_OWNER).length}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Nursing Home Admins</span>
          <span className="stat-value">
            {users.filter(u => u.role === USER_ROLES.NURSING_HOME_ADMIN).length}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Nursing Home Users</span>
          <span className="stat-value">
            {users.filter(u => u.role === USER_ROLES.NURSING_HOME_USER).length}
          </span>
        </div>
      </div>

      {}
      <div className="users-filters">
        <div className="filter-group">
          <label>Role</label>
          <select 
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })}
          >
            {USER_ROLES_FILTER.map(role => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Name, email, phone..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          />
        </div>

        <div className="filter-group">
          <label>Per Page</label>
          <select 
            value={filters.limit}
            onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), page: 1 })}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {}
      <div className="users-table-container">
        {loading ? (
          <div className="users-loading">
            <LoadingSpinner size="large" />
            <p>Loading users...</p>
          </div>
        ) : (
          <>
            <div className="users-table-scroll">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="user-id">
                        {user.id}
                      </td>
                      <td className="user-name">
                        <div className="name-info">
                          <div className="full-name">
                            {user.first_name} {user.last_name}
                          </div>
                        </div>
                      </td>
                      <td className="user-email">
                        {user.email}
                      </td>
                      <td className="user-phone">
                        {formatPhoneNumber(user.phone_number)}
                      </td>
                      <td className="user-role">
                        <span 
                          className="role-badge"
                          style={{ 
                            backgroundColor: getRoleBadgeColor(user.role),
                            color: 'white'
                          }}
                        >
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="user-joined">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="user-login">
                        {user.last_login ? formatDate(user.last_login) : 'Never'}
                      </td>
                      <td className="user-actions">
                        <button
                          className="view-btn"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserModal(true);
                          }}
                        >
                          View
                        </button>
                        <button
                          className="edit-btn"
                          onClick={() => {
                            setSelectedUser(user);
                            setEditFormData({
                              first_name: user.first_name,
                              last_name: user.last_name,
                              email: user.email,
                              phone_number: user.phone_number,
                              role: user.role,
                              nursing_home_facility_id: user.nursing_home_facility_id || user.nursingHomeFacilityId || ''
                            });
                            setShowEditModal(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {}
            <div className="pagination">
              <div className="pagination-info">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} users
              </div>
              <div className="pagination-controls">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {}
      {showUserModal && selectedUser && (
        <div className="admin-users__overlay" onClick={() => setShowUserModal(false)}>
          <div className="admin-users__modal admin-users__modal--view" onClick={(e) => e.stopPropagation()}>
            <div className="admin-users__modal-header">
              <h2>User Details</h2>
              <button 
                className="admin-users__modal-close"
                onClick={() => setShowUserModal(false)}
              >
                ×
              </button>
            </div>
            <div className="admin-users__modal-content">
              <div className="admin-users__overview">
                <h3>{selectedUser.first_name} {selectedUser.last_name}</h3>
                
                <div className="admin-users__info-grid">
                  <div className="admin-users__info-item">
                    <label>User ID:</label>
                    <span>{selectedUser.id}</span>
                  </div>
                  <div className="admin-users__info-item">
                    <label>Email:</label>
                    <span>{selectedUser.email}</span>
                  </div>
                  <div className="admin-users__info-item">
                    <label>Phone:</label>
                    <span>{formatPhoneNumber(selectedUser.phone_number)}</span>
                  </div>
                  <div className="admin-users__info-item">
                    <label>Role:</label>
                    <span className="admin-users__role-badge" style={{ backgroundColor: getRoleBadgeColor(selectedUser.role), color: 'white' }}>
                      {getRoleLabel(selectedUser.role)}
                    </span>
                  </div>
                  <div className="admin-users__info-item">
                    <label>Joined:</label>
                    <span>{formatDate(selectedUser.created_at)}</span>
                  </div>
                  <div className="admin-users__info-item">
                    <label>Last Login:</label>
                    <span>{selectedUser.last_login ? formatDate(selectedUser.last_login) : 'Never'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {showEditModal && selectedUser && (
        <div className="admin-users__overlay" onClick={() => setShowEditModal(false)}>
          <div className="admin-users__modal admin-users__modal--edit" onClick={(e) => e.stopPropagation()}>
            <div className="admin-users__modal-header">
              <h2>Edit User</h2>
              <button 
                className="admin-users__modal-close"
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>
            <div className="admin-users__modal-content">
              <form onSubmit={(e) => {
                e.preventDefault();
                handleEditUser(editFormData);
              }}>
                <div className="admin-users__form-grid">
                  <div className="admin-users__form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={editFormData.first_name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="admin-users__form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={editFormData.last_name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="admin-users__form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={editFormData.email || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="admin-users__form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      value={formatPhoneForInput(editFormData.phone_number)}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                          setEditFormData({ ...editFormData, phone_number: value });
                        }
                      }}
                      placeholder="1234567890"
                    />
                  </div>
                  <div className="admin-users__form-group">
                    <label>Role *</label>
                    <select
                      value={editFormData.role || USER_ROLES.USER}
                      onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                      required
                    >
                      <option value={USER_ROLES.USER}>{ROLE_LABELS[USER_ROLES.USER]}</option>
                      <option value={USER_ROLES.ADMIN}>{ROLE_LABELS[USER_ROLES.ADMIN]}</option>
                      <option value={USER_ROLES.RESTAURANT_OWNER}>{ROLE_LABELS[USER_ROLES.RESTAURANT_OWNER]}</option>
                      <option value={USER_ROLES.NURSING_HOME_ADMIN}>{ROLE_LABELS[USER_ROLES.NURSING_HOME_ADMIN]}</option>
                      <option value={USER_ROLES.NURSING_HOME_USER}>{ROLE_LABELS[USER_ROLES.NURSING_HOME_USER]}</option>
                    </select>
                  </div>
                  {(editFormData.role === USER_ROLES.NURSING_HOME_ADMIN || editFormData.role === USER_ROLES.NURSING_HOME_USER) && (
                    <div className="admin-users__form-group">
                      <label>Nursing Home Facility</label>
                      <select
                        value={editFormData.nursing_home_facility_id || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, nursing_home_facility_id: e.target.value })}
                      >
                        <option value="">No facility</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="admin-users__form-actions">
                  <button type="button" onClick={() => setShowEditModal(false)} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className="admin-users__save-btn" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {}
      {showCreateModal && (
        <div className="admin-users__overlay" onClick={() => setShowCreateModal(false)}>
          <div className="admin-users__modal admin-users__modal--edit" onClick={(e) => e.stopPropagation()}>
            <div className="admin-users__modal-header">
              <h2>Create New User</h2>
              <button 
                className="admin-users__modal-close"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowPassword(false);
                }}
              >
                ×
              </button>
            </div>
            <div className="admin-users__modal-content">
              <form onSubmit={(e) => {
                e.preventDefault();
                handleCreateUser(createFormData);
              }}>
                <div className="admin-users__form-grid">
                  <div className="admin-users__form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={createFormData.firstName}
                      onChange={(e) => setCreateFormData({ ...createFormData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="admin-users__form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={createFormData.lastName}
                      onChange={(e) => setCreateFormData({ ...createFormData, lastName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="admin-users__form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={createFormData.email}
                      onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="admin-users__form-group">
                    <label>Password *</label>
                    <div className="admin-users__password-input">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={createFormData.password}
                        onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="admin-users__password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          {showPassword ? (
                            <>
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </>
                          ) : (
                            <>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="admin-users__form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      value={formatPhoneForInput(createFormData.phone)}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                          setCreateFormData({ ...createFormData, phone: value });
                        }
                      }}
                      placeholder="1234567890"
                    />
                  </div>
                  <div className="admin-users__form-group">
                    <label>Role *</label>
                    <select
                      value={createFormData.role}
                      onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value })}
                      required
                    >
                      <option value={USER_ROLES.USER}>{ROLE_LABELS[USER_ROLES.USER]}</option>
                      <option value={USER_ROLES.ADMIN}>{ROLE_LABELS[USER_ROLES.ADMIN]}</option>
                      <option value={USER_ROLES.RESTAURANT_OWNER}>{ROLE_LABELS[USER_ROLES.RESTAURANT_OWNER]}</option>
                      <option value={USER_ROLES.NURSING_HOME_ADMIN}>{ROLE_LABELS[USER_ROLES.NURSING_HOME_ADMIN]}</option>
                      <option value={USER_ROLES.NURSING_HOME_USER}>{ROLE_LABELS[USER_ROLES.NURSING_HOME_USER]}</option>
                    </select>
                  </div>
                  {(createFormData.role === USER_ROLES.NURSING_HOME_ADMIN || createFormData.role === USER_ROLES.NURSING_HOME_USER) && (
                    <div className="admin-users__form-group">
                      <label>Nursing Home Facility</label>
                      <select
                        value={createFormData.nursingHomeFacilityId || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, nursingHomeFacilityId: e.target.value })}
                      >
                        <option value="">No facility</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="admin-users__form-actions">
                  <button type="button" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="admin-users__save-btn">
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {}
      {showDeleteConfirm && selectedUser && (
        <div className="admin-users__overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="admin-users__modal admin-users__modal--delete" onClick={(e) => e.stopPropagation()}>
            <div className="admin-users__modal-header">
              <h2>Confirm Delete</h2>
              <button 
                className="admin-users__modal-close"
                onClick={() => setShowDeleteConfirm(false)}
              >
                ×
              </button>
            </div>
            <div className="admin-users__modal-content">
              <p>
                Are you sure you want to delete the user <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>?
              </p>
              <p className="admin-users__warning">
                This action cannot be undone and will permanently delete all user data including orders, preferences, and payment methods.
              </p>
              <div className="admin-users__form-actions">
                <button onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </button>
                <button className="admin-users__delete-confirm-btn" onClick={handleDeleteUser}>
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {}
      <NotificationToast 
        notification={notification} 
        onClose={hideNotification} 
      />
    </div>
  );
};

export default AdminUsers; 