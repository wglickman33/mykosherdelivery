import { loadStripe } from '@stripe/stripe-js';
import apiClient from '../lib/api';
import logger from '../utils/logger';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ===== STRIPE SETUP =====

export const getStripe = async () => {
  return await stripePromise;
};

// ===== ORDER CREATION SERVICES =====

export const createOrder = async (orderData) => {
  try {
    const {
      userId,
      restaurantGroups,
      deliveryAddress,
      deliveryInstructions,
      subtotal,
      deliveryFee,
      tax
    } = orderData;

    // Create orders via Express backend
    const response = await apiClient.post('/orders', {
      userId,
      restaurantGroups,
      deliveryAddress,
      deliveryInstructions,
      subtotal,
      deliveryFee,
      tax
    });

    if (response.success) {
      return { success: true, orders: response.data };
    } else {
      throw new Error(response.error || 'Failed to create orders');
    }
  } catch (error) {
    logger.error('Error creating orders:', error);
    return { success: false, error: error.message };
  }
};

// ===== PAYMENT PROCESSING SERVICES =====

export const processPayment = async (paymentData) => {
  try {
    const {
      amount,
      paymentMethodId,
      orderIds,
      customerInfo
    } = paymentData;

    // ⚠️ SECURITY: Payment processing MUST be done server-side
    // This function now calls the backend API for secure payment processing
    
    if (!paymentMethodId) {
      throw new Error('Payment method is required');
    }

    if (!amount || amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    if (!orderIds || orderIds.length === 0) {
      throw new Error('Order IDs are required');
    }

    // Call backend API for secure payment processing
    const response = await apiClient.post('/payments/process', {
      amount: Math.round(amount * 100), // Convert to cents
      paymentMethodId,
      orderIds,
      customerInfo,
      currency: 'usd'
    });

    if (response.success) {
      return {
        success: true,
        paymentIntentId: response.paymentIntentId,
        transactionId: response.transactionId,
        amount: amount,
        status: response.status
      };
    } else {
      throw new Error(response.error || 'Payment processing failed');
    }
    
  } catch (error) {
    logger.error('Payment processing error:', error);
    
    // Return user-friendly error messages
    let errorMessage = 'Payment processing failed. Please try again.';
    
    if (error.message.includes('card_declined')) {
      errorMessage = 'Your card was declined. Please try a different payment method.';
    } else if (error.message.includes('insufficient_funds')) {
      errorMessage = 'Insufficient funds. Please try a different payment method.';
    } else if (error.message.includes('expired_card')) {
      errorMessage = 'Your card has expired. Please update your payment method.';
    } else if (error.message.includes('network')) {
      errorMessage = 'Network error. Please check your connection and try again.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};



// ===== PAYMENT METHOD SERVICES =====

export const createPaymentMethod = async (cardElement, billingDetails) => {
  try {
    const stripe = await getStripe();
    
    if (!stripe) {
      throw new Error('Stripe not loaded');
    }

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: billingDetails,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, paymentMethod };
  } catch (error) {
    console.error('Error creating payment method:', error);
    return { success: false, error: error.message };
  }
};

export const savePaymentMethodToUser = async (userId, paymentMethod, isDefault = false) => {
  try {
    const paymentMethodData = {
      paymentMethodId: paymentMethod.id,
      isDefault: isDefault
    };

    // Save payment method via Express backend
    const response = await apiClient.post('/payments/methods', paymentMethodData);

    if (response.success) {
      return { success: true, data: response.data };
    } else {
      throw new Error(response.error || 'Failed to save payment method');
    }
  } catch (error) {
    logger.error('Error saving payment method:', error);
    return { success: false, error: error.message };
  }
};

// ===== ORDER CALCULATION SERVICES =====

export const calculateOrderTotals = async (cartItems, zipCode = null) => {
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Dynamic delivery fee based on zip code (fallback to default)
  let deliveryFee = 5.99;
  let taxRate = 0.0825;
  
  if (zipCode) {
    try {
      const { calculateDeliveryFee, calculateTaxRate } = await import('./deliveryZoneService');
      const [fee, rate] = await Promise.all([
        calculateDeliveryFee(zipCode),
        calculateTaxRate(zipCode)
      ]);
      deliveryFee = fee || 5.99;
      taxRate = rate || 0.0825;
    } catch (error) {
      console.warn('Error calculating dynamic fees, using defaults:', error);
    }
  }
  
  const tax = subtotal * taxRate;
  const total = subtotal + deliveryFee + tax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    deliveryFee: Math.round(deliveryFee * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
    taxRate
  };
};

// ===== EMAIL NOTIFICATION SERVICES =====

export const sendOrderConfirmationEmail = async (orderData) => {
  try {
    console.log('📧 Sending REAL order confirmation email:', orderData);
    
    // ⚠️ EmailJS Implementation - Real email sending
    // You'll need to set up EmailJS account and get these values:
    // 1. Go to https://emailjs.com
    // 2. Create account and email template
    // 3. Get your PUBLIC_KEY, SERVICE_ID, and TEMPLATE_ID
    
    const emailjsConfig = {
      publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'YOUR_EMAILJS_PUBLIC_KEY',
      serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || 'YOUR_EMAILJS_SERVICE_ID',
      templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'YOUR_EMAILJS_TEMPLATE_ID'
    };
    
    // Check if EmailJS is configured
    if (emailjsConfig.publicKey === 'YOUR_EMAILJS_PUBLIC_KEY') {
      console.warn('⚠️ EmailJS not configured - skipping real email send');
      console.log('📧 Email would have been sent to:', orderData.customerEmail);
      console.log('📧 Order details:', {
        orderIds: orderData.orderIds,
        total: orderData.total,
        customerName: orderData.customerName
      });
      
      // Simulate successful email for demo
      return { 
        success: true, 
        note: 'Email simulated - configure EmailJS for real emails'
      };
    }
    
    // Real EmailJS implementation (when configured)
    const { default: emailjs } = await import('@emailjs/browser');
    
    const templateParams = {
      // Template variables for your EmailJS template
      order_ids: orderData.orderIds ? orderData.orderIds.join(', ') : orderData.orders?.[0]?.order_number || 'N/A',
      to_name: orderData.customerInfo?.firstName || orderData.customerInfo?.first_name || orderData.customerName || 'Customer',
      order_date: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      to_email: orderData.customerInfo?.email || orderData.customerEmail || 'customer@example.com',
      delivery_address: orderData.deliveryAddress || 'Address not provided',
      delivery_fee: `$${(orderData.deliveryFee || 5.99).toFixed(2)}`,
      tax: orderData.tax ? `$${orderData.tax.toFixed(2)}` : 'Included',
      total_amount: `$${(orderData.total || orderData.paymentInfo?.amount || 0).toFixed(2)}`
    };
    
    const response = await emailjs.send(
      emailjsConfig.serviceId,
      emailjsConfig.templateId,
      templateParams,
      emailjsConfig.publicKey
    );
    
    console.log('✅ Email sent successfully:', response);
    return { success: true, emailId: response.text };
    
  } catch (error) {
    console.error('❌ Error sending confirmation email:', error);
    return { 
      success: false, 
      error: error.message,
      note: 'Email failed - check EmailJS configuration'
    };
  }
};

// ===== GUEST ORDER SERVICES =====

export const createGuestOrder = async (orderData) => {
  try {
    const {
      guestInfo,
      restaurantGroups,
      deliveryAddress,
      deliveryInstructions,
      subtotal,
      deliveryFee,
      tax
    } = orderData;

    // Create guest orders via Express backend
    const response = await apiClient.post('/orders/guest', {
      guestInfo,
      restaurantGroups,
      deliveryAddress,
      deliveryInstructions,
      subtotal,
      deliveryFee,
      tax
    });

    if (response.success) {
      return { success: true, orders: response.data };
    } else {
      throw new Error(response.error || 'Failed to create guest orders');
    }
  } catch (error) {
    logger.error('Error creating guest orders:', error);
    return { success: false, error: error.message };
  }
}; 