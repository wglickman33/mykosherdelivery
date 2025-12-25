import { useState, useEffect } from "react";
import "./ContactForm.scss";
import { createSupportTicket } from "../../services/adminServices";

const ContactForm = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    message: ""
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [messageTimer, setMessageTimer] = useState(null);

  useEffect(() => {
    return () => {
      if (messageTimer) {
        clearTimeout(messageTimer);
      }
    };
  }, [messageTimer]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
    
    if (submitStatus) {
      setSubmitStatus(null);
      if (messageTimer) {
        clearTimeout(messageTimer);
        setMessageTimer(null);
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    if (!formData.message.trim()) {
      newErrors.message = "Message is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setSubmitStatus(null);
      return;
    }
    
    setIsSubmitting(true);
    setSubmitStatus(null);
    
    try {
      const payload = {
        type: 'contact',
        subject: `Contact: ${formData.firstName} ${formData.lastName}`.trim(),
        message: formData.message,
        requester_name: `${formData.firstName} ${formData.lastName}`.trim(),
        requester_email: formData.email
      };
      const result = await createSupportTicket(payload);
      if (!result.success) throw new Error(result.error || 'Failed to submit');
      
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        message: ""
      });
      
      setSubmitStatus('success');
      
      const timer = setTimeout(() => {
        setSubmitStatus(null);
        setMessageTimer(null);
      }, 5000);
      setMessageTimer(timer);
    } catch {
      setSubmitStatus('error');
      
      const timer = setTimeout(() => {
        setSubmitStatus(null);
        setMessageTimer(null);
      }, 7000);
      setMessageTimer(timer);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-form-container">
      <div className="contact-form-wrapper">
        <div className="contact-form-content">
          <div className="contact-form-text">
            <h2 className="contact-form-title">Reach out to us!</h2>
            <p className="contact-form-description">
              Hey there! Got a burning question? Need a helping hand? Or just want to chat 
              about the best kosher restaurants in town? You&apos;re in the right place! At MKD, 
              no question is too big, too small, or too off-the-wall. Seriously, we&apos;ve heard 
              it all and we&apos;re here to help with a smile.
            </p>
          </div>
          
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="contact-form-row">
              <div className="contact-form-field">
                <label htmlFor="firstName" className="contact-form-label">
                  First Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={`contact-form-input ${errors.firstName ? 'error' : ''}`}
                  placeholder="Enter your first name"
                  required
                />
                {errors.firstName && (
                  <span className="contact-form-error">{errors.firstName}</span>
                )}
              </div>
              
              <div className="contact-form-field">
                <label htmlFor="lastName" className="contact-form-label">
                  Last Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={`contact-form-input ${errors.lastName ? 'error' : ''}`}
                  placeholder="Enter your last name"
                  required
                />
                {errors.lastName && (
                  <span className="contact-form-error">{errors.lastName}</span>
                )}
              </div>
            </div>
            
            <div className="contact-form-field">
              <label htmlFor="email" className="contact-form-label">
                Email <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`contact-form-input ${errors.email ? 'error' : ''}`}
                placeholder="Enter your email address"
                required
              />
              {errors.email && (
                <span className="contact-form-error">{errors.email}</span>
              )}
            </div>
            
            <div className="contact-form-field">
              <label htmlFor="message" className="contact-form-label">
                Message <span className="required">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                className={`contact-form-textarea ${errors.message ? 'error' : ''}`}
                placeholder="Tell us what's on your mind..."
                rows="5"
                required
              />
              {errors.message && (
                <span className="contact-form-error">{errors.message}</span>
              )}
            </div>
            
            <button 
              type="submit" 
              className="contact-form-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send"}
            </button>
            
            {submitStatus && (
              <div className={`contact-form-message ${submitStatus}`}>
                {submitStatus === 'success' ? (
                  <div className="contact-form-message-content">
                    <svg className="contact-form-message-icon" viewBox="0 0 24 24" fill="none">
                      <path d="M9 16.2L4.8 12L3.4 13.4L9 19L21 7L19.6 5.6L9 16.2Z" fill="currentColor"/>
                    </svg>
                    <span>Success! Message sent.</span>
                  </div>
                ) : (
                  <div className="contact-form-message-content">
                    <svg className="contact-form-message-icon" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
                    </svg>
                    <span>Uh oh! Seems like something went wrong! Please contact support.</span>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactForm;