import apiClient from '../lib/api';
import logger from '../utils/logger';

// Authentication service for Express backend
let lastSessionCheck = 0;
let lastSessionResult = null;
const SESSION_CHECK_COOLDOWN = 30 * 1000; // 30 seconds minimum between session checks

export const authService = {
  // Sign up a new user
  async signUp(email, password, firstName, lastName) {
    try {
      const response = await apiClient.post('/auth/signup', {
        email,
        password,
        firstName,
        lastName
      });

      if (response.data && response.data.session) {
        apiClient.setToken(response.data.session.access_token);
        return {
          success: true,
          user: response.data.user,
          token: response.data.session.access_token
        };
      }

      return { success: false, error: response.message || 'Signup failed' };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: error.message };
    }
  },

  // Sign in existing user
  async signIn(email, password) {
    try {
      const response = await apiClient.post('/auth/signin', {
        email,
        password
      });

      if (response.data && response.data.session) {
        apiClient.setToken(response.data.session.access_token);
        return {
          success: true,
          user: response.data.user,
          token: response.data.session.access_token
        };
      }

      return { success: false, error: response.message || 'Signin failed' };
    } catch (error) {
      console.error('Signin error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get current session with token validation
  async getSession() {
    try {
      const token = apiClient.getToken();
      if (!token) {
        return { success: false, user: null };
      }

      // Prevent too frequent session checks (but allow initial page loads)
      const now = Date.now();
      if (now - lastSessionCheck < SESSION_CHECK_COOLDOWN && lastSessionCheck > 0 && lastSessionResult) {
        logger.debug('Session check skipped due to cooldown, returning cached result');
        // Return the last known session state
        return lastSessionResult;
      }
      lastSessionCheck = now;

      // Check if token is close to expiring and refresh if needed
      try {
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        const expiresAt = tokenPayload.exp * 1000; // Convert to milliseconds
        const timeUntilExpiry = expiresAt - now;
        
        // If token expires in less than 1 hour, try to refresh it
        if (timeUntilExpiry < 60 * 60 * 1000) {
          logger.debug('Token expires soon, attempting refresh', {
            expiresAt: new Date(expiresAt).toISOString(),
            timeUntilExpiry: Math.floor(timeUntilExpiry / 1000 / 60) + ' minutes'
          });
          
          // Try to refresh the session
          const refreshResponse = await apiClient.post('/auth/refresh');
          if (refreshResponse.data && refreshResponse.data.session) {
            apiClient.setToken(refreshResponse.data.session.access_token);
            logger.debug('Token refreshed successfully');
          }
        }
      } catch (tokenParseError) {
        logger.warn('Could not parse token for expiry check:', tokenParseError);
      }

      const response = await apiClient.get('/auth/session');
      if (response.data && response.data.session) {
        const result = {
          success: true,
          user: response.data.session.user
        };
        lastSessionResult = result;
        return result;
      }
      
      const result = { success: false, user: null };
      lastSessionResult = result;
      return result;
    } catch (error) {
      logger.error('Get session error:', error);
      
      const result = { success: false, user: null };
      
      // Only cache failure result if it's a real auth error
      if (error.message.includes('Token expired') || 
          error.message.includes('Invalid token')) {
        lastSessionResult = result;
        return result;
      }
      
      // For network errors, etc., don't cache the failure and don't immediately fail the session
      logger.warn('Session check failed but may be temporary:', error.message);
      return result;
    }
  },

  // Sign out user
  async signOut() {
    try {
      await apiClient.post('/auth/signout');
    } catch (error) {
      console.error('Signout error:', error);
    } finally {
      // Always clear the token locally
      apiClient.setToken(null);
    }
  },

  // Update user profile
  async updateProfile(updates) {
    try {
      const response = await apiClient.put('/profiles/me', updates);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  },

  // Add new address
  async addAddress(addressData) {
    try {
      const response = await apiClient.post('/profiles/me/addresses', addressData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Add address error:', error);
      return { success: false, error: error.message };
    }
  },

  // Update address
  async updateAddress(addressId, updates) {
    try {
      const response = await apiClient.put(`/profiles/me/addresses/${addressId}`, updates);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Update address error:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete address
  async deleteAddress(addressId) {
    try {
      await apiClient.delete(`/profiles/me/addresses/${addressId}`);
      return { success: true };
    } catch (error) {
      console.error('Delete address error:', error);
      return { success: false, error: error.message };
    }
  },

  // Set primary address
  async setPrimaryAddress(addressId) {
    try {
      const response = await apiClient.patch(`/profiles/me/addresses/${addressId}/primary`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Set primary address error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get current token (for client-side validation)
  getToken() {
    return apiClient.getToken();
  }
};

export default authService; 