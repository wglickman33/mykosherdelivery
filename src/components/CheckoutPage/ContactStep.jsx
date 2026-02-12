import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useAuth } from "../../hooks/useAuth";

const ContactStep = ({ onNext }) => {
  const { user, profile } = useAuth();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    deliveryInstructions: "",
    smsUpdates: true,
    emailUpdates: true
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user && profile) {
      setFormData(prev => ({
        ...prev,
        email: user.email || "",
        phone: profile.phone || "",
        firstName: profile.firstName || prev.firstName,
        lastName: profile.lastName || prev.lastName
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
              <label htmlFor="firstName" className="form-label">
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                className="form-input"
                placeholder="First name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName" className="form-label">
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                className="form-input"
                placeholder="Last name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>
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
              <span className="label-hint">(Max 500 characters)</span>
            </label>
            <textarea
              id="instructions"
              className="form-textarea"
              placeholder="Ring doorbell, leave at door, apartment buzzer code, special requests, etc."
              value={formData.deliveryInstructions}
              onChange={(e) => {
                const value = e.target.value.substring(0, 500);
                setFormData({ ...formData, deliveryInstructions: value });
              }}
              rows={3}
              maxLength={500}
            />
            <p className="form-hint">
              {formData.deliveryInstructions.length}/500 characters
            </p>
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