import { useEffect } from 'react';
import Footer from '../Footer/Footer';
import './TermsAndConditionsPage.scss';

const TermsAndConditionsPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="terms-and-conditions-page">
      <div className="terms-and-conditions-container">
        <div className="terms-and-conditions-content">
          <div className="terms-header">
            <h1>Terms & Conditions</h1>
            <p className="terms-intro">
              Let&apos;s be real… nobody actually reads all the <strong>Terms and Conditions</strong>. 
              So, instead we are going to get straight to the point and highlight the key factors 
              you may worry about when it comes to handling your food, orders, and refunds.
            </p>
          </div>

          <div className="terms-sections">
            <section className="terms-section">
              <div className="section-number">1</div>
              <div className="section-content">
                <h2>Handling your food:</h2>
                <p>
                  When you place an order from My Kosher Delivery, you are putting your trust in our hands 
                  to guarantee that your food is handled carefully and safely. My Kosher Delivery promises 
                  that no work is too hard and no cost is too big to make sure that you receive fresh and 
                  healthy food that was kept in safe conditions and watched extremely close.
                </p>
                <p>
                  We keep all food in refrigerated ice cold conditions from the second it leaves the 
                  restaurant until the second you receive it at your doorstep. This ensures that all 
                  food stays 100% fresh and keeps any food from spoiling.
                </p>
              </div>
            </section>

            <section className="terms-section">
              <div className="section-number">2</div>
              <div className="section-content">
                <h2>Orders:</h2>
                <p>
                  All orders must be placed through our website. However, we are here to make sure that 
                  you receive the food that you want and will enjoy all Shabbat and weekend. As a result, 
                  if you place an order and have any questions, additions, changes, etc., feel free to 
                  reach out to us through our live chat below, contact form, or instagram direct message.
                </p>
                <p>
                  We will get back to you as soon as possible and do the best we can to always satisfy 
                  your request.
                </p>
              </div>
            </section>

            <section className="terms-section">
              <div className="section-number">3</div>
              <div className="section-content">
                <h2>Refunds:</h2>
                <p>
                  Yes, we do offer refunds in situations where you are not satisfied with an item you 
                  had received. The best way to request a refund is to contact us through our contact 
                  form or email. We will get back to you as soon as possible and are always open to 
                  discussing any dissatisfaction, feedback, and talk future solutions.
                </p>
                <p>
                  We are here to make your Shabbat and it&apos;s prep easier and more enjoyable and will 
                  work endlessly to reach those results.
                </p>
              </div>
            </section>
          </div>

          <div className="terms-additional">
            <h2>Additional Terms</h2>
            <div className="additional-terms-grid">
              <div className="additional-term">
                <h3>Service Area</h3>
                <p>
                  My Kosher Delivery operates within specific delivery zones. Please check our 
                  delivery zones page to confirm we service your area.
                </p>
              </div>
              
              <div className="additional-term">
                <h3>Ordering Window</h3>
                <p>
                  Orders are accepted from Friday midnight through Thursday 6pm each week, 
                  with delivery for the upcoming weekend.
                </p>
              </div>
              
              <div className="additional-term">
                <h3>Kosher Certification</h3>
                <p>
                  All our partner restaurants maintain proper kosher certification. We ensure 
                  the integrity of kosher standards throughout the delivery process.
                </p>
              </div>
              
              <div className="additional-term">
                <h3>Payment</h3>
                <p>
                  Payment is processed securely through our website. We accept major credit 
                  cards and other approved payment methods.
                </p>
              </div>
              
              <div className="additional-term">
                <h3>Delivery Times</h3>
                <p>
                  Delivery times are estimates and may vary based on weather, traffic, and 
                  order volume. We strive to meet all scheduled delivery windows.
                </p>
              </div>
              
              <div className="additional-term">
                <h3>Contact Information</h3>
                <p>
                  For any questions or concerns, please contact us through our contact form, 
                  email at info@mykosherdelivery.com, or call (516) 360-0549.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TermsAndConditionsPage; 