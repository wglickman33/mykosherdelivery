import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import logoImg from "../../assets/navyMKDLogo.png";
import apiClient from "../../lib/api";
import logger from "../../utils/logger";
import "./ResetPasswordPage.scss";

const PASSWORD_RULES = /^(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,128}$/;

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error' | 'invalid'

  useEffect(() => {
    if (!token || token.length !== 64) {
      setStatus("invalid");
    }
  }, [token]);

  const validate = () => {
    const newErrors = {};
    if (!password) {
      newErrors.password = "Password is required";
    } else if (!PASSWORD_RULES.test(password)) {
      newErrors.password = "Password must be at least 8 characters and include a number and special character";
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setStatus("loading");

    try {
      const response = await apiClient.post("/auth/reset-password", { token, password });

      if (response?.success) {
        setStatus("success");
        setTimeout(() => navigate("/signin"), 3000);
      } else {
        setStatus("error");
      }
    } catch (error) {
      logger.error("Reset password error:", error);
      const msg = error?.message || "";
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("expired")) {
        setStatus("invalid");
      } else {
        setStatus("error");
      }
    }
  };

  const EyeIcon = ({ visible }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      {visible ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );

  const renderContent = () => {
    if (status === "invalid") {
      return (
        <div className="reset-password-page__state">
          <div className="reset-password-page__state-icon reset-password-page__state-icon--error">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#dc3545" strokeWidth="2" />
              <path d="M15 9l-6 6M9 9l6 6" stroke="#dc3545" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="reset-password-page__title">Link expired or invalid</h1>
          <p className="reset-password-page__subtitle">
            This password reset link is no longer valid. Links expire after 1 hour and can only be used once.
          </p>
          <Link to="/forgot-password" className="reset-password-page__submit reset-password-page__submit--link">
            Request a new link
          </Link>
        </div>
      );
    }

    if (status === "success") {
      return (
        <div className="reset-password-page__state">
          <div className="reset-password-page__state-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#28a745" strokeWidth="2" />
              <path d="M7 13l3 3 7-7" stroke="#28a745" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="reset-password-page__title">Password updated!</h1>
          <p className="reset-password-page__subtitle">
            Your password has been changed successfully. Redirecting you to sign in...
          </p>
          <Link to="/signin" className="reset-password-page__back-link">
            Sign In now →
          </Link>
        </div>
      );
    }

    return (
      <>
        <div className="reset-password-page__header">
          <h1 className="reset-password-page__title">Create new password</h1>
          <p className="reset-password-page__subtitle">
            Choose a strong password for your account.
          </p>
        </div>

        <form className="reset-password-page__form" onSubmit={handleSubmit}>
          <div className="reset-password-page__field">
            <label htmlFor="password" className="reset-password-page__label">
              New Password <span className="required">*</span>
            </label>
            <div className="reset-password-page__password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: "" }));
                }}
                className={`reset-password-page__input${errors.password ? " error" : ""}`}
                placeholder="Min. 8 characters, 1 number, 1 special character"
                autoFocus
              />
              <button
                type="button"
                className="reset-password-page__eye"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex="-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
            {errors.password && (
              <span className="reset-password-page__error">{errors.password}</span>
            )}
          </div>

          <div className="reset-password-page__field">
            <label htmlFor="confirmPassword" className="reset-password-page__label">
              Confirm Password <span className="required">*</span>
            </label>
            <div className="reset-password-page__password-field">
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: "" }));
                }}
                className={`reset-password-page__input${errors.confirmPassword ? " error" : ""}`}
                placeholder="Re-enter your new password"
              />
              <button
                type="button"
                className="reset-password-page__eye"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex="-1"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                <EyeIcon visible={showConfirm} />
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="reset-password-page__error">{errors.confirmPassword}</span>
            )}
          </div>

          {status === "error" && (
            <div className="reset-password-page__error-banner">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <span>Something went wrong. Please try again.</span>
            </div>
          )}

          <button
            type="submit"
            className="reset-password-page__submit"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Updating..." : "Update Password"}
          </button>
        </form>

        <div className="reset-password-page__footer">
          <Link to="/signin" className="reset-password-page__back-link">
            ← Back to Sign In
          </Link>
        </div>
      </>
    );
  };

  return (
    <div className="reset-password-page">
      <div className="reset-password-page__container">
        <div className="reset-password-page__logo">
          <Link to="/landing">
            <img src={logoImg} alt="My Kosher Delivery" />
          </Link>
        </div>
        <div className="reset-password-page__card">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
