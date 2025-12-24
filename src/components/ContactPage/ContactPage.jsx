import ContactForm from "../ContactForm/ContactForm";
import Footer from "../Footer/Footer";
import "./ContactPage.scss";

const ContactPage = () => {
  return (
    <div className="contact-page">
      <div className="contact-content">
        <div className="contact-header">
          <h1>Have a question?</h1>
          <h2>Contact us.</h2>
        </div>

        <div className="contact-info">
          <div className="contact-item">
            <span className="contact-label">Email:</span>
            <a href="mailto:info@mykosherdelivery.com" className="contact-link">
              info@mykosherdelivery.com
            </a>
          </div>
          <div className="contact-item">
            <span className="contact-label">Text, WhatsApp, or call:</span>
            <a href="tel:+15163600549" className="contact-link">
              (516) 360-0549
            </a>
          </div>
        </div>

        <div className="contact-main">
          <ContactForm />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ContactPage; 