import './AdminAnalytics.scss';
import { useState, useEffect, useCallback } from 'react';
import AnalyticsNavigation from './AnalyticsNavigation';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import {
  fetchTaxProfitAnalytics,
  fetchExpenses
} from '../../services/adminServices';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0);

const AdminAnalyticsTaxProfit = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nyTaxRatePct, setNyTaxRatePct] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        startDate,
        endDate,
        ...(nyTaxRatePct !== '' && parseFloat(nyTaxRatePct) >= 0 ? { nyTaxRate: parseFloat(nyTaxRatePct) / 100 } : {})
      };
      const [result, expResult] = await Promise.all([
        fetchTaxProfitAnalytics(params),
        fetchExpenses({ startDate, endDate })
      ]);
      if (result.success && result.data) setData(result.data);
      else setData(null);
      if (expResult.success) setExpenses(expResult.data || []);
      else setExpenses([]);
      if (!result.success && result.error) setError(result.error);
    } catch (err) {
      setError(err?.message || 'Failed to load data');
      setData(null);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, nyTaxRatePct]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ['Tax & Profit Summary', data.period?.startDate, 'to', data.period?.endDate],
      [],
      ['Revenue'],
      ['Subtotal', formatCurrency(data.revenue?.subtotal)],
      ['Delivery fee', formatCurrency(data.revenue?.deliveryFee)],
      ['Tip', formatCurrency(data.revenue?.tip)],
      ['Tax collected', formatCurrency(data.revenue?.tax)],
      ['Discounts', formatCurrency(data.revenue?.discountAmount)],
      ['Total revenue', formatCurrency(data.revenue?.total)],
      [],
      ['Refunds', 'Count', data.refunds?.count, 'Total', formatCurrency(data.refunds?.total)],
      [],
      ['Deductions', 'Total', formatCurrency(data.deductions?.total)],
      ...Object.entries(data.deductions?.byCategory || {}).map(([cat, amt]) => ['', cat, formatCurrency(amt)]),
      [],
      ['Net profit', formatCurrency(data.netProfit)],
      [],
      ['Disclaimer', data.disclaimer || 'Estimate only; not tax advice. Consult a CPA for filing and compliance.']
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tax-profit-${data.period?.startDate}-${data.period?.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (loading) {
    return (
      <div className="admin-analytics">
        <AnalyticsNavigation />
        <div className="admin-analytics-loading">
          <LoadingSpinner />
          <p>Loading tax & profit analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-analytics">
      <AnalyticsNavigation />
      <div className="analytics-content">
        <div className="chart-section">
          <div className="chart-header">
            <h3>Tax & Profit (P&amp;L)</h3>
            <div className="chart-controls tax-profit-controls">
              <label>
                <span>Start</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label>
                <span>End</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
              <label>
                <span>NY tax % (optional)</span>
                <input type="number" min="0" step="0.1" placeholder="e.g. 6.5" value={nyTaxRatePct} onChange={(e) => setNyTaxRatePct(e.target.value)} />
              </label>
              <button type="button" className="period-selector" onClick={fetchData}>Refresh</button>
              {data && (
                <button type="button" className="period-selector" onClick={handleExportCSV}>Export CSV</button>
              )}
            </div>
          </div>

          {error && (
            <div className="tax-profit-error">
              <p>{error}</p>
              <button type="button" className="period-selector" onClick={fetchData}>Try again</button>
            </div>
          )}

          {!error && !data && !loading && (
            <div className="tax-profit-empty-state">
              <p>No data for the selected period. Adjust dates and click Refresh.</p>
            </div>
          )}

          {data && !error && (
            <>
              <div className="tax-profit-disclaimer">
                {data.disclaimer || 'Estimate only; not tax advice. Consult a CPA for filing and compliance.'}
              </div>

              <div className="metrics-grid">
                <div className="metric-card revenue">
                  <div className="metric-content">
                    <h3>Total Revenue</h3>
                    <p className="metric-value">{formatCurrency(data.revenue?.total)}</p>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-content">
                    <h3>Refunds</h3>
                    <p className="metric-value">{formatCurrency(data.refunds?.total)}</p>
                    <span className="metric-change neutral">{data.refunds?.count ?? 0} refunds</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-content">
                    <h3>Deductions</h3>
                    <p className="metric-value">{formatCurrency(data.deductions?.total)}</p>
                  </div>
                </div>
                <div className="metric-card tax-profit-net-card">
                  <div className="metric-content">
                    <h3>Net Profit</h3>
                    <p className="metric-value">{formatCurrency(data.netProfit)}</p>
                  </div>
                </div>
              </div>

              <div className="tax-profit-breakdown-grid">
                <div className="chart-section">
                  <h4>Revenue breakdown</h4>
                  <ul className="tax-profit-breakdown-list">
                    <li><span>Subtotal</span><span>{formatCurrency(data.revenue?.subtotal)}</span></li>
                    <li><span>Delivery fee</span><span>{formatCurrency(data.revenue?.deliveryFee)}</span></li>
                    <li><span>Tip</span><span>{formatCurrency(data.revenue?.tip)}</span></li>
                    <li><span>Tax collected</span><span>{formatCurrency(data.revenue?.tax)}</span></li>
                    <li><span>Discounts</span><span>{formatCurrency(data.revenue?.discountAmount)}</span></li>
                  </ul>
                </div>
                <div className="chart-section">
                  <h4>Deductions by category</h4>
                  {Object.keys(data.deductions?.byCategory || {}).length === 0 ? (
                    <p className="tax-profit-empty-inline">None in this period</p>
                  ) : (
                    <ul className="tax-profit-breakdown-list">
                      {Object.entries(data.deductions?.byCategory || {}).map(([cat, amt]) => (
                        <li key={cat}><span>{cat}</span><span>{formatCurrency(amt)}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {data.nyTaxEstimate != null && (
                <div className="chart-section">
                  <h4>NY tax estimate</h4>
                  <p>Rate: {(data.nyTaxEstimate.rate * 100).toFixed(2)}% — Estimate: {formatCurrency(data.nyTaxEstimate.estimate)}</p>
                </div>
              )}

              {expenses.length > 0 && (
                <div className="chart-section">
                  <h4>Expense entries in period</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="tax-profit-expense-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Category</th>
                          <th className="amount-cell">Amount</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((e) => (
                          <tr key={e.id}>
                            <td>{e.expenseDate}</td>
                            <td>{e.category}</td>
                            <td className="amount-cell">{formatCurrency(e.amount)}</td>
                            <td>{e.note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsTaxProfit;
