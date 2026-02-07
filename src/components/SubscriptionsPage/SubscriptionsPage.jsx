import { useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../Footer/Footer';
import navyMKMLogo from '../../assets/navyMKMLogo.png';
import navyMKDIcon from '../../assets/navyMKDIcon.png';
import './SubscriptionsPage.scss';

const subscriptionPlans = [
  { id: 'monthly', price: 5, interval: 'month', label: '$5/month', description: 'Billed monthly. Cancel anytime.' },
  { id: 'yearly', price: 45, interval: 'year', label: '$45/year', description: 'Save $15. Billed once per year.' },
];

export default function SubscriptionsPage() {
  const [selectedPlan, setSelectedPlan] = useState('yearly');

  return (
    <div className="gift-card-page subscriptions-page">
      <div className="gift-card-page__content">
        <div className="subscriptions-page__hero">
          <Link to="/home" className="subscriptions-page__back">← Back to Home</Link>
          <div className="subscriptions-page__hero-inner">
            <h1 className="subscriptions-page__hero-title">My Kosher Maps</h1>
            <img
              src={navyMKMLogo}
              alt="My Kosher Maps"
              className="subscriptions-page__hero-logo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <p className="subscriptions-page__hero-subtitle">Subscribe to the kosher restaurant directory</p>
            <p className="subscriptions-page__hero-description">
              Get full access to our map of kosher restaurants — search by diet, get directions,
              filter by certification, and never miss a spot. One subscription, unlimited access.
            </p>
          </div>
        </div>

        <div className="subscriptions-page__promo">
          <img src={navyMKMLogo} alt="My Kosher Maps" className="subscriptions-page__promo-logo" />
          <p className="subscriptions-page__promo-tagline">Every kosher restaurant. One map. Your subscription.</p>
        </div>

        <div className="gift-card-section">
          <h2 className="section-title">Choose your plan</h2>
          <div className="gift-card-grid">
            {subscriptionPlans.map((plan) => (
              <div
                className={`gift-card-option ${selectedPlan === plan.id ? 'selected' : ''}`}
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <div className="gift-card-option__content">
                  <div className="gift-card-option__image">
                    <img src={navyMKDIcon} alt="My Kosher Maps" />
                  </div>
                  <div className="gift-card-option__details">
                    <h3 className="gift-card-option__name">
                      {plan.interval === 'year' ? 'Annual' : 'Monthly'}
                    </h3>
                    <p className="gift-card-option__desc">{plan.description}</p>
                    <div className="gift-card-option__price">{plan.label}</div>
                  </div>
                </div>
                {selectedPlan === plan.id && (
                  <div className="gift-card-option__selected-indicator">✓ Selected</div>
                )}
              </div>
            ))}
          </div>

          <div className="gift-card-actions">
            <div className="selected-value">
              Selected: <span className="selected-amount">
                {subscriptionPlans.find((p) => p.id === selectedPlan)?.label}
              </span>
            </div>
            <Link
              to="/account"
              className="add-to-cart-btn"
              style={{ textDecoration: 'none', textAlign: 'center', display: 'inline-block' }}
            >
              Subscribe now
            </Link>
          </div>
        </div>

        <div className="gift-card-info">
          <h3>What you get</h3>
          <ul>
            <li>Full access to the My Kosher Maps directory</li>
            <li>Search and filter by diet (meat, dairy, parve, sushi, and more)</li>
            <li>Get directions to any restaurant</li>
            <li>See certifications and ratings at a glance</li>
            <li>Cancel anytime — no long-term commitment</li>
          </ul>
        </div>
      </div>
      <Footer />
    </div>
  );
}
