import { useEffect } from 'react';
import Footer from '../Footer/Footer';
import './PrivacyPage.scss';

const PrivacyPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <div className="privacy-content">
          <div className="privacy-header">
            <h1>Privacy Policy</h1>
            <p className="privacy-intro">
              Your privacy is important to us. This policy explains how we collect, use, and protect 
              your personal information when you use My Kosher Delivery services.
            </p>
          </div>

          <div className="stripe-notice">
            <h2>Payment Processing Privacy Notice</h2>
            <p className="stripe-intro">
              <strong>A message from our credit card processor - Stripe:</strong>
            </p>
            <div className="stripe-content">
              <p>
                We provide economic infrastructure for the internet. Businesses of all sizes use our 
                software and services to accept payments and manage their businesses online. Stripe cares 
                about the security and privacy of the personal data that is entrusted to us.
              </p>
              <p>
                This Privacy Policy (&quot;<strong>Policy</strong>&quot;) describes the &quot;Personal Data&quot; that we <a href="https://stripe.com/privacy#1-personal-data-that-we-collect-and-how-we-use-and-share-it" target="_blank" rel="noopener noreferrer">collect about you</a>, 
                how we <a href="https://stripe.com/privacy#2-more-ways-we-collect-use-and-share-personal-data" target="_blank" rel="noopener noreferrer">use it</a>, 
                how we share it, your <a href="https://stripe.com/privacy#4-your-rights-and-choices" target="_blank" rel="noopener noreferrer">rights and choices</a>, 
                and how you can <a href="https://stripe.com/privacy#9-contact-us" target="_blank" rel="noopener noreferrer">contact us</a> about our privacy practices. 
                This Policy also outlines your data subject rights, including the right to object to some uses of your Personal Data by us.
              </p>
            </div>
          </div>

          <div className="privacy-sections">
            <section className="privacy-section">
              <h2>1. Information We Collect</h2>
              <div className="subsection">
                <h3>Personal Information</h3>
                <p>
                  When you use My Kosher Delivery, we collect information that identifies you personally, including:
                </p>
                <ul>
                  <li><strong>Contact Information:</strong> Name, email address, phone number, delivery address</li>
                  <li><strong>Payment Information:</strong> Credit card details, billing address (processed securely through <a href="https://stripe.com/legal/privacy-center#stripe-identity" target="_blank" rel="noopener noreferrer">Stripe</a>)</li>
                  <li><strong>Order Information:</strong> Food preferences, order history, delivery instructions</li>
                  <li><strong>Account Information:</strong> Username, password, account preferences</li>
                </ul>
              </div>
              
              <div className="subsection">
                <h3>Usage Information</h3>
                <p>
                  We automatically collect certain information about how you use our service:
                </p>
                <ul>
                  <li>Device information (IP address, browser type, operating system)</li>
                  <li>Website usage patterns and navigation behavior</li>
                  <li>Order frequency and timing patterns</li>
                  <li>Customer service interactions</li>
                </ul>
              </div>
            </section>

            <section className="privacy-section">
              <h2>2. How We Use Your Information</h2>
              <div className="use-cases">
                <div className="use-case">
                  <h4>Service Delivery</h4>
                  <p>To process and fulfill your kosher food orders, coordinate deliveries, and provide customer support.</p>
                </div>
                <div className="use-case">
                  <h4>Communication</h4>
                  <p>To send order confirmations, delivery updates, and important service announcements.</p>
                </div>
                <div className="use-case">
                  <h4>Improvement</h4>
                  <p>To analyze usage patterns and improve our service quality and user experience.</p>
                </div>
                <div className="use-case">
                  <h4>Security</h4>
                  <p>To <a href="https://docs.stripe.com/radar/reviews/risk-insights" target="_blank" rel="noopener noreferrer">detect and prevent fraud</a>, ensure payment security, and maintain platform integrity.</p>
                </div>
              </div>
            </section>

            <section className="privacy-section">
              <h2>3. Information Sharing</h2>
              <p>We share your information only in the following circumstances:</p>
              <div className="sharing-grid">
                <div className="sharing-item">
                  <h4>Restaurant Partners</h4>
                  <p>Order details and delivery information necessary to prepare and deliver your food.</p>
                </div>
                <div className="sharing-item">
                  <h4>Payment Processors</h4>
                  <p>
                    <a href="https://stripe.com/legal/privacy-center#controller-v-processor" target="_blank" rel="noopener noreferrer">Stripe processes</a> all payments securely according to their privacy policy and industry standards.
                  </p>
                </div>
                <div className="sharing-item">
                  <h4>Delivery Partners</h4>
                  <p>Delivery address and contact information to ensure successful food delivery.</p>
                </div>
                <div className="sharing-item">
                  <h4>Legal Requirements</h4>
                  <p>When required by law, regulation, or legal process.</p>
                </div>
              </div>
            </section>

            <section className="privacy-section">
              <h2>4. Payment Security</h2>
              <div className="security-notice">
                <h3>Stripe Payment Processing</h3>
                <p>
                  All payment transactions are processed by Stripe, a PCI-compliant payment processor. 
                  My Kosher Delivery does not store your complete credit card information on our servers. 
                  Stripe maintains the <a href="https://docs.stripe.com/security" target="_blank" rel="noopener noreferrer">highest levels of security</a> and compliance standards.
                </p>
                <div className="security-features">
                  <div className="security-feature">
                    <h4>🔒 Encryption</h4>
                    <p>All data is <a href="https://stripe.com/privacy#5-security-and-retention" target="_blank" rel="noopener noreferrer">encrypted in transit and at rest</a></p>
                  </div>
                  <div className="security-feature">
                    <h4>🛡️ PCI Compliance</h4>
                    <p>Stripe is <a href="https://docs.stripe.com/security" target="_blank" rel="noopener noreferrer">PCI DSS Level 1 certified</a></p>
                  </div>
                  <div className="security-feature">
                    <h4>🔐 Tokenization</h4>
                    <p>Card details are <a href="https://stripe.com/legal/privacy-center#link" target="_blank" rel="noopener noreferrer">tokenized for secure storage</a></p>
                  </div>
                </div>
              </div>
            </section>

            <section className="privacy-section">
              <h2>5. Your Rights and Choices</h2>
              <div className="rights-grid">
                <div className="right-item">
                  <h4>Access</h4>
                  <p><a href="https://stripe.com/legal/privacy-center#exercise-rights" target="_blank" rel="noopener noreferrer">Request a copy</a> of the personal information we have about you.</p>
                </div>
                <div className="right-item">
                  <h4>Correction</h4>
                  <p><a href="https://stripe.com/legal/privacy-center#exercise-rights" target="_blank" rel="noopener noreferrer">Update or correct</a> any inaccurate personal information.</p>
                </div>
                <div className="right-item">
                  <h4>Deletion</h4>
                  <p><a href="https://support.stripe.com/questions/i-would-like-to-delete-the-information-stripe-has-collected-from-me" target="_blank" rel="noopener noreferrer">Request deletion</a> of your personal information, subject to legal requirements.</p>
                </div>
                <div className="right-item">
                  <h4>Opt-Out</h4>
                  <p>Unsubscribe from marketing communications at any time.</p>
                </div>
                <div className="right-item">
                  <h4>Data Portability</h4>
                  <p>Request your data in a portable format.</p>
                </div>
                <div className="right-item">
                  <h4>Restriction</h4>
                  <p>Request limitation of processing in certain circumstances.</p>
                </div>
              </div>
            </section>

            <section className="privacy-section">
              <h2>6. Data Retention</h2>
              <p>
                We retain your personal information for as long as necessary to provide our services 
                and comply with legal obligations. Specific retention periods include:
              </p>
              <ul>
                <li><strong>Account Information:</strong> Retained while your account is active and for 7 years after closure</li>
                <li><strong>Order History:</strong> Retained for 7 years for business and tax purposes</li>
                <li><strong>Payment Information:</strong> <a href="https://stripe.com/privacy#5-security-and-retention" target="_blank" rel="noopener noreferrer">Tokenized payment methods retained per Stripe&apos;s policy</a></li>
                <li><strong>Marketing Preferences:</strong> Retained until you opt-out or account closure</li>
              </ul>
            </section>

            <section className="privacy-section">
              <h2>7. International Data Transfers</h2>
              <p>
                As a global business, Stripe may <a href="https://stripe.com/privacy#6-international-data-transfers" target="_blank" rel="noopener noreferrer">transfer your personal data</a> to countries other than your own, 
                including to the United States. These transfers are conducted with appropriate safeguards to 
                ensure your data remains protected according to applicable data protection laws.
              </p>
            </section>

            <section className="privacy-section">
              <h2>8. Cookies and Tracking</h2>
              <p>
                We use <a href="https://stripe.com/legal/cookies-policy" target="_blank" rel="noopener noreferrer">cookies and similar technologies</a> to enhance your experience, analyze usage, 
                and provide personalized content. You can control cookie settings through your browser preferences.
              </p>
              <div className="cookie-types">
                <div className="cookie-type">
                  <h4>Essential Cookies</h4>
                  <p>Required for basic website functionality and <a href="https://stripe.com/legal/privacy-center#fraud-security" target="_blank" rel="noopener noreferrer">security</a></p>
                </div>
                <div className="cookie-type">
                  <h4>Analytics Cookies</h4>
                  <p>Help us understand how visitors use our website</p>
                </div>
                <div className="cookie-type">
                  <h4>Functional Cookies</h4>
                  <p><a href="https://stripe.com/legal/privacy-center#how-does-stripe-remember" target="_blank" rel="noopener noreferrer">Remember your preferences</a> and settings</p>
                </div>
              </div>
            </section>
          </div>

          <div className="privacy-footer">
            <div className="privacy-footer-content">
              <h3>Questions About Privacy?</h3>
              <p>
                If you have questions about this privacy policy or how we handle your personal information, 
                please contact us. We&apos;re committed to protecting your privacy and will respond to your 
                inquiries promptly.
              </p>
              <div className="privacy-contact-actions">
                <a href="/contact" className="contact-btn">
                  Contact Us
                </a>
                <a href="mailto:info@mykosherdelivery.com" className="email-btn">
                  Email Privacy Team
                </a>
              </div>
            </div>
          </div>

          <div className="privacy-legal">
            <div className="stripe-reference">
              <h4>Third-Party Privacy Policies</h4>
              <p>
                For detailed information about how Stripe handles your payment data, please review <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe&apos;s Privacy Policy</a>.
                Learn more about <a href="https://stripe.com/legal/privacy-center#which-stripe-entities-are-involved" target="_blank" rel="noopener noreferrer">which Stripe entities are involved</a> and 
                visit the <a href="https://stripe.com/legal/privacy-center" target="_blank" rel="noopener noreferrer">Stripe Privacy Center</a> for comprehensive privacy information.
                Stripe&apos;s privacy practices are governed by their own privacy policy and terms of service.
              </p>
            </div>
            <div className="policy-updates">
              <p className="last-updated">
                <strong>Last Updated:</strong> February 2025
              </p>
              <p className="legal-notice">
                We may <a href="https://stripe.com/privacy#7-updates-and-notifications" target="_blank" rel="noopener noreferrer">update this privacy policy</a> from time to time. We will notify you of any material 
                changes by posting the updated policy on our website and, where required by law, by sending 
                you a direct notification. For questions about your rights, please see our <a href="https://stripe.com/legal/privacy-center#your-rights-and-choices" target="_blank" rel="noopener noreferrer">rights and choices</a> section.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PrivacyPage; 