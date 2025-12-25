import { useState, useEffect, useCallback } from 'react';
import mailchimpService from '../../services/mailchimpService';
import './AdminCampaigns.scss';

const AdminCampaigns = () => {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    subject: '',
    templateId: '',
    listId: '',
    content: '',
    fromName: 'My Kosher Delivery',
    fromEmail: 'noreply@mykosherdelivery.com'
  });

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    content: '',
    type: 'html'
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteType, setDeleteType] = useState('');

  const [showSendModal, setShowSendModal] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(null);

  const [showUseTemplateModal, setShowUseTemplateModal] = useState(false);

  const loadCampaigns = useCallback(async () => {
    if (dataLoaded) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await mailchimpService.getCampaigns();
      if (response.success) {
        const transformedCampaigns = response.data.campaigns?.map(campaign => ({
          id: campaign.id,
          name: campaign.settings?.title || campaign.settings?.subject_line || 'Untitled Campaign',
          subject: campaign.settings?.subject_line || 'No Subject',
          status: campaign.status,
          sentDate: campaign.send_time,
          recipients: campaign.recipients?.recipient_count || 0,
          openRate: campaign.reports?.opens?.open_rate || 0,
          clickRate: campaign.reports?.clicks?.click_rate || 0
        })) || [];
        setCampaigns(transformedCampaigns);
      } else {
        setError('Failed to load campaigns');
      }
    } catch (err) {
      console.error('Error loading campaigns:', err);
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [dataLoaded]);

  const loadTemplates = useCallback(async () => {
    if (dataLoaded) return;
    
    try {
      const response = await mailchimpService.getTemplates();
      if (response.success) {
        const transformedTemplates = response.data.templates?.map(template => ({
          id: template.id,
          name: template.name || 'Untitled Template',
          subject: template.name || 'No Subject',
          type: 'html',
          createdAt: template.date_created
        })) || [];
        setTemplates(transformedTemplates);
      } else {
        setError('Failed to load templates');
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates');
    }
  }, [dataLoaded]);

  useEffect(() => {
    if (!dataLoaded) {
      const loadData = async () => {
        await Promise.all([loadCampaigns(), loadTemplates()]);
        setDataLoaded(true);
      };
      loadData();
    }
  }, [loadCampaigns, loadTemplates, dataLoaded]);

  const handleUseTemplate = useCallback((template) => {
    setCampaignForm(prev => ({
      ...prev,
      name: `${template.name} Campaign`,
      subject: template.subject,
      templateId: template.id,
      content: template.content || ''
    }));
    setShowUseTemplateModal(false);
    setShowCampaignModal(true);
  }, []);

  const resetCampaignForm = () => {
    setCampaignForm({
      name: '',
      subject: '',
      templateId: '',
      listId: '',
      content: '',
      fromName: 'My Kosher Delivery',
      fromEmail: 'noreply@mykosherdelivery.com'
    });
    setEditingCampaign(null);
  };

  const handleCreateCampaign = async () => {
    const errors = validateCampaignForm();
    if (Object.keys(errors).length > 0) {
      setError(`Please fix the following errors: ${Object.values(errors).join(', ')}`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = editingCampaign 
        ? await mailchimpService.updateCampaign(editingCampaign.id, {
            name: campaignForm.name,
            subject: campaignForm.subject,
            content: campaignForm.content,
            fromName: campaignForm.fromName,
            fromEmail: campaignForm.fromEmail,
            listId: campaignForm.listId
          })
        : await mailchimpService.createCampaign({
            name: campaignForm.name,
            subject: campaignForm.subject,
            content: campaignForm.content,
            fromName: campaignForm.fromName,
            fromEmail: campaignForm.fromEmail,
            listId: campaignForm.listId
          });
      
      if (response.success) {
        setShowCampaignModal(false);
        resetCampaignForm();
        await loadCampaigns();
      } else {
        setError(response.error || 'Failed to save campaign');
      }
    } catch (err) {
      console.error('Error saving campaign:', err);
      setError('Failed to save campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    const errors = validateTemplateForm();
    if (Object.keys(errors).length > 0) {
      setError(`Please fix the following errors: ${Object.values(errors).join(', ')}`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = editingTemplate
        ? await mailchimpService.updateTemplate(editingTemplate.id, {
            name: templateForm.name,
            content: templateForm.content
          })
        : await mailchimpService.createTemplate({
            name: templateForm.name,
            content: templateForm.content
          });
      
      if (response.success) {
        setShowTemplateModal(false);
        resetTemplateForm();
        await loadTemplates();
      } else {
        setError(response.error || 'Failed to save template');
      }
    } catch (err) {
      console.error('Error saving template:', err);
      setError('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      subject: '',
      content: '',
      type: 'html'
    });
    setEditingTemplate(null);
  };

  const handleEditCampaign = useCallback((campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.name,
      subject: campaign.subject,
      templateId: '',
      listId: '',
      content: '',
      fromName: 'My Kosher Delivery',
      fromEmail: 'noreply@mykosherdelivery.com'
    });
    setShowCampaignModal(true);
  }, []);

  const handleEditTemplate = useCallback((template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      content: template.content || '',
      type: 'html'
    });
    setShowTemplateModal(true);
  }, []);


  const confirmDelete = (item, type) => {
    setDeleteItem(item);
    setDeleteType(type);
    setShowDeleteModal(true);
  };

  const validateCampaignForm = () => {
    const errors = {};
    
    if (!campaignForm.name.trim()) {
      errors.name = 'Campaign name is required';
    }
    
    if (!campaignForm.subject.trim()) {
      errors.subject = 'Subject line is required';
    }
    
    if (!campaignForm.content.trim()) {
      errors.content = 'Content is required';
    }
    
    if (!campaignForm.fromEmail.trim()) {
      errors.fromEmail = 'From email is required';
    } else if (!/\S+@\S+\.\S+/.test(campaignForm.fromEmail)) {
      errors.fromEmail = 'Please enter a valid email address';
    }
    
    return errors;
  };

  const validateTemplateForm = () => {
    const errors = {};
    
    if (!templateForm.name.trim()) {
      errors.name = 'Template name is required';
    }
    
    if (!templateForm.content.trim()) {
      errors.content = 'Content is required';
    }
    
    return errors;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent': return 'success';
      case 'draft': return 'warning';
      case 'scheduled': return 'info';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not sent';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleSendCampaign = useCallback((campaign) => {
    setSendingCampaign(campaign);
    setShowSendModal(true);
  }, []);

  const CampaignCard = useCallback(({ campaign }) => (
    <div className="campaign-card">
      <div className="campaign-header">
        <h3>{campaign.name}</h3>
        <span className={`status-badge ${getStatusColor(campaign.status)}`}>
          {campaign.status}
        </span>
      </div>
      <div className="campaign-details">
        <p><strong>Subject:</strong> {campaign.subject}</p>
        <p><strong>Sent:</strong> {formatDate(campaign.sentDate)}</p>
        <p><strong>Recipients:</strong> {campaign.recipients.toLocaleString()}</p>
        <p><strong>Open Rate:</strong> {(campaign.openRate * 100).toFixed(1)}%</p>
        <p><strong>Click Rate:</strong> {(campaign.clickRate * 100).toFixed(1)}%</p>
      </div>
      <div className="campaign-actions">
        <button 
          onClick={() => handleEditCampaign(campaign)}
          className="btn btn-sm btn-outline"
        >
          Edit
        </button>
        <button 
          onClick={() => confirmDelete(campaign, 'campaign')}
          className="btn btn-sm btn-danger"
        >
          Delete
        </button>
        {campaign.status === 'draft' && (
          <button 
            onClick={() => handleSendCampaign(campaign)}
            className="btn btn-sm btn-primary"
          >
            Send
          </button>
        )}
      </div>
    </div>
  ), [handleEditCampaign, handleSendCampaign]);

  const TemplateCard = useCallback(({ template }) => (
    <div className="template-card">
      <div className="template-header">
        <h3>{template.name}</h3>
        <span className="template-type">{template.type}</span>
      </div>
      <div className="template-details">
        <p><strong>Subject:</strong> {template.subject}</p>
        <p><strong>Created:</strong> {formatDate(template.createdAt)}</p>
      </div>
      <div className="template-actions">
        <button 
          onClick={() => handleEditTemplate(template)}
          className="btn btn-sm btn-outline"
        >
          Edit
        </button>
        <button 
          onClick={() => confirmDelete(template, 'template')}
          className="btn btn-sm btn-danger"
        >
          Delete
        </button>
        <button 
          onClick={() => handleUseTemplate(template)}
          className="btn btn-sm btn-primary"
        >
          Use Template
        </button>
      </div>
    </div>
  ), [handleEditTemplate, handleUseTemplate]);


  const handleConfirmDelete = async () => {
    setLoading(true);
    try {
      let response;
      if (deleteType === 'campaign') {
        response = await mailchimpService.deleteCampaign(deleteItem.id);
      } else {
        response = await mailchimpService.deleteTemplate(deleteItem.id);
      }
      
      if (response.success) {
        if (deleteType === 'campaign') {
          await loadCampaigns();
        } else {
          await loadTemplates();
        }
        setShowDeleteModal(false);
        setDeleteItem(null);
        setDeleteType('');
        setError(null);
      } else {
        setError(`Failed to delete ${deleteType}`);
      }
    } catch (err) {
      console.error(`Error deleting ${deleteType}:`, err);
      setError(`Failed to delete ${deleteType}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSend = async () => {
    setLoading(true);
    try {
      const response = await mailchimpService.sendCampaign(sendingCampaign.id);
      
      if (response.success) {
        setShowSendModal(false);
        setSendingCampaign(null);
        await loadCampaigns();
        setError(null);
      } else {
        setError('Failed to send campaign');
      }
    } catch (err) {
      console.error('Error sending campaign:', err);
      setError('Failed to send campaign');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="admin-campaigns">
      <div className="admin-campaigns__header">
        <h1>Email Campaigns</h1>
        <p>Manage email campaigns and templates for customer communication</p>
      </div>

      <div className="admin-campaigns__tabs">
        <button
          className={`tab-button ${activeTab === 'campaigns' ? 'active' : ''}`}
          onClick={() => setActiveTab('campaigns')}
        >
          Campaigns
        </button>
        <button
          className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div className="campaigns-section">
          <div className="section-header">
            <h2>Email Campaigns</h2>
            <div className="header-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowUseTemplateModal(true)}
              >
                Use Template
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowCampaignModal(true)}
              >
                Create Campaign
              </button>
            </div>
          </div>

          <div className="campaigns-grid">
            {loading && !dataLoaded ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading campaigns...</p>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📧</div>
                <h3>No campaigns yet</h3>
                <p>Create your first campaign or use a template to get started.</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowCampaignModal(true)}
                >
                  Create Campaign
                </button>
              </div>
            ) : (
              campaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="templates-section">
          <div className="section-header">
            <h2>Email Templates</h2>
            <button
              className="btn btn-primary"
              onClick={() => setShowTemplateModal(true)}
            >
              Create Template
            </button>
          </div>

          <div className="templates-grid">
            {loading && !dataLoaded ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading templates...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h3>No templates yet</h3>
                <p>Create your first template to reuse across campaigns.</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowTemplateModal(true)}
                >
                  Create Template
                </button>
              </div>
            ) : (
              templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))
            )}
          </div>
        </div>
      )}

      {}
      {showCampaignModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingCampaign ? 'Edit Campaign' : 'Create New Campaign'}</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowCampaignModal(false);
                  resetCampaignForm();
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Campaign Name</label>
                <input
                  type="text"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({...campaignForm, name: e.target.value})}
                  placeholder="Enter campaign name"
                />
              </div>
              <div className="form-group">
                <label>Email Subject</label>
                <input
                  type="text"
                  value={campaignForm.subject}
                  onChange={(e) => setCampaignForm({...campaignForm, subject: e.target.value})}
                  placeholder="Enter email subject"
                />
              </div>
              <div className="form-group">
                <label>Template</label>
                <select
                  value={campaignForm.templateId}
                  onChange={(e) => setCampaignForm({...campaignForm, templateId: e.target.value})}
                >
                  <option value="">Select a template</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Email Content</label>
                <textarea
                  value={campaignForm.content}
                  onChange={(e) => setCampaignForm({...campaignForm, content: e.target.value})}
                  placeholder="Enter email content (HTML supported)"
                  rows="8"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowCampaignModal(false);
                  resetCampaignForm();
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateCampaign}
                disabled={loading}
              >
                {loading ? (editingCampaign ? 'Updating...' : 'Creating...') : (editingCampaign ? 'Update Campaign' : 'Create Campaign')}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showTemplateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingTemplate ? 'Edit Template' : 'Create New Template'}</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowTemplateModal(false);
                  resetTemplateForm();
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Template Name</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                  placeholder="Enter template name"
                />
              </div>
              <div className="form-group">
                <label>Email Subject</label>
                <input
                  type="text"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({...templateForm, subject: e.target.value})}
                  placeholder="Enter email subject"
                />
              </div>
              <div className="form-group">
                <label>Template Type</label>
                <select
                  value={templateForm.type}
                  onChange={(e) => setTemplateForm({...templateForm, type: e.target.value})}
                >
                  <option value="html">HTML</option>
                  <option value="text">Plain Text</option>
                </select>
              </div>
              <div className="form-group">
                <label>Template Content</label>
                <textarea
                  value={templateForm.content}
                  onChange={(e) => setTemplateForm({...templateForm, content: e.target.value})}
                  placeholder="Enter template content (HTML supported)"
                  rows="10"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowTemplateModal(false);
                  resetTemplateForm();
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateTemplate}
                disabled={loading}
              >
                {loading ? (editingTemplate ? 'Updating...' : 'Creating...') : (editingTemplate ? 'Update Template' : 'Create Template')}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteItem(null);
                  setDeleteType('');
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete this {deleteType}? This action cannot be undone.
              </p>
              <p><strong>{deleteItem?.name}</strong></p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteItem(null);
                  setDeleteType('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showSendModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Send Campaign</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowSendModal(false);
                  setSendingCampaign(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to send this campaign? It will be delivered to all subscribers in your mailing list.
              </p>
              <p><strong>{sendingCampaign?.name}</strong></p>
              <p><strong>Subject:</strong> {sendingCampaign?.subject}</p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowSendModal(false);
                  setSendingCampaign(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmSend}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showUseTemplateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Use Template</h3>
              <button
                className="modal-close"
                onClick={() => setShowUseTemplateModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Select a template to use for your campaign:</p>
              <div className="template-list">
                {templates.map((template) => (
                  <div key={template.id} className="template-item">
                    <h4>{template.name}</h4>
                    <p>{template.subject}</p>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleUseTemplate(template)}
                    >
                      Use This Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowUseTemplateModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

AdminCampaigns.propTypes = {
};

export default AdminCampaigns;
