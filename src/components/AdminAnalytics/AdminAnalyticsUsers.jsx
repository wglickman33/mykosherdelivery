import './AdminAnalytics.scss';
import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Typography, Box } from '@mui/material';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import MaterialChart from './MaterialChart';
import AdminAnalyticsTheme from './AdminAnalyticsTheme';
import AnalyticsNavigation from './AnalyticsNavigation';
import { 
  fetchUserOverviewMetrics,
  fetchUserRegistrationTrends,
  fetchUserOrderFrequencyDistribution,
  fetchUserValueSegments,
  fetchUserGeographicDistribution,
  fetchUserLifecycleStages,
  fetchUserOrderPatterns
} from '../../services/adminServices';

const AdminAnalyticsUsers = () => {
  const [userOverviewMetrics, setUserOverviewMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [userRegistrationPeriod, setUserRegistrationPeriod] = useState('monthly');
  const [userOrderPatternsPeriod, setUserOrderPatternsPeriod] = useState('30d');
  const [userRegistrationTrends, setUserRegistrationTrends] = useState([]);
  const [userOrderFrequencyDistribution, setUserOrderFrequencyDistribution] = useState([]);
  const [userValueSegments, setUserValueSegments] = useState([]);
  const [userGeographicDistribution, setUserGeographicDistribution] = useState([]);
  const [userLifecycleStages, setUserLifecycleStages] = useState([]);
  const [userOrderPatterns, setUserOrderPatterns] = useState([]);

  const fetchUserAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch user overview metrics (all time)
      const overviewResult = await fetchUserOverviewMetrics();
      if (overviewResult.success) {
        setUserOverviewMetrics(overviewResult.data);
      }

      // Fetch user registration trends
      const registrationResult = await fetchUserRegistrationTrends(userRegistrationPeriod);
      if (registrationResult.success) {
        setUserRegistrationTrends(registrationResult.data);
      }

      // Fetch user order frequency distribution
      const frequencyResult = await fetchUserOrderFrequencyDistribution();
      if (frequencyResult.success) {
        setUserOrderFrequencyDistribution(frequencyResult.data);
      }

      // Fetch user value segments
      const segmentsResult = await fetchUserValueSegments();
      if (segmentsResult.success) {
        setUserValueSegments(segmentsResult.data);
      }

      // Fetch user geographic distribution
      const geoResult = await fetchUserGeographicDistribution();
      if (geoResult.success) {
        setUserGeographicDistribution(geoResult.data);
      }


      // Fetch user lifecycle stages
      const lifecycleResult = await fetchUserLifecycleStages();
      if (lifecycleResult.success) {
        setUserLifecycleStages(lifecycleResult.data);
      }

      // Fetch user order patterns
      const patternsResult = await fetchUserOrderPatterns(userOrderPatternsPeriod);
      if (patternsResult.success) {
        setUserOrderPatterns(patternsResult.data);
      }
    } catch (error) {
      console.error('Error fetching user analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [userRegistrationPeriod, userOrderPatternsPeriod]);

  useEffect(() => {
    fetchUserAnalytics();
  }, [fetchUserAnalytics]);

  if (loading) {
    return (
      <div className="admin-analytics-loading">
        <LoadingSpinner />
        <p>Loading user analytics...</p>
      </div>
    );
  }

  if (!userOverviewMetrics || Object.keys(userOverviewMetrics).length === 0) {
    return (
      <div className="admin-analytics-error">
        <p>Failed to load user analytics. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="admin-analytics">
      <AnalyticsNavigation />
      <div className="analytics-content">
        {/* User Overview Metrics */}
        <div className="metrics-grid">
          <div className="metric-card revenue">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Total Users</h3>
              <p className="metric-value">{userOverviewMetrics.totalUsers?.toLocaleString() || 0}</p>
              <span className="metric-change neutral">All Time</span>
            </div>
          </div>
          
          <div className="metric-card orders">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Active Users</h3>
              <p className="metric-value">{userOverviewMetrics.activeUsers?.toLocaleString() || 0}</p>
              <span className="metric-change neutral">Logged In</span>
            </div>
          </div>

          <div className="metric-card users">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Retained Users</h3>
              <p className="metric-value">{userOverviewMetrics.retainedUsers?.toLocaleString() || 0}</p>
              <span className="metric-change neutral">2+ Orders</span>
            </div>
          </div>

          <div className="metric-card restaurants">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h3>Retention Rate</h3>
              <span className="metric-value">{userOverviewMetrics.retentionRate?.toFixed(1) || 0}%</span>
            </div>
          </div>
        </div>

        {/* User Registration Trends Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>User Registration Trends by {userRegistrationPeriod.charAt(0).toUpperCase() + userRegistrationPeriod.slice(1)}</h3>
            <div className="chart-controls">
              <select 
                value={userRegistrationPeriod} 
                onChange={(e) => setUserRegistrationPeriod(e.target.value)}
                className="period-selector"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            {userRegistrationTrends.length > 0 ? (
              <MaterialChart
                data={userRegistrationTrends}
                valueKey="users"
                labelKey="period"
                chartColor="#3b82f6"
                title=""
                type="line"
                tooltipContent={(item) => (
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {item.label}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">New Users:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {item.users.toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
              />
            ) : (
              <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '8px' }}>
                <Typography variant="h6" color="text.secondary">No Registration Data Available</Typography>
              </div>
            )}
          </ThemeProvider>
        </div>

        {/* User Order Frequency Distribution Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>User Order Frequency Distribution</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={userOrderFrequencyDistribution}
              valueKey="count"
              labelKey="range"
              chartColor="#10b981"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.range}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Users:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.count.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Percentage:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.percentage}%
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Avg Orders:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.avgOrders?.toFixed(1) || 0}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            />
          </ThemeProvider>
        </div>

        {/* User Value Segments Chart */}
        <div className="chart-section" style={{ marginTop: '32px' }}>
          <div className="chart-header">
            <h3>User Value Segments</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={userValueSegments.map(segment => ({
                ...segment,
                name: segment.segment,
                color: segment.segment === 'High Value' ? '#10b981' : 
                       segment.segment === 'Medium Value' ? '#f59e0b' : '#ef4444',
                description: segment.description
              }))}
              valueKey="count"
              labelKey="segment"
              chartColor="#3b82f6"
              title=""
              type="pie"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.segment}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Users:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.count.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Percentage:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.percentage}%
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            />
          </ThemeProvider>
        </div>

        {/* User Geographic Distribution Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>Geographic Distribution of Users</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={userGeographicDistribution}
              valueKey="userCount"
              labelKey="location"
              chartColor="#8b5cf6"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.location}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Users:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.userCount.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Orders:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.orderCount.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Revenue:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        ${item.revenue.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            />
          </ThemeProvider>
        </div>


        {/* User Lifecycle Stages Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>User Lifecycle Stages</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={userLifecycleStages.map(stage => ({
                ...stage,
                name: stage.stage,
                color: stage.stage === 'New' ? '#3b82f6' : 
                       stage.stage === 'Active' ? '#10b981' : 
                       stage.stage === 'Loyal' ? '#f59e0b' : 
                       stage.stage === 'VIP' ? '#8b5cf6' : '#ef4444',
                description: stage.description
              }))}
              valueKey="count"
              labelKey="stage"
              chartColor="#3b82f6"
              title=""
              type="pie"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.stage}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Users:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.count.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Percentage:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.percentage}%
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            />
          </ThemeProvider>
        </div>

        {/* User Order Patterns Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h3>User Order Patterns by {userOrderPatternsPeriod}</h3>
            <div className="chart-controls">
              <select 
                value={userOrderPatternsPeriod} 
                onChange={(e) => setUserOrderPatternsPeriod(e.target.value)}
                className="period-selector"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={userOrderPatterns}
              valueKey="userCount"
              labelKey="name"
              chartColor="#3b82f6"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.name}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Users:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.userCount.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Avg Order Value:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        ${item.avgOrderValue?.toFixed(2) || 0}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            />
          </ThemeProvider>
          
          {/* User Type Definitions Legend */}
          <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: '600', color: '#374151' }}>
              User Type Definitions
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '2px' }}></div>
                <strong>New Users:</strong>&nbsp;1 order
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '2px' }}></div>
                <strong>Regular Users:</strong>&nbsp;2-5 orders
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '2px' }}></div>
                <strong>Frequent Users:</strong>&nbsp;6-10 orders
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '2px' }}></div>
                <strong>Power Users:</strong>&nbsp;11+ orders
              </div>
            </div>
          </div>
        </div>

        {/* User Revenue Analysis Chart */}
        <div className="chart-section" style={{ marginTop: '32px' }}>
          <div className="chart-header">
            <h3>User Revenue Analysis by {userOrderPatternsPeriod}</h3>
          </div>
          
          <ThemeProvider theme={AdminAnalyticsTheme}>
            <MaterialChart
              data={userOrderPatterns.map(pattern => ({
                ...pattern,
                revenue: pattern.userCount * (pattern.avgOrderValue || 0)
              }))}
              valueKey="revenue"
              labelKey="name"
              chartColor="#10b981"
              title=""
              type="bar"
              tooltipContent={(item) => (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {item.name}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Revenue:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        ${item.revenue?.toLocaleString() || 0}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Users:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.userCount.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            />
          </ThemeProvider>
          
          {/* User Type Definitions Legend */}
          <div style={{ marginTop: '16px', padding: '16px', background: '#f0fdf4', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: '600', color: '#374151' }}>
              User Type Definitions
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px' }}></div>
                <strong>New Users:</strong>&nbsp;1 order
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#22c55e', borderRadius: '2px' }}></div>
                <strong>Regular Users:</strong>&nbsp;2-5 orders
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#16a34a', borderRadius: '2px' }}></div>
                <strong>Frequent Users:</strong>&nbsp;6-10 orders
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#15803d', borderRadius: '2px' }}></div>
                <strong>Power Users:</strong>&nbsp;11+ orders
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsUsers;
