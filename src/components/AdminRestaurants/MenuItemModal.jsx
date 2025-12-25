import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import LabelSelector from './LabelSelector';
import { AVAILABLE_LABELS } from '../../data/labels';
import './MenuItemModal.scss';
import { 
  createMenuItem, 
  updateMenuItem, 
  validateMenuItemData,
  normalizeMenuItemData,
  getItemTypeDisplayName,
  getDefaultOptions
} from '../../services/menuItemService';
import { uploadMenuItemImage } from '../../services/imageService';

const MenuItemModal = ({ 
  isOpen, 
  onClose, 
  restaurant, 
  menuItem = null, 
  onSave 
}) => {
  const [step, setStep] = useState(1);
  const [itemType, setItemType] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (menuItem) {
        setItemType(menuItem.itemType);
        setFormData({
          name: menuItem.name || '',
          description: menuItem.description || '',
          price: parseFloat(menuItem.price) || 0,
          category: menuItem.category || '',
          imageUrl: menuItem.imageUrl || '',
          available: menuItem.available !== false,
          itemType: menuItem.itemType,
          options: menuItem.options || getDefaultOptions(menuItem.itemType),
          labels: menuItem.labels || []
        });
        setStep(2);
      } else {
        setItemType(null);
        setFormData({
          name: '',
          description: '',
          price: 0,
          category: '',
          imageUrl: '',
          available: true,
          itemType: null,
          options: null,
          labels: []
        });
        setStep(1);
      }
      setErrors([]);
    }
  }, [isOpen, menuItem]);

  const handleTypeSelection = (type) => {
    setItemType(type);
    setFormData(prev => ({
      ...prev,
      itemType: type,
      options: getDefaultOptions(type)
    }));
    setStep(2);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleOptionsChange = useCallback((newOptions) => {
    setFormData(prev => ({
      ...prev,
      options: newOptions
    }));
  }, []);

  const validateAndProceed = () => {
    const validationErrors = validateMenuItemData(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setStep(3);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const normalizedData = normalizeMenuItemData(formData);
      
      let result;
      if (menuItem) {
        result = await updateMenuItem(restaurant.id, menuItem.id, normalizedData);
      } else {
        result = await createMenuItem(restaurant.id, normalizedData);
      }

      if (result.success) {
        onSave(result.data);
        onClose();
      } else {
        setErrors([result.message || 'Failed to save menu item']);
      }
    } catch (error) {
      console.error('Error saving menu item:', error);
      setErrors(['An error occurred while saving the menu item']);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      if (menuItem) {
        setStep(2);
      } else {
        setStep(1);
        setItemType(null);
      }
    } else if (step === 3) {
      setStep(2);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="menu-item-modal__overlay" onClick={onClose}>
      <div className="menu-item-modal__container" onClick={(e) => e.stopPropagation()}>
        <div className="menu-item-modal__header">
          <h2 className="menu-item-modal__header-title">
            {menuItem ? 'Edit Menu Item' : 'Add New Menu Item'}
            {restaurant && ` - ${restaurant.name}`}
          </h2>
          <button className="menu-item-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="menu-item-modal__content">
          {}
          <div className="menu-item-modal__steps">
            <div className={`menu-item-modal__step ${step >= 1 ? 'active' : ''}`}>
              <span className="menu-item-modal__step-number">1</span>
              <span className="menu-item-modal__step-label">Type</span>
            </div>
            <div className={`menu-item-modal__step ${step >= 2 ? 'active' : ''}`}>
              <span className="menu-item-modal__step-number">2</span>
              <span className="menu-item-modal__step-label">Details</span>
            </div>
            <div className={`menu-item-modal__step ${step >= 3 ? 'active' : ''}`}>
              <span className="menu-item-modal__step-number">3</span>
              <span className="menu-item-modal__step-label">Preview</span>
            </div>
          </div>

          {}
          {errors.length > 0 && (
            <div className="menu-item-modal__errors">
              <h4>Please fix the following errors:</h4>
              <ul>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {}
          {step === 1 && (
            <TypeSelectionStep 
              onTypeSelect={handleTypeSelection}
              selectedType={itemType}
            />
          )}

          {}
          {step === 2 && (
            <DetailsFormStep
              formData={formData}
              itemType={itemType}
              onInputChange={handleInputChange}
              onOptionsChange={handleOptionsChange}
              onNext={validateAndProceed}
              onBack={handleBack}
              isEditing={!!menuItem}
            />
          )}

          {}
          {step === 3 && (
            <PreviewStep
              formData={formData}
              itemType={itemType}
              onSave={handleSave}
              onBack={handleBack}
              loading={loading}
              isEditing={!!menuItem}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const TypeSelectionStep = ({ onTypeSelect, selectedType }) => {
  const types = [
    {
      id: 'simple',
      name: 'Regular Item',
      description: 'Simple menu item with fixed price and no customization',
      icon: '•',
      example: 'Caesar Salad - $12.99'
    },
    {
      id: 'variety',
      name: 'Variable Item',
      description: 'Item with multiple variants (different options, prices, images)',
      icon: '•',
      example: 'Bagel - Everything ($3.99), Sesame ($3.99), Cinnamon Raisin ($4.49)'
    },
    {
      id: 'builder',
      name: 'Configurable Item',
      description: 'Buildable item where customers choose components',
      icon: '•',
      example: 'Custom Sandwich - Choose bread, protein, toppings with price modifiers'
    }
  ];

  return (
    <div className="menu-item-modal__type-selection">
      <h3>Choose Item Type</h3>
      <p>Select the type of menu item you want to create:</p>
      
      <div className="menu-item-modal__type-options">
        {types.map(type => (
          <button
            key={type.id}
            className={`menu-item-modal__type-option ${selectedType === type.id ? 'selected' : ''}`}
            onClick={() => onTypeSelect(type.id)}
          >
            <div className="menu-item-modal__type-icon">{type.icon}</div>
            <div className="menu-item-modal__type-content">
              <h4>{type.name}</h4>
              <p>{type.description}</p>
              <span className="menu-item-modal__type-example">Example: {type.example}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const DetailsFormStep = ({ 
  formData, 
  itemType, 
  onInputChange, 
  onOptionsChange, 
  onNext, 
  onBack,
  isEditing 
}) => {
  return (
    <div className="menu-item-modal__details-form">
      <h3>Item Details</h3>
      
      <div className="menu-item-modal__form-grid">
        {}
        <div className="menu-item-modal__form-section">
          <h4>Basic Information</h4>
          
          <div className="menu-item-modal__form-group">
            <label>Item Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onInputChange('name', e.target.value)}
              placeholder="e.g., Caesar Salad"
              required
            />
          </div>

          <div className="menu-item-modal__form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => onInputChange('description', e.target.value)}
              placeholder="Describe the item..."
              rows={3}
            />
          </div>

          <div className="menu-item-modal__form-group">
            <label>Category *</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => onInputChange('category', e.target.value)}
              placeholder="e.g., Salads, Sandwiches, Appetizers"
              required
            />
          </div>

          <div className="menu-item-modal__form-group">
            <label>Base Price *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => {
                const value = e.target.value;
                const numericValue = value === '' ? 0 : parseFloat(value) || 0;
                onInputChange('price', numericValue);
              }}
              placeholder="0.00"
              required
            />
          </div>

          <div className="menu-item-modal__form-group">
            <label>Image URL</label>
            <input
              type="url"
              value={formData.imageUrl}
              onChange={(e) => onInputChange('imageUrl', e.target.value)}
              placeholder="https://example.com/image.jpg or upload file"
            />
          </div>
          
          <div className="menu-item-modal__form-group">
            <label>Or Upload Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const res = await uploadMenuItemImage(file);
                if (res?.success && res.data?.originalUrl) {
                  onInputChange('imageUrl', res.data.originalUrl);
                }
              }}
            />
          </div>

          <div className="menu-item-modal__form-group menu-item-modal__form-group--checkbox">
            <label>
              <input
                type="checkbox"
                checked={formData.available}
                onChange={(e) => onInputChange('available', e.target.checked)}
              />
              Available for ordering
            </label>
          </div>
        </div>

        {}
        <div className="menu-item-modal__form-section">
          <LabelSelector
            selectedLabels={formData.labels || []}
            onChange={(labels) => onInputChange('labels', labels)}
          />
        </div>
      </div>

      {}
      <div className="menu-item-modal__form-section menu-item-modal__form-section--full-width">
        <h4>{getItemTypeDisplayName(itemType)} Options</h4>
        
        {itemType === 'variety' && (
          <VarietyOptionsEditor
            options={formData.options}
            onChange={onOptionsChange}
          />
        )}
        
        {itemType === 'builder' && (
          <BuilderOptionsEditor
            options={formData.options}
            onChange={onOptionsChange}
          />
        )}
        
        {itemType === 'simple' && (
          <div className="menu-item-modal__simple-info">
            <p>Regular items don&apos;t require additional options. The item will be displayed with the base price you set above.</p>
          </div>
        )}
      </div>

      <div className="menu-item-modal__form-actions">
        <button type="button" onClick={onBack} className="menu-item-modal__btn menu-item-modal__btn--secondary">
          {isEditing ? 'Cancel' : 'Back'}
        </button>
        <button type="button" onClick={onNext} className="menu-item-modal__btn menu-item-modal__btn--primary">
          Next: Preview
        </button>
      </div>
    </div>
  );
};

const PreviewStep = ({ formData, itemType, onSave, onBack, loading, isEditing }) => {
  return (
    <div className="menu-item-modal__preview">
      <h3>Preview & Save</h3>
      
      <div className="menu-item-modal__preview-content">
        <div className="menu-item-modal__preview-item">
          <h4>{formData.name}</h4>
          <p className="menu-item-modal__preview-description">{formData.description}</p>
          <div className="menu-item-modal__preview-details">
            <span className="menu-item-modal__preview-category">{formData.category}</span>
            <span className="menu-item-modal__preview-price">${(parseFloat(formData.price) || 0).toFixed(2)}</span>
            <span className={`menu-item-modal__preview-status ${formData.available ? 'available' : 'unavailable'}`}>
              {formData.available ? 'Available' : 'Unavailable'}
            </span>
          </div>
          
          {formData.labels && formData.labels.length > 0 && (
            <div className="menu-item-modal__preview-labels">
              <h5>Dietary Labels:</h5>
              <div className="menu-item-modal__preview-label-tags">
                {formData.labels.map(label => (
                  <span 
                    key={label} 
                    className="menu-item-modal__preview-label-tag"
                    title={AVAILABLE_LABELS[label] || label}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {itemType === 'variety' && formData.options?.variants && (
            <div className="menu-item-modal__preview-variants">
              <h5>Variants:</h5>
              <ul>
                {formData.options.variants.map((variant, index) => (
                  <li key={index}>
                    {variant.name} - ${(parseFloat(formData.price) + parseFloat(variant.priceModifier || 0)).toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {itemType === 'builder' && formData.options?.configurations && (
            <div className="menu-item-modal__preview-configurations">
              <h5>Configuration Categories:</h5>
              <ul>
                {formData.options.configurations.map((config, index) => (
                  <li key={index}>
                    <strong>{config.category}</strong> ({config.required ? 'Required' : 'Optional'})
                    <ul>
                      {config.options.map((option, optIndex) => (
                        <li key={optIndex}>
                          {option.name} {parseFloat(option.priceModifier || 0) > 0 ? `(+${(parseFloat(option.priceModifier || 0)).toFixed(2)})` : ''}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="menu-item-modal__form-actions">
        <button type="button" onClick={onBack} className="menu-item-modal__btn menu-item-modal__btn--secondary">
          Back to Details
        </button>
        <button 
          type="button" 
          onClick={onSave} 
          className="menu-item-modal__btn menu-item-modal__btn--primary"
          disabled={loading}
        >
          {loading ? 'Saving...' : (isEditing ? 'Update Item' : 'Create Item')}
        </button>
      </div>
    </div>
  );
};

const VarietyOptionsEditor = ({ options, onChange }) => {
  const [variants, setVariants] = useState(options?.variants || []);

  useEffect(() => {
    onChange({ variants });
  }, [variants, onChange]);

  const addVariant = () => {
    setVariants(prev => [...prev, {
      id: `variant-${Date.now()}`,
      name: '',
      imageUrl: '',
      priceModifier: 0,
      available: true
    }]);
  };

  const updateVariant = (index, field, value) => {
    setVariants(prev => prev.map((variant, i) => 
      i === index ? { ...variant, [field]: value } : variant
    ));
  };

  const removeVariant = (index) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="menu-item-modal__variety-editor">
      <div className="menu-item-modal__variety-header">
        <h5>Variants</h5>
        <button type="button" onClick={addVariant} className="menu-item-modal__btn menu-item-modal__btn--small">
          Add Variant
        </button>
      </div>
      
      {variants.length === 0 ? (
        <p className="menu-item-modal__no-variants">No variants added yet. Click &quot;Add Variant&quot; to get started.</p>
      ) : (
        <div className="menu-item-modal__variants-list">
          {variants.map((variant, index) => (
            <div key={variant.id || index} className="menu-item-modal__variant-item">
              <div className="menu-item-modal__variant-fields">
                <input
                  type="text"
                  placeholder="Variant name (e.g., Everything Bagel)"
                  value={variant.name}
                  onChange={(e) => updateVariant(index, 'name', e.target.value)}
                />
                <input
                  type="url"
                  placeholder="Image URL (optional)"
                  value={variant.imageUrl}
                  onChange={(e) => updateVariant(index, 'imageUrl', e.target.value)}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Price modifier"
                  value={variant.priceModifier}
                  onChange={(e) => updateVariant(index, 'priceModifier', parseFloat(e.target.value) || 0)}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={variant.available}
                    onChange={(e) => updateVariant(index, 'available', e.target.checked)}
                  />
                  Available
                </label>
              </div>
              <button 
                type="button" 
                onClick={() => removeVariant(index)}
                className="menu-item-modal__btn menu-item-modal__btn--danger menu-item-modal__btn--small"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BuilderOptionsEditor = ({ options, onChange }) => {
  const [configurations, setConfigurations] = useState(options?.configurations || []);

  useEffect(() => {
    onChange({ configurations });
  }, [configurations, onChange]);

  const addConfiguration = () => {
    setConfigurations(prev => [...prev, {
      category: '',
      required: false,
      maxSelections: 1,
      options: []
    }]);
  };

  const updateConfiguration = (index, field, value) => {
    setConfigurations(prev => prev.map((config, i) => 
      i === index ? { ...config, [field]: value } : config
    ));
  };

  const removeConfiguration = (index) => {
    setConfigurations(prev => prev.filter((_, i) => i !== index));
  };

  const addOptionToConfiguration = (configIndex) => {
    setConfigurations(prev => prev.map((config, i) => 
      i === configIndex ? {
        ...config,
        options: [...config.options, {
          id: `option-${Date.now()}`,
          name: '',
          priceModifier: 0,
          available: true
        }]
      } : config
    ));
  };

  const updateOption = (configIndex, optionIndex, field, value) => {
    setConfigurations(prev => prev.map((config, i) => 
      i === configIndex ? {
        ...config,
        options: config.options.map((option, j) => 
          j === optionIndex ? { ...option, [field]: value } : option
        )
      } : config
    ));
  };

  const removeOption = (configIndex, optionIndex) => {
    setConfigurations(prev => prev.map((config, i) => 
      i === configIndex ? {
        ...config,
        options: config.options.filter((_, j) => j !== optionIndex)
      } : config
    ));
  };

  return (
    <div className="menu-item-modal__builder-editor">
      <div className="menu-item-modal__builder-header">
        <h5>Configuration Categories</h5>
        <button type="button" onClick={addConfiguration} className="menu-item-modal__btn menu-item-modal__btn--small">
          Add Category
        </button>
      </div>
      
      {configurations.length === 0 ? (
        <p className="menu-item-modal__no-configurations">No configuration categories added yet. Click &quot;Add Category&quot; to get started.</p>
      ) : (
        <div className="menu-item-modal__configurations-list">
          {configurations.map((config, configIndex) => (
            <div key={configIndex} className="menu-item-modal__configuration-item">
              <div className="menu-item-modal__configuration-header">
                <input
                  type="text"
                  placeholder="Category name (e.g., Bread, Protein, Toppings)"
                  value={config.category}
                  onChange={(e) => updateConfiguration(configIndex, 'category', e.target.value)}
                />
                <div className="menu-item-modal__configuration-settings">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.required}
                      onChange={(e) => updateConfiguration(configIndex, 'required', e.target.checked)}
                    />
                    Required
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Max selections"
                    value={config.maxSelections}
                    onChange={(e) => updateConfiguration(configIndex, 'maxSelections', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              
              <div className="menu-item-modal__configuration-options">
                <div className="menu-item-modal__options-header">
                  <h6>Options</h6>
                  <button 
                    type="button" 
                    onClick={() => addOptionToConfiguration(configIndex)}
                    className="menu-item-modal__btn menu-item-modal__btn--small"
                  >
                    Add Option
                  </button>
                </div>
                
                {config.options.map((option, optionIndex) => (
                  <div key={option.id || optionIndex} className="menu-item-modal__option-item">
                    <input
                      type="text"
                      placeholder="Option name (e.g., White Bread)"
                      value={option.name}
                      onChange={(e) => updateOption(configIndex, optionIndex, 'name', e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Price modifier"
                      value={option.priceModifier}
                      onChange={(e) => updateOption(configIndex, optionIndex, 'priceModifier', parseFloat(e.target.value) || 0)}
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={option.available}
                        onChange={(e) => updateOption(configIndex, optionIndex, 'available', e.target.checked)}
                      />
                      Available
                    </label>
                    <button 
                      type="button" 
                      onClick={() => removeOption(configIndex, optionIndex)}
                      className="menu-item-modal__btn menu-item-modal__btn--danger menu-item-modal__btn--small"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              
              <button 
                type="button" 
                onClick={() => removeConfiguration(configIndex)}
                className="menu-item-modal__btn menu-item-modal__btn--danger menu-item-modal__btn--small"
              >
                Remove Category
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

MenuItemModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  restaurant: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  }).isRequired,
  menuItem: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    category: PropTypes.string,
    imageUrl: PropTypes.string,
    available: PropTypes.bool,
    itemType: PropTypes.string,
    options: PropTypes.object,
    labels: PropTypes.array
  }),
  onSave: PropTypes.func.isRequired
};

TypeSelectionStep.propTypes = {
  onTypeSelect: PropTypes.func.isRequired,
  selectedType: PropTypes.string
};

DetailsFormStep.propTypes = {
  formData: PropTypes.shape({
    name: PropTypes.string,
    description: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    category: PropTypes.string,
    imageUrl: PropTypes.string,
    available: PropTypes.bool,
    itemType: PropTypes.string,
    options: PropTypes.object,
    labels: PropTypes.array
  }).isRequired,
  itemType: PropTypes.string.isRequired,
  onInputChange: PropTypes.func.isRequired,
  onOptionsChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  isEditing: PropTypes.bool.isRequired
};

PreviewStep.propTypes = {
  formData: PropTypes.shape({
    name: PropTypes.string,
    description: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    category: PropTypes.string,
    imageUrl: PropTypes.string,
    available: PropTypes.bool,
    itemType: PropTypes.string,
    options: PropTypes.object,
    labels: PropTypes.array
  }).isRequired,
  itemType: PropTypes.string.isRequired,
  onSave: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isEditing: PropTypes.bool.isRequired
};

VarietyOptionsEditor.propTypes = {
  options: PropTypes.shape({
    variants: PropTypes.array
  }),
  onChange: PropTypes.func.isRequired
};

BuilderOptionsEditor.propTypes = {
  options: PropTypes.shape({
    configurations: PropTypes.array
  }),
  onChange: PropTypes.func.isRequired
};

export default MenuItemModal;
