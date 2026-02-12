import './AdminAnalytics.scss';
import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Typography, Box } from '@mui/material';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import MaterialChart from './MaterialChart';
import AdminAnalyticsTheme from './AdminAnalyticsTheme';
import AnalyticsNavigation from './AnalyticsNavigation';
import { fetchSupportAnalytics } from '../../services/adminServices';

const AdminAnalyticsSupport = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchSupportAnalytics();
      if (result.success && result.data) setData(result.data);
      else setData(null);
    } catch (err) {
      console.error('Error fetching support analytics:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="admin-analytics">
        <AnalyticsNavigation />
        <div className="admin-analytics-loading">
          <LoadingSpinner />
          <p>Loading support analytics...</p>
        </div>
      </div>
    );
  }

  const byPeriod = data?.byPeriod ?? [];
  const byStatus = data?.byStatus ?? [];

  return (
    <div className="admin-analytics">
      <AnalyticsNavigation />
      <div className="analytics-content">
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-content">
              <h3>Total tickets</h3>
              <p className="metric-value">{(data?.total ?? 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-content">
              <h3>Open</h3>
              <p className="metric-value">{(data?.open ?? 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-content">
              <h3>Closed</h3>
              <p className="metric-value">{(data?.closed ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="chart-section">
          <h3>Tickets by period (last 12 months)</h3>
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={byPeriod}
              valueKey="count"
              labelKey="period"
              chartColor="#f59e0b"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>{item.label}</Typography>
                  <Typography variant="body2">Tickets: {item.count}</Typography>
                </Box>
              )}
            />
          </ThemeProvider>
        </div>
        <div className="chart-section">
          <h3>Tickets by status</h3>
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={byStatus}
              valueKey="count"
              labelKey="status"
              chartColor="#06b6d4"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>{item.status}</Typography>
                  <Typography variant="body2">Count: {item.count}</Typography>
                </Box>
              )}
            />
          </ThemeProvider>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsSupport;
