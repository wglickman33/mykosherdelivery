
export const formatPhoneNumber = (phone) => {
  if (!phone || phone === 'Not Provided' || phone === 'Not provided') {
    return 'Not Provided';
  }

  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  return phone;
};


export const formatPhoneForInput = (phone) => {
  if (!phone || phone === 'Not Provided' || phone === 'Not provided') {
    return '';
  }
  
  return phone.replace(/\D/g, '');
};


export const isValidPhoneNumber = (phone) => {
  if (!phone) return false;
  
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
};
