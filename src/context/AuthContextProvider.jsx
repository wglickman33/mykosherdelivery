import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import authService from '../services/authService'
import { AuthContext } from './AuthContext'
import { fetchUserProfile } from '../services/accountServices'
import logger from '../utils/logger'

class SessionManager {
  constructor() {
    this.tokenExpiryTimeout = null;
    this.isActive = false;
    this.refreshAttempts = 0;
    this.maxRefreshAttempts = 3;
  }

  startTokenMonitoring(token, onExpiryCallback) {
    if (this.tokenExpiryTimeout) {
      this.stopTokenMonitoring();
    }

    try {
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = tokenPayload.exp * 1000;
      const timeUntilExpiry = expiresAt - Date.now();
      
      if (timeUntilExpiry <= 0) {
        logger.warn('Token is already expired');
        onExpiryCallback();
        return;
      }

      const timeoutMs = Math.max(timeUntilExpiry - (5 * 60 * 1000), 1000);
      
      logger.debug('Token monitoring started', {
        expiresAt: new Date(expiresAt).toISOString(),
        refreshIn: Math.floor(timeoutMs / 1000 / 60) + ' minutes',
        attempt: this.refreshAttempts
      });

      this.tokenExpiryTimeout = setTimeout(() => {
        logger.debug('Token approaching expiry, triggering refresh');
        this.refreshAttempts++;
        onExpiryCallback();
        this.tokenExpiryTimeout = null;
      }, timeoutMs);

      this.isActive = true;
    } catch (error) {
      logger.error('Error parsing token for monitoring:', error);
      onExpiryCallback();
    }
  }

  stopTokenMonitoring() {
    if (this.tokenExpiryTimeout) {
      clearTimeout(this.tokenExpiryTimeout);
      this.tokenExpiryTimeout = null;
    }
    this.isActive = false;
    this.refreshAttempts = 0;
  }

  shouldContinueRefresh() {
    return this.refreshAttempts < this.maxRefreshAttempts;
  }
}

const sessionManager = new SessionManager();

const GUEST_SESSION_KEY = 'mkd_guest_session'
const GUEST_SESSION_MS = 24 * 60 * 60 * 1000

function getValidGuestSession() {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.expires && parsed.expires > Date.now()) return parsed
  } catch {
    void 0;
  }
  return null
}

