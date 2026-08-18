import PropTypes from 'prop-types';
import {
  groupNhMealsByDay,
  getNhMealItemLines,
  isNoneMeal,
  mealHasItems
} from '../../utils/nursingHomeOrderUtils';
import './NhMealsByDay.scss';

const mealTypeLabel = (mealType) =>
  mealType ? `${mealType.charAt(0).toUpperCase()}${mealType.slice(1)}` : '';

const NhMealsByDay = ({ meals, title = 'Meals by day' }) => {
  const days = groupNhMealsByDay(meals);

  if (!days.length) {
    return (
      <section className="nh-meals-by-day">
        {title ? <h2 className="nh-meals-by-day__title">{title}</h2> : null}
        <p className="nh-meals-by-day__empty">No meals on this order.</p>
      </section>
    );
  }

  return (
    <section className="nh-meals-by-day">
      {title ? <h2 className="nh-meals-by-day__title">{title}</h2> : null}
      <div className="nh-meals-by-day__list">
        {days.map(({ day, slots, selectedCount }) => (
          <article key={day} className="nh-meals-day">
            <header className="nh-meals-day__header">
              <h3>{day}</h3>
              <span>
                {selectedCount} meal{selectedCount === 1 ? '' : 's'}
              </span>
            </header>
            <div className="nh-meals-day__grid">
              {slots.map(({ mealType, meal }) => {
                const skipped = !meal || isNoneMeal(meal) || !mealHasItems(meal);
                const lines = skipped ? [] : getNhMealItemLines(meal);
                return (
                  <div
                    key={mealType}
                    className={`nh-meal-slot${skipped ? ' nh-meal-slot--skipped' : ''}`}
                  >
                    <span className="nh-meal-slot__type">{mealTypeLabel(mealType)}</span>
                    {skipped ? (
                      <p className="nh-meal-slot__skipped">Skipped</p>
                    ) : (
                      <ul>
                        {lines.map((line) => (
                          <li key={`${line.name}-${line.note || ''}`}>
                            {line.name}
                            {line.note ? <span className="item-note">{line.note}</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

NhMealsByDay.propTypes = {
  meals: PropTypes.array,
  title: PropTypes.string
};

export default NhMealsByDay;
