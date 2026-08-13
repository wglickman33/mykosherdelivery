import { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { isNoneMeal, NH_MEAL_TYPES } from '../../utils/nursingHomeOrderUtils';
import './NhCopyDayModal.scss';

const mealPreviewLines = (meal) => {
  if (!meal) return ['Not set'];
  if (isNoneMeal(meal)) return ['Skipped'];
  const items = (meal.items || []).map((i) => i.name).filter(Boolean);
  if (meal.bagelType) items.push(`Bagel: ${meal.bagelType}`);
  return items.length ? items : ['Selected'];
};

/**
 * Multi-step copy-day modal: pick source → preview → optional overwrite confirm.
 */
const NhCopyDayModal = ({
  open,
  completedDays,
  suggestedSourceDay,
  targetDay,
  meals,
  targetHasMeals,
  onClose,
  onConfirmCopy
}) => {
  const [step, setStep] = useState('pick'); // pick | preview | overwrite
  const [sourceDay, setSourceDay] = useState(suggestedSourceDay || completedDays[0] || null);

  useEffect(() => {
    if (!open) return;
    setStep('pick');
    setSourceDay(suggestedSourceDay || completedDays[0] || null);
  }, [open, suggestedSourceDay, completedDays]);

  const preview = useMemo(() => {
    if (!sourceDay) return [];
    return NH_MEAL_TYPES.map((mealType) => {
      const meal = meals[`${sourceDay}-${mealType}`];
      return {
        mealType,
        lines: mealPreviewLines(meal)
      };
    });
  }, [sourceDay, meals]);

  if (!open) return null;

  const goPreview = () => {
    if (!sourceDay) return;
    setStep('preview');
  };

  const requestConfirm = () => {
    if (targetHasMeals) {
      setStep('overwrite');
      return;
    }
    onConfirmCopy(sourceDay);
  };

  return (
    <div className="nh-copy-day-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="nh-copy-day-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nh-copy-day-title"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'pick' && (
          <>
            <h2 id="nh-copy-day-title">Copy meals onto {targetDay}</h2>
            <p className="nh-copy-day-modal__lead">
              Choose a completed day to copy. You can switch days if the first choice isn&apos;t right.
            </p>
            <div className="nh-copy-day-modal__day-list" role="listbox" aria-label="Source day">
              {completedDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  role="option"
                  aria-selected={sourceDay === day}
                  className={`nh-copy-day-modal__day-btn ${sourceDay === day ? 'selected' : ''}`}
                  onClick={() => setSourceDay(day)}
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="nh-copy-day-modal__actions">
              <button type="button" className="nh-copy-day-modal__btn nh-copy-day-modal__btn--secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="nh-copy-day-modal__btn nh-copy-day-modal__btn--primary"
                onClick={goPreview}
                disabled={!sourceDay}
              >
                Preview {sourceDay || ''}
              </button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <h2 id="nh-copy-day-title">Copy {sourceDay} → {targetDay}?</h2>
            <p className="nh-copy-day-modal__lead">
              These meals will be applied to <strong>{targetDay}</strong>.
            </p>
            <div className="nh-copy-day-modal__preview">
              {preview.map((block) => (
                <div key={block.mealType} className="nh-copy-day-modal__preview-meal">
                  <h3>{block.mealType}</h3>
                  <ul>
                    {block.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="nh-copy-day-modal__actions">
              <button
                type="button"
                className="nh-copy-day-modal__btn nh-copy-day-modal__btn--secondary"
                onClick={() => setStep('pick')}
              >
                Choose another day
              </button>
              <button
                type="button"
                className="nh-copy-day-modal__btn nh-copy-day-modal__btn--primary"
                onClick={requestConfirm}
              >
                Use these meals
              </button>
            </div>
          </>
        )}

        {step === 'overwrite' && (
          <>
            <h2 id="nh-copy-day-title">Replace {targetDay}&apos;s meals?</h2>
            <p className="nh-copy-day-modal__lead">
              {targetDay} already has meals saved. Copying <strong>{sourceDay}</strong> will overwrite them.
            </p>
            <div className="nh-copy-day-modal__actions">
              <button
                type="button"
                className="nh-copy-day-modal__btn nh-copy-day-modal__btn--secondary"
                onClick={() => setStep('preview')}
              >
                Back
              </button>
              <button
                type="button"
                className="nh-copy-day-modal__btn nh-copy-day-modal__btn--danger"
                onClick={() => onConfirmCopy(sourceDay)}
              >
                Replace meals
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

NhCopyDayModal.propTypes = {
  open: PropTypes.bool,
  completedDays: PropTypes.arrayOf(PropTypes.string).isRequired,
  suggestedSourceDay: PropTypes.string,
  targetDay: PropTypes.string.isRequired,
  meals: PropTypes.object.isRequired,
  targetHasMeals: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onConfirmCopy: PropTypes.func.isRequired
};

export default NhCopyDayModal;
