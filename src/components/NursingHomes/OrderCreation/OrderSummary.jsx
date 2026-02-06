import PropTypes from 'prop-types';

const OrderSummary = ({ meals, resident, onSave, saving, totalMeals }) => {
  const calculateTotals = () => {
    let subtotal = 0;
    const mealArray = Object.values(meals).filter(meal => meal.items && meal.items.length > 0);
    
    mealArray.forEach(meal => {
      meal.items.forEach(item => {
        subtotal += parseFloat(item.price);
      });
    });

    const tax = subtotal * 0.08875;
    const total = subtotal + tax;

    return {
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      mealCount: mealArray.length
    };
  };

  const totals = calculateTotals();

  const getMealsByDay = () => {
    const byDay = {};
    Object.values(meals).forEach(meal => {
      if (meal.items && meal.items.length > 0) {
        if (!byDay[meal.day]) {
          byDay[meal.day] = [];
        }
        byDay[meal.day].push(meal);
      }
    });
    return byDay;
  };

  const mealsByDay = getMealsByDay();
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="order-summary">
      <div className="summary-header">
        <h2>Order Summary</h2>
        <p className="resident-info">{resident?.name}</p>
      </div>

      <div className="summary-content">
        {totalMeals === 0 ? (
          <div className="empty-summary">
            <p>No meals selected yet</p>
            <p className="hint">Select days and meals to build your weekly order</p>
          </div>
        ) : (
          <>
            <div className="meals-by-day">
              {days.map(day => {
                const dayMeals = mealsByDay[day];
                if (!dayMeals || dayMeals.length === 0) return null;

                return (
                  <div key={day} className="day-summary">
                    <h4>{day}</h4>
                    {dayMeals.map(meal => (
                      <div key={`${meal.day}-${meal.mealType}`} className="meal-summary">
                        <div className="meal-type-label">{meal.mealType}</div>
                        <div className="meal-items">
                          {meal.items.map(item => (
                            <div key={item.id} className="summary-item">
                              <span className="item-name">{item.name}</span>
                              <span className="item-price">${parseFloat(item.price).toFixed(2)}</span>
                            </div>
                          ))}
                          {meal.bagelType && (
                            <div className="bagel-type-note">
                              Bagel Type: {meal.bagelType}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
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
                <span>${totals.subtotal}</span>
              </div>
              <div className="total-row">
                <span>Tax (8.875%):</span>
                <span>${totals.tax}</span>
              </div>
              <div className="total-row grand-total">
                <span>Total:</span>
                <span>${totals.total}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="summary-actions">
        <button
          className="save-draft-btn"
          onClick={onSave}
          disabled={saving || totalMeals === 0}
        >
          {saving ? 'Saving...' : 'Save & Continue to Payment'}
        </button>
        {totalMeals === 0 && (
          <p className="action-hint">Add at least one meal to continue</p>
        )}
      </div>

      <div className="summary-info">
        <p className="info-text">
          <strong>Note:</strong> Orders can be edited until Sunday 12:00 PM
        </p>
        <p className="info-text">
          Payment will be processed when you submit the final order
        </p>
      </div>
    </div>
  );
};

OrderSummary.propTypes = {
  meals: PropTypes.object.isRequired,
  resident: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  totalMeals: PropTypes.number.isRequired
};

export default OrderSummary;
