import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, MapPin, Phone, CreditCard } from 'lucide-react';
import emailjs from '@emailjs/browser';
import apiClient from '../../lib/api';
import Footer from '../Footer/Footer';
import './OrderConfirmationPage.scss';

const OrderConfirmationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState(null);
  const [giftCardsFromOrder, setGiftCardsFromOrder] = useState([]);
  const emailSentRef = useRef(false);

  const subtotal = orderData?.subtotal || 0;
  const deliveryFee = orderData?.deliveryFee || 5.99;
  const tip = orderData?.tip || 0;
  const tax = orderData?.tax || 0;
  const discountAmount = orderData?.discountAmount || 0;
  const appliedPromo = orderData?.appliedPromo || null;
  const total = orderData?.orderTotal || 0;

  const sendConfirmationEmail = useCallback(async (orderData, giftCards = []) => {
    try {
      console.log('📧 Sending confirmation email with data:', orderData, 'giftCards:', giftCards?.length);

      const emailjsConfig = {
        publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
        serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
        templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID
      };

      if (!emailjsConfig.publicKey || !emailjsConfig.serviceId || !emailjsConfig.templateId) {
        console.warn('EmailJS not configured - skipping email send');
        return;
      }

      let orderNumber = orderData.paymentMethod?.orderNumber ||
                       orderData.paymentMethod?.order_number ||
                       orderData.orderNumber ||
                       orderData.order_number ||
                       null;

      if (!orderNumber || orderNumber === 'Order' || orderNumber === 'Confirmed') {
        const orderIds = orderData.paymentMethod?.orderIds || orderData.orderIds;
        if (orderIds && orderIds.length > 0) {
          try {
            const firstOrderId = orderIds[0];
            const orderResponse = await apiClient.get(`/orders/${firstOrderId}`);
            if (orderResponse) {
              orderNumber = orderResponse.orderNumber || orderResponse.order_number || orderResponse.id || null;
            }
          } catch (orderError) {
            console.warn('Failed to fetch order number for email:', orderError);
          }
        }
      }

      if (!orderNumber) {
        const orderIds = orderData.paymentMethod?.orderIds || orderData.orderIds;
        orderNumber = (orderIds && orderIds.length > 0) ? orderIds[0] : 'N/A';
      }

      const getUserName = () => {
        if (orderData.userProfile?.firstName) return orderData.userProfile.firstName;
        if (orderData.contactInfo?.firstName) return orderData.contactInfo.firstName;
        if (orderData.contactInfo?.first_name) return orderData.contactInfo.first_name;
        if (orderData.userProfile?.email) {
          const emailName = orderData.userProfile.email.split('@')[0];
          return emailName.charAt(0).toUpperCase() + emailName.slice(1);
        }
        if (orderData.contactInfo?.email) {
          const emailName = orderData.contactInfo.email.split('@')[0];
          return emailName.charAt(0).toUpperCase() + emailName.slice(1);
        }
        return 'Customer';
      };

      const sSubtotal = Number(orderData?.subtotal ?? 0);
      const sDelivery = Number(orderData?.deliveryFee ?? 0);
      const sTip = Number(orderData?.tip ?? 0);
      const sTax = Number(orderData?.tax ?? 0);
      const sDiscount = Number(orderData?.discountAmount ?? 0);
      const sTotal = Number(orderData?.orderTotal ?? (sSubtotal - sDiscount + sDelivery + sTip + sTax));
      const fullName = `${orderData.userProfile?.firstName || ''} ${orderData.userProfile?.lastName || ''}`.trim() || getUserName();

      const hasGiftCards = Array.isArray(giftCards) && giftCards.length > 0;
      const orderItemsContent = hasGiftCards
        ? `Gift Card Purchase\n\nYour gift card code(s) — keep this private (only you and our team can see it):\n${giftCards.map((c) => `${c.code} — $${Number(c.balance ?? c.initialBalance).toFixed(2)}`).join('\n')}`
        : buildOrderItemsHtml(orderData.orderItems);

      const templateParams = {
        to_email: orderData.contactInfo?.email || orderData.userProfile?.email || 'customer@example.com',
        to_name: getUserName(),
        customer_full_name: fullName,
        order_ids: hasGiftCards ? 'Gift Card Purchase' : orderNumber,
        order_date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        subtotal: `${sSubtotal.toFixed(2)}`,
        discount: sDiscount > 0 ? `-${sDiscount.toFixed(2)}${orderData?.appliedPromo?.code ? ` (${orderData.appliedPromo.code})` : ''}` : '$0.00',
        delivery_fee: `${sDelivery.toFixed(2)}`,
        tip: `${sTip.toFixed(2)}`,
        tax: `${sTax.toFixed(2)}`,
        total_amount: `${sTotal.toFixed(2)}`,
        delivery_address: hasGiftCards ? 'N/A — Gift card delivered via email' : formatAddress(orderData.deliveryAddress),
        order_items_html: orderItemsContent,
        is_gift_card_purchase: hasGiftCards ? 'true' : 'false',
        gift_card_codes_display: hasGiftCards ? giftCards.map((c) => `${c.code} ($${Number(c.balance ?? c.initialBalance).toFixed(2)})`).join(', ') : ''
      };

      console.log('📧 Email template params (is_gift_card_purchase):', templateParams.is_gift_card_purchase);

      const response = await emailjs.send(
        emailjsConfig.serviceId,
        emailjsConfig.templateId,
        templateParams,
        emailjsConfig.publicKey
      );

      console.log('✅ Confirmation email sent successfully:', response);
    } catch (error) {
      console.error('❌ Failed to send confirmation email:', error);
    }
  }, []);

  useEffect(() => {
    if (!location.state) {
      navigate('/');
      return;
    }

    const state = location.state;
    setOrderData(state);

    const orderIds = state.paymentMethod?.orderIds || state.orderIds;
    const orderKey = state.paymentMethod?.orderNumber ||
                    state.paymentMethod?.order_number ||
                    state.orderNumber ||
                    state.order_number ||
                    (orderIds && orderIds[0]) ||
                    `order_${Date.now()}`;
    const emailSentKey = `email_sent_${orderKey}`;
    if (sessionStorage.getItem(emailSentKey) || emailSentRef.current) return;

    const run = async () => {
      let giftCards = [];
      if (orderIds && orderIds.length > 0) {
        try {
          const res = await apiClient.get(`/orders/${orderIds[0]}`);
          const cards = res?.giftCards || res?.gift_cards || [];
          giftCards = Array.isArray(cards) ? cards : [];
          setGiftCardsFromOrder(giftCards);
        } catch {
          setGiftCardsFromOrder([]);
        }
      }
      sendConfirmationEmail(state, giftCards);
      emailSentRef.current = true;
      sessionStorage.setItem(emailSentKey, 'true');
    };
    run();
  }, [location.state, navigate, sendConfirmationEmail]);

  const formatAddress = (address) => {
    if (!address) return '';
    if (typeof address === 'string') return address;
    return `${address.street || ''}${address.apartment ? `, ${address.apartment}` : ''}, ${address.city || ''}, ${address.state || ''} ${address.zip_code || ''}`;
  };

  const buildOrderItemsHtml = (orderItems) => {
    if (!orderItems || orderItems.length === 0) {
      return '<div>No items</div>';
    }

    const groups = {};
    orderItems.forEach(item => {
      const restaurantName = item.restaurantName || 'Unknown Restaurant';
      if (!groups[restaurantName]) groups[restaurantName] = [];
      groups[restaurantName].push(item);
    });

    const sections = Object.entries(groups).map(([restaurantName, items]) => {
      const header = `
        <div style="margin: 8px 0 6px; color:#061757; font-weight:700;">
          <span style="display:inline-block; vertical-align:middle; width:24px; border-top:2px solid #cbd5e1; margin-right:8px;"></span>
          <span style="vertical-align:middle; letter-spacing:0.5px;">${restaurantName.toUpperCase()}</span>
          <span style="display:inline-block; vertical-align:middle; width:24px; border-top:2px solid #cbd5e1; margin-left:8px;"></span>
        </div>`;

      const list = `<ul style="list-style:none; padding:0 0 0 6px; margin:0 0 10px;">
        ${items.map(it => `<li style="margin:6px 0;">
            <span style="display:inline-block; min-width:12px; color:#061757;">•</span>
            <span>${it.name}</span>
            <span style="color:#64748b;"> x${it.quantity}</span>
            <span style="float:right; font-weight:600;">$${(it.price * it.quantity).toFixed(2)}</span>
        </li>`).join('')}
      </ul>`;

      return header + list;
    });

    return sections.join('');
  };

  const formatPaymentMethod = (paymentMethod) => {
    if (!paymentMethod) return 'Card payment';
    return `${paymentMethod.brand || 'Card'} •••• ${paymentMethod.last4 || paymentMethod.last_four || '****'}`;
  };

  if (!orderData) {
    return (
      <div className="order-confirmation-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="order-confirmation-page">
      <div className="order-confirmation-container">
        {}
        <div className="success-header">
          <div className="success-icon">
            <Check className="check-icon" />
          </div>
          <h1 className="success-title">Order Confirmed!</h1>
          <p className="success-subtitle">
            Thank you for your order. We&apos;ve received your payment and are preparing your delicious kosher meal.
          </p>
          <div className="order-number">
            Order #{orderData.paymentMethod?.orderNumber || 
                    orderData.paymentMethod?.order_number ||
                    orderData.orderNumber ||
                    orderData.order_number ||
                    (orderData.paymentMethod?.orderIds && orderData.paymentMethod.orderIds[0]) ||
                    (orderData.orderIds && orderData.orderIds[0]) ||
                    'N/A'}
          </div>
        </div>

        {}
        <div className="order-details-grid">
          {}
          <div className="detail-card">
            <div className="card-header">
              <MapPin className="card-icon" />
              <h3>Delivery Address</h3>
            </div>
            <div className="card-content">
              <p className="address-text">{formatAddress(orderData.deliveryAddress)}</p>
              {orderData.contactInfo?.deliveryInstructions && (
                <p className="delivery-instructions">
                  <strong>Instructions:</strong> {orderData.contactInfo.deliveryInstructions}
                </p>
              )}
            </div>
          </div>

          {}
          <div className="detail-card">
            <div className="card-header">
              <Phone className="card-icon" />
              <h3>Contact Info</h3>
            </div>
            <div className="card-content">
              <p>{orderData.contactInfo?.phone}</p>
              <p>{orderData.contactInfo?.email}</p>
            </div>
          </div>

          {}
          <div className="detail-card">
            <div className="card-header">
              <CreditCard className="card-icon" />
              <h3>Payment Method</h3>
            </div>
            <div className="card-content">
              <p>{formatPaymentMethod(orderData.paymentMethod)}</p>
              <p className="payment-status">✓ Payment Successful</p>
            </div>
          </div>


        </div>

        {}
        <div className="order-items-section">
          <h3 className="section-title">Your Order</h3>
          <div className="order-items-list">
            {orderData.orderItems?.map((item) => (
              <div key={item.id} className="order-item">
                <div className="item-image">
                  {item.image ? (
                    <img src={item.image} alt={item.name} />
                  ) : (
                    <div className="item-placeholder">🍽️</div>
                  )}
                </div>
                <div className="item-details">
                  <h4 className="item-name">{item.name}</h4>
                  {item.customizations && item.customizations.length > 0 && (
                    <p className="item-customizations">
                      {item.customizations.join(', ')}
                    </p>
                  )}
                  <p className="item-quantity">Quantity: {item.quantity}</p>
                </div>
                <div className="item-price">
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          
          {}
          <div className="order-total-summary">
            <h3>Order Summary</h3>
            <div className="breakdown-line">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            
            {discountAmount > 0 && (
              <div className="breakdown-line discount-line">
                <span>Promo Discount ({appliedPromo?.code})</span>
                <span className="discount-value">-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            {orderData?.giftCardAmount > 0 && (
              <div className="breakdown-line discount-line">
                <span>Gift Card</span>
                <span className="discount-value">-${Number(orderData.giftCardAmount).toFixed(2)}</span>
              </div>
            )}
            
            <div className="breakdown-line">
              <span>Delivery Fee</span>
              <span>${deliveryFee.toFixed(2)}</span>
            </div>
            <div className="breakdown-line">
              <span>Driver Tip</span>
              <span>${tip.toFixed(2)}</span>
            </div>
            <div className="breakdown-line">
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="total-line">
              <span><strong>Total Paid</strong></span>
              <span className="total-amount"><strong>${total.toFixed(2)}</strong></span>
            </div>
          </div>
        </div>

        {giftCardsFromOrder.length > 0 && (
          <div className="gift-cards-confirmation" style={{ marginTop: '24px', padding: '16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Your gift card code(s)</h3>
            <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#166534' }}>Use these codes at checkout. Balance can be checked on your account page.</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {giftCardsFromOrder.map((gc) => (
                <li key={gc.id} style={{ marginBottom: '8px', fontFamily: 'monospace', fontWeight: 600 }}>
                  {gc.code} — ${Number(gc.balance || gc.initialBalance).toFixed(2)} balance
                </li>
              ))}
            </ul>
          </div>
        )}

        {}
        <div className="action-buttons">
          <button 
            className="primary-button"
            onClick={() => navigate('/')}
          >
            Continue Shopping
          </button>
          <button 
            className="secondary-button"
            onClick={() => navigate('/account')}
          >
            View Order History
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default OrderConfirmationPage; 