const logger = require('../utils/logger');

const sendOrderConfirmationEmail = async (orderData) => {
  try {
    logger.info('📧 Order confirmation email requested:', {
      orderIds: orderData.orderIds,
      customerEmail: orderData.customerInfo?.email
    });
    
    
    const giftCardCodesList = [];
    if (orderData.giftCardCodesByOrder && typeof orderData.giftCardCodesByOrder === 'object') {
      Object.values(orderData.giftCardCodesByOrder).forEach((cards) => {
        (cards || []).forEach((c) => {
          giftCardCodesList.push({ code: c.code, balance: c.balance, initialBalance: c.initialBalance });
        });
      });
    }

    const emailData = {
      to: orderData.customerInfo?.email || 'customer@example.com',
      subject: 'Order Confirmation - My Kosher Delivery',
      orderIds: orderData.orderIds ? orderData.orderIds.join(', ') : 'N/A',
      customerName: orderData.customerInfo?.firstName || orderData.customerInfo?.first_name || 'Customer',
      orderDate: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      deliveryAddress: orderData.deliveryAddress || 'Address not provided',
      deliveryFee: `${(orderData.deliveryFee || 5.99).toFixed(2)}`,
      tax: orderData.tax ? `${orderData.tax.toFixed(2)}` : 'Included',
      totalAmount: `${(orderData.total || 0).toFixed(2)}`,
      giftCardCodes: giftCardCodesList,
      hasGiftCards: giftCardCodesList.length > 0
    };
    
    logger.info('📧 Email would be sent with data:', emailData);
    
    logger.info('✅ Email simulation completed successfully');
    
    return { 
      success: true, 
      emailId: `sim_${Date.now()}`,
      note: 'Email simulated - integrate with actual email service for production'
    };
    
  } catch (error) {
    logger.error('❌ Error in email service:', error);
    return { 
      success: false, 
      error: error.message,
      note: 'Email service error'
    };
  }
};

module.exports = {
  sendOrderConfirmationEmail
}; 