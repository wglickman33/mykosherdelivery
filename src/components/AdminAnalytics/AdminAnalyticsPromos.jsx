import './AdminAnalytics.scss';
import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Typography, Box } from '@mui/material';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import MaterialChart from './MaterialChart';
import AdminAnalyticsTheme from './AdminAnalyticsTheme';
import AnalyticsNavigation from './AnalyticsNavigation';
import { fetchPromosAnalytics } from '../../services/adminServices';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0);

const AdminAnalyticsPromos = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchPromosAnalytics(period);
      if (result.success && result.data) setData(result.data);
      else setData(null);
    } catch (err) {
      console.error('Error fetching promos analytics:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="admin-analytics">
        <AnalyticsNavigation />
        <div className="admin-analytics-loading">
          <LoadingSpinner />
          <p>Loading promos analytics...</p>
        </div>
      </div>
    );
  }

  const byPeriod = data?.byPeriod ?? [];
  const topCodes = data?.topCodes ?? [];
  const summary = data?.summary ?? {};

  return (
    <div className="admin-analytics">
      <AnalyticsNavigation />
      <div className="analytics-content">
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-content">
              <h3>Total promo codes</h3>
              <p className="metric-value">{(summary.totalCodes ?? 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-content">
              <h3>Total redemptions</h3>
              <p className="metric-value">{(summary.totalRedemptions ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="chart-section">
          <div className="chart-header">
            <h3>Redemptions by period</h3>
            <div className="chart-controls">
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="period-selector">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={byPeriod}
              valueKey="redemptions"
              labelKey="period"
              chartColor="#8b5cf6"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>{item.label}</Typography>
                  <Typography variant="body2">Redemptions: {item.redemptions}</Typography>
                  <Typography variant="body2">Revenue (with promo): {formatCurrency(item.revenueWithPromo)}</Typography>
                </Box>
              )}
            />
          </ThemeProvider>
        </div>
        <div className="chart-section">
          <h3>Top promo codes by usage</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Code</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Value</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Usage</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Active</th>
                </tr>
              </thead>
              <tbody>
                {topCodes.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px' }}>{row.code}</td>
                    <td style={{ padding: '8px' }}>{row.discountType}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{row.discountType === 'percentage' ? `${row.discountValue}%` : formatCurrency(row.discountValue)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{row.usageCount ?? 0}</td>
                    <td style={{ padding: '8px' }}>{row.active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPromos;
