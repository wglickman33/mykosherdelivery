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
import Pagination from '../Pagination/Pagination';
import './AdminNursingHomes.scss';

const staffOptionLabel = (s) => {
  const name = [s.firstName, s.lastName].filter(Boolean).join(' ').trim();
  if (name && s.email) return `${name} (${s.email})`;
  return name || s.email || 'Staff';
};

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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

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
  const total = residents.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const pagedResidents = residents.slice((safePage - 1) * limit, safePage * limit);

  useEffect(() => {
    setPage(1);
  }, [selectedFacilityId, currentFacilityId]);

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
        Assign each resident to a nursing home staff member (NH Admin) for the portal &quot;Mine&quot; filter.
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
            No staff found for this facility. Add staff under the Staff tab (or Admin Users as Nursing Home Staff), then assign them to residents here.
          </p>
        </div>
      ) : (
        <div className="nh-mgmt-table-container">
          <div className="nh-mgmt-table-scroll">
            <table className="nh-mgmt-table staff-assignment-tab__table" role="grid">
              <colgroup>
                <col className="col-resident" />
                <col className="col-room" />
                <col className="col-assigned" />
                <col className="col-status" />
              </colgroup>
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Room</th>
                  <th>Assigned staff</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedResidents.map((r) => {
                  const assigned = Boolean(r.assignedUserId);
                  return (
                    <tr key={r.id}>
                      <td className="nh-mgmt-table__name">{r.name}</td>
                      <td>{r.roomNumber || '—'}</td>
                      <td>
                        <select
                          className="staff-assignment-tab__select"
                          value={r.assignedUserId || ''}
                          onChange={(e) => handleAssign(r.id, e.target.value || null)}
                          disabled={assigningId === r.id}
                          aria-label={`Assign staff for ${r.name}`}
                        >
                          <option value="">Unassigned</option>
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {staffOptionLabel(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {assigningId === r.id ? (
                          <span className="assigning-label">Saving…</span>
                        ) : assigned ? (
                          <span className="assignment-pill assignment-pill--assigned">Assigned</span>
                        ) : (
                          <span className="assignment-pill assignment-pill--unassigned">Unassigned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="nh-mgmt-table-pagination pagination-footer">
            <Pagination
              page={safePage}
              totalPages={totalPages}
              rowsPerPage={limit}
              total={total}
              onPageChange={setPage}
              onRowsPerPageChange={(n) => { setLimit(n); setPage(1); }}
              rowsPerPageOptions={[10, 20, 50]}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffAssignmentTab;
