const logger = require('../utils/logger');

class MailChimpService {
  constructor() {
    this.apiKey = process.env.MAILCHIMP_API_KEY;
    
    if (!this.apiKey) {
      logger.warn('⚠️ MailChimp API key not found in environment variables');
    } else {
      const keyParts = this.apiKey.split('-');
      this.serverPrefix = keyParts[keyParts.length - 1] || 'us1';
      this.baseUrl = `https://${this.serverPrefix}.api.mailchimp.com/3.0`;
    }
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    if (!this.apiKey) {
      throw new Error('MailChimp API key not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `apikey ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`MailChimp API error: ${responseData.detail || responseData.title || 'Unknown error'}`);
      }

      return responseData;
    } catch (error) {
      logger.error('❌ MailChimp API request failed:', error);
      throw error;
    }
  }

  async getCampaigns(options = {}) {
    try {
      logger.info('📧 Fetching MailChimp campaigns');
      const params = new URLSearchParams();
      
      if (options.count) params.append('count', options.count);
      if (options.offset) params.append('offset', options.offset);
      if (options.status) params.append('status', options.status);
      if (options.type) params.append('type', options.type);
      
      const queryString = params.toString();
      const endpoint = `/campaigns${queryString ? `?${queryString}` : ''}`;
      
      return await this.makeRequest(endpoint);
    } catch (error) {
      logger.error('❌ Error fetching campaigns:', error);
      throw error;
    }
  }

  async createCampaign(campaignData) {
    try {
      logger.info('📧 Creating MailChimp campaign:', campaignData.subject);
      
      let listId = campaignData.listId;
      if (!listId) {
        const lists = await this.getLists();
        if (lists.lists && lists.lists.length > 0) {
          listId = lists.lists[0].id;
        } else {
          throw new Error('No mailing lists found. Please create a list in MailChimp first.');
        }
      }
      
      const campaignPayload = {
        type: 'regular',
        recipients: {
          list_id: listId
        },
        settings: {
          subject_line: campaignData.subject,
          from_name: campaignData.fromName || 'My Kosher Delivery',
          reply_to: campaignData.fromEmail || 'noreply@mykosherdelivery.com',
          title: campaignData.name
        }
      };

      const campaign = await this.makeRequest('/campaigns', 'POST', campaignPayload);
      
      if (campaignData.content) {
        await this.setCampaignContent(campaign.id, campaignData.content);
      }

      return campaign;
    } catch (error) {
      logger.error('❌ Error creating campaign:', error);
      throw error;
    }
  }

  async setCampaignContent(campaignId, content) {
    try {
      logger.info('📧 Setting campaign content:', campaignId);
      
      const contentPayload = {
        html: content
      };

      return await this.makeRequest(`/campaigns/${campaignId}/content`, 'PUT', contentPayload);
    } catch (error) {
      logger.error('❌ Error setting campaign content:', error);
      throw error;
    }
  }

  async sendCampaign(campaignId) {
    try {
      logger.info('📧 Sending MailChimp campaign:', campaignId);
      return await this.makeRequest(`/campaigns/${campaignId}/actions/send`, 'POST');
    } catch (error) {
      logger.error('❌ Error sending campaign:', error);
      throw error;
    }
  }

  async deleteCampaign(campaignId) {
    try {
      logger.info('📧 Deleting MailChimp campaign:', campaignId);
      return await this.makeRequest(`/campaigns/${campaignId}`, 'DELETE');
    } catch (error) {
      logger.error('❌ Error deleting campaign:', error);
      throw error;
    }
  }

  async getCampaignAnalytics(campaignId) {
    try {
      logger.info('📊 Fetching campaign analytics:', campaignId);
      return await this.makeRequest(`/reports/${campaignId}`);
    } catch (error) {
      logger.error('❌ Error fetching campaign analytics:', error);
      throw error;
    }
  }