function ensureGuestSession() {
  const existing = getValidGuestSession()
  if (existing) return existing
  const session = { createdAt: Date.now(), expires: Date.now() + GUEST_SESSION_MS }
  localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session))
  return session
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)
  const [tempAddress, setTempAddress] = useState(() => {
    try {
      const saved = localStorage.getItem('mkd_temp_address')
      if (saved) {
        const parsed = JSON.parse(saved)
        const now = Date.now()
        if (parsed.expires > now) {
          return parsed.address
        } else {
          localStorage.removeItem('mkd_temp_address')
        }
      }
    } catch (error) {
      console.error('Error loading temp address:', error)
    }
    return null
  })
  const [selectedAddress, setSelectedAddress] = useState(() => {
    try {
      const saved = localStorage.getItem('mkd_selected_address')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      logger.error('AuthContext - Error loading selected address:', error)
    }
    return null
  })

  useEffect(() => {
    const getInitialSession = async () => {
      logger.debug('AuthContext - Getting initial session...')
      const { success, user: sessionUser } = await authService.getSession()
      
      logger.debug('AuthContext - Initial session result:', {
        hasSession: success,
        hasUser: !!sessionUser,
        userId: sessionUser?.id
      })
      
      if (success && sessionUser) {
        logger.debug('AuthContext - Setting user from initial session:', sessionUser.id)
        setUser(sessionUser)
        setIsGuest(false)
        
        
        try {
          const fetched = await fetchUserProfile(sessionUser.id)
          if (fetched) {
            setProfile(fetched)
          } else {
            setProfile(sessionUser)
          }
        } catch {
          setProfile(sessionUser)
        } finally {
        setLoading(false)
        }
      } else {
        logger.debug('AuthContext - No auth token; ensuring guest session')
        ensureGuestSession()
        setUser(null)
        setProfile(null)
        setIsGuest(true)
        setLoading(false)
      }
    }

    getInitialSession()
  }, [])

  useEffect(() => {
    if (user) {
      const startTokenRefreshCycle = async () => {
        const token = authService.getToken();
        if (!token) {
          logger.warn('No token found, signing out user');
          setUser(null);
          setProfile(null);
          setIsGuest(true);
          sessionManager.stopTokenMonitoring();
          return;
        }

        sessionManager.startTokenMonitoring(token, async () => {
          logger.debug('Token expiry detected, attempting refresh');
          
          if (!sessionManager.shouldContinueRefresh()) {
            logger.warn('Max refresh attempts reached, signing out user');
            setUser(null);
            setProfile(null);
            setIsGuest(true);
            sessionManager.stopTokenMonitoring();
            return;
          }

          try {
            const { success: refreshSuccess } = await authService.getSession();
            if (!refreshSuccess) {
              logger.warn('Token refresh failed, signing out user');
              setUser(null);
              setProfile(null);
              setIsGuest(true);
              sessionManager.stopTokenMonitoring();
            } else {
              logger.debug('Token refreshed successfully, restarting cycle');
              sessionManager.refreshAttempts = 0;
              startTokenRefreshCycle();
            }
          } catch (error) {
            logger.error('Token refresh error:', error);
            setUser(null);
            setProfile(null);
            setIsGuest(true);
            sessionManager.stopTokenMonitoring();
          }
        });
      };

      startTokenRefreshCycle();
    }

    return () => {
      sessionManager.stopTokenMonitoring();
    };
  }, [user])

  const fetchProfile = async (userId) => {
    try {
      logger.debug('AuthContext - Fetching profile for user:', userId)
      const fetched = await fetchUserProfile(userId)
      if (fetched) {
        setProfile(fetched)
      }
    } catch (error) {
      logger.error('AuthContext - Error fetching profile:', error)
      setProfile(null)
    }
  }

  const signUp = async (email, password, firstName, lastName) => {
    try {
      logger.debug('AuthContext - Signing up user:', email)
      
      const { success, user: newUser } = await authService.signUp(
        email, 
        password, 
        firstName, 
        lastName
      )

      if (success && newUser) {
        logger.success('AuthContext - Signup successful, setting user:', newUser.id)
        setUser(newUser)
        setIsGuest(false)
        
        
        await fetchProfile(newUser.id)
        return { success: true, user: newUser }
      } else {
        logger.error('AuthContext - Signup failed')
        return { success: false, error: 'Signup failed' }
      }
    } catch (error) {
      logger.error('AuthContext - Signup error:', error)
      return { success: false, error: error.message }
    }
  }

  const signIn = async (email, password) => {
    try {
      logger.debug('AuthContext - Signing in user:', email)
      
      const { success, user: sessionUser } = await authService.signIn(email, password)

      if (success && sessionUser) {
        logger.success('AuthContext - Signin successful, setting user:', sessionUser.id)
        setUser(sessionUser)
        setIsGuest(false)
        
        
        await fetchProfile(sessionUser.id)
        return { success: true, user: sessionUser }
      } else {
        logger.error('AuthContext - Signin failed')
        return { success: false, error: 'Signin failed' }
      }
    } catch (error) {
      logger.error('AuthContext - Signin error:', error)
      return { success: false, error: error.message }
    }
  }

  const signOut = async (navigateCallback = null) => {
    try {
      logger.debug('AuthContext - Signing out user')
      
      sessionManager.stopTokenMonitoring()
      
      await authService.signOut()
    } catch (error) {
      logger.error('AuthContext - Signout error:', error)
    } finally {
      logger.debug('AuthContext - Clearing user data and temp address')
      setUser(null)
      setProfile(null)
      setIsGuest(false)
      setTempAddress(null)
      setSelectedAddress(null)
      
      localStorage.removeItem('mkd_temp_address')
      logger.debug('AuthContext - Cleared mkd_temp_address from localStorage')
      
      localStorage.removeItem(GUEST_SESSION_KEY)
      logger.debug('AuthContext - Cleared guest session from localStorage')
      
      logger.debug('AuthContext - User signed out, all data cleared')
      
      if (navigateCallback && typeof navigateCallback === 'function') {
        setTimeout(() => {
          navigateCallback()
        }, 0)
      }
    }
    return { success: true }
  }

  const updateProfile = async (updates) => {
    try {
      const { success, data, error } = await authService.updateProfile(updates)
      if (success && data) {
        setProfile(data)
        setUser(data)
        return { success: true, data }
      } else {
        return { success: false, error }
      }
    } catch (error) {
      logger.error('AuthContext - Update profile error:', error)
      return { success: false, error: error.message }
    }
  }

  const addAddress = async (addressData) => {
    try {
      const { success, data, error } = await authService.addAddress(addressData)
      if (success && data) {
        setProfile(data)
        setUser(data)
        return { success: true, data }
      } else {
        return { success: false, error }
      }
    } catch (error) {
      logger.error('AuthContext - Add address error:', error)
      return { success: false, error: error.message }
    }
  }

  const updateAddress = async (addressId, updates) => {
    try {
      const { success, data, error } = await authService.updateAddress(addressId, updates)
      if (success && data) {
        setProfile(data)
        setUser(data)
        return { success: true, data }
      } else {
        return { success: false, error }
      }
    } catch (error) {
      logger.error('AuthContext - Update address error:', error)
      return { success: false, error: error.message }
    }
  }

  const deleteAddress = async (addressId) => {
    try {
      const { success, error } = await authService.deleteAddress(addressId)
      if (success) {
        if (user) {
          fetchProfile(user.id)
        }
        return { success: true }
      } else {
        return { success: false, error }
      }
    } catch (error) {
      logger.error('AuthContext - Delete address error:', error)
      return { success: false, error: error.message }
    }
  }

  const setPrimaryAddress = async (addressId) => {
    try {
      const { success, data, error } = await authService.setPrimaryAddress(addressId)
      if (success && data) {
        setProfile(data)
        setUser(data)
        return { success: true, data }
      } else {
        return { success: false, error }
      }
    } catch (error) {
      logger.error('AuthContext - Set primary address error:', error)
      return { success: false, error: error.message }
    }
  }

  const setTempAddressPersistent = (address) => {
    try {
      const tempAddressData = {
        address,
        expires: Date.now() + (24 * 60 * 60 * 1000)
      }
      localStorage.setItem('mkd_temp_address', JSON.stringify(tempAddressData))
      setTempAddress(address)
      logger.debug('AuthContext - Temp address set:', address)
    } catch (error) {
      logger.error('AuthContext - Error setting temp address:', error)
    }
  }

  const getCurrentAddress = () => {
    if (selectedAddress) {
      return selectedAddress
    }

    if (profile?.addresses && profile.addresses.length > 0) {
      const primaryAddress = profile.addresses.find(addr => addr.is_primary) || profile.addresses[0]
      return primaryAddress
    }

    if (tempAddress) {
      return tempAddress
    }

    return null
  }

  const selectAddress = (address) => {
    setSelectedAddress(address)
    try {
      if (address) {
        localStorage.setItem('mkd_selected_address', JSON.stringify(address))
      } else {
        localStorage.removeItem('mkd_selected_address')
      }
      logger.debug('AuthContext - Address selected and persisted:', address)
    } catch (error) {
      logger.error('AuthContext - Error persisting selected address:', error)
    }
  }

  const getPrimaryAddress = () => {
    if (profile?.addresses && profile.addresses.length > 0) {
      return profile.addresses.find(addr => addr.is_primary) || profile.addresses[0]
    }
    return null
  }

  const value = {
    user,
    profile,
    isGuest,
    loading,
    tempAddress,
    selectedAddress,
    signUp,
    signIn,
    signOut,
    updateProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    setPrimaryAddress,
    setTempAddressPersistent,
    setTempAddress,
    getCurrentAddress,
    selectAddress,
    getPrimaryAddress
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
} 