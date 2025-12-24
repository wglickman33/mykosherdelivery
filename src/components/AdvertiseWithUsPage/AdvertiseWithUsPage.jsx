import { useState, useEffect } from 'react';
import './AdvertiseWithUsPage.scss';
import Footer from '../Footer/Footer';
import { createSupportTicket } from '../../services/adminServices';

const AdvertiseWithUsPage = () => {
  const [isAnimating, setIsAnimating] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    website: '',
    date: '',
    description: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scroll to top when component mounts or when isSubmitted changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [isSubmitted]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateWebsite = (url) => {
    if (!url.trim()) return true; // Optional field
    
    // Remove whitespace
    url = url.trim();
    
    // If it doesn't start with http:// or https://, add https://
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }
    
    // Check if it's an unsafe HTTP URL
    if (url.startsWith('http://')) {
      return false;
    }
    
    // Basic URL validation
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
    
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Business description is required';
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
        type: 'advertise',
        subject: `Advertise: ${formData.website || formData.email}`.trim(),
        message: formData.description,
        requester_name: `${formData.firstName} ${formData.lastName}`.trim(),
        requester_email: formData.email,
        website: formData.website || undefined,
        requested_date: formData.date
      };
      const result = await createSupportTicket(payload);
      if (!result.success) throw new Error(result.error || 'Failed to submit');
      setIsSubmitted(true);
      
      // Force immediate scroll to top with multiple methods for reliability
      setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 0);
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        website: '',
        date: '',
        description: ''
      });
    } catch {
      // keep existing UX; you can add error banner if desired
    } finally {
      setIsSubmitting(false);
    }
  };

  const setTodayDate = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({
      ...prev,
      date: today
    }));
    
    // Clear date error if it exists
    if (errors.date) {
      setErrors(prev => ({
        ...prev,
        date: ''
      }));
    }
  };

  const PlayIcon = () => (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z"/>
    </svg>
  );

  const PauseIcon = () => (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  );

  if (isSubmitted) {
    return (
      <div className="advertise-with-us-page">
        <div className="advertise-with-us-container">
          <div className="advertise-with-us-content">
            <div className="success-message">
              <h1>Thank You!</h1>
              <p>Your advertising request has been submitted successfully. We&apos;ll get back to you as soon as possible to discuss how we can help grow your business!</p>
              <button 
                onClick={() => {
                  setIsSubmitted(false);
                  // Scroll to top when returning to form
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
    <div className="advertise-with-us-page">
      <div className="advertise-with-us-container">
        <div className="advertise-with-us-content">
          <h1>Advertise With Us</h1>
          <p className="subtitle">Let&apos;s get the ball rolling.</p>
          
          <div className="animated-text-container">
            <div className="animation-controls">
              <button 
                className="animation-toggle"
                onClick={() => setIsAnimating(!isAnimating)}
                aria-label={isAnimating ? "Pause animation" : "Play animation"}
              >
                {isAnimating ? <PauseIcon /> : <PlayIcon />}
                {isAnimating ? 'Pause Animation' : 'Play Animation'}
              </button>
            </div>
            <div className={`animated-text ${isAnimating ? 'animate' : 'paused'}`}>
              <span>Grow It • Dream It • Build It • Grow It • Dream It • Build It • Grow It • Dream It • Build It • Grow It • Dream It • Build It • </span>
            </div>
          </div>

          <div className="required-notice">
            <span className="asterisk">*</span>
            Required fields
          </div>

          <form className="advertise-form" onSubmit={handleSubmit}>
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
              <label htmlFor="date">Date<span className="asterisk">*</span></label>
              <div className="date-input-container">
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className={errors.date ? 'error' : ''}
                />
                <button
                  type="button"
                  className="today-button"
                  onClick={setTodayDate}
                >
                  Today
                </button>
              </div>
              {errors.date && <span className="error-message">{errors.date}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="description">Business Description<span className="asterisk">*</span></label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Tell us about your business and advertising goals"
                className={errors.description ? 'error' : ''}
                rows="6"
              />
              {errors.description && <span className="error-message">{errors.description}</span>}
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

export default AdvertiseWithUsPage; 