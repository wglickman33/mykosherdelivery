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
  }
};

export default mailchimpService;