  async getTemplates(options = {}) {
    try {
      logger.info('📧 Fetching MailChimp templates');
      const params = new URLSearchParams();
      
      if (options.count) params.append('count', options.count);
      if (options.offset) params.append('offset', options.offset);
      
      const queryString = params.toString();
      const endpoint = `/templates${queryString ? `?${queryString}` : ''}`;
      
      return await this.makeRequest(endpoint);
    } catch (error) {
      logger.error('❌ Error fetching templates:', error);
      throw error;
    }
  }

  async createTemplate(templateData) {
    try {
      logger.info('📧 Creating MailChimp template:', templateData.name);
      
      const templatePayload = {
        name: templateData.name,
        html: templateData.content
      };

      return await this.makeRequest('/templates', 'POST', templatePayload);
    } catch (error) {
      logger.error('❌ Error creating template:', error);
      throw error;
    }
  }

  async updateTemplate(templateId, templateData) {
    try {
      logger.info('📧 Updating MailChimp template:', templateId);
      
      const templatePayload = {
        name: templateData.name,
        html: templateData.content
      };

      return await this.makeRequest(`/templates/${templateId}`, 'PATCH', templatePayload);
    } catch (error) {
      logger.error('❌ Error updating template:', error);
      throw error;
    }
  }

  async deleteTemplate(templateId) {
    try {
      logger.info('📧 Deleting MailChimp template:', templateId);
      return await this.makeRequest(`/templates/${templateId}`, 'DELETE');
    } catch (error) {
      logger.error('❌ Error deleting template:', error);
      throw error;
    }
  }

  async getLists() {
    try {
      logger.info('📧 Fetching MailChimp lists');
      return await this.makeRequest('/lists');
    } catch (error) {
      logger.error('❌ Error fetching lists:', error);
      throw error;
    }
  }

  async getListMembers(listId, options = {}) {
    try {
      logger.info('📧 Fetching list members:', listId);
      const params = new URLSearchParams();
      
      if (options.count) params.append('count', options.count);
      if (options.offset) params.append('offset', options.offset);
      if (options.status) params.append('status', options.status);
      
      const queryString = params.toString();
      const endpoint = `/lists/${listId}/members${queryString ? `?${queryString}` : ''}`;
      
      return await this.makeRequest(endpoint);
    } catch (error) {
      logger.error('❌ Error fetching list members:', error);
      throw error;
    }
  }

  async addListMember(listId, memberData) {
    try {
      logger.info('📧 Adding member to list:', listId);
      
      const memberPayload = {
        email_address: memberData.email,
        status: memberData.status || 'subscribed',
        merge_fields: memberData.mergeFields || {}
      };

      return await this.makeRequest(`/lists/${listId}/members`, 'POST', memberPayload);
    } catch (error) {
      logger.error('❌ Error adding list member:', error);
      throw error;
    }
  }

  async updateListMember(listId, memberEmail, memberData) {
    try {
      logger.info('📧 Updating list member:', memberEmail);
      
      const memberPayload = {
        email_address: memberEmail,
        status: memberData.status,
        merge_fields: memberData.mergeFields || {}
      };

      return await this.makeRequest(`/lists/${listId}/members/${memberEmail}`, 'PUT', memberPayload);
    } catch (error) {
      logger.error('❌ Error updating list member:', error);
      throw error;
    }
  }

  async removeListMember(listId, memberEmail) {
    try {
      logger.info('📧 Removing member from list:', memberEmail);
      return await this.makeRequest(`/lists/${listId}/members/${memberEmail}`, 'DELETE');
    } catch (error) {
      logger.error('❌ Error removing list member:', error);
      throw error;
    }
  }

  async sendTestEmail(campaignId, testEmails) {
    try {
      logger.info('📧 Sending test email for campaign:', campaignId);
      
      const testPayload = {
        test_emails: testEmails,
        send_type: 'html'
      };

      return await this.makeRequest(`/campaigns/${campaignId}/actions/test`, 'POST', testPayload);
    } catch (error) {
      logger.error('❌ Error sending test email:', error);
      throw error;
    }
  }

  async getAccountInfo() {
    try {
      logger.info('📧 Fetching MailChimp account info');
      return await this.makeRequest('/');
    } catch (error) {
      logger.error('❌ Error fetching account info:', error);
      throw error;
    }
  }
}

module.exports = new MailChimpService();
