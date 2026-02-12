import './AdminRequests.scss';
import { useEffect, useState, useMemo, useRef } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import { fetchSupportTickets, updateTicketStatus, addTicketResponse } from '../../services/adminServices';

const STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
const STATUS_TITLES = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  resolved: 'Resolved',
  closed: 'Closed'
};

const formatStatusLabel = (status) => {
  const label = STATUS_TITLES[status] || 'Open';
  return label.replace(/\.+$/, '');
};

const deriveType = (ticket) => {
  const raw = (ticket?.type || '').toLowerCase();
  if (raw === 'contact' || raw === 'partner' || raw === 'advertise') return raw;
  const subject = (ticket?.subject || '').toLowerCase();
  if (subject.startsWith('contact')) return 'contact';
  if (subject.startsWith('partner')) return 'partner';
  if (subject.startsWith('advertise')) return 'advertise';
  return 'contact';
};

const formatTypeLabel = (t) => {
  const d = deriveType(t);
  return d.charAt(0).toUpperCase() + d.slice(1);
};

const AdminRequests = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', type: 'all', status: 'all' });
  const [draggingId, setDraggingId] = useState(null);
  const [activeTab, setActiveTab] = useState('board');
  const [dragOverStatus, setDragOverStatus] = useState(null);

  const boardRef = useRef(null);
  const scrollAnimRef = useRef(null);
  const edgeDirRef = useRef(0);

  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await fetchSupportTickets({});
      if (result.success) setTickets(Array.isArray(result.data) ? result.data : []);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const activeStatuses = ['open', 'in_progress', 'waiting'];
    const count = (tickets || []).filter(t => activeStatuses.includes(t?.status)).length;
    window.dispatchEvent(new CustomEvent('mkd-admin-active-requests', { detail: { count } }));
  }, [tickets]);

  const grouped = useMemo(() => {
    const out = { open: [], in_progress: [], waiting: [], resolved: [], closed: [] };
    const q = filters.q.trim().toLowerCase();
    const type = filters.type;
    (tickets || []).forEach(t => {
      if (q) {
        const hay = `${t.subject || ''} ${t.message || ''} ${t.requester_email || ''}`.toLowerCase();
        if (!hay.includes(q)) return;
      }
      if (type !== 'all') {
        const tType = deriveType(t);
        if (tType !== type) return;
      }
      const s = t.status && STATUSES.includes(t.status) ? t.status : 'open';
      out[s].push(t);
    });
    Object.keys(out).forEach(k => out[k].sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0)));
    return out;
  }, [tickets, filters]);

  const filteredList = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const type = filters.type;
    const status = filters.status;
    let list = Array.isArray(tickets) ? [...tickets] : [];
    if (q) {
      list = list.filter(t => (`${t.subject||''} ${t.message||''} ${t.requester_email||''}`).toLowerCase().includes(q));
    }
    if (type !== 'all') list = list.filter(t => deriveType(t) === type);
    if (status !== 'all') list = list.filter(t => t.status === status);
    list.sort((a,b)=> new Date(b.createdAt||0)-new Date(a.createdAt||0));
    return list;
  }, [tickets, filters]);

  const stopAutoScroll = () => {
    edgeDirRef.current = 0;
    if (scrollAnimRef.current) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
  };

  const startAutoScroll = () => {
    if (scrollAnimRef.current) return;
    const step = () => {
      const el = boardRef.current;
      if (!el || edgeDirRef.current === 0) {
        scrollAnimRef.current = null;
        return;
      }
      el.scrollLeft += edgeDirRef.current * 12;
      scrollAnimRef.current = requestAnimationFrame(step);
    };
    scrollAnimRef.current = requestAnimationFrame(step);
  };

  const onDragStart = (id) => setDraggingId(id);
  const onDragOver = (e) => {
    e.preventDefault();
    if (!draggingId) return;
    const el = boardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const EDGE = 80;
    let dir = 0;
    if (e.clientX > rect.right - EDGE) dir = 1;
    else if (e.clientX < rect.left + EDGE) dir = -1;
    edgeDirRef.current = dir;
    if (dir !== 0) startAutoScroll(); else stopAutoScroll();
  };
  const onDragEnter = (status) => { if (draggingId) setDragOverStatus(status); };
  const onDragLeave = (status) => { if (dragOverStatus === status) setDragOverStatus(null); };
  const onDrop = async (status) => {
    if (!draggingId) return;
    const ticket = tickets.find(t => t.id === draggingId);
    if (!ticket || ticket.status === status) { setDraggingId(null); setDragOverStatus(null); stopAutoScroll(); return; }
    const prevDisplay = ticket.status;
    setTickets(prev => prev.map(t => t.id === draggingId ? { ...t, status } : t));
    setDraggingId(null);
    setDragOverStatus(null);
    stopAutoScroll();
    await updateTicketStatus(draggingId, status, prevDisplay);
    
    window.dispatchEvent(new CustomEvent('mkd-refresh-notifications'));
  };

  const submitResponse = async () => {
    if (!selected || !reply.trim()) return;
    setSaving(true);
    const res = await addTicketResponse(selected.id, reply.trim(), isInternal);
    if (res?.success) {
      setReply('');
      setIsInternal(false);
      
      window.dispatchEvent(new CustomEvent('mkd-refresh-notifications'));
    }
    setSaving(false);
  };

  useEffect(() => () => stopAutoScroll(), []);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const onPurgeClosed = async () => {
    setPurging(true);
    try {
      const { deleteClosedSupportTickets } = await import('../../services/adminServices');
      const res = await deleteClosedSupportTickets();
      if (res?.success) {
        setTickets(prev => prev.filter(t => t.status !== 'closed'));
        
        window.dispatchEvent(new CustomEvent('mkd-refresh-notifications'));
      }
    } finally {
      setPurging(false);
      setConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-requests__loading">
        <LoadingSpinner size="large" />
        <p>Loading requests…</p>
      </div>
    );
  }

  return (
    <div className="admin-requests">
      <div className="admin-requests__header">
        <div className="admin-requests__title">
          <h1>Requests</h1>
          <p>Track incoming contact, partnership and advertising requests</p>
        </div>

        <div className="admin-requests__tabs">
          <button className={`admin-requests__tab ${activeTab==='board'?'active':''}`} onClick={()=>setActiveTab('board')}>Board</button>
          <button className={`admin-requests__tab ${activeTab==='inbox'?'active':''}`} onClick={()=>setActiveTab('inbox')}>Inbox</button>
        </div>

        <div className="admin-requests__filters">
          <input
            className="admin-requests__search"
            placeholder="Search subject, message, email"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
          <select
            className="admin-requests__type"
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="all">All Types</option>
            <option value="contact">Contact</option>
            <option value="partner">Partner</option>
            <option value="advertise">Advertise</option>
          </select>
          {activeTab==='inbox' && (
            <select
              className="admin-requests__status"
              value={filters.status}
              onChange={(e)=>setFilters({ ...filters, status: e.target.value })}
            >
              <option value="all">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{formatStatusLabel(s)}</option>)}
            </select>
          )}
        </div>
      </div>

      {activeTab === 'board' ? (
        <div className="admin-requests__board" ref={boardRef}>
          {STATUSES.map((s) => (
            <div
              key={s}
              className={`admin-requests__column admin-requests__column--${s} ${dragOverStatus===s ? 'drag-over' : ''}`}
              onDragOver={onDragOver}
              onDragEnter={()=>onDragEnter(s)}
              onDragLeave={()=>onDragLeave(s)}
              onDrop={() => onDrop(s)}
            >
              <div className="admin-requests__column-header">
                <span className="admin-requests__column-title">{formatStatusLabel(s)}</span>
                <span className="admin-requests__column-count">{grouped[s].length}</span>
              </div>
              <div className="admin-requests__column-body">
                {grouped[s].map((t) => (
                  <div
                    key={t.id}
                    className="admin-requests__card"
                    draggable
                    onDragStart={() => onDragStart(t.id)}
                    onDragEnd={stopAutoScroll}
                    onClick={()=>{ setSelected(t); setActiveTab('inbox'); }}
                    title={`${t.subject || '(no subject)'} — ${t.requester_email || ''}`}
                  >
                    <div className="admin-requests__card-header">
                      <span className={`admin-requests__type-badge admin-requests__type-badge--${deriveType(t)}`}>{formatTypeLabel(t).toUpperCase()}</span>
                      <span className="admin-requests__date">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                    <div className="admin-requests__subject">{t.subject || '(no subject)'}</div>
                    <div className="admin-requests__meta">
                      <span className="admin-requests__requester">{t.requester_name || 'User'}</span>
                      <span className="admin-requests__email">{t.requester_email || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="admin-requests__inbox">
          <div className="admin-requests__table-wrap">
            <table className="admin-requests__table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Requester</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(t => (
                  <tr key={t.id} className={selected?.id===t.id ? 'active' : ''}>
                    <td>{t.id}</td>
                    <td className="truncate" title={t.subject}>{t.subject || '(no subject)'}</td>
                    <td>{formatTypeLabel(t)}</td>
                    <td className="truncate" title={`${t.requester_name||''} • ${t.requester_email||''}`}>{t.requester_name || 'User'} • {t.requester_email || '—'}</td>
                    <td>
                      <span className={`admin-requests__status-pill admin-requests__status-pill--${t.status || 'open'}`}>
                        {formatStatusLabel(t.status)}
                      </span>
                    </td>
                    <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</td>
                    <td><button className="admin-requests__view-btn" onClick={()=>setSelected(t)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="admin-requests__drawer">
              <div className="admin-requests__drawer-header">
                <h3>{selected.subject || '(no subject)'}</h3>
                <button className="admin-requests__drawer-close" onClick={()=>setSelected(null)}>×</button>
              </div>
              <div className="admin-requests__drawer-meta">
                <span className={`admin-requests__type-badge admin-requests__type-badge--${deriveType(selected)}`}>{formatTypeLabel(selected).toUpperCase()}</span>
                <span>{selected.requester_name || 'User'}</span>
                <span>{selected.requester_email || '—'}</span>
                <select value={selected.status} onChange={async (e)=>{
                  const newStatus = e.target.value; setTickets(prev=>prev.map(t=>t.id===selected.id?{...t,status:newStatus}:t)); setSelected({...selected, status:newStatus}); await updateTicketStatus(selected.id, newStatus);
                }}>
                  {STATUSES.map(s => <option key={s} value={s}>{formatStatusLabel(s)}</option>)}
                </select>
              </div>

              <div className="admin-requests__drawer-section">
                <label className="admin-requests__reply-label">Original Message</label>
                <div className="admin-requests__original-msg" title={selected.message || ''}>
                  {selected.message || '—'}
                </div>
              </div>

              <div className="admin-requests__drawer-section">
                <label className="admin-requests__reply-label">Add Response</label>
                <textarea className="admin-requests__reply" value={reply} onChange={(e)=>setReply(e.target.value)} placeholder="Write a reply or add an internal note" />
                <div className="admin-requests__reply-actions">
                  <label className="admin-requests__checkbox">
                    <input type="checkbox" checked={isInternal} onChange={(e)=>setIsInternal(e.target.checked)} /> Internal note
                  </label>
                  <button disabled={saving || !reply.trim()} onClick={submitResponse} className="admin-requests__send-btn">{saving?'Sending…':'Send'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="admin-requests__footer">
        <button className="admin-requests__danger" onClick={()=>setConfirmOpen(true)}>
          Delete Closed Tickets
        </button>
      </div>

      {confirmOpen && (
        <div className="admin-requests__overlay" onClick={()=>setConfirmOpen(false)}>
          <div className="admin-requests__confirm" onClick={(e)=>e.stopPropagation()}>
            <div className="admin-requests__confirm-header">
              <h3>Delete all closed tickets?</h3>
              <button className="admin-requests__drawer-close" onClick={()=>setConfirmOpen(false)}>×</button>
            </div>
            <div className="admin-requests__confirm-body">
              This will permanently delete all tickets with status “Closed”. This action cannot be undone.
            </div>
            <div className="admin-requests__confirm-actions">
              <button onClick={()=>setConfirmOpen(false)}>Cancel</button>
              <button className="admin-requests__danger" disabled={purging} onClick={onPurgeClosed}>{purging ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRequests; 