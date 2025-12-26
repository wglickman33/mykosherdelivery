import { useState, useEffect } from 'react';
import mailchimpService from '../../services/mailchimpService';
import './AdminCampaigns.scss';

const CampaignAnalytics = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaign]);

  const loadCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await mailchimpService.getCampaigns();
      if (response.success && response.data.campaigns) {
        const sentCampaigns = response.data.campaigns.filter(c => c.status === 'sent');
        setCampaigns(sentCampaigns);
      } else {
        setError('Failed to load campaigns');
      }
    } catch (err) {
      console.error('Error loading campaigns:', err);
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!selectedCampaign) return;

    setLoading(true);
    try {
      const [report, clicks, opens] = await Promise.all([
        mailchimpService.getCampaignReport(selectedCampaign.id),
        mailchimpService.getCampaignClicks(selectedCampaign.id),
        mailchimpService.getCampaignOpens(selectedCampaign.id)
      ]);

      if (report.success && clicks.success && opens.success) {
        setAnalytics({
          report: report.data,
          clicks: clicks.data,
          opens: opens.data
        });
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="analytics-tab">
      <div className="section-header">
        <h2>Campaign Analytics</h2>
        <p>Track performance and ROI of your email campaigns</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="analytics-overview">
        <h3>Campaign Performance Overview</h3>
        {loading && !campaigns.length ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No sent campaigns yet</h3>
            <p>Send a campaign to see analytics data.</p>
          </div>
        ) : (
          <div className="campaigns-list">
            {campaigns.map((campaign) => {
              const report = campaign.reports || {};
              const opens = report.opens || {};
              const clicks = report.clicks || {};
              
              return (
                <div
                  key={campaign.id}
                  className={`campaign-analytics-card ${selectedCampaign?.id === campaign.id ? 'selected' : ''}`}
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <div className="campaign-name">
                    <h4>{campaign.settings?.title || campaign.settings?.subject_line}</h4>
                    <span className="campaign-date">
                      {campaign.send_time ? new Date(campaign.send_time).toLocaleDateString() : 'Not sent'}
                    </span>
                  </div>
                  <div className="analytics-metrics">
                    <div className="metric">
                      <span className="metric-label">Recipients</span>
                      <span className="metric-value">{campaign.recipients?.recipient_count || 0}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Open Rate</span>
                      <span className="metric-value">
                        {opens.open_rate ? `${(opens.open_rate * 100).toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Click Rate</span>
                      <span className="metric-value">
                        {clicks.click_rate ? `${(clicks.click_rate * 100).toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Revenue</span>
                      <span className="metric-value">
                        ${report.ecommerce?.total_revenue || 0}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedCampaign && analytics && (
        <div className="detailed-analytics">
          <h3>Detailed Analytics: {selectedCampaign.settings?.title}</h3>
          <div className="analytics-grid">
            <div className="analytics-card">
              <h4>Performance Summary</h4>
              <div className="metric-row">
                <span>Total Recipients:</span>
                <span>{analytics.report.emails_sent || 0}</span>
              </div>
              <div className="metric-row">
                <span>Opens:</span>
                <span>{analytics.report.opens?.opens_total || 0}</span>
              </div>
              <div className="metric-row">
                <span>Unique Opens:</span>
                <span>{analytics.report.opens?.unique_opens || 0}</span>
              </div>
              <div className="metric-row">
                <span>Open Rate:</span>
                <span>{(analytics.report.opens?.open_rate * 100 || 0).toFixed(2)}%</span>
              </div>
              <div className="metric-row">
                <span>Clicks:</span>
                <span>{analytics.report.clicks?.clicks_total || 0}</span>
              </div>
              <div className="metric-row">
                <span>Unique Clicks:</span>
                <span>{analytics.report.clicks?.unique_clicks || 0}</span>
              </div>
              <div className="metric-row">
                <span>Click Rate:</span>
                <span>{(analytics.report.clicks?.click_rate * 100 || 0).toFixed(2)}%</span>
              </div>
            </div>

            <div className="analytics-card">
              <h4>Revenue</h4>
              <div className="metric-row">
                <span>Total Revenue:</span>
                <span>${analytics.report.ecommerce?.total_revenue || 0}</span>
              </div>
              <div className="metric-row">
                <span>Orders:</span>
                <span>{analytics.report.ecommerce?.total_orders || 0}</span>
              </div>
              <div className="metric-row">
                <span>Average Order Value:</span>
                <span>
                  ${analytics.report.ecommerce?.total_orders 
                    ? (analytics.report.ecommerce.total_revenue / analytics.report.ecommerce.total_orders).toFixed(2)
                    : 0}
                </span>
              </div>
            </div>

            <div className="analytics-card">
              <h4>Engagement</h4>
              <div className="metric-row">
                <span>Bounces:</span>
                <span>{analytics.report.bounces?.hard_bounces + analytics.report.bounces?.soft_bounces || 0}</span>
              </div>
              <div className="metric-row">
                <span>Unsubscribes:</span>
                <span>{analytics.report.unsubscribes || 0}</span>
              </div>
              <div className="metric-row">
                <span>Unsubscribe Rate:</span>
                <span>
                  {analytics.report.unsubscribes && analytics.report.emails_sent
                    ? ((analytics.report.unsubscribes / analytics.report.emails_sent) * 100).toFixed(2)
                    : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignAnalytics;

