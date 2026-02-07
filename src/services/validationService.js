import { validateDeliveryAddress as validateAddress } from './addressValidationService';
import { NH_CONFIG } from '../config/constants';

export const validateDeliveryAddress = validateAddress;

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone) => {
  const phoneRegex = /^\+?1?\d{10,14}$/;
  const cleanPhone = phone.replace(/[\s\-()]/g, '');
  return phoneRegex.test(cleanPhone);
};

export const validateZipCode = (zipCode) => {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode);
};

export const validateRequired = (value, fieldName = 'Field') => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  return { isValid: true };
};

export const validateLength = (value, min, max, fieldName = 'Field') => {
  const length = value ? value.length : 0;
  if (min && length < min) {
    return { isValid: false, error: `${fieldName} must be at least ${min} characters` };
  }
  if (max && length > max) {
    return { isValid: false, error: `${fieldName} must be no more than ${max} characters` };
  }
  return { isValid: true };
};

export const validateResidentOrder = (orderData) => {
  const errors = [];

  if (!orderData.residentId) {
    errors.push('Resident ID is required');
  }

  if (!orderData.weekStartDate || !orderData.weekEndDate) {
    errors.push('Week dates are required');
  }

  if (!orderData.meals || !Array.isArray(orderData.meals) || orderData.meals.length === 0) {
    errors.push('At least one meal must be selected');
  }

  if (orderData.meals && orderData.meals.length > NH_CONFIG.MEALS.MAX_MEALS_PER_WEEK) {
    errors.push(`Maximum ${NH_CONFIG.MEALS.MAX_MEALS_PER_WEEK} meals per week (${NH_CONFIG.MEALS.TYPES.length} meals × ${NH_CONFIG.MEALS.DAYS.length} days)`);
  }

  if (!orderData.deliveryAddress) {
    errors.push('Delivery address is required');
  } else {
    if (!orderData.deliveryAddress.street) {
      errors.push('Street address is required');
    }
    if (!orderData.deliveryAddress.city) {
      errors.push('City is required');
    }
    if (!orderData.deliveryAddress.state) {
      errors.push('State is required');
    }
    if (!orderData.deliveryAddress.zip_code || !validateZipCode(orderData.deliveryAddress.zip_code)) {
      errors.push('Valid ZIP code is required');
    }
  }

  if (orderData.billingEmail && !validateEmail(orderData.billingEmail)) {
    errors.push('Valid billing email is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateMealSelection = (meals) => {
  const errors = [];

  if (!Array.isArray(meals)) {
    return { isValid: false, errors: ['Meals must be an array'] };
  }

  meals.forEach((meal, index) => {
    if (!meal.day || !NH_CONFIG.MEALS.DAYS.includes(meal.day)) {
      errors.push(`Meal ${index + 1}: Invalid day`);
    }

    if (!meal.mealType || !NH_CONFIG.MEALS.TYPES.includes(meal.mealType)) {
      errors.push(`Meal ${index + 1}: Invalid meal type`);
    }

    if (!meal.items || !Array.isArray(meal.items) || meal.items.length === 0) {
      errors.push(`Meal ${index + 1}: At least one item must be selected`);
    }

    if (meal.items && meal.items.length > NH_CONFIG.MEALS.MAX_ITEMS_PER_MEAL) {
      errors.push(`Meal ${index + 1}: Maximum ${NH_CONFIG.MEALS.MAX_ITEMS_PER_MEAL} items per meal`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateOrderForm = (formData) => {
  const errors = {};

  if (!formData.street || formData.street.trim() === '') {
    errors.street = 'Street address is required';
  }

  if (!formData.city || formData.city.trim() === '') {
    errors.city = 'City is required';
  }

  if (!formData.state || formData.state.trim() === '') {
    errors.state = 'State is required';
  }

  if (!formData.zipCode || !validateZipCode(formData.zipCode)) {
    errors.zipCode = 'Valid ZIP code is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateContactInfo = (contactInfo) => {
  const errors = {};

  if (!contactInfo.firstName || contactInfo.firstName.trim() === '') {
    errors.firstName = 'First name is required';
  }

  if (!contactInfo.lastName || contactInfo.lastName.trim() === '') {
    errors.lastName = 'Last name is required';
  }

  if (!contactInfo.email || !validateEmail(contactInfo.email)) {
    errors.email = 'Valid email is required';
  }

  if (!contactInfo.phone || !validatePhone(contactInfo.phone)) {
    errors.phone = 'Valid phone number is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export default {
  validateDeliveryAddress,
  validateEmail,
  validatePhone,
  validateZipCode,
  validateRequired,
  validateLength,
  validateResidentOrder,
  validateMealSelection,
  validateOrderForm,
  validateContactInfo
};
