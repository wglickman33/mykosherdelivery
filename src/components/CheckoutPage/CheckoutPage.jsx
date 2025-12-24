import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import apiClient from "../../lib/api";
import { calculateDeliveryFee, calculateTaxRate } from "../../services/deliveryZoneService";
import { calculateTaxWithStripe } from "../../services/stripeTaxService";
import CheckoutProgress from "./CheckoutProgress";
import AddressStep from "./AddressStep";
import ContactStep from "./ContactStep";
import PaymentStep from "./PaymentStep";
import OrderSummary from "./OrderSummary";
import Footer from "../Footer/Footer";
import "./CheckoutPage.scss";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { profile, selectAddress } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [contactInfo, setContactInfo] = useState(null);

  // Tip and promo code state
  const [customTip, setCustomTip] = useState(0);
  const [tipPercentage, setTipPercentage] = useState(18); // Default 18%
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoErrorTimeout, setPromoErrorTimeout] = useState(null);

  const steps = ["Address", "Contact", "Payment"];

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (promoErrorTimeout) {
        clearTimeout(promoErrorTimeout);
      }
    };
  }, [promoErrorTimeout]);

  // Calculate current tip amount
  const calculateTip = (subtotalAmount) => {
    if (customTip > 0) {
      return customTip;
    }
    return (subtotalAmount * tipPercentage) / 100;
  };

  // Handle tip percentage selection
  const handleTipPercentage = (percentage) => {
    setTipPercentage(percentage);
    setCustomTip(0); // Reset custom tip when selecting percentage
  };

  // Handle custom tip input
  const handleCustomTipChange = (value) => {
    const tipValue = parseFloat(value) || 0;
    setCustomTip(tipValue);
    setTipPercentage(0); // Reset percentage when entering custom tip
  };

  // Validate and apply promo code
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      setPromoError("Please enter a promo code");
      return;
    }

    setIsValidatingPromo(true);
    setPromoError("");

    try {
      const response = await apiClient.validatePromoCode(promoCode.trim());
      if (response.success) {
        setAppliedPromo(response.data);
        setPromoError("");
        
        // Clear any existing timeout since promo was successful
        if (promoErrorTimeout) {
          clearTimeout(promoErrorTimeout);
          setPromoErrorTimeout(null);
        }
      }
    } catch (error) {
      // Provide user-friendly error messages
      let friendlyMessage = "Invalid promo code";
      
      if (error.message?.includes("Authentication")) {
        friendlyMessage = "Please sign in to use promo codes";
      } else if (error.message?.includes("not found") || error.message?.includes("404")) {
        friendlyMessage = "This promo code doesn't exist";
      } else if (error.message?.includes("expired")) {
        friendlyMessage = "This promo code has expired";
      } else if (error.message?.includes("deactivated")) {
        friendlyMessage = "This promo code is no longer active";
      } else if (error.message?.includes("limit")) {
        friendlyMessage = "This promo code has reached its usage limit";
      } else if (error.message?.includes("Server error")) {
        friendlyMessage = "Unable to validate promo code right now. Please try again.";
      } else if (error.message && !error.message.includes("Invalid promo code")) {
        // If we have a specific error message from the API, use it
        friendlyMessage = error.message;
      }
      
      setPromoError(friendlyMessage);
      setAppliedPromo(null);
      
      // Clear any existing timeout
      if (promoErrorTimeout) {
        clearTimeout(promoErrorTimeout);
      }
      
      // Set new timeout to clear error after 2 seconds
      const timeout = setTimeout(() => {
        setPromoError("");
      }, 2000);
      
      setPromoErrorTimeout(timeout);
    } finally {
      setIsValidatingPromo(false);
    }
  };

  // Remove applied promo code
  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoError("");
  };

  // Calculate totals with dynamic tip and promo
  const subtotal = getCartTotal();
  const [deliveryFee, setDeliveryFee] = useState(0); // Will be calculated
  const [taxRate, setTaxRate] = useState(0.0825); // Default NY tax rate
  const [taxAmount, setTaxAmount] = useState(0); // Tax amount from Stripe
  
  // Calculate delivery fee and tax using Stripe Tax when delivery address changes
  useEffect(() => {
    const calculateFees = async () => {
      // Normalize zip code - check both zipCode and zip_code
      const zipCode = selectedAddress?.zipCode || selectedAddress?.zip_code || selectedAddress?.postal_code;
      if (zipCode && cartItems.length > 0) {
        try {
          // Calculate delivery fee
          const fee = await calculateDeliveryFee(zipCode);
          if (fee && fee > 0) {
            setDeliveryFee(fee);
          } else {
            setDeliveryFee(5.99); // Fallback if fee is 0 or invalid
          }
          
          // Use the calculated fee for tax calculation
          const feeForTax = fee && fee > 0 ? fee : 5.99;

          // Validate address fields before calculating tax
          const addressLine1 = selectedAddress.street || selectedAddress.address || '';
          const addressCity = selectedAddress.city || '';
          const addressState = selectedAddress.state || '';
          
          if (!addressLine1 || !addressCity || !addressState || !zipCode) {
            console.warn('Incomplete address for tax calculation:', {
              line1: addressLine1,
              city: addressCity,
              state: addressState,
              zipCode,
            });
            // Fallback to default tax rate
            const discountedSubtotal = appliedPromo 
              ? (appliedPromo.discountType === 'percentage'
                  ? subtotal - (subtotal * appliedPromo.discountValue / 100)
                  : subtotal - Math.min(appliedPromo.discountValue, subtotal))
              : subtotal;
            setTaxRate(0.0825);
            setTaxAmount(discountedSubtotal * 0.0825);
            return;
          }

          // Calculate tax using Stripe Tax
          const taxResult = await calculateTaxWithStripe({
            items: cartItems.map(item => ({
              amount: item.price * item.quantity,
              description: item.name || 'Item',
              id: item.cartItemId || item.id,
            })),
            customerAddress: {
              line1: addressLine1,
              city: addressCity,
              state: addressState,
              postal_code: zipCode,
              country: 'US',
            },
            deliveryFee: feeForTax,
          });

          if (taxResult.success) {
            setTaxAmount(taxResult.taxAmount);
            // Calculate tax rate from Stripe result
            const discountedSubtotal = appliedPromo 
              ? (appliedPromo.discountType === 'percentage'
                  ? subtotal - (subtotal * appliedPromo.discountValue / 100)
                  : subtotal - Math.min(appliedPromo.discountValue, subtotal))
              : subtotal;
            const calculatedRate = discountedSubtotal > 0 
              ? taxResult.taxAmount / discountedSubtotal 
              : 0.0825;
            setTaxRate(calculatedRate);
          } else {
            // Fallback to default tax rate
            const rate = await calculateTaxRate(zipCode);
            setTaxRate(rate || 0.0825);
            setTaxAmount(0); // Will be calculated below
          }
        } catch (error) {
          console.warn('Error calculating fees with Stripe Tax:', error);
          // Fallback to default values
          try {
            const rate = await calculateTaxRate(zipCode);
            setTaxRate(rate || 0.0825);
          } catch {
            setTaxRate(0.0825);
          }
          setTaxAmount(0);
        }
      }
    };
    
    calculateFees();
  }, [selectedAddress, cartItems, appliedPromo, subtotal]);
  
  // Apply promo discount to subtotal before calculating tip and tax
  let discountAmount = 0;
  let discountedSubtotal = subtotal;
  if (appliedPromo) {
    if (appliedPromo.discountType === 'percentage') {
      discountAmount = (subtotal * appliedPromo.discountValue) / 100;
    } else if (appliedPromo.discountType === 'fixed') {
      discountAmount = Math.min(appliedPromo.discountValue, subtotal);
    }
    discountedSubtotal = subtotal - discountAmount;
  }
  
  const tip = calculateTip(discountedSubtotal); // Use dynamic tip calculation
  // Use Stripe Tax amount if available, otherwise calculate from rate
  const tax = taxAmount > 0 && selectedAddress?.zipCode
    ? taxAmount
    : discountedSubtotal * taxRate;
  const total = discountedSubtotal + deliveryFee + tip + tax;

  // Convert cart items to order items format
  const orderItems = cartItems.map(item => ({
    id: item.cartItemId,
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    image: item.image,
    restaurantId: item.restaurantId, // Add this crucial field
    restaurantName: item.restaurantName, // Add this for reference
    customizations: item.customizations || []
  }));



  // Validate that all cart items have restaurant IDs
  const invalidItems = cartItems.filter(item => !item.restaurantId);
  if (invalidItems.length > 0) {
    console.error('Cart items missing restaurant IDs:', invalidItems);
    // Clear invalid cart and redirect to cart page
    clearCart();
    navigate('/cart');
    return null;
  }

  // Redirect if cart is empty
  if (cartItems.length === 0) {
    navigate('/cart');
    return null;
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddressNext = (address) => {
    // Normalize address format for consistency
    const normalizedAddress = {
      ...address,
      zipCode: address.zipCode || address.zip_code || address.postal_code,
      zip_code: address.zip_code || address.zipCode || address.postal_code,
    };
    
    setSelectedAddress(normalizedAddress);
    // Persist address selection globally so CartPage can access it
    selectAddress(normalizedAddress);
    setCurrentStep(1);
    scrollToTop();
  };

  const handleContactNext = async (contact) => {
    setContactInfo(contact);
    setCurrentStep(2);
    scrollToTop();
  };

  const handlePaymentComplete = (payment) => {
    // Process the order
    console.log("Order completed!", {
      address: selectedAddress,
      contact: contactInfo,
      payment,
      total,
      items: orderItems
    });
    
    // Navigate to confirmation first, then clear cart
    navigate('/order-confirmation', {
      state: {
        orderTotal: total,
        subtotal,
        deliveryFee,
        tip,
        tax,
        taxRate,
        discountAmount,
        appliedPromo,
        orderItems,
        deliveryAddress: selectedAddress,
        contactInfo,
        paymentMethod: payment,
        userProfile: profile // Add user profile for personalization
      }
    });
    
    // Clear cart after navigation
    setTimeout(() => {
      clearCart();
    }, 100);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      scrollToTop();
    } else {
      navigate('/cart');
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return <AddressStep onNext={handleAddressNext} />;
      case 1:
        return <ContactStep onNext={handleContactNext} />;
      case 2:
        return (
          <PaymentStep 
            onComplete={handlePaymentComplete}
            orderData={{
              total,
              items: orderItems,
              deliveryAddress: selectedAddress,
              contactInfo,
              tip,
              appliedPromo,
              discountAmount,
              deliveryFee,
              tax,
              subtotal: discountedSubtotal
            }}
            tipPercentage={tipPercentage}
            customTip={customTip}
            onTipPercentageChange={handleTipPercentage}
            onCustomTipChange={handleCustomTipChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        {/* Header */}
        <div className="checkout-header">
          <button
            className="back-button"
            onClick={handleBack}
            disabled={false}
          >
            <ArrowLeft className="back-icon" />
            Back
          </button>
          <h1 className="checkout-title">Checkout</h1>
        </div>

        {/* Progress Indicator */}
        <CheckoutProgress currentStep={currentStep} steps={steps} />

        {/* Main Content */}
        <div className="checkout-content">
          {/* Checkout Steps */}
          <div className="checkout-steps">
            <div className="checkout-transition">
              {renderCurrentStep()}
            </div>
          </div>

          {/* Order Summary */}
          <div className="checkout-sidebar">
            <div className="sticky-summary">
              <OrderSummary
                items={orderItems}
                subtotal={subtotal}
                deliveryFee={deliveryFee}
                tip={tip}
                tax={tax}
                total={total}
                promoCode={promoCode}
                onPromoCodeChange={setPromoCode}
                onApplyPromo={handleApplyPromo}
                appliedPromo={appliedPromo}
                onRemovePromo={handleRemovePromo}
                promoError={promoError}
                isValidatingPromo={isValidatingPromo}
                discountAmount={discountAmount}
              />
            </div>
          </div>
        </div>

        {/* Mobile Summary */}
        <div className="mobile-summary">
          <div className="mobile-summary-card">
            <div className="mobile-summary-content">
              <div className="mobile-total">Total: ${total.toFixed(2)}</div>
              <div className="mobile-step">
                Step {currentStep + 1} of {steps.length}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CheckoutPage; 