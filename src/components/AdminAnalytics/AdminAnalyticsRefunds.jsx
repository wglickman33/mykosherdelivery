import './AdminAnalytics.scss';
import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Typography, Box } from '@mui/material';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import MaterialChart from './MaterialChart';
import AdminAnalyticsTheme from './AdminAnalyticsTheme';
import AnalyticsNavigation from './AnalyticsNavigation';
import { fetchRefundsAnalytics } from '../../services/adminServices';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0);

const AdminAnalyticsRefunds = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchRefundsAnalytics(period);
      if (result.success && result.data) setData(result.data);
      else setData(null);
    } catch (err) {
      console.error('Error fetching refunds analytics:', err);
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
          <p>Loading refunds analytics...</p>
        </div>
      </div>
    );
  }

  const byPeriod = data?.byPeriod ?? [];
  const summary = data?.summary ?? { count: 0, total: 0 };

  return (
    <div className="admin-analytics">
      <AnalyticsNavigation />
      <div className="analytics-content">
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-content">
              <h3>Total refunds (all time)</h3>
              <p className="metric-value">{summary.count?.toLocaleString() ?? 0}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-content">
              <h3>Total amount refunded</h3>
              <p className="metric-value">{formatCurrency(summary.total)}</p>
            </div>
          </div>
        </div>
        <div className="chart-section">
          <div className="chart-header">
            <h3>Refunds by period</h3>
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
              valueKey="total"
              labelKey="period"
              chartColor="#ef4444"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>{item.label}</Typography>
                  <Typography variant="body2">Count: {item.count}</Typography>
                  <Typography variant="body2">Total: {formatCurrency(item.total)}</Typography>
                </Box>
              )}
            />
          </ThemeProvider>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsRefunds;
