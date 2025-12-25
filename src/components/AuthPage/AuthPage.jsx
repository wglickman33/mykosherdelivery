import { Link, useLocation } from "react-router-dom";
import { useNavigateWithScroll } from "../../hooks/useNavigateWithScroll";
import logoImg from "../../assets/navyMKDLogo.png";
import { useAuth } from "../../hooks/useAuth";
import "./AuthPage.scss";
import { useState, useEffect } from "react";

const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigateWithScroll();
  const { signIn, signUp, user } = useAuth();
  
  const isSignupMode = location.pathname === '/signup';
  const [mode, setMode] = useState(isSignupMode ? 'signup' : 'signin');
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const newMode = location.pathname === '/signup' ? 'signup' : 'signin';
    if (newMode !== mode) {
      setMode(newMode);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: ""
      });
      setErrors({});
      setSubmitStatus(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [location.pathname, mode]);

  useEffect(() => {
    if (user) {
      console.log('AuthPage - User already authenticated, redirecting to home');
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

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
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (mode === 'signup') {
      if (!formData.firstName.trim()) {
        newErrors.firstName = "First name is required";
      }
      
      if (!formData.lastName.trim()) {
        newErrors.lastName = "Last name is required";
      }
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (mode === 'signup') {
      const hasNumber = /\d/.test(formData.password);
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);
      
      if (!hasNumber) {
        newErrors.password = "Password must contain at least one number";
      } else if (!hasSpecial) {
        newErrors.password = "Password must contain at least one special character";
      }
    }
    
    if (mode === 'signup') {
      if (!formData.confirmPassword.trim()) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
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
      let result;
      
      if (mode === 'signup') {
        console.log('AuthPage - Calling signUp with:', {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          hasPassword: !!formData.password
        });
        result = await signUp(
          formData.email,
          formData.password,
          formData.firstName,
          formData.lastName
        );
      } else {
        result = await signIn(formData.email, formData.password);
      }
      
      if (result.error) {
        console.error(`${mode} error:`, result.error);
        
        if (result.error.message?.includes('Email address') && result.error.message?.includes('invalid')) {
          setErrors(prev => ({
            ...prev,
            email: "Please enter a valid email address"
          }));
          setSubmitStatus(null);
        } else if (result.error.message?.includes('email')) {
          setSubmitStatus('email_confirmation');
        } else if (result.error.message?.includes('Invalid login credentials')) {
          setSubmitStatus('error');
        } else if (result.error.message?.includes('User already registered')) {
          setErrors(prev => ({
            ...prev,
            email: "An account with this email already exists"
          }));
          setSubmitStatus(null);
        } else {
          setSubmitStatus('error');
        }
      } else {
        console.log(`${mode} successful`);
        setSubmitStatus('success');
        
        if (result.user || result.success) {
          console.log(`${mode} successful, navigating to homepage`);
          navigate('/home', { replace: true });
        }
      }
      
    } catch (error) {
      console.error(`${mode} error:`, error);
      
      if (error.message?.includes('Email address') && error.message?.includes('invalid')) {
        setErrors(prev => ({
          ...prev,
          email: "Please enter a valid email address"
        }));
        setSubmitStatus(null);
      } else if (error.message?.includes('User already registered')) {
        setErrors(prev => ({
          ...prev,
          email: "An account with this email already exists"
        }));
        setSubmitStatus(null);
      } else {
        setSubmitStatus('error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    const newPath = mode === 'signin' ? '/signup' : '/signin';
    navigate(newPath);
  };

  const togglePasswordVisibility = (field) => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else if (field === 'confirmPassword') {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__container">
        <div className="auth-page__logo">
          <Link to="/home">
            <img src={logoImg} alt="My Kosher Delivery" />
          </Link>
        </div>

        <div className={`auth-page__form-container ${mode === 'signup' ? 'auth-page__form-container--signup' : ''}`}>
          <div className={`auth-page__header ${mode === 'signup' ? 'auth-page__header--signup' : ''}`}>
            <h1 className={`auth-page__title ${mode === 'signup' ? 'auth-page__title--signup' : ''}`}>
              {mode === 'signin' ? 'Welcome back!' : 'Join My Kosher Delivery'}
            </h1>
            <p className={`auth-page__subtitle ${mode === 'signup' ? 'auth-page__subtitle--signup' : ''}`}>
              {mode === 'signin' 
                ? 'Sign in to your account to continue' 
                : 'Create your account to get started'
              }
            </p>
          </div>

          <form className="auth-page__form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="auth-page__form-row auth-page__form-row--signup">
                <div className="auth-page__form-field auth-page__form-field--signup">
                  <label htmlFor="firstName" className="auth-page__label auth-page__label--signup">
                    First Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className={`auth-page__input auth-page__input--signup ${errors.firstName ? 'error' : ''}`}
                    placeholder="First name"
                    required={mode === 'signup'}
                  />
                  {errors.firstName && (
                    <span className="auth-page__error auth-page__error--signup">{errors.firstName}</span>
                  )}
                </div>
                
                <div className="auth-page__form-field auth-page__form-field--signup">
                  <label htmlFor="lastName" className="auth-page__label auth-page__label--signup">
                    Last Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className={`auth-page__input auth-page__input--signup ${errors.lastName ? 'error' : ''}`}
                    placeholder="Last name"
                    required={mode === 'signup'}
                  />
                  {errors.lastName && (
                    <span className="auth-page__error auth-page__error--signup">{errors.lastName}</span>
                  )}
                </div>
              </div>
            )}
            
            <div className={`auth-page__form-field ${mode === 'signup' ? 'auth-page__form-field--signup' : ''}`}>
              <label htmlFor="email" className={`auth-page__label ${mode === 'signup' ? 'auth-page__label--signup' : ''}`}>
                Email Address <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`auth-page__input ${mode === 'signup' ? 'auth-page__input--signup' : ''} ${errors.email ? 'error' : ''}`}
                placeholder="Enter your email address"
                required
              />
              {errors.email && (
                <span className={`auth-page__error ${mode === 'signup' ? 'auth-page__error--signup' : ''}`}>{errors.email}</span>
              )}
            </div>
            
            <div className={`auth-page__form-field ${mode === 'signup' ? 'auth-page__form-field--signup' : ''}`}>
              <label htmlFor="password" className={`auth-page__label ${mode === 'signup' ? 'auth-page__label--signup' : ''}`}>
                Password <span className="required">*</span>
              </label>
              <div className="auth-page__password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`auth-page__input ${mode === 'signup' ? 'auth-page__input--signup' : ''} ${errors.password ? 'error' : ''}`}
                  placeholder={mode === 'signup' ? "Create a password (min. 8 characters)" : "Enter your password"}
                  required
                />
                <button
                  type="button"
                  className="auth-page__password-toggle"
                  onClick={() => togglePasswordVisibility('password')}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex="-1"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </>
                    )}
                  </svg>
                </button>
              </div>
              {errors.password && (
                <span className={`auth-page__error ${mode === 'signup' ? 'auth-page__error--signup' : ''}`}>{errors.password}</span>
              )}
            </div>

            {mode === 'signup' && (
              <div className="auth-page__form-field auth-page__form-field--signup">
                <label htmlFor="confirmPassword" className="auth-page__label auth-page__label--signup">
                  Confirm Password <span className="required">*</span>
                </label>
                <div className="auth-page__password-field">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`auth-page__input auth-page__input--signup ${errors.confirmPassword ? 'error' : ''}`}
                    placeholder="Confirm your password"
                    required={mode === 'signup'}
                  />
                  <button
                    type="button"
                    className="auth-page__password-toggle"
                    onClick={() => togglePasswordVisibility('confirmPassword')}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    tabIndex="-1"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      {showConfirmPassword ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </>
                      ) : (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </>
                      )}
                    </svg>
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className="auth-page__error auth-page__error--signup">{errors.confirmPassword}</span>
                )}
              </div>
            )}

            {mode === 'signin' && (
              <div className="auth-page__forgot-password">
                <Link to="/forgot-password" className="auth-page__forgot-link">
                  Forgot your password?
                </Link>
              </div>
            )}
            
            <button 
              type="submit" 
              className={`auth-page__submit ${mode === 'signup' ? 'auth-page__submit--signup' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting 
                ? (mode === 'signin' ? "Signing in..." : "Creating account...") 
                : (mode === 'signin' ? "Sign In" : "Create Account")
              }
            </button>
            
            {submitStatus === 'error' && (
              <div className={`auth-page__message error ${mode === 'signup' ? 'auth-page__message--signup' : ''}`}>
                <div className="auth-page__message-content">
                  <svg className="auth-page__message-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
                  </svg>
                  <span>
                    {mode === 'signin' 
                      ? 'Invalid email or password. Please try again.' 
                      : 'Something went wrong. Please try again.'
                    }
                  </span>
                </div>
              </div>
            )}
            
            {submitStatus === 'email_confirmation' && (
              <div className={`auth-page__message info ${mode === 'signup' ? 'auth-page__message--signup' : ''}`}>
                <div className="auth-page__message-content">
                  <svg className="auth-page__message-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V11H13V17ZM13 9H11V7H13V9Z" fill="currentColor"/>
                  </svg>
                  <span>
                    Please check your email and click the confirmation link to complete your account setup.
                  </span>
                </div>
              </div>
            )}
          </form>

          <div className={`auth-page__toggle ${mode === 'signup' ? 'auth-page__toggle--signup' : ''}`}>
            <p className="auth-page__toggle-text">
              {mode === 'signin' 
                ? "Don't have an account? " 
                : "Already have an account? "
              }
              <button
                type="button"
                onClick={toggleMode}
                className="auth-page__toggle-link"
              >
                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;