import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchResidents,
  fetchFacilitiesList,
  fetchFacility,
  assignResidentToStaff,
  updateResident
} from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import './AdminNursingHomes.scss';

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
      if (!selectedFacilityId && list.length) setSelectedFacilityId(list[0].id);
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
      const [resRes, facRes] = await Promise.all([
        fetchResidents({ facilityId, limit: 200, isActive: 'true' }),
        fetchFacility(facilityId)
      ]);
      const body = resRes?.data;
      setResidents(Array.isArray(body?.data) ? body.data : []);
      const fac = facRes?.data ?? facRes;
      setStaff(fac?.staff || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load data');
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
            {facilities.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        )}
      </div>

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
      ) : (
        <div className="table-wrap">
          <table className="data-table" role="grid">
            <thead>
              <tr>
                <th>Resident</th>
                <th>Room</th>
                <th>Assigned to</th>
                <th aria-label="Actions" />
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
                    >
                      <option value="">Unassigned</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>
                          {[s.firstName, s.lastName].filter(Boolean).join(' ')} ({s.email})
                        </option>
                      ))}
                    </select>
                    {assigningId === r.id && <span className="assigning-label">Saving…</span>}
                  </td>
                  <td />
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
