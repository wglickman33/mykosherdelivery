import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { NH_CONFIG } from '../../config/constants';
import {
  getMealSelectionHints,
  isNoneMeal,
  validateMealSelection,
  formatNhCategoryLabel
} from '../../utils/nursingHomeOrderUtils';

const normCat = (c) => String(c || '').toLowerCase();

const itemNeedsBagelType = (item) => {
  if (item?.requiresBagelType === true) return true;
  const name = item?.name != null ? String(item.name) : '';
  return /bagel/i.test(name) && !/type/i.test(name);
};

const hydrateFromMeal = (meal) => {
  if (!meal) {
    return { isNone: false, selectedItems: [], bagelType: '' };
  }
  const none = isNoneMeal(meal);
  return {
    isNone: none,
    selectedItems: none ? [] : (meal.items || []),
    bagelType: none ? '' : (meal.bagelType || '')
  };
};

const MealForm = ({
  day,
  mealType,
  menuItems,
  initialMeal,
  isCommitted,
  onDraftChange,
  onCommit,
  onClear,
  onAdvance,
  nextLabel,
  isLastSlot,
  onNextController,
  resident
}) => {
  const hydrated = hydrateFromMeal(initialMeal);
  const [selectedItems, setSelectedItems] = useState(hydrated.selectedItems);
  const [bagelType, setBagelType] = useState(hydrated.bagelType);
  const [isNone, setIsNone] = useState(hydrated.isNone);
  const [searchTerm, setSearchTerm] = useState('');
  const [localError, setLocalError] = useState(null);
  const nextBtnRef = useRef(null);
  const skipDraftEcho = useRef(true);

  const mealPrice = NH_CONFIG.MEALS.PRICES[mealType] ?? 0;
  const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);

  useEffect(() => {
    if (skipDraftEcho.current) {
      skipDraftEcho.current = false;
      return;
    }
    onDraftChange?.(day, mealType, {
      items: isNone ? [] : selectedItems,
      bagelType: isNone ? null : (bagelType || null),
      none: isNone
    });
  }, [selectedItems, bagelType, isNone, day, mealType, onDraftChange]);

  const replaceByCategory = (items, incoming) => {
    const cat = normCat(incoming.category);
    const isMainLike = cat === 'main' || cat === 'entree';
    const isSide = cat === 'side';
    const isSoup = cat === 'soup';
    const isDessert = cat === 'dessert';

    const currentMains = items.filter((i) => ['main', 'entree'].includes(normCat(i.category)));
    if (isSide && currentMains.some((i) => i.excludesSide === true)) {
      return items;
    }

    let next = items.filter((i) => {
      const c = normCat(i.category);
      if (isMainLike && (c === 'main' || c === 'entree')) return false;
      if (isSide && c === 'side') return false;
      if (isSoup && c === 'soup') return false;
      if (isDessert && c === 'dessert') return false;
      return true;
    });

    if (mealType === 'breakfast' || mealType === 'lunch') {
      if (isSoup || isDessert) return items;
      next = next.filter((i) => {
        const c = normCat(i.category);
        return c === 'main' || c === 'entree' || c === 'side';
      });
    }

    if (mealType === 'dinner' && !isMainLike && !isSide && !isSoup && !isDessert) {
      return items;
    }

    next = [...next, {
      id: incoming.id,
      name: incoming.name,
      category: incoming.category,
      price: incoming.price,
      excludesSide: !!incoming.excludesSide,
      requiresBagelType: !!incoming.requiresBagelType
    }];

    if (isMainLike && incoming.excludesSide) {
      next = next.filter((i) => normCat(i.category) !== 'side');
    }

    return next;
  };

  const handleSelectNone = () => {
    if (isNone) {
      setIsNone(false);
      setLocalError(null);
      return;
    }
    setIsNone(true);
    setSelectedItems([]);
    setBagelType('');
    setSearchTerm('');
    setLocalError(null);
  };

  const handleItemToggle = (item) => {
    setIsNone(false);
    setLocalError(null);

    const isSelected = selectedItems.some((i) => i.id === item.id);
    let newItems;
    if (isSelected) {
      newItems = selectedItems.filter((i) => i.id !== item.id);
    } else {
      newItems = replaceByCategory(selectedItems, item);
    }

    setSelectedItems(newItems);
    const stillNeedsBagel = newItems.some(itemNeedsBagelType);
    if (!stillNeedsBagel) setBagelType('');
  };

  const handleBagelTypeChange = (type) => {
    setBagelType(type);
    setLocalError(null);
  };

  const handleClearMeal = () => {
    setIsNone(false);
    setSelectedItems([]);
    setBagelType('');
    setSearchTerm('');
    setLocalError(null);
    onClear(day, mealType);
  };

  const draftMeal = {
    day,
    mealType,
    items: isNone ? [] : selectedItems,
    bagelType: isNone ? null : (bagelType || null),
    none: isNone
  };

  const hints = getMealSelectionHints(mealType, draftMeal);
  const canContinue = isNone || selectedItems.length > 0;

  const handleNext = () => {
    if (!canContinue) {
      setLocalError('Select items for this meal, or skip it.');
      return;
    }

    if (!isNone) {
      const err = validateMealSelection(mealType, draftMeal);
      if (err) {
        setLocalError(err);
        return;
      }
    }

    setLocalError(null);
    onCommit(day, mealType, isNone ? [] : selectedItems, isNone ? null : (bagelType || null), isNone);
    onAdvance();
  };

  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;

  useEffect(() => {
    onNextController?.({
      canContinue,
      nextLabel,
      isLastSlot: !!isLastSlot,
      runNext: () => handleNextRef.current()
    });
  }, [canContinue, nextLabel, isLastSlot, onNextController]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return;
      const tag = event.target?.tagName;
      if (tag === 'TEXTAREA') return;
      event.preventDefault();
      nextBtnRef.current?.click();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const sideExcluded = selectedItems.some((i) =>
    ['main', 'entree'].includes(normCat(i.category)) && i.excludesSide === true
  );

  const filteredItems = (menuItems || []).filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedItems = filteredItems.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryOrder = { main: 1, entree: 1, side: 2, soup: 3, dessert: 4 };
  const sortedCategories = Object.keys(groupedItems).sort(
    (a, b) => (categoryOrder[normCat(a)] || 99) - (categoryOrder[normCat(b)] || 99)
  );

  const allowedCategories = mealType === 'dinner'
    ? ['main', 'entree', 'side', 'soup', 'dessert']
    : ['main', 'entree', 'side'];

  const visibleCategories = sortedCategories.filter((cat) => {
    const n = normCat(cat);
    if (sideExcluded && n === 'side') return false;
    return allowedCategories.includes(n);
  });

  const hasSelection = selectedItems.length > 0 || isNone;
  const hintForCategory = (cat) => {
    const n = normCat(cat);
    if (n === 'main' || n === 'entree') return hints.find((h) => h.category === 'main');
    return hints.find((h) => h.category === n);
  };

  const skipToggle = (
    <button
      type="button"
      className={`skip-meal-toggle ${isNone ? 'active' : ''}`}
      onClick={handleSelectNone}
      aria-pressed={isNone}
    >
      <span className="skip-meal-toggle__radio" aria-hidden="true">
        {isNone ? '✓' : ''}
      </span>
      <span className="skip-meal-toggle__copy">
        <span className="skip-meal-toggle__title">Skip this meal</span>
        <span className="skip-meal-toggle__sub">Marked as None for this slot</span>
      </span>
    </button>
  );

  return (
    <div className="meal-form">
      <div className="meal-form-header">
        <div>
          <h3>
            {day} · {mealLabel}
            <span className="meal-price">${mealPrice.toFixed(2)}</span>
          </h3>
          <p className="meal-form-hint">
            {isCommitted
              ? 'Already saved in your summary. Change items and hit Next to update.'
              : 'Choose your items, then continue to lock this meal into your order summary.'}
          </p>
        </div>
        {hasSelection && (
          <button type="button" className="clear-btn" onClick={handleClearMeal} aria-label="Clear this meal">
            Clear<span className="clear-btn__rest"> this meal</span>
          </button>
        )}
      </div>

      {resident?.dietaryRestrictions && (
        <div className="dietary-info">
          <strong>Dietary restrictions:</strong> {resident.dietaryRestrictions}
        </div>
      )}

      {resident?.allergies && (
        <div className="allergy-warning">
          <strong>Allergies:</strong> {resident.allergies}
        </div>
      )}

      {isNone ? (
        <>
          <div className="skip-meal-confirmed">
            <p>
              {day} {mealLabel} will be skipped. Continue when you&apos;re ready.
            </p>
          </div>
          {skipToggle}
        </>
      ) : (
        <>
          <div className="search-box">
            <input
              type="search"
              placeholder="Search menu items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search menu items"
            />
          </div>

          {selectedItems.length > 0 && (
            <div className="selected-items-summary">
              <strong>Selected</strong>
              <div className="selected-items-list">
                {selectedItems.map((item) => (
                  <span key={item.id} className="selected-item-tag">
                    {item.name}
                    {itemNeedsBagelType(item) && bagelType ? ` (${bagelType})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hints.length > 0 && (
            <ul className="meal-inline-hints">
              {hints.map((hint) => (
                <li key={hint.category}>{hint.message}</li>
              ))}
            </ul>
          )}

          <div className="menu-items-grid">
            {visibleCategories.map((category) => {
              const categoryHint = hintForCategory(category);
              return (
                <div
                  key={category}
                  className={`category-section ${categoryHint ? 'category-section--needs' : ''}`}
                >
                  <h4 className="category-title">
                    {formatNhCategoryLabel(category)}
                    {(normCat(category) === 'main' || normCat(category) === 'entree' || normCat(category) === 'side') && (
                      <span className="category-hint"> (choose one)</span>
                    )}
                    {(normCat(category) === 'soup' || normCat(category) === 'dessert') && (
                      <span className="category-hint"> (optional)</span>
                    )}
                    {categoryHint && (
                      <span className="category-needs">{categoryHint.message}</span>
                    )}
                  </h4>
                  <div className="items-list">
                    {groupedItems[category].map((item) => {
                      const isSelected = selectedItems.some((i) => i.id === item.id);
                      const showBagelPicker = isSelected && itemNeedsBagelType(item);
                      return (
                        <div key={item.id} className={`menu-item-block ${isSelected ? 'selected' : ''}`}>
                          <div
                            className={`menu-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleItemToggle(item)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleItemToggle(item);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                          >
                            <div className="item-info">
                              <span className="item-name">{item.name}</span>
                              {item.excludesSide && (
                                <span className="item-flag">No side included</span>
                              )}
                            </div>
                            {isSelected && <div className="checkmark">✓</div>}
                          </div>

                          {showBagelPicker && (
                            <div className="inline-option-picker" role="group" aria-label="Bagel type">
                              <p className="inline-option-picker__label">Bagel type</p>
                              <div className="inline-option-picker__options">
                                {NH_CONFIG.BAGEL_TYPES.map((type) => (
                                  <button
                                    key={type}
                                    type="button"
                                    className={`inline-option-btn ${bagelType === type ? 'selected' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleBagelTypeChange(type);
                                    }}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {skipToggle}
        </>
      )}

      {localError && <div className="meal-form-error" role="alert">{localError}</div>}

      <div className="meal-form-footer">
        <button
          ref={nextBtnRef}
          type="button"
          id="nh-meal-next"
          className="meal-next-btn"
          onClick={handleNext}
          disabled={!canContinue}
        >
          {nextLabel}
          {!isLastSlot && <span aria-hidden="true"> →</span>}
        </button>
        {!canContinue ? (
          <p className="meal-form-footer-hint">Select a meal or skip to continue</p>
        ) : (
          <p className="meal-form-footer-hint">Tip: Ctrl/⌘ + Enter also continues</p>
        )}
      </div>
    </div>
  );
};

MealForm.propTypes = {
  day: PropTypes.string.isRequired,
  mealType: PropTypes.string.isRequired,
  menuItems: PropTypes.array.isRequired,
  initialMeal: PropTypes.object,
  isCommitted: PropTypes.bool,
  onDraftChange: PropTypes.func,
  onCommit: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  onAdvance: PropTypes.func.isRequired,
  nextLabel: PropTypes.string.isRequired,
  isLastSlot: PropTypes.bool,
  onNextController: PropTypes.func,
  resident: PropTypes.object
};

export default MealForm;
