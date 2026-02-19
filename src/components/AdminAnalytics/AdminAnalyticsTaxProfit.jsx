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
  const [expensesError, setExpensesError] = useState(null);
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
      setExpensesError(null);
      const numRate = nyTaxRatePct !== '' && !Number.isNaN(parseFloat(nyTaxRatePct)) && parseFloat(nyTaxRatePct) >= 0
        ? parseFloat(nyTaxRatePct) / 100
        : null;
      const params = {
        startDate,
        endDate,
        ...(numRate != null ? { nyTaxRate: numRate } : {})
      };
      const [result, expResult] = await Promise.all([
        fetchTaxProfitAnalytics(params),
        fetchExpenses({ startDate, endDate })
      ]);
      if (result.success && result.data) setData(result.data);
      else setData(null);
      if (!result.success && result.error) setError(result.error);
      if (expResult.success) setExpenses(expResult.data || []);
      else {
        setExpenses([]);
        if (expResult.error) setExpensesError(expResult.error);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load data');
      setData(null);
      setExpenses([]);
      setExpensesError(null);
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
      ['Discounts (reduction)', formatCurrency(-(data.revenue?.discountAmount || 0))],
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
    <div className="admin-analytics tax-profit-page">
      <AnalyticsNavigation />
      <div className="analytics-content tax-profit-content">
        <header className="tax-profit-page-header">
          <h2 className="tax-profit-page-title">Tax & Profit (P&amp;L)</h2>
          <div className="tax-profit-controls">
            <label className="tax-profit-control">
              <span className="tax-profit-control-label">Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" />
            </label>
            <label className="tax-profit-control">
              <span className="tax-profit-control-label">End date</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="End date" />
            </label>
            <label className="tax-profit-control">
              <span className="tax-profit-control-label">NY tax % (optional)</span>
              <input type="number" min="0" step="0.1" placeholder="6.5" value={nyTaxRatePct} onChange={(e) => setNyTaxRatePct(e.target.value)} aria-label="NY tax rate percent" />
            </label>
            <div className="tax-profit-actions">
              <button type="button" className="tax-profit-btn tax-profit-btn--primary" onClick={fetchData}>Refresh</button>
              {data && (
                <button type="button" className="tax-profit-btn tax-profit-btn--secondary" onClick={handleExportCSV}>Export CSV</button>
              )}
            </div>
          </div>
        </header>

        {error && (
          <section className="tax-profit-section tax-profit-error-block">
            <p>{error}</p>
            <button type="button" className="tax-profit-btn tax-profit-btn--primary" onClick={fetchData}>Try again</button>
          </section>
        )}

        {!error && !data && !loading && (
          <section className="tax-profit-section tax-profit-empty-state">
            <p>No data for the selected period. Adjust dates and click Refresh.</p>
          </section>
        )}

        {data && !error && (
          <>
            <section className="tax-profit-section tax-profit-disclaimer" aria-live="polite">
              <p>{data.disclaimer || 'Estimate only; not tax advice. Consult a CPA for filing and compliance.'}</p>
            </section>

            <section className="tax-profit-section tax-profit-kpis" aria-label="Key figures">
              <div className="tax-profit-kpis-grid">
                <div className="tax-profit-kpi tax-profit-kpi--revenue">
                  <span className="tax-profit-kpi-label">Total Revenue</span>
                  <span className="tax-profit-kpi-value">{formatCurrency(data.revenue?.total)}</span>
                </div>
                <div className="tax-profit-kpi">
                  <span className="tax-profit-kpi-label">Refunds</span>
                  <span className="tax-profit-kpi-value">{formatCurrency(data.refunds?.total)}</span>
                  <span className="tax-profit-kpi-meta">{data.refunds?.count ?? 0} refunds</span>
                </div>
                <div className="tax-profit-kpi">
                  <span className="tax-profit-kpi-label">Deductions</span>
                  <span className="tax-profit-kpi-value">{formatCurrency(data.deductions?.total)}</span>
                </div>
                <div className="tax-profit-kpi tax-profit-kpi--net">
                  <span className="tax-profit-kpi-label">Net Profit</span>
                  <span className="tax-profit-kpi-value">{formatCurrency(data.netProfit)}</span>
                </div>
              </div>
            </section>

            <section className="tax-profit-section tax-profit-breakdowns" aria-label="Revenue and deductions breakdown">
              <div className="tax-profit-breakdown-grid">
                <div className="tax-profit-card tax-profit-breakdown-card">
                  <h3 className="tax-profit-card-title">Revenue breakdown</h3>
                  <ul className="tax-profit-breakdown-list">
                    <li><span>Subtotal</span><span>{formatCurrency(data.revenue?.subtotal)}</span></li>
                    <li><span>Delivery fee</span><span>{formatCurrency(data.revenue?.deliveryFee)}</span></li>
                    <li><span>Tip</span><span>{formatCurrency(data.revenue?.tip)}</span></li>
                    <li><span>Tax collected</span><span>{formatCurrency(data.revenue?.tax)}</span></li>
                    <li><span>Discounts (reduction)</span><span className="revenue-reduction">-{formatCurrency(data.revenue?.discountAmount)}</span></li>
                  </ul>
                </div>
                <div className="tax-profit-card tax-profit-breakdown-card">
                  <h3 className="tax-profit-card-title">Deductions by category</h3>
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
            </section>

            {data.nyTaxEstimate != null && (
              <section className="tax-profit-section tax-profit-ny-estimate">
                <h3 className="tax-profit-card-title">Estimated tax on profit (NY %)</h3>
                <p className="tax-profit-ny-text">
                  Rate: {(data.nyTaxEstimate.rate * 100).toFixed(2)}% of net profit — Estimate: {formatCurrency(data.nyTaxEstimate.estimate)}
                  <span className="tax-profit-ny-hint"> (Use the optional NY tax % field above to estimate liability on profit. Not a substitute for professional tax advice.)</span>
                </p>
              </section>
            )}

            <section className="tax-profit-section tax-profit-expenses-section" aria-label="Expense entries">
              <h3 className="tax-profit-card-title">Expense entries in period</h3>
              {expensesError && (
                <p className="tax-profit-expenses-error">Expense list could not be loaded. P&amp;L totals above are still accurate.</p>
              )}
              {!expensesError && expenses.length === 0 && (
                <p className="tax-profit-empty-inline">No expense entries in this period.</p>
              )}
              {!expensesError && expenses.length > 0 && (
                <div className="tax-profit-table-wrap">
                  <table className="tax-profit-expense-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th className="tax-profit-amount-col">Amount</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((e) => (
                        <tr key={e.id}>
                          <td>{e.expenseDate}</td>
                          <td>{e.category}</td>
                          <td className="tax-profit-amount-col">{formatCurrency(e.amount)}</td>
                          <td>{e.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminAnalyticsTaxProfit;
