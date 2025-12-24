import { Check } from "lucide-react";
import PropTypes from "prop-types";

const CheckoutProgress = ({ currentStep, steps }) => {
  return (
    <div className="checkout-progress-container">
      <div className="checkout-progress-inner">
        {steps.map((step, index) => (
          <div key={step} className="progress-step-container">
            <div className="progress-step-wrapper">
              <div
                className={`step-indicator ${
                  index < currentStep ? "completed" : 
                  index === currentStep ? "active" : "inactive"
                }`}
              >
                {index < currentStep ? (
                  <Check className="check-icon" />
                ) : (
                  <span className="step-number">{index + 1}</span>
                )}
              </div>
              <span className={`step-label ${
                index <= currentStep ? "active-label" : "inactive-label"
              }`}>
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`progress-line ${
                index < currentStep ? "completed" : 
                index === currentStep - 1 ? "progress-line" : "incomplete"
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

CheckoutProgress.propTypes = {
  currentStep: PropTypes.number.isRequired,
  steps: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default CheckoutProgress; 