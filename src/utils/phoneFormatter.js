/**
 * Formats a phone number to XXX-XXX-XXXX format
 * @param {string} phone - The phone number to format
 * @returns {string} - Formatted phone number or original value if invalid
 */
export const formatPhoneNumber = (phone) => {
  if (!phone || phone === 'Not Provided' || phone === 'Not provided') {
    return 'Not Provided';
  }

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Check if we have exactly 10 digits
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  // Check if we have 11 digits starting with 1 (US country code)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  // If it doesn't match expected patterns, return as-is
  return phone;
};

/**
 * Formats a phone number for input display (removes formatting)
 * @param {string} phone - The phone number to format for input
 * @returns {string} - Unformatted phone number
 */
export const formatPhoneForInput = (phone) => {
  if (!phone || phone === 'Not Provided' || phone === 'Not provided') {
    return '';
  }
  
  // Remove all non-digit characters
  return phone.replace(/\D/g, '');
};

/**
 * Validates if a phone number is in correct format
 * @param {string} phone - The phone number to validate
 * @returns {boolean} - True if valid format
 */
export const isValidPhoneNumber = (phone) => {
  if (!phone) return false;
  
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
};
