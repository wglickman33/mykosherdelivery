import { API_BASE_URL } from '../lib/api';

const getAuthToken = () => {
  const token = localStorage.getItem('mkd-auth-token');
  return token;
};

export const fetchPromoCodes = async (page = 1, limit = 20, search = '', active = '') => {
  try {
    const token = getAuthToken();
    
    if (!token) {
      throw new Error('No authentication token found. Please log in as an admin.');
    }

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
      ...(active && { active })
    });

    const response = await fetch(`${API_BASE_URL}/admin/promo-codes?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in as an admin.');
      } else if (response.status === 403) {
        throw new Error('Admin access required. You do not have permission to manage promo codes.');
      }
      throw new Error(data.message || 'Failed to fetch promo codes');
    }

    return data;
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    throw error;
  }
};

export const fetchPromoCodeById = async (id) => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/promo-codes/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch promo code');
    }

    return data;
  } catch (error) {
    console.error('Error fetching promo code:', error);
    throw error;
  }
};

export const createPromoCode = async (promoCodeData) => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/promo-codes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(promoCodeData)
    });

    const data = await response.json();
    
    if (!response.ok) {
      const msg = data.message
        || (data.details && data.details[0] && (data.details[0].msg || data.details[0].message))
        || data.error
        || 'Failed to create promo code';
      throw new Error(msg);
    }

    return data;
  } catch (error) {
    console.error('Error creating promo code:', error);
    throw error;
  }
};

export const updatePromoCode = async (id, promoCodeData) => {
  try {
    const token = getAuthToken();
    
    const promoId = typeof id === 'object' ? (id?.id || id) : id;
    const cleanId = String(promoId).split(':')[0];
    
    const response = await fetch(`${API_BASE_URL}/admin/promo-codes/${encodeURIComponent(cleanId)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(promoCodeData)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Promo code update error:', {
        status: response.status,
        statusText: response.statusText,
        error: data,
        promoId: cleanId,
        originalId: id,
        requestData: promoCodeData
      });
      const errorMessage = data.message || data.error || (data.details && Array.isArray(data.details) ? data.details.map(d => d.msg || d.message).join(', ') : '') || `Failed to update promo code: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error('Error updating promo code:', error);
    throw error;
  }
};

export const deletePromoCode = async (id) => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/promo-codes/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete promo code');
    }

    return data;
  } catch (error) {
    console.error('Error deleting promo code:', error);
    throw error;
  }
};

export const validatePromoCode = async (code) => {
  try {
    const response = await fetch(`${API_BASE_URL}/promo-codes/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to validate promo code');
    }

    return data;
  } catch (error) {
    console.error('Error validating promo code:', error);
    throw error;
  }
};

export const calculateDiscount = async (code, subtotal) => {
  try {
    const response = await fetch(`${API_BASE_URL}/promo-codes/calculate-discount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, subtotal })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to calculate discount');
    }

    return data;
  } catch (error) {
    console.error('Error calculating discount:', error);
    throw error;
  }
};
