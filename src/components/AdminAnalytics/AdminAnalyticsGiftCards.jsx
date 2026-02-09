import './AdminAnalytics.scss';
import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Typography, Box } from '@mui/material';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import MaterialChart from './MaterialChart';
import AdminAnalyticsTheme from './AdminAnalyticsTheme';
import AnalyticsNavigation from './AnalyticsNavigation';
import { fetchPlatformAnalytics, fetchGiftCardAnalytics } from '../../services/adminServices';

const AdminAnalyticsGiftCards = () => {
  const [platformData, setPlatformData] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount ?? 0);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [platformResult, trendsResult] = await Promise.all([
        fetchPlatformAnalytics(),
        fetchGiftCardAnalytics(period)
      ]);
      if (platformResult.success && platformResult.data) {
        setPlatformData(platformResult.data);
      }
      if (trendsResult.success && trendsResult.data) {
        setTrendsData(trendsResult.data);
      }
    } catch (error) {
      console.error('Error fetching gift card analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="admin-analytics-loading">
        <LoadingSpinner />
        <p>Loading gift card analytics...</p>
      </div>
    );
  }

  const gc = platformData?.giftCards ?? {};
  const byPeriod = trendsData?.byPeriod ?? [];

  return (
    <div className="admin-analytics">
      <AnalyticsNavigation />
      <div className="analytics-content">
        <div className="metrics-grid">
          <div className="metric-card gift-cards">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M20 6H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm0 12H4v-6h16v6zm0-8H4V8h16v2z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Total Issued Value</h3>
              <p className="metric-value">{formatCurrency(gc.totalIssuedValue)}</p>
              <span className="metric-change neutral">All time</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Total Redeemed</h3>
              <p className="metric-value">{formatCurrency(gc.totalRedeemed)}</p>
              <span className="metric-change neutral">Spent on orders</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Outstanding Balance</h3>
              <p className="metric-value">{formatCurrency(gc.totalOutstandingBalance)}</p>
              <span className="metric-change neutral">Active balance</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Cards by Status</h3>
              <p className="metric-value">{gc.count ?? 0}</p>
              <span className="metric-change neutral">Active: {gc.countActive ?? 0} · Used: {gc.countUsed ?? 0} · Void: {gc.countVoid ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="chart-section">
          <div className="chart-header">
            <h3>Gift Card Value Issued by Period</h3>
            <div className="chart-controls">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="period-selector"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={byPeriod}
              valueKey="valueIssued"
              labelKey="period"
              chartColor="#8b5cf6"
              period={period}
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.label}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Value issued:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(item.valueIssued)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Cards issued:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.countIssued ?? 0}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            />
          </ThemeProvider>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsGiftCards;
