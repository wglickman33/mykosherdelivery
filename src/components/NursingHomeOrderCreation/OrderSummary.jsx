import PropTypes from 'prop-types';
import { NH_CONFIG } from '../../config/constants';
import {
  calculateNhOrderTotals,
  isNoneMeal,
  mealHasItems,
  NH_MEAL_PRICES
} from '../../utils/nursingHomeOrderUtils';

const OrderSummary = ({
  meals,
  resident,
  onSaveDraft,
  onSubmit,
  saving,
  totalMeals
}) => {
  const totals = calculateNhOrderTotals(meals);

  const getMealsByDay = () => {
    const byDay = {};
    Object.values(meals || {}).forEach((meal) => {
      if (!mealHasItems(meal) && !isNoneMeal(meal)) return;
      if (!byDay[meal.day]) byDay[meal.day] = [];
      byDay[meal.day].push(meal);
    });
    return byDay;
  };

  const mealsByDay = getMealsByDay();
  const days = NH_CONFIG.MEALS.DAYS;
  const hasActions = Boolean(onSaveDraft || onSubmit);

  return (
    <div className="order-summary">
      <div className="summary-header">
        <h2>Order Summary</h2>
        <p className="resident-info">{resident?.name}</p>
      </div>

      <div className="summary-content">
        {totalMeals === 0 && Object.values(meals || {}).every((m) => !isNoneMeal(m)) ? (
          <div className="empty-summary">
            <p>No meals selected yet</p>
            <p className="hint">Select days and meals to build your weekly order</p>
          </div>
        ) : (
          <>
            <div className="meals-by-day">
              {days.map((day) => {
                const dayMeals = mealsByDay[day];
                if (!dayMeals || dayMeals.length === 0) return null;

                return (
                  <div key={day} className="day-summary">
                    <h4>{day}</h4>
                    {dayMeals.map((meal) => {
                      const none = isNoneMeal(meal);
                      const price = none ? 0 : (NH_MEAL_PRICES[meal.mealType] ?? 0);
                      return (
                        <div key={`${meal.day}-${meal.mealType}`} className="meal-summary">
                          <div className="meal-type-label">
                            {meal.mealType}
                            <span className="item-price">${price.toFixed(2)}</span>
                          </div>
                          <div className="meal-items">
                            {none ? (
                              <div className="summary-item">
                                <span className="item-name">None</span>
                                <span className="item-price">$0.00</span>
                              </div>
                            ) : (
                              (meal.items || []).map((item) => (
                                <div key={item.id} className="summary-item">
                                  <span className="item-name">{item.name}</span>
                                </div>
                              ))
                            )}
                            {meal.bagelType && !none && (
                              <div className="bagel-type-note">
                                Bagel Type: {meal.bagelType}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="summary-totals">
              <div className="total-row">
                <span>Total Meals:</span>
                <span>{totals.mealCount}</span>
              </div>
              <div className="total-row">
                <span>Subtotal:</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Tax (8.875%):</span>
                <span>${totals.tax.toFixed(2)}</span>
              </div>
              <div className="total-row grand-total">
                <span>Total:</span>
                <span>${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {hasActions && (
        <div className="summary-actions">
          {onSaveDraft && (
            <button
              type="button"
              className="save-draft-btn"
              onClick={onSaveDraft}
              disabled={saving || (totalMeals === 0 && Object.values(meals || {}).every((m) => !isNoneMeal(m)))}
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
          )}
          {onSubmit && (
            <button
              type="button"
              className="save-draft-btn submit-order-btn"
              onClick={onSubmit}
              disabled={saving || totalMeals === 0}
            >
              {saving ? 'Submitting…' : 'Submit Order'}
            </button>
          )}
          {totalMeals === 0 && (
            <p className="action-hint">Add at least one meal to submit</p>
          )}
        </div>
      )}

      <div className="summary-info">
        <p className="info-text">
          <strong>Note:</strong> Orders can be edited until Sunday 12:00 PM ET
        </p>
        <p className="info-text">
          Billing is charged monthly to the resident&apos;s card on file. Staff do not pay at checkout.
        </p>
      </div>
    </div>
  );
};

OrderSummary.propTypes = {
  meals: PropTypes.object.isRequired,
  resident: PropTypes.object,
  onSaveDraft: PropTypes.func,
  onSubmit: PropTypes.func,
  saving: PropTypes.bool.isRequired,
  totalMeals: PropTypes.number.isRequired
};

export default OrderSummary;
