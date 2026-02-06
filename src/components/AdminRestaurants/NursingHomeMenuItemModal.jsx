import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './NursingHomeMenuItemModal.scss';

const NursingHomeMenuItemModal = ({ isOpen, onClose, menuItem, onSave }) => {
  const [formData, setFormData] = useState({
    mealType: 'breakfast',
    category: 'main',
    name: '',
    description: '',
    price: '0.00',
    requiresBagelType: false,
    excludesSide: false,
    displayOrder: 0,
    isActive: true
  });

  useEffect(() => {
    if (menuItem) {
      setFormData({
        mealType: menuItem.mealType || 'breakfast',
        category: menuItem.category || 'main',
        name: menuItem.name || '',
        description: menuItem.description || '',
        price: menuItem.price || '0.00',
        requiresBagelType: menuItem.requiresBagelType || false,
        excludesSide: menuItem.excludesSide || false,
        displayOrder: menuItem.displayOrder || 0,
        isActive: menuItem.isActive !== false
      });
    } else {
      setFormData({
        mealType: 'breakfast',
        category: 'main',
        name: '',
        description: '',
        price: '0.00',
        requiresBagelType: false,
        excludesSide: false,
        displayOrder: 0,
        isActive: true
      });
    }
  }, [menuItem, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(menuItem?.id, formData);
  };

  if (!isOpen) return null;

  const getCategoryOptions = () => {
    const { mealType } = formData;
    if (mealType === 'breakfast') {
      return [
        { value: 'main', label: 'Main' },
        { value: 'side', label: 'Side' }
      ];
    } else if (mealType === 'lunch') {
      return [
        { value: 'entree', label: 'Entree' },
        { value: 'side', label: 'Side' }
      ];
    } else if (mealType === 'dinner') {
      return [
        { value: 'entree', label: 'Entree' },
        { value: 'side', label: 'Side' },
        { value: 'soup', label: 'Soup' },
        { value: 'dessert', label: 'Dessert' }
      ];
    }
    return [];
  };

  return (
    <div className="nh-menu-modal-overlay" onClick={onClose}>
      <div className="nh-menu-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nh-menu-modal__header">
          <h2>{menuItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
          <button className="nh-menu-modal__close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="nh-menu-modal__form">
          <div className="nh-menu-modal__form-grid">
            <div className="form-group">
              <label>Meal Type *</label>
              <select
                value={formData.mealType}
                onChange={(e) => setFormData({ ...formData, mealType: e.target.value, category: 'main' })}
                required
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>

            <div className="form-group">
              <label>Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                {getCategoryOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group full-width">
              <label>Item Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Scrambled Eggs"
                required
              />
            </div>

            <div className="form-group full-width">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description or special notes"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Price *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Display Order</label>
              <input
                type="number"
                min="0"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
              />
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.requiresBagelType}
                  onChange={(e) => setFormData({ ...formData, requiresBagelType: e.target.checked })}
                />
                Requires Bagel Type Selection
              </label>
              <p className="help-text">Check if customer needs to specify bagel type (Plain, Sesame, Everything, Whole Wheat)</p>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.excludesSide}
                  onChange={(e) => setFormData({ ...formData, excludesSide: e.target.checked })}
                />
                Excludes Side Option
              </label>
              <p className="help-text">Check if this item does not include a side (marked with * in menu)</p>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                Active
              </label>
              <p className="help-text">Inactive items won&apos;t appear in ordering forms</p>
            </div>
          </div>

          <div className="nh-menu-modal__actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-save">
              {menuItem ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

NursingHomeMenuItemModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  menuItem: PropTypes.object,
  onSave: PropTypes.func.isRequired
};

export default NursingHomeMenuItemModal;
