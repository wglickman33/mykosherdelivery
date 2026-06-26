import apiClient from '../lib/api';
import logger from '../utils/logger';

/** @returns {Promise<Array<Record<string, unknown>>>} */
export async function fetchKiddushPackages() {
  try {
    const res = await apiClient.get('/kiddush-packages');
    if (!res?.success || !Array.isArray(res.data)) {
      return [];
    }
    return res.data;
  } catch (e) {
    logger.error('fetchKiddushPackages failed', { message: e?.message });
    return [];
  }
}
