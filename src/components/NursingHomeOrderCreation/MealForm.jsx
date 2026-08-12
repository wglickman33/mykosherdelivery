import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { NH_CONFIG } from '../../config/constants';
import { isNoneMeal } from '../../utils/nursingHomeOrderUtils';

const normCat = (c) => String(c || '').toLowerCase();

/**
 * Meal picker for one day/mealType.
 * onUpdate(day, mealType, items, bagelType, none)
 * — when None is selected: onUpdate(day, mealType, [], null, true)
 */
const MealForm = ({ day, mealType, menuItems, currentMeal, onUpdate, resident }) => {
  const [selectedItems, setSelectedItems] = useState([]);
  const [bagelType, setBagelType] = useState('');
  const [isNone, setIsNone] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const mealPrice = NH_CONFIG.MEALS.PRICES[mealType] ?? 0;

  useEffect(() => {
    if (currentMeal) {
      const none = isNoneMeal(currentMeal);
      setIsNone(none);
      setSelectedItems(none ? [] : (currentMeal.items || []));
      setBagelType(none ? '' : (currentMeal.bagelType || ''));
    } else {
      setIsNone(false);
      setSelectedItems([]);
      setBagelType('');
    }
  }, [currentMeal, day, mealType]);

  const emitUpdate = (items, bagel, none) => {
    onUpdate(day, mealType, none ? [] : items, none ? null : (bagel || null), !!none);
  };

  const handleSelectNone = () => {
    setIsNone(true);
    setSelectedItems([]);
    setBagelType('');
    setSearchTerm('');
    emitUpdate([], null, true);
  };

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

    // Breakfast/lunch: only main/entree + side
    if (mealType === 'breakfast' || mealType === 'lunch') {
      if (isSoup || isDessert) return items;
      next = next.filter((i) => {
        const c = normCat(i.category);
        return c === 'main' || c === 'entree' || c === 'side';
      });
    }

    // Dinner: one each of entree, side, optional soup/dessert
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

  const handleItemToggle = (item) => {
    if (isNone) {
      setIsNone(false);
    }

    const isSelected = selectedItems.some((i) => i.id === item.id);
    let newItems;
    if (isSelected) {
      newItems = selectedItems.filter((i) => i.id !== item.id);
    } else {
      newItems = replaceByCategory(selectedItems, item);
    }

    setSelectedItems(newItems);
    const nextBagel = newItems.some((i) =>
      i.requiresBagelType === true ||
      (i.name.toLowerCase().includes('bagel') && !i.name.toLowerCase().includes('type'))
    ) ? bagelType : '';
    if (!nextBagel) setBagelType('');
    emitUpdate(newItems, nextBagel || null, false);
  };

  const handleBagelTypeChange = (type) => {
    setBagelType(type);
    emitUpdate(selectedItems, type, false);
  };

  const handleClearMeal = () => {
    setIsNone(false);
    setSelectedItems([]);
    setBagelType('');
    emitUpdate([], null, false);
  };

  const needsBagelType = !isNone && selectedItems.some((item) =>
    item.requiresBagelType === true ||
    (item.name.toLowerCase().includes('bagel') && !item.name.toLowerCase().includes('type'))
  );

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

  return (
    <div className="meal-form">
      <div className="meal-form-header">
        <h3>
          {day} — {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
          <span className="meal-price"> ${mealPrice.toFixed(2)}</span>
        </h3>
        {(selectedItems.length > 0 || isNone) && (
          <button type="button" className="clear-btn" onClick={handleClearMeal}>
            Clear Selection
          </button>
        )}
      </div>

      {resident?.dietaryRestrictions && (
        <div className="dietary-info">
          <strong>Dietary Restrictions:</strong> {resident.dietaryRestrictions}
        </div>
      )}

      {resident?.allergies && (
        <div className="allergy-warning">
          <strong>Allergies:</strong> {resident.allergies}
        </div>
      )}

      <div className="none-option">
        <button
          type="button"
          className={`menu-item none-item ${isNone ? 'selected' : ''}`}
          onClick={handleSelectNone}
        >
          <div className="item-info">
            <span className="item-name">None</span>
            <span className="item-description">Skip this meal (no charge)</span>
          </div>
          <div className="item-price">$0.00</div>
          {isNone && <div className="checkmark">✓</div>}
        </button>
      </div>

      {isNone ? (
        <div className="selected-items-summary">
          <strong>Selected:</strong>
          <div className="selected-items-list">
            <span className="selected-item-tag">None</span>
          </div>
        </div>
      ) : (
        <>
          <div className="search-box">
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="selected-items-summary">
            <strong>Selected ({selectedItems.length}):</strong>
            {selectedItems.length === 0 ? (
              <span className="no-selection"> No items selected</span>
            ) : (
              <div className="selected-items-list">
                {selectedItems.map((item) => (
                  <span key={item.id} className="selected-item-tag">
                    {item.name}
                  </span>
                ))}
              </div>
            )}
            {sideExcluded && (
              <p className="no-selection" style={{ marginTop: '0.5rem' }}>
                This main does not include a side.
              </p>
            )}
          </div>

          {needsBagelType && (
            <div className="bagel-type-selector">
              <label>Select Bagel Type:</label>
              <div className="bagel-types">
                {NH_CONFIG.BAGEL_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`bagel-type-btn ${bagelType === type ? 'selected' : ''}`}
                    onClick={() => handleBagelTypeChange(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="menu-items-grid">
            {visibleCategories.map((category) => (
              <div key={category} className="category-section">
                <h4 className="category-title">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                  {(normCat(category) === 'main' || normCat(category) === 'entree' || normCat(category) === 'side') && (
                    <span className="category-hint"> (choose one)</span>
                  )}
                  {(normCat(category) === 'soup' || normCat(category) === 'dessert') && (
                    <span className="category-hint"> (optional)</span>
                  )}
                </h4>
                <div className="items-list">
                  {groupedItems[category].map((item) => {
                    const isSelected = selectedItems.some((i) => i.id === item.id);
                    return (
                      <div
                        key={item.id}
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
                      >
                        <div className="item-info">
                          <span className="item-name">{item.name}</span>
                          {item.description && (
                            <span className="item-description">{item.description}</span>
                          )}
                        </div>
                        {isSelected && <div className="checkmark">✓</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

MealForm.propTypes = {
  day: PropTypes.string.isRequired,
  mealType: PropTypes.string.isRequired,
  menuItems: PropTypes.array.isRequired,
  currentMeal: PropTypes.object,
  /** (day, mealType, items, bagelType, none) — none=true clears items */
  onUpdate: PropTypes.func.isRequired,
  resident: PropTypes.object
};

export default MealForm;
