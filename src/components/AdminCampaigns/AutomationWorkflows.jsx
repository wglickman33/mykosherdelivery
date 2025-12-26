import { useState, useEffect } from 'react';
import mailchimpService from '../../services/mailchimpService';
import './AdminCampaigns.scss';

const AutomationWorkflows = () => {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAutomation, setSelectedAutomation] = useState(null);
  const [automationEmails, setAutomationEmails] = useState([]);

  useEffect(() => {
    loadAutomations();
  }, []);

  const loadAutomations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await mailchimpService.getAutomations();
      if (response.success && response.data.automations) {
        setAutomations(response.data.automations);
      } else {
        setError('Failed to load automations');
      }
    } catch (err) {
      console.error('Error loading automations:', err);
      setError('Failed to load automations');
    } finally {
      setLoading(false);
    }
  };

  const loadAutomationEmails = async (automationId) => {
    try {
      const response = await mailchimpService.getAutomationEmails(automationId);
      if (response.success && response.data.emails) {
        setAutomationEmails(response.data.emails);
      }
    } catch (err) {
      console.error('Error loading automation emails:', err);
    }
  };

  const handleStartAutomation = async (automationId) => {
    setLoading(true);
    try {
      const response = await mailchimpService.startAutomation(automationId);
      if (response.success) {
        await loadAutomations();
      } else {
        setError('Failed to start automation');
      }
    } catch (err) {
      console.error('Error starting automation:', err);
      setError('Failed to start automation');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseAutomation = async (automationId) => {
    setLoading(true);
    try {
      const response = await mailchimpService.pauseAutomation(automationId);
      if (response.success) {
        await loadAutomations();
      } else {
        setError('Failed to pause automation');
      }
    } catch (err) {
      console.error('Error pausing automation:', err);
      setError('Failed to pause automation');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (automation) => {
    setSelectedAutomation(automation);
    await loadAutomationEmails(automation.id);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'save': return 'warning';
      case 'sending': return 'info';
      case 'paused': return 'default';
      default: return 'success';
    }
  };

  const automationTemplates = [
    {
      name: 'Welcome Series',
      description: 'Send a series of welcome emails to new customers',
      trigger: 'Account Creation',
      emails: ['Welcome + First Order Discount', 'How to Use Platform', 'Featured Restaurants']
    },
    {
      name: 'Post-Order Follow-up',
      description: 'Follow up after order delivery',
      trigger: 'Order Delivered',
      emails: ['Thank You + Review Request', 'Re-order Suggestions', 'Related Restaurants']
    },
    {
      name: 'Abandoned Cart',
      description: 'Remind customers about items left in cart',
      trigger: 'Cart Abandoned',
      emails: ['Cart Reminder', 'Time-limited Discount']
    },
    {
      name: 'Re-engagement',
      description: 'Re-engage inactive customers',
      trigger: 'No Order in 30/60/90 Days',
      emails: ['We Miss You', 'Comeback Discount']
    }
  ];

  return (
    <div className="automations-tab">
      <div className="section-header">
        <h2>Automation Workflows</h2>
        <p>Set up automated email sequences based on customer actions</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="automation-templates">
        <h3>Available Automation Templates</h3>
        <div className="templates-grid">
          {automationTemplates.map((template, index) => (
            <div key={index} className="template-card">
              <h4>{template.name}</h4>
              <p>{template.description}</p>
              <div className="template-details">
                <p><strong>Trigger:</strong> {template.trigger}</p>
                <p><strong>Emails:</strong> {template.emails.length}</p>
              </div>
              <button className="btn btn-primary btn-sm">
                Set Up Automation
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="active-automations">
        <h3>Active Automations</h3>
        {loading && !automations.length ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading automations...</p>
          </div>
        ) : automations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <h3>No automations yet</h3>
            <p>Set up automation workflows to engage customers automatically.</p>
          </div>
        ) : (
          <div className="automations-grid">
            {automations.map((automation) => (
              <div key={automation.id} className="automation-card">
                <div className="automation-header">
                  <h4>{automation.settings?.title || automation.settings?.from_name || 'Untitled Automation'}</h4>
                  <span className={`status-badge ${getStatusColor(automation.status)}`}>
                    {automation.status}
                  </span>
                </div>
                <div className="automation-details">
                  <p><strong>Trigger:</strong> {automation.trigger_settings?.workflow_type || 'Manual'}</p>
                  <p><strong>Recipients:</strong> {automation.recipients?.recipient_count || 0}</p>
                </div>
                <div className="automation-actions">
                  <button
                    onClick={() => handleViewDetails(automation)}
                    className="btn btn-sm btn-outline"
                  >
                    View Details
                  </button>
                  {automation.status === 'save' && (
                    <button
                      onClick={() => handleStartAutomation(automation.id)}
                      className="btn btn-sm btn-primary"
                    >
                      Start
                    </button>
                  )}
                  {automation.status === 'sending' && (
                    <button
                      onClick={() => handlePauseAutomation(automation.id)}
                      className="btn btn-sm btn-secondary"
                    >
                      Pause
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedAutomation && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Automation Details</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setSelectedAutomation(null);
                  setAutomationEmails([]);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="automation-info">
                <p><strong>Name:</strong> {selectedAutomation.settings?.title}</p>
                <p><strong>Status:</strong> {selectedAutomation.status}</p>
                <p><strong>Trigger:</strong> {selectedAutomation.trigger_settings?.workflow_type || 'Manual'}</p>
              </div>
              {automationEmails.length > 0 && (
                <div className="automation-emails">
                  <h4>Email Sequence</h4>
                  {automationEmails.map((email, index) => (
                    <div key={email.id || index} className="email-item">
                      <p><strong>{index + 1}. {email.settings?.subject_line || 'Untitled Email'}</strong></p>
                      <p>Delay: {email.delay?.delay_type || 'Immediate'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedAutomation(null);
                  setAutomationEmails([]);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationWorkflows;

