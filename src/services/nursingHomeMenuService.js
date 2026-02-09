import api from '../lib/api';
import logger from '../utils/logger';

export const fetchNursingHomeMenu = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.mealType && filters.mealType !== 'all') {
      params.append('mealType', filters.mealType);
    }
    if (filters.category && filters.category !== 'all') {
      params.append('category', filters.category);
    }
    if (filters.isActive !== undefined) {
      params.append('isActive', filters.isActive);
    }

    const queryString = params.toString();
    const url = queryString ? `/nursing-homes/menu?${queryString}` : '/nursing-homes/menu';
    const response = await api.get(url);
    // #region agent log
    const _rawKeys = response && typeof response === 'object' ? Object.keys(response) : [];
    const _hasData = response && typeof response.data !== 'undefined';
    const _dataKeys = _hasData && response.data && typeof response.data === 'object' ? Object.keys(response.data) : [];
    const _body = response?.data ?? response;
    const _bodyDataKeys = _body && typeof _body === 'object' ? Object.keys(_body) : [];
    const _shapePayload = {location:'nursingHomeMenuService.js:fetch',message:'response shape',data:{rawKeys:_rawKeys,hasData:_hasData,dataKeys:_dataKeys,bodyDataKeys:_bodyDataKeys,bodyDataItemsLen:Array.isArray(_body?.data?.items)?_body.data.items.length:undefined,bodyItemsLen:Array.isArray(_body?.items)?_body.items.length:undefined},timestamp:Date.now(),hypothesisId:'A,B,E'};
    if (import.meta.env.DEV) console.debug('[DEBUG] NH menu response shape', _shapePayload);
    fetch('http://127.0.0.1:7242/ingest/4dc3c80e-cf40-46c2-9570-f0bcad5c8b59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(_shapePayload)}).catch(()=>{});
    // #endregion
    // Normalize: backend sends { success, data: { items, grouped } }; api.get returns that body.
    // Handle both response and response.data in case of double-wrap.
    const body = response?.data ?? response;
    const items = Array.isArray(body?.data?.items) ? body.data.items : (Array.isArray(body?.items) ? body.items : []);
    const grouped = body?.data?.grouped ?? body?.grouped ?? {};
    // #region agent log
    const _extractPayload = {location:'nursingHomeMenuService.js:fetch',message:'extracted items',data:{itemsLength:items.length,groupedKeys:Object.keys(grouped)},timestamp:Date.now(),hypothesisId:'A,B'};
    if (import.meta.env.DEV) console.debug('[DEBUG] NH menu extracted', _extractPayload);
    fetch('http://127.0.0.1:7242/ingest/4dc3c80e-cf40-46c2-9570-f0bcad5c8b59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(_extractPayload)}).catch(()=>{});
    // #endregion
    if (import.meta.env.DEV) {
      console.info('[Nursing home menu]', items.length, 'items received');
    }
    return { success: true, data: { items, grouped } };
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4dc3c80e-cf40-46c2-9570-f0bcad5c8b59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'nursingHomeMenuService.js:catch',message:'fetch failed',data:{errorMessage:error?.message},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    logger.error('Error fetching nursing home menu:', error);
    return {
      success: false,
      error: error?.message || error?.response?.data?.error || 'Failed to fetch menu'
    };
  }
};

export const createNursingHomeMenuItem = async (menuItemData) => {
  try {
    const response = await api.post('/nursing-homes/menu', menuItemData);
    return { success: true, data: response.data.data };
  } catch (error) {
    logger.error('Error creating nursing home menu item:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Failed to create menu item' 
    };
  }
};

export const updateNursingHomeMenuItem = async (id, menuItemData) => {
  try {
    const response = await api.put(`/nursing-homes/menu/${id}`, menuItemData);
    return { success: true, data: response.data.data };
  } catch (error) {
    logger.error('Error updating nursing home menu item:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Failed to update menu item' 
    };
  }
};

export const deleteNursingHomeMenuItem = async (id) => {
  try {
    const response = await api.delete(`/nursing-homes/menu/${id}`);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error deleting nursing home menu item:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Failed to delete menu item' 
    };
  }
};
