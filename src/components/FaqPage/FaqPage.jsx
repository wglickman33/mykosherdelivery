import { useState } from "react";
import { Link } from "react-router-dom";
import { faqs } from "../../data/faqs.js";
import Footer from "../Footer/Footer";
import "./FaqPage.scss";

const FaqPage = () => {
  const [expandedItems, setExpandedItems] = useState(new Set());

  const toggleExpanded = (id) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="faq-page">
      <div className="faq-content">
        <div className="faq-header">
          <h1>Let&apos;s keep this simple.</h1>
          <p>Find answers to the most frequently asked questions about My Kosher Delivery</p>
        </div>

        <div className="faq-list">
          {faqs.map((faq) => (
            <div key={faq.id} className="faq-item">
              <button 
                className="faq-question"
                onClick={() => toggleExpanded(faq.id)}
                aria-expanded={expandedItems.has(faq.id)}
              >
                <span className="question-text">{faq.question}</span>
                <span className={`dropdown-icon ${expandedItems.has(faq.id) ? 'expanded' : ''}`}>
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                  </svg>
                </span>
              </button>
              
              <div className={`faq-answer ${expandedItems.has(faq.id) ? 'expanded' : ''}`}>
                <div className="answer-content">
                  <p>{faq.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="faq-footer">
          <h2>Still have questions?</h2>
          <p>Can&apos;t find what you&apos;re looking for? Reach out to our support team and we&apos;ll get back to you as soon as possible.</p>
          <Link to="/contact" className="contact-button">
            Contact Support
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default FaqPage; 