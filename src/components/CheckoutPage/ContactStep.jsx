import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useAuth } from "../../hooks/useAuth";

const ContactStep = ({ onNext }) => {
  const { user, profile } = useAuth();
  const [formData, setFormData] = useState({
    phone: "",
    email: "",
    deliveryInstructions: "",
    smsUpdates: true,
    emailUpdates: true
  });

  const [errors, setErrors] = useState({});

  // Pre-fill with user data
  useEffect(() => {
    if (user && profile) {
      setFormData(prev => ({
        ...prev,
        email: user.email || "",
        phone: profile.phone || ""
      }));
    }
  }, [user, profile]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.phone) {
      newErrors.phone = "Phone number is required";
    } else if (!/^[+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = "Please enter a valid phone number";
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onNext(formData);
    }
  };

  const formatPhoneNumber = (value) => {
    const number = value.replace(/\D/g, '');
    if (number.length <= 3) return number;
    if (number.length <= 6) return `(${number.slice(0, 3)}) ${number.slice(3)}`;
    return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6, 10)}`;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, phone: formatted });
  };

  return (
    <div className="contact-step">
      <div className="step-header">
        <h2 className="step-title">
          Contact Information
        </h2>
        <p className="step-description">
          We&apos;ll use this to keep you updated about your order
        </p>
      </div>

      <div className="contact-form-card">
        <div className="contact-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="phone" className="form-label">
                Phone Number <span className="required">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                className={`form-input ${errors.phone ? 'error' : ''}`}
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={handlePhoneChange}
              />
              {errors.phone && (
                <p className="error-text">{errors.phone}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address <span className="required">*</span>
              </label>
              <input
                id="email"
                type="email"
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              {errors.email && (
                <p className="error-text">{errors.email}</p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="instructions" className="form-label">
              Delivery Instructions (Optional)
            </label>
            <textarea
              id="instructions"
              className="form-textarea"
              placeholder="Ring doorbell, leave at door, apartment buzzer code, etc."
              value={formData.deliveryInstructions}
              onChange={(e) => setFormData({ ...formData, deliveryInstructions: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      </div>

      <button 
        className="continue-button"
        onClick={handleSubmit}
      >
        Continue to Payment
      </button>
    </div>
  );
};

ContactStep.propTypes = {
  onNext: PropTypes.func.isRequired,
};

export default ContactStep; 