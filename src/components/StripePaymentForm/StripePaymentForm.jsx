import { useState } from 'react';
import PropTypes from 'prop-types';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Lock } from 'lucide-react';
import './StripePaymentForm.scss';

const StripePaymentForm = ({ 
  amount,
  onSuccess, 
  onError, 
  createPaymentIntent,
  buttonText,
  showSecurityBadge = true,
  saveCardOption = false,
  onSaveCardChange
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentMeta, setPaymentMeta] = useState(null);
  const [saveCard, setSaveCard] = useState(false);

  const handleSaveCardChange = (checked) => {
    setSaveCard(checked);
    if (onSaveCardChange) {
      onSaveCardChange(checked);
    }
  };

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
      }

      const cardElement = elements.getElement(CardElement);
      const { error, paymentIntent } = await stripe.confirmCardPayment(activeClientSecret, {
        payment_method: {
          card: cardElement,
        }
      });

      if (error) {
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

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1e293b',
        '::placeholder': {
          color: '#94a3b8',
        },
      },
      invalid: {
        color: '#dc2626',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="stripe-payment-form">
      <div className="stripe-payment-form__card-section">
        <label className="stripe-payment-form__label">
          Card Information
        </label>
        <div className="stripe-payment-form__card-element">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {error && (
        <div className="stripe-payment-form__error">
          {error}
        </div>
      )}

      {saveCardOption && (
        <div className="stripe-payment-form__save-card">
          <label>
            <input
              type="checkbox"
              checked={saveCard}
              onChange={(e) => handleSaveCardChange(e.target.checked)}
            />
            <span>Save card for future orders</span>
          </label>
        </div>
      )}

      <button
        type="submit"
        className="stripe-payment-form__submit"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? 'Processing...' : (buttonText || `Pay $${parseFloat(amount).toFixed(2)}`)}
      </button>

      {showSecurityBadge && (
        <div className="stripe-payment-form__security">
          <p>
            <Lock size={16} className="security-icon" />
            <span>Secure payment powered by Stripe</span>
          </p>
          <p className="security-note">Your payment information is encrypted and secure</p>
        </div>
      )}
    </form>
  );
};

StripePaymentForm.propTypes = {
  amount: PropTypes.number.isRequired,
  onSuccess: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
  createPaymentIntent: PropTypes.func.isRequired,
  buttonText: PropTypes.string,
  showSecurityBadge: PropTypes.bool,
  saveCardOption: PropTypes.bool,
  onSaveCardChange: PropTypes.func
};

export default StripePaymentForm;
