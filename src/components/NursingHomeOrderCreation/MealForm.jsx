import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const MealForm = ({ day, mealType, menuItems, currentMeal, onUpdate, resident }) => {
  const [selectedItems, setSelectedItems] = useState([]);
  const [bagelType, setBagelType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (currentMeal) {
      setSelectedItems(currentMeal.items || []);
      setBagelType(currentMeal.bagelType || '');
    } else {
      setSelectedItems([]);
      setBagelType('');
    }
  }, [currentMeal, day, mealType]);

  const handleItemToggle = (item) => {
    const isSelected = selectedItems.some(i => i.id === item.id);
    
    let newItems;
    if (isSelected) {
      newItems = selectedItems.filter(i => i.id !== item.id);
    } else {
      newItems = [...selectedItems, {
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price
      }];
    }

    setSelectedItems(newItems);
    onUpdate(day, mealType, newItems, bagelType || null);
  };

  const handleBagelTypeChange = (type) => {
    setBagelType(type);
    onUpdate(day, mealType, selectedItems, type);
  };

  const handleClearMeal = () => {
    setSelectedItems([]);
    setBagelType('');
    onUpdate(day, mealType, [], null);
  };

  const needsBagelType = selectedItems.some(item => 
    item.name.toLowerCase().includes('bagel') && 
    !item.name.toLowerCase().includes('type')
  );

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  const categoryOrder = {
    main: 1,
    entree: 1,
    side: 2,
    soup: 3,
    dessert: 4
  };

  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    return (categoryOrder[a] || 99) - (categoryOrder[b] || 99);
  });

  return (
    <div className="meal-form">
      <div className="meal-form-header">
        <h3>{day} - {mealType.charAt(0).toUpperCase() + mealType.slice(1)}</h3>
        {selectedItems.length > 0 && (
          <button className="clear-btn" onClick={handleClearMeal}>
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
            {selectedItems.map(item => (
              <span key={item.id} className="selected-item-tag">
                {item.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {needsBagelType && (
        <div className="bagel-type-selector">
          <label>Select Bagel Type:</label>
          <div className="bagel-types">
            {['Plain', 'Sesame', 'Everything', 'Poppy', 'Onion', 'Whole Wheat'].map(type => (
              <button
                key={type}
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
        {sortedCategories.map(category => (
          <div key={category} className="category-section">
            <h4 className="category-title">{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
            <div className="items-list">
              {groupedItems[category].map(item => {
                const isSelected = selectedItems.some(i => i.id === item.id);
                return (
                  <div
                    key={item.id}
                    className={`menu-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleItemToggle(item)}
                  >
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      {item.description && (
                        <span className="item-description">{item.description}</span>
                      )}
                    </div>
                    <div className="item-price">${parseFloat(item.price).toFixed(2)}</div>
                    {isSelected && <div className="checkmark">✓</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

MealForm.propTypes = {
  day: PropTypes.string.isRequired,
  mealType: PropTypes.string.isRequired,
  menuItems: PropTypes.array.isRequired,
  currentMeal: PropTypes.object,
  onUpdate: PropTypes.func.isRequired,
  resident: PropTypes.object
};

export default MealForm;
