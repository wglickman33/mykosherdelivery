import { useState, useEffect } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import Pagination from '../Pagination/Pagination';
import { fetchAuditLogs } from '../../services/adminServices';

const SettingsLogs = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: 'all',
    table: 'all',
    search: '',
    page: 1,
    limit: 20
  });
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchAuditData();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAuditData = async () => {
    setLoading(true);
    const result = await fetchAuditLogs(filters);
    if (result.success) {
      setAuditLogs(result.data);
      setTotalCount(result.pagination?.total || 0);
    }
    setLoading(false);
  };

  const formatTimestamp = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return '#10b981';
      case 'UPDATE': return '#f59e0b';
      case 'DELETE': return '#ef4444';
      case 'LOGIN': return '#3b82f6';
      case 'LOGOUT': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'CREATE': return 'Add';
      case 'UPDATE': return 'Edit';
      case 'DELETE': return 'Delete';
      case 'LOGIN': return 'Login';
      case 'LOGOUT': return 'Logout';
      default: return action;
    }
  };

  const formatAuditLogData = (log) => {
    if (!log.oldValues && !log.newValues) return 'No changes recorded';

    const changes = [];
    if (log.oldValues && log.newValues) {
      Object.keys(log.newValues).forEach(key => {
        if (log.oldValues[key] !== log.newValues[key]) {
          changes.push(`${key}: "${log.oldValues[key]}" → "${log.newValues[key]}"`);
        }
      });
    } else if (log.newValues) {
      Object.entries(log.newValues).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          changes.push(`${key}: "${value}"`);
        }
      });
    } else if (log.oldValues) {
      Object.entries(log.oldValues).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          changes.push(`${key}: "${value}"`);
        }
      });
    }

    return changes.length > 0 ? changes.slice(0, 2).join(', ') + (changes.length > 2 ? '...' : '') : 'No data';
  };

  const totalPages = Math.ceil((totalCount || 0) / filters.limit) || 1;

  return (
    <div className="audit-logs-tab">
      <div className="audit-filters">
        <div className="filter-group">
          <label>Action Type</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
          >
            <option value="all">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Table</label>
          <select
            value={filters.table}
            onChange={(e) => setFilters({ ...filters, table: e.target.value, page: 1 })}
          >
            <option value="all">All Tables</option>
            <option value="orders">Orders</option>
            <option value="profiles">Users</option>
            <option value="restaurants">Restaurants</option>
            <option value="support_tickets">Support Tickets</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Search Admin</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            placeholder="Search by admin..."
          />
        </div>
      </div>

      {loading ? (
        <div className="audit-loading">
          <LoadingSpinner size="large" />
          <p>Loading audit logs...</p>
        </div>
      ) : (
        <>
          <div className="audit-table-container">
            <div className="audit-table-scroll">
              <table className="audit-table">
                <colgroup>
                  <col className="col-timestamp" />
                  <col className="col-admin" />
                  <col className="col-action" />
                  <col className="col-table" />
                  <col className="col-record" />
                  <col className="col-changes" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Table</th>
                    <th>Record ID</th>
                    <th>Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id}>
                      <td>{formatTimestamp(log.createdAt)}</td>
                      <td>
                        <div className="admin-info">
                          <span className="name">{log.admin?.name || 'Unknown'}</span>
                          <span className="email">{log.admin?.email || 'N/A'}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="action-badge"
                          style={{ backgroundColor: getActionColor(log.action) }}
                        >
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td>{log.tableName}</td>
                      <td className="record-id">{log.recordId}</td>
                      <td className="changes-cell">
                        <div className="changes-summary">
                          {formatAuditLogData(log)}
                        </div>
                        {(log.oldValues || log.newValues) && (
                          <details className="changes-details">
                            <summary>Details</summary>
                            <div className="changes-content">
                              {log.oldValues && (
                                <div className="old-values">
                                  <strong>Before:</strong>
                                  <pre>{JSON.stringify(log.oldValues, null, 2)}</pre>
                                </div>
                              )}
                              {log.newValues && (
                                <div className="new-values">
                                  <strong>After:</strong>
                                  <pre>{JSON.stringify(log.newValues, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pagination-footer">
            <Pagination
              page={filters.page}
              totalPages={totalPages || 1}
              rowsPerPage={filters.limit}
              total={totalCount || 0}
              onPageChange={(p) => setFilters({ ...filters, page: p })}
              onRowsPerPageChange={(n) => setFilters({ ...filters, limit: n, page: 1 })}
              rowsPerPageOptions={[10, 20, 30, 40, 50]}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default SettingsLogs;
