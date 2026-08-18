import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchResidentOrders,
  fetchFacilitiesList,
  fetchResidentOrderRefunds,
  processResidentOrderRefund,
  runMonthlyBilling
} from '../../services/nursingHomeService';
import { sendNhMonthlyBillingEmail } from '../../services/paymentServices';
import {
  formatNhPaymentLabel,
  formatNhStatusLabel,
  formatNhWeekRange
} from '../../utils/nursingHomeOrderUtils';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import Pagination from '../Pagination/Pagination';
import NhMealsByDay from '../NursingHomeShared/NhMealsByDay';
import './AdminNursingHomes.scss';

const formatPlacedBy = (order) => {
  const creator = order?.createdBy;
  if (!creator) return order?.createdByUserId ? 'Staff / admin' : '—';
  const name = [creator.firstName, creator.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (creator.email) return creator.email;
  if (creator.role === 'nursing_home_user') return 'Resident';
  if (creator.role === 'nursing_home_admin') return 'Facility staff';
  if (creator.role === 'admin') return 'Platform admin';
  return creator.role || '—';
};

const formatCurrency = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

const STATUS_FILTERS = [
  { value: '', label: 'All orders' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'paid', label: 'Paid' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

const OrdersTab = () => {
  const navigate = useNavigate();
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

  const [billingRunning, setBillingRunning] = useState(false);
  const [billingResult, setBillingResult] = useState(null);
  const [billingError, setBillingError] = useState(null);

  const selectedFacilityId = isAdmin
    ? facilityFilter
    : (user?.nursingHomeFacilityId || '');

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
      setOrders(Array.isArray(res?.data) ? res.data : []);
      setPagination(res?.pagination || { page, total: 0, totalPages: 0 });
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
      const list = await fetchResidentOrderRefunds(orderId);
      setRefunds(Array.isArray(list) ? list : []);
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

  const billedMonthlyCount = orders.filter((o) => o.paymentStatus === 'pending_monthly').length;
  const submittedCount = orders.filter((o) => o.status === 'submitted').length;

  const orderTotal = parseFloat(selectedOrder?.total || 0);
  const totalRefunded = refunds
    .filter((r) => r.status === 'processed')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const remainingRefundable = orderTotal - totalRefunded;
  const canRefund = selectedOrder?.paymentStatus === 'paid' && remainingRefundable > 0;
  const detailResident = selectedOrder?.resident?.name ?? selectedOrder?.residentName ?? '—';
  const detailRoom = selectedOrder?.resident?.roomNumber ?? selectedOrder?.roomNumber;
  const detailFacility = selectedOrder?.facility?.name;
  const detailSubtitle = selectedOrder
    ? [
        detailFacility,
        detailResident !== '—' ? detailResident : null,
        detailRoom ? `Room ${detailRoom}` : null
      ].filter(Boolean).join(' · ')
    : '';

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
      setRefundModalOpen(false);
      setRefundReason('');
      setRefundAmount(0);
      await loadRefunds(selectedOrder.id);
      loadOrders();
      if (res?.refund) {
        setRefunds((prev) => {
          if (prev.some((r) => r.id === res.refund.id)) return prev;
          return [res.refund, ...prev];
        });
      }
    } catch (err) {
      setRefundError(err.response?.data?.message || err.response?.data?.error || err.message || 'Refund failed');
    } finally {
      setProcessingRefund(false);
    }
  };

  const handleRunMonthlyBilling = async () => {
    if (!selectedFacilityId) return;
    setBillingRunning(true);
    setBillingError(null);
    setBillingResult(null);
    try {
      const summary = await runMonthlyBilling(selectedFacilityId);
      const charged = Array.isArray(summary?.charged) ? summary.charged : [];
      for (const row of charged) {
        if (!row.billingEmail) continue;
        try {
          await sendNhMonthlyBillingEmail({
            billingEmail: row.billingEmail,
            billingName: row.billingName || row.residentName,
            residentName: row.residentName,
            facilityName: row.facilityName,
            orderIds: row.orderIds || [],
            orderNumbers: row.orderNumbers || [],
            orderCount: row.orderCount,
            amount: row.amount,
            subtotal: row.subtotal,
            tax: row.tax,
            weeks: row.weeks || []
          });
        } catch {
          /* EmailJS failure should not block billing summary */
        }
      }
      setBillingResult(summary);
      loadOrders();
    } catch (err) {
      setBillingError(
        err.response?.data?.message || err.response?.data?.error || err.message || 'Monthly billing failed'
      );
    } finally {
      setBillingRunning(false);
    }
  };

  return (
    <div className="orders-tab">
      <div className="orders-tab__header">
        <div className="orders-tab__header-content">
          <h2>Nursing Home Orders</h2>
          <p>Weekly resident meal orders and billing. Amounts roll into monthly invoices.</p>
        </div>
        <div className="orders-tab__header-actions">
          {isAdmin && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const qs = facilityFilter ? `?facilityId=${encodeURIComponent(facilityFilter)}` : '';
                navigate(`/admin/orders/nursing-homes${qs}`);
              }}
            >
              Open in Admin Orders
            </button>
          )}
          {selectedFacilityId && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleRunMonthlyBilling}
              disabled={billingRunning}
            >
              {billingRunning ? 'Running…' : 'Run monthly billing'}
            </button>
          )}
        </div>
        <div className="orders-tab__header-stats">
          <div className="orders-tab__stat-card">
            <span className="orders-tab__stat-label">Total orders</span>
            <span className="orders-tab__stat-value">{pagination.total || 0}</span>
          </div>
          <div className="orders-tab__stat-card">
            <span className="orders-tab__stat-label">Submitted</span>
            <span className="orders-tab__stat-value">{submittedCount}</span>
          </div>
          <div className="orders-tab__stat-card">
            <span className="orders-tab__stat-label">Billed monthly</span>
            <span className="orders-tab__stat-value">{billedMonthlyCount}</span>
          </div>
        </div>
      </div>

      <div className="orders-tab__filters">
        {isAdmin && (
          <div className="orders-tab__filter-group">
            <label htmlFor="nh-mgmt-orders-facility">Facility</label>
            <select
              id="nh-mgmt-orders-facility"
              value={facilityFilter}
              onChange={(e) => {
                setFacilityFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All facilities</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="orders-tab__filter-group">
          <label htmlFor="nh-mgmt-orders-status">Status</label>
          <select
            id="nh-mgmt-orders-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_FILTERS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {billingError && (
        <ErrorMessage message={billingError} type="error" onDismiss={() => setBillingError(null)} />
      )}

      {billingResult && (
        <div className="orders-tab__billing-summary" role="status">
          <strong>Monthly billing complete</strong>
          <span>
            Charged: {billingResult.residentsCharged ?? billingResult.charged?.length ?? 0}
            {billingResult.ordersPaid != null ? ` (${billingResult.ordersPaid} orders)` : ''}
          </span>
          <span>Skipped: {billingResult.residentsSkipped ?? billingResult.skipped?.length ?? 0}</span>
          <span>Errors: {billingResult.failed?.length ?? 0}</span>
          {billingResult.totalCharged != null && (
            <span>Total: {formatCurrency(billingResult.totalCharged)}</span>
          )}
          <button type="button" className="link-btn" onClick={() => setBillingResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <ErrorMessage message={error} type="error" onDismiss={() => setError(null)} />
      )}

      {loading ? (
        <div className="orders-tab__loading">
          <LoadingSpinner size="large" />
          <p>Loading orders…</p>
        </div>
      ) : (
        <div className="orders-tab__table-container">
          <div className="orders-tab__table-scroll">
            <table className="orders-tab__table" role="grid">
              <colgroup>
                <col className="col-order" />
                {isAdmin && <col className="col-facility" />}
                <col className="col-resident" />
                <col className="col-week" />
                <col className="col-status" />
                <col className="col-payment" />
                <col className="col-total" />
                <col className="col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Order #</th>
                  {isAdmin && <th>Facility</th>}
                  <th>Resident</th>
                  <th>Week</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="orders-tab__empty-cell">
                      No nursing home orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const residentName = o.resident?.name || o.residentName || '—';
                    const roomNumber = o.resident?.roomNumber || o.roomNumber;
                    return (
                      <tr key={o.id}>
                        <td className="orders-tab__order-number" title={o.orderNumber || o.id}>
                          {o.orderNumber || (o.id ? String(o.id).slice(0, 8) : '—')}
                        </td>
                        {isAdmin && (
                          <td className="orders-tab__facility" title={o.facility?.name || '—'}>
                            {o.facility?.name || '—'}
                          </td>
                        )}
                        <td
                          className="orders-tab__resident"
                          title={[residentName, roomNumber ? `Room ${roomNumber}` : null].filter(Boolean).join(' · ')}
                        >
                          <div className="orders-tab__resident-name">{residentName}</div>
                          {roomNumber ? (
                            <div className="orders-tab__resident-meta">Room {roomNumber}</div>
                          ) : null}
                        </td>
                        <td className="orders-tab__week" title={formatNhWeekRange(o.weekStartDate, o.weekEndDate)}>
                          {formatNhWeekRange(o.weekStartDate, o.weekEndDate)}
                        </td>
                        <td>
                          <span className={`nh-status-badge nh-status-badge--${o.status || 'draft'}`}>
                            {formatNhStatusLabel(o.status)}
                          </span>
                        </td>
                        <td>
                          <span className={`nh-payment-badge nh-payment-badge--${o.paymentStatus || 'pending'}`}>
                            {formatNhPaymentLabel(o.paymentStatus)}
                          </span>
                        </td>
                        <td className="orders-tab__total">
                          {o.total != null ? formatCurrency(o.total) : '—'}
                        </td>
                        <td className="orders-tab__actions">
                          <button
                            type="button"
                            className="orders-tab__view-btn"
                            onClick={() => openDetail(o)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
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
        </div>
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
            className="orders-tab__modal orders-tab__modal--detail"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="orders-tab__modal-header">
              <div className="orders-tab__modal-heading">
                <p className="orders-tab__modal-kicker">Nursing home order</p>
                <h2 id="order-detail-title">{selectedOrder.orderNumber || 'Order'}</h2>
                {detailSubtitle ? (
                  <p className="orders-tab__modal-sub">{detailSubtitle}</p>
                ) : null}
                <div className="orders-tab__modal-badges">
                  <span className={`nh-status-badge nh-status-badge--${selectedOrder.status || 'draft'}`}>
                    {formatNhStatusLabel(selectedOrder.status)}
                  </span>
                  <span className={`nh-payment-badge nh-payment-badge--${selectedOrder.paymentStatus || 'pending'}`}>
                    {formatNhPaymentLabel(selectedOrder.paymentStatus)}
                  </span>
                </div>
              </div>
              <button type="button" className="orders-tab__modal-close" onClick={closeDetail} aria-label="Close">
                ×
              </button>
            </div>
            <div className="orders-tab__modal-body">
              <section className="orders-tab__panel">
                <h3>Overview</h3>
                <dl className="orders-tab__meta">
                  <div>
                    <dt>Resident</dt>
                    <dd>{detailResident}</dd>
                  </div>
                  <div>
                    <dt>Room</dt>
                    <dd>{detailRoom || '—'}</dd>
                  </div>
                  {detailFacility ? (
                    <div>
                      <dt>Facility</dt>
                      <dd>{detailFacility}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Week</dt>
                    <dd>
                      {selectedOrder.weekStartDate
                        ? formatNhWeekRange(selectedOrder.weekStartDate, selectedOrder.weekEndDate)
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Meals</dt>
                    <dd>
                      {(selectedOrder.totalMeals ?? 0) === 1
                        ? '1 meal'
                        : `${selectedOrder.totalMeals ?? 0} meals`}
                    </dd>
                  </div>
                  <div>
                    <dt>Placed by</dt>
                    <dd>{formatPlacedBy(selectedOrder)}</dd>
                  </div>
                  <div className="orders-tab__meta-total">
                    <dt>Total</dt>
                    <dd>{formatCurrency(selectedOrder.total)}</dd>
                  </div>
                </dl>
              </section>

              <NhMealsByDay meals={selectedOrder.meals} />

              <section className="orders-tab__panel">
                <h3>Refunds</h3>
                {refundsLoading ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <>
                    <div className="orders-tab__metrics">
                      <div className="orders-tab__metric">
                        <span>Order total</span>
                        <strong>{formatCurrency(orderTotal)}</strong>
                      </div>
                      <div className="orders-tab__metric">
                        <span>Refunded</span>
                        <strong>{formatCurrency(totalRefunded)}</strong>
                      </div>
                      <div className="orders-tab__metric">
                        <span>Remaining</span>
                        <strong>{formatCurrency(remainingRefundable)}</strong>
                      </div>
                    </div>
                    {refunds.length > 0 ? (
                      <ul className="orders-tab__refunds-list">
                        {refunds.map((r) => (
                          <li key={r.id} className="orders-tab__refund-item">
                            <div className="orders-tab__refund-item-top">
                              <span className="orders-tab__refund-amount">{formatCurrency(r.amount)}</span>
                              <span className={`orders-tab__refund-status orders-tab__refund-status--${r.status}`}>
                                {r.status === 'processed' ? 'Processed' : r.status === 'pending' ? 'Pending' : 'Failed'}
                              </span>
                            </div>
                            {r.reason ? (
                              <span className="orders-tab__refund-reason">{r.reason}</span>
                            ) : null}
                            <span className="orders-tab__refund-date">
                              {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="orders-tab__refund-empty">No refunds on this order.</p>
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
                    {selectedOrder.paymentStatus === 'pending_monthly' && (
                      <p className="orders-tab__refund-note">
                        This order is billed monthly. Refunds become available after payment is collected.
                      </p>
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
            className="orders-tab__modal orders-tab__modal--refund"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="orders-tab__modal-header">
              <div className="orders-tab__modal-heading">
                <p className="orders-tab__modal-kicker">Refund</p>
                <h2 id="refund-modal-title">Process refund</h2>
                <p className="orders-tab__modal-sub">
                  Remaining refundable: {formatCurrency(remainingRefundable)}
                </p>
              </div>
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
              <div className="orders-tab__refund-type">
                <label className={refundType === 'full' ? 'is-selected' : undefined}>
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
                <label className={refundType === 'partial' ? 'is-selected' : undefined}>
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
