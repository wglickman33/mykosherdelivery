import { useState, useEffect } from 'react';
import mailchimpService from '../../services/mailchimpService';
import './AdminCampaigns.scss';

const AudienceTab = () => {
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);

  useEffect(() => {
    loadLists();
  }, []);

  useEffect(() => {
    if (selectedListId) {
      loadMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId]);

  const loadLists = async () => {
    try {
      const response = await mailchimpService.getLists();
      if (response.success && response.data.lists) {
        setLists(response.data.lists);
        if (response.data.lists.length > 0) {
          setSelectedListId(response.data.lists[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading lists:', err);
      setError('Failed to load lists');
    }
  };

  const loadMembers = async () => {
    if (!selectedListId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await mailchimpService.getListMembers(selectedListId, { count: 50 });
      if (response.success && response.data.members) {
        setMembers(response.data.members);
      } else {
        setError('Failed to load members');
      }
    } catch (err) {
      console.error('Error loading members:', err);
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCustomers = async () => {
    if (!selectedListId) {
      setError('Please select a list first');
      return;
    }

    setSyncing(true);
    setError(null);
    setSyncProgress({ success: 0, failed: 0, total: 0 });

    try {
      const response = await mailchimpService.batchSyncCustomers(selectedListId);
      if (response.success) {
        setSyncProgress(response.data);
        await loadMembers();
      } else {
        setError('Failed to sync customers');
      }
    } catch (err) {
      console.error('Error syncing customers:', err);
      setError('Failed to sync customers');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="audience-tab">
      <div className="section-header">
        <h2>Audience Management</h2>
        <div className="header-actions">
          <select
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            className="list-selector"
          >
            {lists.map(list => (
              <option key={list.id} value={list.id}>
                {list.name} ({list.stats?.member_count || 0} members)
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={handleSyncCustomers}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync All Customers'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {syncProgress && (
        <div className="sync-progress">
          <p>Sync Complete: {syncProgress.success} succeeded, {syncProgress.failed} failed</p>
          {syncProgress.errors && syncProgress.errors.length > 0 && (
            <details>
              <summary>View Errors ({syncProgress.errors.length})</summary>
              <ul>
                {syncProgress.errors.slice(0, 10).map((err, idx) => (
                  <li key={idx}>{err.email}: {err.error}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="audience-info">
        <div className="info-card">
          <h3>List Information</h3>
          {lists.find(l => l.id === selectedListId) && (
            <>
              <p><strong>Name:</strong> {lists.find(l => l.id === selectedListId).name}</p>
              <p><strong>Members:</strong> {lists.find(l => l.id === selectedListId).stats?.member_count || 0}</p>
              <p><strong>Unsubscribes:</strong> {lists.find(l => l.id === selectedListId).stats?.unsubscribe_count || 0}</p>
              <p><strong>Created:</strong> {new Date(lists.find(l => l.id === selectedListId).date_created).toLocaleDateString()}</p>
            </>
          )}
        </div>
      </div>

      <div className="members-section">
        <h3>List Members</h3>
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading members...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No members yet</h3>
            <p>Sync your customers to populate this list.</p>
          </div>
        ) : (
          <div className="members-table">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Total Spent</th>
                  <th>Order Count</th>
                  <th>Last Order</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.email_address}</td>
                    <td>
                      {member.merge_fields?.FNAME || ''} {member.merge_fields?.LNAME || ''}
                    </td>
                    <td>
                      <span className={`status-badge ${member.status}`}>
                        {member.status}
                      </span>
                    </td>
                    <td>${member.merge_fields?.TOTALSPENT || '0.00'}</td>
                    <td>{member.merge_fields?.ORDERCOUNT || '0'}</td>
                    <td>{member.merge_fields?.LASTORDER || 'Never'}</td>
                    <td>
                      {member.tags && member.tags.length > 0
                        ? member.tags.map(tag => tag.name).join(', ')
                        : 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudienceTab;

