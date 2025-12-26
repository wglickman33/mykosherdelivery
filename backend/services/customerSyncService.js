const { Profile, Order, UserRestaurantFavorite, Restaurant } = require('../models');
const mailchimpService = require('./mailchimpService');
const logger = require('../utils/logger');
const crypto = require('crypto');

class CustomerSyncService {
  async calculateCustomerMetrics(userId) {
    try {
      const orders = await Order.findAll({
        where: { userId },
        attributes: ['total', 'createdAt', 'status']
      });

      const totalSpent = orders
        .filter(order => order.status !== 'cancelled')
        .reduce((sum, order) => sum + parseFloat(order.total || 0), 0);

      const orderCount = orders.filter(order => order.status !== 'cancelled').length;

      const lastOrder = orders
        .filter(order => order.status !== 'cancelled')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      const lastOrderDate = lastOrder ? lastOrder.createdAt.toISOString().split('T')[0] : '';

      const favorites = await UserRestaurantFavorite.findAll({
        where: { userId },
        include: [{
          model: Restaurant,
          as: 'restaurant',
          attributes: ['name']
        }]
      });

      const favoriteRestaurants = favorites
        .map(fav => fav.restaurant?.name)
        .filter(Boolean)
        .join(', ');

      return {
        totalSpent: totalSpent.toFixed(2),
        orderCount,
        lastOrderDate,
        favoriteRestaurants
      };
    } catch (error) {
      logger.error('❌ Error calculating customer metrics:', error);
      throw error;
    }
  }

  async getCustomerTags(metrics) {
    const tags = [];

    if (parseFloat(metrics.totalSpent) > 500) {
      tags.push('High Value');
    }

    if (metrics.orderCount >= 10) {
      tags.push('Frequent Orderer');
    } else if (metrics.orderCount >= 5) {
      tags.push('Regular Customer');
    }

    if (metrics.lastOrderDate) {
      const lastOrder = new Date(metrics.lastOrderDate);
      const daysSinceLastOrder = Math.floor((new Date() - lastOrder) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastOrder > 90) {
        tags.push('Inactive');
      } else if (daysSinceLastOrder > 60) {
        tags.push('At Risk');
      } else if (daysSinceLastOrder <= 30) {
        tags.push('Active');
      }
    } else {
      tags.push('New Customer');
    }

    return tags;
  }

  async syncCustomerToMailChimp(userId, listId) {
    try {
      const profile = await Profile.findByPk(userId, {
        include: [{
          model: Order,
          as: 'orders',
          attributes: ['total', 'createdAt', 'status']
        }]
      });

      if (!profile || !profile.email) {
        throw new Error('Profile not found or email missing');
      }

      const metrics = await this.calculateCustomerMetrics(userId);
      const tags = await this.getCustomerTags(metrics);

      const addresses = profile.addresses || [];
      const primaryAddress = addresses[profile.primaryAddressIndex] || profile.address || {};
      const addressString = primaryAddress.street 
        ? `${primaryAddress.street}, ${primaryAddress.city || ''}, ${primaryAddress.state || ''} ${primaryAddress.zipCode || ''}`.trim()
        : '';

      const mergeFields = {
        FNAME: profile.firstName || profile.preferredName || '',
        LNAME: profile.lastName || '',
        PHONE: profile.phone || '',
        ADDRESS: addressString,
        TOTALSPENT: metrics.totalSpent,
        ORDERCOUNT: metrics.orderCount.toString(),
        LASTORDER: metrics.lastOrderDate,
        FAVREST: metrics.favoriteRestaurants
      };

      try {
        try {
          await mailchimpService.getMemberByEmail(listId, profile.email);
          
          await mailchimpService.updateMemberWithMergeFields(listId, profile.email, mergeFields, tags);
          logger.info(`✅ Updated MailChimp member: ${profile.email}`);
        } catch (error) {
          if (error.message.includes('404') || error.message.includes('not found')) {
            await mailchimpService.addListMember(listId, {
              email: profile.email,
              status: 'subscribed',
              mergeFields
            });
            
            if (tags.length > 0) {
              const subscriberHash = crypto.createHash('md5').update(profile.email.toLowerCase()).digest('hex');
              await mailchimpService.addMemberTags(listId, subscriberHash, tags);
            }
            
            logger.info(`✅ Added new MailChimp member: ${profile.email}`);
          } else {
            throw error;
          }
        }
      } catch (error) {
        logger.error(`❌ Error syncing customer ${profile.email}:`, error);
        throw error;
      }

      return { success: true, email: profile.email, tags };
    } catch (error) {
      logger.error('❌ Error in syncCustomerToMailChimp:', error);
      throw error;
    }
  }

  async batchSyncCustomers(listId, userIds = null, batchSize = 50) {
    try {
      logger.info('🔄 Starting batch customer sync to MailChimp');

      let profiles;
      if (userIds) {
        profiles = await Profile.findAll({
          where: { id: userIds, role: 'user' },
          attributes: ['id', 'email']
        });
      } else {
        profiles = await Profile.findAll({
          where: { role: 'user' },
          attributes: ['id', 'email']
        });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      for (let i = 0; i < profiles.length; i += batchSize) {
        const batch = profiles.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (profile) => {
            try {
              await this.syncCustomerToMailChimp(profile.id, listId);
              results.success++;
            } catch (error) {
              results.failed++;
              results.errors.push({
                email: profile.email,
                error: error.message
              });
              logger.error(`❌ Failed to sync ${profile.email}:`, error.message);
            }
          })
        );

        logger.info(`📊 Batch sync progress: ${Math.min(i + batchSize, profiles.length)}/${profiles.length}`);
      }

      logger.info(`✅ Batch sync complete: ${results.success} succeeded, ${results.failed} failed`);
      return results;
    } catch (error) {
      logger.error('❌ Error in batchSyncCustomers:', error);
      throw error;
    }
  }

  async getOrCreateDefaultList() {
    try {
      const lists = await mailchimpService.getLists();
      
      if (lists.lists && lists.lists.length > 0) {
        return lists.lists[0].id;
      }

      throw new Error('No mailing lists found. Please create a list in MailChimp first.');
    } catch (error) {
      logger.error('❌ Error getting default list:', error);
      throw error;
    }
  }
}

module.exports = new CustomerSyncService();

