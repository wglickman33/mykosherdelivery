import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchResidentOrders,
  fetchFacilitiesList,
  fetchResidentOrderRefunds,
  processResidentOrderRefund
} from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import Pagination from '../Pagination/Pagination';
import './AdminNursingHomes.scss';

const statusLabels = {
  draft: 'Draft',
  submitted: 'Submitted',
  paid: 'Paid',
  cancelled: 'Cancelled',
  refunded: 'Refunded'
};

const formatCurrency = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

const OrdersTab = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [facilities, setFacilities] = useState([]);
  const [facilityFilter, setFacilityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundType, setRefundType] = useState('full');
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [processingRefund, setProcessingRefund] = useState(false);
  const [refundError, setRefundError] = useState(null);

  const loadFacilities = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetchFacilitiesList({ limit: 200 });
      setFacilities(res?.data || []);
    } catch {
      setFacilities([]);
    }
  }, [isAdmin]);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit };
      if (isAdmin && facilityFilter) params.facilityId = facilityFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await fetchResidentOrders(params);
      const body = res?.data;
      setOrders(Array.isArray(body?.data) ? body.data : []);
      setPagination(body?.pagination || { page, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, facilityFilter, statusFilter, page, limit]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const loadRefunds = useCallback(async (orderId) => {
    if (!orderId) return;
    setRefundsLoading(true);
    try {
      const res = await fetchResidentOrderRefunds(orderId);
      setRefunds(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setRefunds([]);
    } finally {
      setRefundsLoading(false);
    }
  }, []);

  const openDetail = (order) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
    setRefundError(null);
    setRefundType('full');
    setRefundAmount(0);
    setRefundReason('');
    setRefundModalOpen(false);
    if (order?.id) loadRefunds(order.id);
  };

  const closeDetail = () => {
    setDetailModalOpen(false);
    setSelectedOrder(null);
    setRefunds([]);
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString();
  };

  const orderTotal = parseFloat(selectedOrder?.total || 0);
  const totalRefunded = refunds
    .filter((r) => r.status === 'processed')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const remainingRefundable = orderTotal - totalRefunded;
  const canRefund = selectedOrder?.paymentStatus === 'paid' && remainingRefundable > 0;

  const handleOpenRefundModal = () => {
    setRefundType('full');
    setRefundAmount(remainingRefundable);
    setRefundReason('');
    setRefundError(null);
    setRefundModalOpen(true);
  };

  const handleSubmitRefund = async (e) => {
    e.preventDefault();
    if (!selectedOrder?.id || !refundReason.trim()) return;
    const amount = refundType === 'full' ? remainingRefundable : parseFloat(refundAmount);
    if (amount <= 0 || amount > remainingRefundable) {
      setRefundError('Invalid refund amount');
      return;
    }
    setProcessingRefund(true);
    setRefundError(null);
    try {
      const res = await processResidentOrderRefund(selectedOrder.id, {
        amount,
        reason: refundReason.trim(),
        refundType
      });
      if (res?.success) {
        setRefundModalOpen(false);
        setRefundReason('');
        setRefundAmount(0);
        loadRefunds(selectedOrder.id);
        loadOrders();
        if (res?.data?.refund) {
          setRefunds((prev) => [res.data.refund, ...prev]);
        }
      } else {
        setRefundError(res?.message || res?.error || 'Refund failed');
      }
    } catch (err) {
      setRefundError(err.response?.data?.message || err.response?.data?.error || err.message || 'Refund failed');
    } finally {
      setProcessingRefund(false);
    }
  };

  return (
    <div className="orders-tab">
      <div className="tab-header">
        <h2>Nursing Home Orders</h2>
      </div>

      {isAdmin && facilities.length > 0 && (
        <div className="filters-row">
          <label>
            <span>Facility</span>
            <select value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)}>
              <option value="">All facilities</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
      )}

      {error && (
        <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />
      )}

      {loading ? (
        <LoadingSpinner size="large" />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table" role="grid">
              <thead>
                <tr>
                  {isAdmin && <th>Facility</th>}
                  <th>Resident</th>
                  <th>Room</th>
                  <th>Week</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="orders-tab-empty-cell">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id}>
                      {isAdmin && (
                        <td>{o.facility ? o.facility.name : '—'}</td>
                      )}
                      <td>{o.resident ? o.resident.name : '—'}</td>
                      <td>{o.resident?.roomNumber || '—'}</td>
                      <td>{o.weekStartDate ? formatDate(o.weekStartDate) : '—'}</td>
                      <td>{statusLabels[o.status] || o.status || '—'}</td>
                      <td>{o.paymentStatus || '—'}</td>
                      <td>{o.total != null ? formatCurrency(o.total) : '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => openDetail(o)}
                        >
                          View / Refund
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="orders-tab__pagination pagination-footer">
            <Pagination
              page={page}
              totalPages={Math.max(1, pagination.totalPages)}
              rowsPerPage={limit}
              total={pagination.total}
              onPageChange={(p) => setPage(p)}
              onRowsPerPageChange={(n) => { setLimit(n); setPage(1); }}
              rowsPerPageOptions={[10, 20, 30, 40, 50]}
            />
          </div>
        </>
      )}

      {detailModalOpen && selectedOrder && (
        <div
          className="orders-tab__modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-title"
          onClick={closeDetail}
        >
          <div
            className="orders-tab__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="orders-tab__modal-header">
              <h2 id="order-detail-title">Order {selectedOrder.orderNumber}</h2>
              <button type="button" className="orders-tab__modal-close" onClick={closeDetail} aria-label="Close">
                ×
              </button>
            </div>
            <div className="orders-tab__modal-body">
              <section className="orders-tab__detail-section">
                <h3>Details</h3>
                <dl className="orders-tab__detail-list">
                  <dt>Resident</dt>
                  <dd>{selectedOrder.resident?.name ?? selectedOrder.residentName ?? '—'}</dd>
                  <dt>Room</dt>
                  <dd>{selectedOrder.resident?.roomNumber ?? '—'}</dd>
                  <dt>Week</dt>
                  <dd>
                    {selectedOrder.weekStartDate && selectedOrder.weekEndDate
                      ? `${formatDate(selectedOrder.weekStartDate)} – ${formatDate(selectedOrder.weekEndDate)}`
                      : '—'}
                  </dd>
                  <dt>Status</dt>
                  <dd>{statusLabels[selectedOrder.status] || selectedOrder.status}</dd>
                  <dt>Payment</dt>
                  <dd>{selectedOrder.paymentStatus || '—'}</dd>
                  <dt>Total</dt>
                  <dd>{formatCurrency(selectedOrder.total)}</dd>
                </dl>
              </section>

              <section className="orders-tab__refunds-section">
                <h3>Refunds</h3>
                {refundsLoading ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <>
                    <div className="orders-tab__refund-summary">
                      <span>Order total: {formatCurrency(orderTotal)}</span>
                      <span>Refunded: {formatCurrency(totalRefunded)}</span>
                      <span>Remaining: {formatCurrency(remainingRefundable)}</span>
                    </div>
                    {refunds.length > 0 && (
                      <ul className="orders-tab__refunds-list">
                        {refunds.map((r) => (
                          <li key={r.id} className="orders-tab__refund-item">
                            <span className="orders-tab__refund-amount">{formatCurrency(r.amount)}</span>
                            <span className={`orders-tab__refund-status orders-tab__refund-status--${r.status}`}>
                              {r.status === 'processed' ? 'Processed' : r.status === 'pending' ? 'Pending' : 'Failed'}
                            </span>
                            <span className="orders-tab__refund-reason">{r.reason}</span>
                            <span className="orders-tab__refund-date">
                              {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {canRefund && (
                      <div className="orders-tab__refund-actions">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={handleOpenRefundModal}
                        >
                          Process refund
                        </button>
                      </div>
                    )}
                    {selectedOrder.paymentStatus === 'paid' && remainingRefundable <= 0 && (
                      <p className="orders-tab__refund-note">This order has been fully refunded.</p>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {refundModalOpen && selectedOrder && (
        <div
          className="orders-tab__modal-overlay orders-tab__refund-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-modal-title"
          onClick={() => !processingRefund && setRefundModalOpen(false)}
        >
          <div
            className="orders-tab__modal orders-tab__refund-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="orders-tab__modal-header">
              <h2 id="refund-modal-title">Process refund</h2>
              <button
                type="button"
                className="orders-tab__modal-close"
                onClick={() => !processingRefund && setRefundModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitRefund} className="orders-tab__refund-form">
              <div className="orders-tab__refund-form-row">
                <span>Remaining refundable: {formatCurrency(remainingRefundable)}</span>
              </div>
              <div className="orders-tab__refund-form-row">
                <label>
                  <input
                    type="radio"
                    name="refundType"
                    value="full"
                    checked={refundType === 'full'}
                    onChange={() => {
                      setRefundType('full');
                      setRefundAmount(remainingRefundable);
                    }}
                  />
                  Full refund
                </label>
                <label>
                  <input
                    type="radio"
                    name="refundType"
                    value="partial"
                    checked={refundType === 'partial'}
                    onChange={() => setRefundType('partial')}
                  />
                  Partial refund
                </label>
              </div>
              {refundType === 'partial' && (
                <div className="orders-tab__refund-form-row">
                  <label htmlFor="nh-refund-amount">
                    Amount
                    <input
                      id="nh-refund-amount"
                      type="number"
                      min="0.01"
                      max={remainingRefundable}
                      step="0.01"
                      value={refundAmount || ''}
                      onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                    />
                  </label>
                  <span className="orders-tab__refund-form-hint">Max: {formatCurrency(remainingRefundable)}</span>
                </div>
              )}
              <div className="orders-tab__refund-form-row">
                <label htmlFor="nh-refund-reason">
                  Reason (required)
                  <textarea
                    id="nh-refund-reason"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Reason for refund..."
                    rows={3}
                    required
                  />
                </label>
              </div>
              {refundError && (
                <ErrorMessage message={refundError} type="error" onDismiss={() => setRefundError(null)} />
              )}
              <div className="orders-tab__refund-form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => !processingRefund && setRefundModalOpen(false)}
                  disabled={processingRefund}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    processingRefund ||
                    !refundReason.trim() ||
                    (refundType === 'full' ? false : refundAmount <= 0 || refundAmount > remainingRefundable)
                  }
                >
                  {processingRefund ? 'Processing…' : 'Submit refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
