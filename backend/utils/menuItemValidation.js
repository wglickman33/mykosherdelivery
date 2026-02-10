function validateMenuItemData(data) {
  const errors = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Item name is required');
  }

  if (!data.itemType || !['simple', 'variety', 'builder'].includes(data.itemType)) {
    errors.push('Valid item type is required (simple, variety, builder)');
  }

  const priceValue = typeof data.price === 'string' ? parseFloat(data.price) : data.price;
  if (typeof priceValue !== 'number' || isNaN(priceValue) || priceValue < 0) {
    errors.push('Valid price is required');
  }

  if (!data.category || data.category.trim().length === 0) {
    errors.push('Category is required');
  }

  if (data.itemType === 'variety') {
    if (!data.options || !data.options.variants || !Array.isArray(data.options.variants)) {
      errors.push('Variants are required for variety items');
    } else if (data.options.variants.length === 0) {
      errors.push('At least one variant is required for variety items');
    } else {
      data.options.variants.forEach((variant, index) => {
        if (!variant.name || variant.name.trim().length === 0) {
          errors.push(`Variant ${index + 1} name is required`);
        }
        const modifierValue = typeof variant.priceModifier === 'string' ? parseFloat(variant.priceModifier) : variant.priceModifier;
        if (typeof modifierValue !== 'number' || isNaN(modifierValue)) {
          errors.push(`Variant ${index + 1} price modifier must be a number`);
        }
      });
    }
  }

  if (data.itemType === 'builder') {
    if (!data.options || !data.options.configurations || !Array.isArray(data.options.configurations)) {
      errors.push('Configurations are required for builder items');
    } else if (data.options.configurations.length === 0) {
      errors.push('At least one configuration category is required for builder items');
    } else {
      data.options.configurations.forEach((config, index) => {
        if (!config.category || config.category.trim().length === 0) {
          errors.push(`Configuration ${index + 1} category name is required`);
        }
        if (typeof config.required !== 'boolean') {
          errors.push(`Configuration ${index + 1} required field must be boolean`);
        }
        if (typeof config.maxSelections !== 'number' || config.maxSelections < 1) {
          errors.push(`Configuration ${index + 1} maxSelections must be a positive number`);
        }
        if (!config.options || !Array.isArray(config.options) || config.options.length === 0) {
          errors.push(`Configuration ${index + 1} must have at least one option`);
        } else {
          config.options.forEach((option, optIndex) => {
            if (!option.name || option.name.trim().length === 0) {
              errors.push(`Configuration ${index + 1}, option ${optIndex + 1} name is required`);
            }
            const optionModifierValue = typeof option.priceModifier === 'string' ? parseFloat(option.priceModifier) : option.priceModifier;
            if (typeof optionModifierValue !== 'number' || isNaN(optionModifierValue)) {
              errors.push(`Configuration ${index + 1}, option ${optIndex + 1} price modifier must be a number`);
            }
          });
        }
      });
    }
  }

  return errors;
}

function normalizeMenuItemData(data) {
  const normalized = {
    name: data.name?.trim(),
    description: data.description?.trim() || null,
    price: parseFloat(data.price),
    category: data.category?.trim(),
    imageUrl: data.imageUrl?.trim() || null,
    available: data.available !== false,
    itemType: data.itemType,
    options: data.options || null,
    labels: data.labels || []
  };

  if (normalized.itemType === 'variety' && normalized.options) {
    normalized.options = {
      variants: normalized.options.variants || []
    };
  }

  if (normalized.itemType === 'builder' && normalized.options) {
    normalized.options = {
      configurations: normalized.options.configurations || []
    };
  }

  return normalized;
}

module.exports = {
  validateMenuItemData,
  normalizeMenuItemData
};
