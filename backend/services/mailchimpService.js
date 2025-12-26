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
      const safeError = {
        message: error.message,
        endpoint: endpoint,
        method: method
      };
      logger.error('❌ MailChimp API request failed:', safeError);
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
      
      let recipients = { list_id: listId };
      if (campaignData.segmentId) {
        recipients = {
          segment_opts: {
            saved_segment_id: parseInt(campaignData.segmentId)
          }
        };
      }

      const campaignPayload = {
        type: 'regular',
        recipients: recipients,
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

      if (campaignData.scheduleTime) {
        await this.makeRequest(`/campaigns/${campaign.id}/actions/schedule`, 'POST', {
          schedule_time: campaignData.scheduleTime
        });
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

  async getSegments(listId, options = {}) {
    try {
      logger.info('📊 Fetching MailChimp segments:', listId);
      const params = new URLSearchParams();
      
      if (options.count) params.append('count', options.count);
      if (options.offset) params.append('offset', options.offset);
      if (options.type) params.append('type', options.type);
      
      const queryString = params.toString();
      const endpoint = `/lists/${listId}/segments${queryString ? `?${queryString}` : ''}`;
      
      return await this.makeRequest(endpoint);
    } catch (error) {
      logger.error('❌ Error fetching segments:', error);
      throw error;
    }
  }

  async createSegment(listId, segmentData) {
    try {
      logger.info('📊 Creating MailChimp segment:', segmentData.name);
      
      const segmentPayload = {
        name: segmentData.name,
        static_segment: segmentData.staticSegment || []
      };

      if (segmentData.options) {
        segmentPayload.options = segmentData.options;
      }

      return await this.makeRequest(`/lists/${listId}/segments`, 'POST', segmentPayload);
    } catch (error) {
      logger.error('❌ Error creating segment:', error);
      throw error;
    }
  }

  async updateSegment(listId, segmentId, segmentData) {
    try {
      logger.info('📊 Updating MailChimp segment:', segmentId);
      return await this.makeRequest(`/lists/${listId}/segments/${segmentId}`, 'PATCH', segmentData);
    } catch (error) {
      logger.error('❌ Error updating segment:', error);
      throw error;
    }
  }

  async deleteSegment(listId, segmentId) {
    try {
      logger.info('📊 Deleting MailChimp segment:', segmentId);
      return await this.makeRequest(`/lists/${listId}/segments/${segmentId}`, 'DELETE');
    } catch (error) {
      logger.error('❌ Error deleting segment:', error);
      throw error;
    }
  }

  async addSegmentMembers(listId, segmentId, emails) {
    try {
      logger.info('📊 Adding members to segment:', segmentId);
      
      const payload = {
        members_to_add: emails
      };

      return await this.makeRequest(`/lists/${listId}/segments/${segmentId}`, 'POST', payload);
    } catch (error) {
      logger.error('❌ Error adding segment members:', error);
      throw error;
    }
  }

  async getMemberTags(listId, subscriberHash) {
    try {
      logger.info('🏷️ Fetching member tags:', subscriberHash);
      return await this.makeRequest(`/lists/${listId}/members/${subscriberHash}/tags`);
    } catch (error) {
      logger.error('❌ Error fetching member tags:', error);
      throw error;
    }
  }

  async addMemberTags(listId, subscriberHash, tags) {
    try {
      logger.info('🏷️ Adding tags to member:', subscriberHash);
      
      const payload = {
        tags: tags.map(tag => ({ name: tag, status: 'active' }))
      };

      return await this.makeRequest(`/lists/${listId}/members/${subscriberHash}/tags`, 'POST', payload);
    } catch (error) {
      logger.error('❌ Error adding member tags:', error);
      throw error;
    }
  }

  async removeMemberTags(listId, subscriberHash, tags) {
    try {
      logger.info('🏷️ Removing tags from member:', subscriberHash);
      
      const payload = {
        tags: tags.map(tag => ({ name: tag, status: 'inactive' }))
      };

      return await this.makeRequest(`/lists/${listId}/members/${subscriberHash}/tags`, 'POST', payload);
    } catch (error) {
      logger.error('❌ Error removing member tags:', error);
      throw error;
    }
  }

  async getAllTags(listId) {
    try {
      logger.info('🏷️ Fetching all tags for list:', listId);
      return await this.makeRequest(`/lists/${listId}/segments?type=static&count=1000`);
    } catch (error) {
      logger.error('❌ Error fetching tags:', error);
      throw error;
    }
  }

  async updateMemberWithMergeFields(listId, email, mergeFields, tags = []) {
    try {
      logger.info('👤 Updating member with merge fields:', email);
      
      const crypto = require('crypto');
      const subscriberHash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
      
      const memberPayload = {
        merge_fields: mergeFields
      };

      const member = await this.makeRequest(`/lists/${listId}/members/${subscriberHash}`, 'PATCH', memberPayload);

      if (tags.length > 0) {
        await this.addMemberTags(listId, subscriberHash, tags);
      }

      return member;
    } catch (error) {
      logger.error('❌ Error updating member with merge fields:', error);
      throw error;
    }
  }

  async getMemberByEmail(listId, email) {
    try {
      logger.info('👤 Fetching member by email:', email);
      
      const crypto = require('crypto');
      const subscriberHash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
      
      return await this.makeRequest(`/lists/${listId}/members/${subscriberHash}`);
    } catch (error) {
      logger.error('❌ Error fetching member by email:', error);
      throw error;
    }
  }

  async getAutomations(options = {}) {
    try {
      logger.info('🤖 Fetching MailChimp automations');
      const params = new URLSearchParams();
      
      if (options.count) params.append('count', options.count);
      if (options.offset) params.append('offset', options.offset);
      
      const queryString = params.toString();
      const endpoint = `/automations${queryString ? `?${queryString}` : ''}`;
      
      return await this.makeRequest(endpoint);
    } catch (error) {
      logger.error('❌ Error fetching automations:', error);
      throw error;
    }
  }

  async getAutomation(automationId) {
    try {
      logger.info('🤖 Fetching MailChimp automation:', automationId);
      return await this.makeRequest(`/automations/${automationId}`);
    } catch (error) {
      logger.error('❌ Error fetching automation:', error);
      throw error;
    }
  }

  async startAutomation(automationId) {
    try {
      logger.info('🤖 Starting MailChimp automation:', automationId);
      return await this.makeRequest(`/automations/${automationId}/actions/start`, 'POST');
    } catch (error) {
      logger.error('❌ Error starting automation:', error);
      throw error;
    }
  }

  async pauseAutomation(automationId) {
    try {
      logger.info('🤖 Pausing MailChimp automation:', automationId);
      return await this.makeRequest(`/automations/${automationId}/actions/pause`, 'POST');
    } catch (error) {
      logger.error('❌ Error pausing automation:', error);
      throw error;
    }
  }

  async getAutomationEmails(automationId) {
    try {
      logger.info('🤖 Fetching automation emails:', automationId);
      return await this.makeRequest(`/automations/${automationId}/emails`);
    } catch (error) {
      logger.error('❌ Error fetching automation emails:', error);
      throw error;
    }
  }

  async updateCampaign(campaignId, campaignData) {
    try {
      logger.info('📧 Updating MailChimp campaign:', campaignId);
      
      const campaignPayload = {
        settings: {}
      };

      if (campaignData.subject) {
        campaignPayload.settings.subject_line = campaignData.subject;
      }
      if (campaignData.fromName) {
        campaignPayload.settings.from_name = campaignData.fromName;
      }
      if (campaignData.fromEmail) {
        campaignPayload.settings.reply_to = campaignData.fromEmail;
      }
      if (campaignData.name) {
        campaignPayload.settings.title = campaignData.name;
      }

      if (campaignData.segmentId) {
        campaignPayload.recipients = {
          segment_opts: {
            saved_segment_id: parseInt(campaignData.segmentId)
          }
        };
      } else if (campaignData.listId) {
        campaignPayload.recipients = {
          list_id: campaignData.listId
        };
      }

      if (campaignData.scheduleTime) {
        await this.makeRequest(`/campaigns/${campaignId}/actions/schedule`, 'POST', {
          schedule_time: campaignData.scheduleTime
        });
      }

      return await this.makeRequest(`/campaigns/${campaignId}`, 'PATCH', campaignPayload);
    } catch (error) {
      logger.error('❌ Error updating campaign:', error);
      throw error;
    }
  }

  async getCampaignReport(campaignId) {
    try {
      logger.info('📊 Fetching campaign report:', campaignId);
      return await this.makeRequest(`/reports/${campaignId}`);
    } catch (error) {
      logger.error('❌ Error fetching campaign report:', error);
      throw error;
    }
  }

  async getCampaignClickDetails(campaignId) {
    try {
      logger.info('📊 Fetching campaign click details:', campaignId);
      return await this.makeRequest(`/reports/${campaignId}/click-details`);
    } catch (error) {
      logger.error('❌ Error fetching campaign click details:', error);
      throw error;
    }
  }

  async getCampaignOpenDetails(campaignId) {
    try {
      logger.info('📊 Fetching campaign open details:', campaignId);
      return await this.makeRequest(`/reports/${campaignId}/open-details`);
    } catch (error) {
      logger.error('❌ Error fetching campaign open details:', error);
      throw error;
    }
  }

  async getCampaignEcommerceActivity(campaignId) {
    try {
      logger.info('📊 Fetching campaign ecommerce activity:', campaignId);
      return await this.makeRequest(`/reports/${campaignId}/ecommerce-product-activity`);
    } catch (error) {
      logger.error('❌ Error fetching campaign ecommerce activity:', error);
      throw error;
    }
  }
}

module.exports = new MailChimpService();
