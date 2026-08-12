import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchResidents,
  fetchFacilitiesList,
  fetchStaffForFacility,
  assignResidentToStaff,
  updateResident
} from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './AdminNursingHomes.scss';

/**
 * Assigns facility staff (e.g. Jason Smith) to residents (e.g. Abraham Smith).
 * Residents and users are different records — this links them for the dashboard "Mine" filter.
 */
const StaffAssignmentTab = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [residents, setResidents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assigningId, setAssigningId] = useState(null);

  const loadFacilities = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetchFacilitiesList({ limit: 200 });
      const list = res?.data || [];
      setFacilities(list);
      setSelectedFacilityId((prev) => {
        if (prev && list.some((f) => f.id === prev)) return prev;
        return list[0]?.id || '';
      });
    } catch {
      setFacilities([]);
    }
  }, [isAdmin]);

  const loadResidentsAndStaff = useCallback(async (facilityId) => {
    if (!facilityId) {
      setResidents([]);
      setStaff([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [resRes, staffRes] = await Promise.all([
        fetchResidents({ facilityId, limit: 200, isActive: 'true' }),
        fetchStaffForFacility(facilityId)
      ]);
      setResidents(Array.isArray(resRes?.data) ? resRes.data : []);
      setStaff(Array.isArray(staffRes) ? staffRes : []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to load data');
      setResidents([]);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  useEffect(() => {
    const fid = isAdmin ? selectedFacilityId : user?.nursingHomeFacilityId;
    loadResidentsAndStaff(fid);
  }, [isAdmin, selectedFacilityId, user?.nursingHomeFacilityId, loadResidentsAndStaff]);

  const handleAssign = async (residentId, assignedUserId) => {
    try {
      setAssigningId(residentId);
      setError(null);
      if (assignedUserId) {
        await assignResidentToStaff(residentId, assignedUserId);
      } else {
        await updateResident(residentId, { assignedUserId: null });
      }
      await loadResidentsAndStaff(isAdmin ? selectedFacilityId : user?.nursingHomeFacilityId);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to assign');
    } finally {
      setAssigningId(null);
    }
  };

  const currentFacilityId = isAdmin ? selectedFacilityId : user?.nursingHomeFacilityId;

  return (
    <div className="staff-assignment-tab">
      <div className="tab-header">
        <h2>Staff Assignment</h2>
        {isAdmin && facilities.length > 0 && (
          <select
            value={selectedFacilityId}
            onChange={(e) => setSelectedFacilityId(e.target.value)}
            className="facility-select"
          >
            <option value="">Select facility</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="tab-hint" style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.9rem' }}>
        Assign a staff user to each resident for the portal &quot;Mine&quot; filter. Residents (meal recipients) are not the same as staff login accounts.
      </p>

      {error && (
        <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />
      )}

      {loading ? (
        <LoadingSpinner size="large" />
      ) : !currentFacilityId ? (
        <div className="content-placeholder">
          <p>Select a facility to manage assignments.</p>
        </div>
      ) : residents.length === 0 ? (
        <div className="content-placeholder">
          <p>No residents in this facility. Add residents in the Residents tab first.</p>
        </div>
      ) : staff.length === 0 ? (
        <div className="content-placeholder">
          <p>
            No staff found for this facility. Add Jason (or other NH users) under the Staff tab or Admin Users with this facility assigned, then come back here to link them to residents.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table" role="grid">
            <thead>
              <tr>
                <th>Resident</th>
                <th>Room</th>
                <th>Assigned staff</th>
                <th aria-label="Status" />
              </tr>
            </thead>
            <tbody>
              {residents.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.roomNumber || '—'}</td>
                  <td>
                    <select
                      value={r.assignedUserId || ''}
                      onChange={(e) => handleAssign(r.id, e.target.value || null)}
                      disabled={assigningId === r.id}
                      aria-label={`Assign staff for ${r.name}`}
                    >
                      <option value="">Unassigned</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {[s.firstName, s.lastName].filter(Boolean).join(' ')} ({s.email})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{assigningId === r.id ? <span className="assigning-label">Saving…</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StaffAssignmentTab;
