import { useState, useEffect } from "react";
import { CreditCard, Lock, Plus, Check } from "lucide-react";
import PropTypes from "prop-types";
import { useAuth } from "../../hooks/useAuth";
import { processPayment } from "../../services/paymentServices";
import apiClient from "../../lib/api";
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
if (import.meta.env.DEV && !stripeKey) {
  console.warn('[Payment] Stripe publishable key not set');
}

const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

const StripeCardForm = ({ onSuccess, onError, createPaymentIntent }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentMeta, setPaymentMeta] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      let activeClientSecret = clientSecret;
      let activeMeta = paymentMeta;

      if (!activeClientSecret) {
        const paymentIntentData = await createPaymentIntent();
        if (!paymentIntentData || !paymentIntentData.clientSecret) {
          throw new Error('Failed to create payment intent');
        }
        activeClientSecret = paymentIntentData.clientSecret;
        activeMeta = paymentIntentData;
        setClientSecret(paymentIntentData.clientSecret);
        setPaymentMeta(paymentIntentData);
        // Server may have already confirmed (e.g. saved payment method) — do not confirm again
        if (paymentIntentData.status === 'succeeded') {
          onSuccess(
            { id: paymentIntentData.paymentIntentId, status: 'succeeded' },
            paymentIntentData
          );
          return;
        }
      }

      const cardElement = elements.getElement(CardElement);
      const { error, paymentIntent } = await stripe.confirmCardPayment(activeClientSecret, {
        payment_method: {
          card: cardElement,
        }
      });

      if (error) {
        // PaymentIntent already succeeded (e.g. double submit or race) — treat as success
        if (
          error.code === 'payment_intent_unexpected_state' &&
          error.payment_intent?.status === 'succeeded'
        ) {
          onSuccess(error.payment_intent, activeMeta || {});
          return;
        }
        setError(error.message);
        onError(error.message);
      } else if (paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent, activeMeta || {});
      } else {
        setError(`Payment status: ${paymentIntent.status}. Please try again.`);
        onError(`Payment status: ${paymentIntent.status}. Please try again.`);
      }
    } catch (err) {
      console.error('Stripe payment error:', err);
      setError(err.message || 'An unexpected error occurred.');
      onError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stripe-payment-form">
      <div className="stripe-payment-form__card-section">
        <label className="stripe-payment-form__label">
          Card Information
        </label>
        <div className="stripe-payment-form__card-element">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>
      </div>
      
      {error && (
        <div className="stripe-payment-form__error">
          {error}
        </div>
      )}
      
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="stripe-payment-form__submit-button"
      >
        {isProcessing ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
};

StripeCardForm.propTypes = {
  onSuccess: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
  createPaymentIntent: PropTypes.func.isRequired,
};

const PaymentStep = ({ 
  onComplete, 
  orderData, 
  tipPercentage, 
  customTip, 
  onTipPercentageChange, 
  onCustomTipChange 
}) => {
  const { profile } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [errorTimeout, setErrorTimeout] = useState(null);
  const [stripePaymentData, setStripePaymentData] = useState(null);

  useEffect(() => {
    return () => {
      if (errorTimeout) {
        clearTimeout(errorTimeout);
      }
    };
  }, [errorTimeout]);

  const setErrorWithTimeout = (message) => {
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    setError(message);
    const timeout = setTimeout(() => setError(""), 3000);
    setErrorTimeout(timeout);
  };

  const clearError = () => {
    if (errorTimeout) {
      clearTimeout(errorTimeout);
      setErrorTimeout(null);
    }
    setError("");
  };

  const createPaymentIntent = async () => {
    if (stripePaymentData) {
      return stripePaymentData;
    }
    
    try {
      setIsProcessing(true);
      clearError();

      const restaurantGroups = {};
      orderData.items.forEach(item => {
        const restaurantId = item.restaurantId || 'unknown';
        if (!restaurantGroups[restaurantId]) {
          restaurantGroups[restaurantId] = {
            restaurantName: item.restaurantName || 'Unknown Restaurant',
            items: [],
            total: 0
          };
        }
        const fullItem = {
          ...item,
          itemType: item.itemType,
          selectedVariant: item.selectedVariant,
          selectedConfigurations: item.selectedConfigurations,
          basePrice: item.basePrice,
          configurationPrice: item.configurationPrice,
          menuItemId: item.menuItemId || item.id,
          options: item.options
        };
        restaurantGroups[restaurantId].items.push(fullItem);
        restaurantGroups[restaurantId].total += item.price * item.quantity;
      });

      const subtotal = orderData.subtotal;

      const orderPayload = {
        restaurantGroups: restaurantGroups,
        deliveryAddress: orderData.deliveryAddress,
        deliveryInstructions: orderData.contactInfo?.deliveryInstructions || null,
        subtotal: subtotal,
        deliveryFee: orderData.deliveryFee || 0,
        tax: orderData.tax || 0,
        total: orderData.total,
        tip: orderData.tip || 0,
        discountAmount: orderData.discountAmount || 0,
        appliedPromo: orderData.appliedPromo || null,
        appliedGiftCard: orderData.appliedGiftCard || null
      };

      const orderResponse = await apiClient.post('/orders', orderPayload);

      if (!orderResponse.success || !orderResponse.data) {
        throw new Error('Failed to create orders');
      }

      const ordersArray = Array.isArray(orderResponse.data?.orders)
        ? orderResponse.data.orders
        : (Array.isArray(orderResponse.data) ? orderResponse.data : []);
      const orderIds = ordersArray
        .map(order => order?.id)
        .filter(Boolean);

      if (!orderIds || orderIds.length === 0 || orderIds.some(id => !id)) {
        throw new Error('Invalid order IDs extracted from response');
      }

      const paymentIntentResponse = await apiClient.post('/payments/create-intent', {
        amount: Math.round(orderData.total * 100),
        currency: 'usd',
        orderIds: orderIds
      });

      if (!paymentIntentResponse.success) {
        throw new Error(paymentIntentResponse.error || 'Failed to create payment intent');
      }

      const stripeData = {
        clientSecret: paymentIntentResponse.clientSecret,
        paymentIntentId: paymentIntentResponse.paymentIntentId,
        status: paymentIntentResponse.status,
        amount: Math.round(orderData.total * 100),
        orderIds: orderIds
      };

      setStripePaymentData(stripeData);
      return stripeData;

    } catch (error) {
      console.error('Payment intent creation failed:', error);
      setErrorWithTimeout(error.message || 'Payment setup failed. Please try again.');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStripePaymentSuccess = async (paymentIntent, paymentMeta = {}) => {
    const orderIds = paymentMeta?.orderIds || stripePaymentData?.orderIds;
    let orderNumber = null;

    if (orderIds && orderIds.length > 0) {
      try {
        const firstOrderId = orderIds[0];
        const orderResponse = await apiClient.get(`/orders/${firstOrderId}`);
        if (orderResponse && orderResponse.orderNumber) {
          orderNumber = orderResponse.orderNumber;
        } else if (orderResponse && orderResponse.order_number) {
          orderNumber = orderResponse.order_number;
        } else if (orderResponse && orderResponse.id) {
          orderNumber = orderResponse.id;
        }
      } catch (orderError) {
        console.warn('Failed to fetch order number:', orderError);
      }
    }

    try {
      const meta = {
        ...(paymentMeta || {}),
        ...(stripePaymentData || {})
      };

      if (!meta.orderIds || meta.orderIds.length === 0) {
        throw new Error('Payment succeeded but order metadata is missing.');
      }

      try {
        console.log('Confirming payment intent on backend...', { paymentIntentId: paymentIntent.id });
        const confirmResult = await apiClient.post('/payments/confirm-intent', {
          paymentIntentId: paymentIntent.id
        });
        console.log('Payment confirmed on backend:', confirmResult);
      } catch (confirmError) {
        console.error('Failed to confirm payment intent on backend:', confirmError);
      }

      const emailResult = await apiClient.post('/orders/send-confirmation', {
        orderIds: meta.orderIds,
        customerInfo: {
          firstName: profile?.firstName || 'Customer',
          lastName: profile?.lastName || '',
          email: profile?.email || ''
        },
        total: (meta.amount || orderData.total * 100) / 100
      });

      console.log('Email sent:', emailResult);
    } catch (error) {
      console.error('Failed to send confirmation email:', error);
    }

    onComplete({
      id: 'stripe-payment',
      type: 'card',
      last4: paymentIntent.payment_method?.card?.last4 || '****',
      brand: paymentIntent.payment_method?.card?.brand || 'Card',
      status: paymentIntent.status,
      orderIds: orderIds,
      paymentIntentId: paymentIntent.id,
      orderNumber: orderNumber
    });
  };

  const handleStripePaymentError = (errorMessage) => {
    setErrorWithTimeout(errorMessage);
    setStripePaymentData(null);
    setIsProcessing(false);
  };

  const savedMethods = profile?.payment_methods || [];
  




  const handleSubmit = async () => {
    clearError();
    
    if (!selectedMethod) {
      setErrorWithTimeout("Please select a payment method to continue.");
      return;
    }

    if (selectedMethod === 'new-card') {
      setErrorWithTimeout("Please use the secure card form above.");
      return;
    }
    
    setIsProcessing(true);
    
    try {

      
      const restaurantGroups = {};
      
      orderData.items.forEach((item, index) => {
        if (!item.restaurantId) {
          console.error('Cart item missing restaurantId:', item);
          throw new Error('Cart items must have restaurant information. Please refresh and try again.');
        }
        
        const restaurantId = item.restaurantId;
        if (!restaurantGroups[restaurantId]) {
          restaurantGroups[restaurantId] = {
            items: [],
            subtotal: 0,
            total: 0
          };
        }
        
        const fullItem = {
          ...item,
          orderIndex: index,
          itemType: item.itemType,
          selectedVariant: item.selectedVariant,
          selectedConfigurations: item.selectedConfigurations,
          basePrice: item.basePrice,
          configurationPrice: item.configurationPrice,
          menuItemId: item.menuItemId || item.id,
          options: item.options
        };
        restaurantGroups[restaurantId].items.push(fullItem);
        restaurantGroups[restaurantId].subtotal += item.price * item.quantity;
      });

      const totalSubtotal = Object.values(restaurantGroups).reduce((sum, group) => sum + group.subtotal, 0);
      const deliveryFee = orderData.deliveryFee;
      const tip = orderData.tip;
      const discountAmount = orderData.discountAmount || 0;
      const discountedSubtotal = totalSubtotal - discountAmount;
      const tax = discountedSubtotal * (orderData.taxRate || 0.0825);
      const total = orderData.total;
      
      const restaurantCount = Object.keys(restaurantGroups).length;
      const deliveryFeePerRestaurant = deliveryFee / restaurantCount;
      const taxRate = 0.0825;

      Object.keys(restaurantGroups).forEach(restaurantId => {
        const group = restaurantGroups[restaurantId];
        group.deliveryFee = deliveryFeePerRestaurant;
        group.tax = group.subtotal * taxRate;
        group.total = group.subtotal + group.deliveryFee + group.tax;
      });

      const orderPayload = {
        userId: profile?.id,
        restaurantGroups,
        deliveryAddress: orderData.deliveryAddress,
        deliveryInstructions: orderData.contactInfo?.deliveryInstructions || null,
        subtotal: totalSubtotal,
        deliveryFee: deliveryFee,
        tip: tip,
        tax: tax,
        total: total,
        discountAmount: orderData.discountAmount || 0,
        appliedPromo: orderData.appliedPromo || null,
        appliedGiftCard: orderData.appliedGiftCard || null
      };

      const orderResponse = await apiClient.post('/orders', orderPayload);

      if (!orderResponse.success) {
        throw new Error('Failed to create order');
      }

      const orderIds = orderResponse.data.orders.map(order => order.id);
      
      let paymentResult;
      
      if (selectedMethod.startsWith('saved-')) {
        const method = savedMethods.find(m => m.id === selectedMethod);
        if (method && method.stripe_payment_method_id) {
          paymentResult = await processPayment({
            amount: orderData.total,
            paymentMethodId: method.stripe_payment_method_id,
            orderIds: orderIds,
            customerInfo: orderData.contactInfo
          });
        }
      } else if (selectedMethod === 'new-card') {
        const paymentIntentResponse = await apiClient.post('/payments/create-intent', {
          amount: Math.round(orderData.total * 100),
          currency: 'usd',
          orderIds: orderIds
        });

        if (!paymentIntentResponse.success) {
          throw new Error('Failed to create payment intent');
        }

        setStripePaymentData({
          clientSecret: paymentIntentResponse.clientSecret,
          paymentIntentId: paymentIntentResponse.paymentIntentId,
          orderIds: orderIds,
          amount: Math.round(orderData.total * 100)
        });
        return;
      }

      if (paymentResult && paymentResult.success) {
        const order = orderResponse.data.orders?.[0];
        const orderNumber = order?.orderNumber || order?.order_number || order?.id;
        
        onComplete({
          id: selectedMethod,
          type: 'card',
          last4: '****',
          brand: 'Visa',
          status: 'succeeded',
          orderIds,
          orderNumber: orderNumber
        });
      } else {
        throw new Error('Payment processing failed');
      }
    } catch (error) {
      console.error('Payment failed:', error);
      
      let friendlyMessage = "We're having trouble processing your payment right now. Please try again in a moment.";
      
      if (error.message?.includes('restaurant information')) {
        friendlyMessage = "There's an issue with your order. Please refresh the page and try again.";
      } else if (error.message?.includes('order')) {
        friendlyMessage = "We couldn't process your order right now. Please try again or contact support if the issue continues.";
      } else if (error.message?.includes('payment')) {
        friendlyMessage = "Your payment information couldn't be processed. Please check your card details and try again.";
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        friendlyMessage = "We're experiencing connectivity issues. Please check your internet connection and try again.";
      } else if (error.message?.includes('declined') || error.message?.includes('insufficient')) {
        friendlyMessage = "Your card was declined. Please try a different payment method or contact your bank.";
      } else if (error.message?.includes('expired')) {
        friendlyMessage = "Your card appears to be expired. Please use a different payment method.";
      } else if (error.message?.includes('invalid') || error.message?.includes('card')) {
        friendlyMessage = "The card information provided doesn't appear to be valid. Please double-check your details.";
      }
      
      setErrorWithTimeout(friendlyMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const isFormValid = () => {
    return selectedMethod !== '' && selectedMethod !== 'new-card';
  };

  if (!stripePromise) {
    return (
      <div className="payment-step">
        <div className="step-header">
          <h2 className="step-title">Payment Method</h2>
          <p className="step-description">Payment system configuration required</p>
        </div>
        <div className="error-message">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-text">
              Payment processing is not available. Please check your environment configuration or contact support.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-step">
      <div className="step-header">
        <h2 className="step-title">
          Payment Method
        </h2>
        <p className="step-description">
          Choose how you&apos;d like to pay for your order
        </p>
      </div>

      <div className="payment-methods">
        {}
        {savedMethods.length > 0 && (
          <div className="saved-methods">
            <h3 className="section-title">Saved Payment Methods</h3>
            {savedMethods.map((method) => (
              <div
                key={method.id}
                className={`payment-card ${
                  selectedMethod === method.id ? "selected" : ""
                }`}
                onClick={() => {
                  if (error) clearError();
                  setSelectedMethod(method.id);
                }}
              >
                <div className="payment-content">
                  <div className="payment-row">
                    <input
                      type="radio"
                      value={method.id}
                      checked={selectedMethod === method.id}
                      onChange={() => {
                        if (error) clearError();
                        setSelectedMethod(method.id);
                      }}
                      className="payment-radio"
                    />
                    <CreditCard className="card-icon" />
                    <span className="card-brand">
                      {method.brand} •••• {method.last_four || method.last4}
                    </span>
                    {(method.is_primary || method.isDefault) && (
                      <span className="primary-badge">
                        Primary
                      </span>
                    )}
                    {selectedMethod === method.id && (
                      <Check className="selected-check" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {}
        <div className="new-card-section">
          <div
            className={`payment-card ${
              selectedMethod === 'new-card' ? "selected" : ""
            }`}
          >
            <div 
              className="payment-content"
              onClick={() => {
                if (error) clearError();
                setSelectedMethod('new-card');
              }}
            >
              <div className="payment-info">
                <input
                  type="radio"
                  value="new-card"
                  checked={selectedMethod === 'new-card'}
                    onChange={() => {
                       if (error) clearError();
                       setSelectedMethod('new-card');
                     }}
                  className="payment-radio"
                />
                <Plus className="card-icon" />
                <span className="add-card-text">Add New Card</span>
              </div>
            </div>
            
            {selectedMethod === 'new-card' && (
              <div className="new-card-form">
                <div className="form-divider"></div>
                <Elements stripe={stripePromise}>
                  <StripeCardForm
                    onSuccess={handleStripePaymentSuccess}
                    onError={handleStripePaymentError}
                    createPaymentIntent={createPaymentIntent}
                  />
                </Elements>
              </div>
            )}
          </div>
        </div>
      </div>

      {}
      <div className="payment-tip-section">
        <h3 className="payment-tip-title">Add Driver Tip</h3>
        <div className="payment-tip-options">
          <button
            className={`payment-tip-button ${tipPercentage === 15 ? 'selected' : ''}`}
            onClick={() => onTipPercentageChange(15)}
          >
            15%
          </button>
          <button
            className={`payment-tip-button ${tipPercentage === 18 ? 'selected' : ''}`}
            onClick={() => onTipPercentageChange(18)}
          >
            18%
          </button>
          <button
            className={`payment-tip-button ${tipPercentage === 20 ? 'selected' : ''}`}
            onClick={() => onTipPercentageChange(20)}
          >
            20%
          </button>
          <div className="payment-custom-tip">
            <input
              type="number"
              className="payment-custom-tip-input"
              placeholder="Custom"
              value={customTip || ''}
              onChange={(e) => onCustomTipChange(e.target.value)}
              min="0"
              step="0.01"
            />
            <span className="payment-tip-currency">$</span>
          </div>
        </div>
      </div>

      <div className="security-notice">
        <div className="security-content">
          <Lock className="lock-icon" />
          Your payment information is encrypted and secure
        </div>
      </div>

      {error && (
        <div className="error-message">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
          </div>
        </div>
      )}

      {selectedMethod && selectedMethod !== 'new-card' && (
        <button
          className="complete-button"
          onClick={handleSubmit}
          disabled={!isFormValid() || isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Complete Order'}
        </button>
      )}
    </div>
  );
};

PaymentStep.propTypes = {
  onComplete: PropTypes.func.isRequired,
  orderData: PropTypes.object,
  tipPercentage: PropTypes.number,
  customTip: PropTypes.number,
  onTipPercentageChange: PropTypes.func,
  onCustomTipChange: PropTypes.func,
};

export default PaymentStep; 