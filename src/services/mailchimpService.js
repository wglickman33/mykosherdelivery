import apiClient from '../lib/api';
import logger from '../utils/logger';

export const mailchimpService = {
  async getCampaigns() {
    try {
      logger.info('📧 Fetching MailChimp campaigns');
      const response = await apiClient.get('/admin/mailchimp/campaigns');
      return response;
    } catch (error) {
      logger.error('❌ Error fetching campaigns:', error);
      throw error;
    }
  },

  async createCampaign(campaignData) {
    try {
      logger.info('📧 Creating MailChimp campaign:', campaignData.name);
      const response = await apiClient.post('/admin/mailchimp/campaigns', campaignData);
      
      if (campaignData.segmentId || campaignData.scheduleTime) {
        await this.updateCampaign(response.data.id, {
          segmentId: campaignData.segmentId,
          scheduleTime: campaignData.scheduleTime
        });
      }
      
      return response;
    } catch (error) {
      logger.error('❌ Error creating campaign:', error);
      throw error;
    }
  },

  async updateCampaign(campaignId, campaignData) {
    try {
      logger.info('📧 Updating MailChimp campaign:', campaignId);
      const response = await apiClient.put(`/admin/mailchimp/campaigns/${campaignId}`, campaignData);
      return response;
    } catch (error) {
      logger.error('❌ Error updating campaign:', error);
      throw error;
    }
  },

  async sendCampaign(campaignId) {
    try {
      logger.info('📧 Sending MailChimp campaign:', campaignId);
      const response = await apiClient.post(`/admin/mailchimp/campaigns/${campaignId}/send`);
      return response;
    } catch (error) {
      logger.error('❌ Error sending campaign:', error);
      throw error;
    }
  },

  async deleteCampaign(campaignId) {
    try {
      logger.info('📧 Deleting MailChimp campaign:', campaignId);
      const response = await apiClient.delete(`/admin/mailchimp/campaigns/${campaignId}`);
      return response;
    } catch (error) {
      logger.error('❌ Error deleting campaign:', error);
      throw error;
    }
  },

  async getCampaignAnalytics(campaignId) {
    try {
      logger.info('📊 Fetching campaign analytics:', campaignId);
      const response = await apiClient.get(`/admin/mailchimp/campaigns/${campaignId}/analytics`);
      return response;
    } catch (error) {
      logger.error('❌ Error fetching campaign analytics:', error);
      throw error;
    }
  },

  async getTemplates() {
    try {
      logger.info('📧 Fetching MailChimp templates');
      const response = await apiClient.get('/admin/mailchimp/templates');
      return response;
    } catch (error) {
      logger.error('❌ Error fetching templates:', error);
      throw error;
    }
  },

  async createTemplate(templateData) {
    try {
      logger.info('📧 Creating MailChimp template:', templateData.name);
      const response = await apiClient.post('/admin/mailchimp/templates', templateData);
      return response;
    } catch (error) {
      logger.error('❌ Error creating template:', error);
      throw error;
    }
  },

  async updateTemplate(templateId, templateData) {
    try {
      logger.info('📧 Updating MailChimp template:', templateId);
      const response = await apiClient.put(`/admin/mailchimp/templates/${templateId}`, templateData);
      return response;
    } catch (error) {
      logger.error('❌ Error updating template:', error);
      throw error;
    }
  },

  async deleteTemplate(templateId) {
    try {
      logger.info('📧 Deleting MailChimp template:', templateId);
      const response = await apiClient.delete(`/admin/mailchimp/templates/${templateId}`);
      return response;
    } catch (error) {
      logger.error('❌ Error deleting template:', error);
      throw error;
    }
  },

  async getLists() {
    try {
      logger.info('📧 Fetching MailChimp lists');
      const response = await apiClient.get('/admin/mailchimp/lists');
      return response;
    } catch (error) {
      logger.error('❌ Error fetching lists:', error);
      throw error;
    }
  },

  async getListMembers(listId, options = {}) {
    try {
      logger.info('📧 Fetching list members:', listId);
      const response = await apiClient.get(`/admin/mailchimp/lists/${listId}/members`, options);
      return response;
    } catch (error) {
      logger.error('❌ Error fetching list members:', error);
      throw error;
    }
  },

  async addListMember(listId, memberData) {
    try {
      logger.info('📧 Adding member to list:', listId);
      const response = await apiClient.post(`/admin/mailchimp/lists/${listId}/members`, memberData);
      return response;
    } catch (error) {
      logger.error('❌ Error adding list member:', error);
      throw error;
    }
  },

  async updateListMember(listId, memberEmail, memberData) {
    try {
      logger.info('📧 Updating list member:', memberEmail);
      const response = await apiClient.put(`/admin/mailchimp/lists/${listId}/members/${memberEmail}`, memberData);
      return response;
    } catch (error) {
      logger.error('❌ Error updating list member:', error);
      throw error;
    }
  },

  async removeListMember(listId, memberEmail) {
    try {
      logger.info('📧 Removing member from list:', memberEmail);
      const response = await apiClient.delete(`/admin/mailchimp/lists/${listId}/members/${memberEmail}`);
      return response;
    } catch (error) {
      logger.error('❌ Error removing list member:', error);
      throw error;
    }
  },

  async sendTestEmail(campaignId, testEmails) {
    try {
      logger.info('📧 Sending test email for campaign:', campaignId);
      const response = await apiClient.post(`/admin/mailchimp/campaigns/${campaignId}/test`, {
        test_emails: testEmails
      });
      return response;
    } catch (error) {
      logger.error('❌ Error sending test email:', error);
      throw error;
    }
  },

  async getAccountInfo() {
    try {
      logger.info('📧 Fetching MailChimp account info');
      const response = await apiClient.get('/admin/mailchimp/account');
      return response;
    } catch (error) {
      logger.error('❌ Error fetching account info:', error);
      throw error;
    }
  },

  async getSegments(listId, options = {}) {
    try {
      logger.info('📊 Fetching MailChimp segments');
      const response = await apiClient.get(`/admin/mailchimp/lists/${listId}/segments`, { params: options });
      return response;
    } catch (error) {
      logger.error('❌ Error fetching segments:', error);
      throw error;
    }
  },

  async createSegment(listId, segmentData) {
    try {
      logger.info('📊 Creating MailChimp segment');
      const response = await apiClient.post(`/admin/mailchimp/lists/${listId}/segments`, segmentData);
      return response;
    } catch (error) {
      logger.error('❌ Error creating segment:', error);
      throw error;
    }
  },

  async updateSegment(listId, segmentId, segmentData) {
    try {
      logger.info('📊 Updating MailChimp segment');
      const response = await apiClient.put(`/admin/mailchimp/lists/${listId}/segments/${segmentId}`, segmentData);
      return response;
    } catch (error) {
      logger.error('❌ Error updating segment:', error);
      throw error;
    }
  },

  async deleteSegment(listId, segmentId) {
    try {
      logger.info('📊 Deleting MailChimp segment');
      const response = await apiClient.delete(`/admin/mailchimp/lists/${listId}/segments/${segmentId}`);
      return response;
    } catch (error) {
      logger.error('❌ Error deleting segment:', error);
      throw error;
    }
  },

  async addSegmentMembers(listId, segmentId, emails) {
    try {
      logger.info('📊 Adding members to segment');
      const response = await apiClient.post(`/admin/mailchimp/lists/${listId}/segments/${segmentId}/members`, { emails });
      return response;
    } catch (error) {
      logger.error('❌ Error adding segment members:', error);
      throw error;
    }
  },

  async getMemberTags(listId, email) {
    try {
      logger.info('🏷️ Fetching member tags');
      const response = await apiClient.get(`/admin/mailchimp/lists/${listId}/members/${encodeURIComponent(email)}/tags`);
      return response;
    } catch (error) {
      logger.error('❌ Error fetching member tags:', error);
      throw error;
    }
  },

  async addMemberTags(listId, email, tags) {
    try {
      logger.info('🏷️ Adding tags to member');
      const response = await apiClient.post(`/admin/mailchimp/lists/${listId}/members/${encodeURIComponent(email)}/tags`, { tags });
      return response;
    } catch (error) {
      logger.error('❌ Error adding member tags:', error);
      throw error;
    }
  },

  async removeMemberTags(listId, email, tags) {
    try {
      logger.info('🏷️ Removing tags from member');
      const response = await apiClient.delete(`/admin/mailchimp/lists/${listId}/members/${encodeURIComponent(email)}/tags`, { data: { tags } });
      return response;
    } catch (error) {
      logger.error('❌ Error removing member tags:', error);
      throw error;
    }
  },

  async getAllTags(listId) {
    try {
      logger.info('🏷️ Fetching all tags');
      const response = await apiClient.get(`/admin/mailchimp/lists/${listId}/tags`);
      return response;
    } catch (error) {
      logger.error('❌ Error fetching tags:', error);
      throw error;
    }
  },

  async syncCustomer(userId, listId) {
    try {
      logger.info('🔄 Syncing customer to MailChimp');
      const response = await apiClient.post(`/admin/mailchimp/sync/customer/${userId}`, { listId });
      return response;
    } catch (error) {
      logger.error('❌ Error syncing customer:', error);
      throw error;
    }
  },

  async batchSyncCustomers(listId, userIds = null, batchSize = 50) {
    try {
      logger.info('🔄 Batch syncing customers to MailChimp');
      const response = await apiClient.post('/admin/mailchimp/sync/batch', { listId, userIds, batchSize });
      return response;
    } catch (error) {
      logger.error('❌ Error batch syncing customers:', error);
      throw error;
    }
  },

  async getAutomations(options = {}) {
    try {
      logger.info('🤖 Fetching MailChimp automations');
      const response = await apiClient.get('/admin/mailchimp/automations', { params: options });
      return response;
    } catch (error) {
      logger.error('❌ Error fetching automations:', error);
      throw error;
    }
  },

  async getAutomation(automationId) {
    try {
      logger.info('🤖 Fetching MailChimp automation');
      const response = await apiClient.get(`/admin/mailchimp/automations/${automationId}`);
      return response;
    } catch (error) {
      logger.error('❌ Error fetching automation:', error);
      throw error;
    }
  },

  async startAutomation(automationId) {
    try {
      logger.info('🤖 Starting MailChimp automation');
      const response = await apiClient.post(`/admin/mailchimp/automations/${automationId}/start`);
      return response;
    } catch (error) {
      logger.error('❌ Error starting automation:', error);
      throw error;
    }
  },

  async pauseAutomation(automationId) {
    try {
      logger.info('🤖 Pausing MailChimp automation');
      const response = await apiClient.post(`/admin/mailchimp/automations/${automationId}/pause`);
      return response;
    } catch (error) {
      logger.error('❌ Error pausing automation:', error);
      throw error;
    }
  },

  async getAutomationEmails(automationId) {
    try {
      logger.info('🤖 Fetching automation emails');
      const response = await apiClient.get(`/admin/mailchimp/automations/${automationId}/emails`);
      return response;
    } catch (error) {
      logger.error('❌ Error fetching automation emails:', error);
      throw error;
    }
  },

  async getCampaignReport(campaignId) {
    try {
      logger.info('📊 Fetching campaign report');
      const response = await apiClient.get(`/admin/mailchimp/campaigns/${campaignId}/report`);
      return response;
    } catch (error) {
      logger.error('❌ Error fetching campaign report:', error);
      throw error;
    }
  },

  async getCampaignClicks(campaignId) {
    try {
      logger.info('📊 Fetching campaign clicks');
      const response = await apiClient.get(`/admin/mailchimp/campaigns/${campaignId}/clicks`);
      return response;
    } catch (error) {
      logger.error('❌ Error fetching campaign clicks:', error);
      throw error;
    }
  },

  async getCampaignOpens(campaignId) {
    try {
      logger.info('📊 Fetching campaign opens');
      const response = await apiClient.get(`/admin/mailchimp/campaigns/${campaignId}/opens`);
      return response;
    } catch (error) {
      logger.error('❌ Error fetching campaign opens:', error);
      throw error;
    }
  },

  async getCampaignEcommerce(campaignId) {
    try {
      logger.info('📊 Fetching campaign ecommerce');
      const response = await apiClient.get(`/admin/mailchimp/campaigns/${campaignId}/ecommerce`);
      return response;
    } catch (error) {
      logger.error('❌ Error fetching campaign ecommerce:', error);
      throw error;
    }
  }
};

export default mailchimpService;
