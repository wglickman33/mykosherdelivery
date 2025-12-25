import { useState, useEffect } from 'react';
import './PartnerWithUsPage.scss';
import Footer from '../Footer/Footer';
import { createSupportTicket } from '../../services/adminServices';

const PartnerWithUsPage = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    businessName: '',
    website: '',
    partnershipBenefit: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [isSubmitted]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateWebsite = (url) => {
    if (!url.trim()) return true;
    
    url = url.trim();
    
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }
    
    if (url.startsWith('http://')) {
      return false;
    }
    
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (formData.website.trim() && !validateWebsite(formData.website)) {
      newErrors.website = 'Please enter a valid website URL (HTTPS only for security)';
    }
    
    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }
    
    if (!formData.partnershipBenefit.trim()) {
      newErrors.partnershipBenefit = 'This field is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const payload = {
        type: 'partner',
        subject: `Partner: ${formData.businessName}`.trim(),
        message: formData.partnershipBenefit,
        requester_name: `${formData.firstName} ${formData.lastName}`.trim(),
        requester_email: formData.email,
        website: formData.website || undefined,
        business_name: formData.businessName
      };
      const result = await createSupportTicket(payload);
      if (!result.success) throw new Error(result.error || 'Failed to submit');
      setIsSubmitted(true);
      
      setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 0);
      
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        businessName: '',
        website: '',
        partnershipBenefit: ''
      });
    } catch {
      void 0;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="partner-with-us-page">
        <div className="partner-with-us-container">
          <div className="partner-with-us-content">
            <div className="success-message">
              <h1>Thank You!</h1>
              <p>Your partnership request has been submitted successfully. We&apos;ll get back to you as soon as possible.</p>
              <button 
                onClick={() => {
                  setIsSubmitted(false);
                  setTimeout(() => {
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                  }, 0);
                }}
                className="submit-button"
              >
                Submit Another Request
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="partner-with-us-page">
      <div className="partner-with-us-container">
        <div className="partner-with-us-content">
          <h1>Partner With Us.</h1>
          
          <p className="partner-description">
            We are always open to partnership and/or affiliate requests. If you are a restaurant, brand, or influencer, don&apos;t 
            be afraid to reach out! We are extremely open minded and are happy and willing to discuss working 
            something out with you! Fill out the form below with your request and we will get back to as soon as possible.
          </p>

          <div className="required-notice">
            <span className="asterisk">*</span> Required fields
          </div>

          <form onSubmit={handleSubmit} className="partner-form">
            <div className="form-group">
              <label>Name<span className="asterisk">*</span></label>
              <div className="name-fields">
                <div className="name-field">
                  <div className="field-label">First</div>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="Enter your first name"
                    className={errors.firstName ? 'error' : ''}
                  />
                  {errors.firstName && <span className="error-message">{errors.firstName}</span>}
                </div>
                <div className="name-field">
                  <div className="field-label">Last</div>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Enter your last name"
                    className={errors.lastName ? 'error' : ''}
                  />
                  {errors.lastName && <span className="error-message">{errors.lastName}</span>}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email<span className="asterisk">*</span></label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email address"
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="businessName">Business Name<span className="asterisk">*</span></label>
              <input
                type="text"
                id="businessName"
                name="businessName"
                value={formData.businessName}
                onChange={handleInputChange}
                placeholder="Enter your business name"
                className={errors.businessName ? 'error' : ''}
              />
              {errors.businessName && <span className="error-message">{errors.businessName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                placeholder="Enter your website URL (optional)"
                className={errors.website ? 'error' : ''}
              />
              {errors.website && <span className="error-message">{errors.website}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="partnershipBenefit">Do you feel that both of our businesses can benefit from a partnership, and why? <span className="asterisk">*</span></label>
              <textarea
                id="partnershipBenefit"
                name="partnershipBenefit"
                value={formData.partnershipBenefit}
                onChange={handleInputChange}
                placeholder="Tell us how partnering with us would benefit your business"
                rows="6"
                className={errors.partnershipBenefit ? 'error' : ''}
              />
              {errors.partnershipBenefit && <span className="error-message">{errors.partnershipBenefit}</span>}
            </div>

            <button 
              type="submit" 
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PartnerWithUsPage; 