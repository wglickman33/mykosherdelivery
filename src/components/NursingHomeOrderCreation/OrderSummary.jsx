import PropTypes from 'prop-types';
import { NH_CONFIG } from '../../config/constants';
import {
  calculateNhOrderTotals,
  isNoneMeal,
  mealHasItems,
  isDayComplete,
  NH_MEAL_PRICES
} from '../../utils/nursingHomeOrderUtils';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'];

const OrderSummary = ({
  meals,
  resident,
  onSaveDraft,
  onSubmit,
  saving,
  totalMeals,
  onJumpToMeal,
  highlight
}) => {
  const totals = calculateNhOrderTotals(meals);
  const days = NH_CONFIG.MEALS.DAYS;
  const hasActions = Boolean(onSaveDraft || onSubmit);
  const hasAnySlot = Object.values(meals || {}).some((m) => mealHasItems(m) || isNoneMeal(m));
  const completedDays = days.filter((day) => isDayComplete(meals, day)).length;
  const filledSlots = Object.values(meals || {}).filter((m) => mealHasItems(m) || isNoneMeal(m)).length;

  const getMealsByDay = () => {
    const byDay = {};
    Object.values(meals || {}).forEach((meal) => {
      if (!mealHasItems(meal) && !isNoneMeal(meal)) return;
      if (!byDay[meal.day]) byDay[meal.day] = [];
      byDay[meal.day].push(meal);
    });
    Object.keys(byDay).forEach((day) => {
      byDay[day].sort(
        (a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType)
      );
    });
    return byDay;
  };

  const mealsByDay = getMealsByDay();

  const actions = hasActions ? (
    <div className="summary-actions">
      {onSubmit && (
        <button
          id="nh-order-submit"
          type="button"
          className="summary-btn summary-btn--primary"
          onClick={onSubmit}
          disabled={saving || totalMeals === 0}
        >
          {saving ? 'Submitting…' : 'Submit Order'}
        </button>
      )}
      {onSaveDraft && (
        <button
          type="button"
          className="summary-btn summary-btn--secondary"
          onClick={onSaveDraft}
          disabled={saving || !hasAnySlot}
        >
          {saving ? 'Saving…' : 'Save Draft'}
        </button>
      )}
      {totalMeals === 0 && (
        <p className="action-hint">Confirm at least one meal (use Next) to submit</p>
      )}
    </div>
  ) : null;

  return (
    <>
      <aside className={`order-summary ${highlight ? 'order-summary--highlight' : ''}`}>
        <div className="summary-header">
          <h2>Order Summary</h2>
          <p className="resident-info">{resident?.name}</p>
          <div className="summary-progress" aria-label="Order progress">
            <div className="summary-progress__row">
              <span>{filledSlots} of 21 slots</span>
              <span>{completedDays} days done</span>
            </div>
            <div className="summary-progress__bar" role="presentation">
              <div
                className="summary-progress__fill"
                style={{ width: `${Math.min(100, (filledSlots / 21) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {actions}

        <div className="summary-content">
          {!hasAnySlot ? (
            <div className="empty-summary">
              <p>Nothing confirmed yet</p>
              <p className="hint">1. Pick a day · 2. Choose a meal · 3. Tap Next</p>
            </div>
          ) : (
            <>
              <div className="meals-by-day">
                {days.map((day) => {
                  const dayMeals = mealsByDay[day];
                  if (!dayMeals || dayMeals.length === 0) return null;
                  const dayDone = isDayComplete(meals, day);

                  return (
                    <div key={day} className={`day-summary ${dayDone ? 'day-summary--complete' : ''}`}>
                      <div className="day-summary__heading">
                        <h4>{day}</h4>
                        {dayDone && <span className="day-summary__badge">Complete</span>}
                      </div>
                      {dayMeals.map((meal) => {
                        const none = isNoneMeal(meal);
                        const price = none ? 0 : (NH_MEAL_PRICES[meal.mealType] ?? 0);
                        return (
                          <button
                            key={`${meal.day}-${meal.mealType}`}
                            type="button"
                            className="meal-summary"
                            onClick={() => onJumpToMeal?.(meal.day, meal.mealType)}
                            disabled={!onJumpToMeal}
                          >
                            <div className="meal-type-label">
                              <span className="meal-type-name">{meal.mealType}</span>
                              <span className="item-price">{none ? 'Skipped' : `$${price.toFixed(2)}`}</span>
                            </div>
                            <div className="meal-items">
                              {none ? (
                                <div className="summary-item">
                                  <span className="item-name">None</span>
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
                                  Bagel: {meal.bagelType}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div className="summary-totals">
                <div className="total-row">
                  <span>Meals</span>
                  <span>{totals.mealCount}</span>
                </div>
                <div className="total-row">
                  <span>Subtotal</span>
                  <span>${totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="total-row">
                  <span>Tax (8.875%)</span>
                  <span>${totals.tax.toFixed(2)}</span>
                </div>
                <div className="total-row grand-total">
                  <span>Total</span>
                  <span>${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="summary-info">
          <p className="info-text">
            Orders can be edited until Sunday 12:00 PM ET.
          </p>
          <p className="info-text">
            Billing is charged monthly to the card on file.
          </p>
        </div>
      </aside>

      <div className="order-summary-mobile-dock" aria-label="Order totals">
        <div className="order-summary-mobile-dock__meta">
          <span className="order-summary-mobile-dock__total">${totals.total.toFixed(2)}</span>
          <span className="order-summary-mobile-dock__count">
            {totals.mealCount} meal{totals.mealCount === 1 ? '' : 's'} · {completedDays}/7 days
          </span>
        </div>
        {onSubmit && (
          <button
            type="button"
            className="summary-btn summary-btn--primary"
            onClick={onSubmit}
            disabled={saving || totalMeals === 0}
          >
            {saving ? '…' : 'Submit'}
          </button>
        )}
      </div>
    </>
  );
};

OrderSummary.propTypes = {
  meals: PropTypes.object.isRequired,
  resident: PropTypes.object,
  onSaveDraft: PropTypes.func,
  onSubmit: PropTypes.func,
  saving: PropTypes.bool.isRequired,
  totalMeals: PropTypes.number.isRequired,
  onJumpToMeal: PropTypes.func,
  highlight: PropTypes.bool
};

export default OrderSummary;
