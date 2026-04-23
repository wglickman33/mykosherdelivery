import { useState } from "react";
import { Link } from "react-router-dom";
import emailjs from "@emailjs/browser";
import logoImg from "../../assets/navyMKDLogo.png";
import apiClient from "../../lib/api";
import logger from "../../utils/logger";
import "./ForgotPasswordPage.scss";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // null | 'loading' | 'sent' | 'error'
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      // Ask backend to generate a secure token
      const response = await apiClient.post("/auth/forgot-password", { email: email.trim() });

      // Backend always returns success:true even if email not found (prevents enumeration).
      // Only send the email when a real token was returned.
      if (response?.token) {
        const resetLink = `${window.location.origin}/reset-password?token=${response.token}`;

        const emailjsConfig = {
          serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
          templateId: import.meta.env.VITE_EMAILJS_RESET_TEMPLATE_ID,
          publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY
        };

        if (emailjsConfig.publicKey && emailjsConfig.serviceId && emailjsConfig.templateId) {
          await emailjs.send(
            emailjsConfig.serviceId,
            emailjsConfig.templateId,
            {
              to_name: response.firstName || "there",
              to_email: response.email,
              reset_link: resetLink
            },
            emailjsConfig.publicKey
          );
        } else {
          logger.warn("EmailJS reset template not configured — skipping email send");
        }
      }

      setStatus("sent");
    } catch (error) {
      logger.error("Forgot password error:", error);
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-page__container">
        <div className="forgot-password-page__logo">
          <Link to="/landing">
            <img src={logoImg} alt="My Kosher Delivery" />
          </Link>
        </div>

        <div className="forgot-password-page__card">
          {status === "sent" ? (
            <div className="forgot-password-page__success">
              <div className="forgot-password-page__success-icon">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#28a745" strokeWidth="2" />
                  <path d="M7 13l3 3 7-7" stroke="#28a745" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="forgot-password-page__title">Check your email</h1>
              <p className="forgot-password-page__subtitle">
                If an account with <strong>{email}</strong> exists, we sent a password reset link.
                The link expires in 1 hour.
              </p>
              <p className="forgot-password-page__hint">
                Don't see it? Check your spam folder.
              </p>
              <Link to="/signin" className="forgot-password-page__back-link">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="forgot-password-page__header">
                <h1 className="forgot-password-page__title">Forgot your password?</h1>
                <p className="forgot-password-page__subtitle">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form className="forgot-password-page__form" onSubmit={handleSubmit}>
                <div className="forgot-password-page__field">
                  <label htmlFor="email" className="forgot-password-page__label">
                    Email Address <span className="required">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (status === "error") setStatus(null);
                    }}
                    className={`forgot-password-page__input${status === "error" ? " error" : ""}`}
                    placeholder="Enter your email address"
                    required
                    autoFocus
                  />
                </div>

                {status === "error" && (
                  <div className="forgot-password-page__error-banner">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="forgot-password-page__submit"
                  disabled={status === "loading" || !email.trim()}
                >
                  {status === "loading" ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              <div className="forgot-password-page__footer">
                <Link to="/signin" className="forgot-password-page__back-link">
                  ← Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
