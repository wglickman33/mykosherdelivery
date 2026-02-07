export const TAX_RATE = 0.0825;
export const DEFAULT_DELIVERY_FEE = 5.99;

export const NH_CONFIG = {
  DEADLINE: {
    DAY: 'Sunday',
    HOUR: 12,
    MINUTE: 0,
    TIMEZONE: 'America/New_York'
  },
  
  MEALS: {
    TYPES: ['breakfast', 'lunch', 'dinner'],
    DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    MAX_ITEMS_PER_MEAL: 10,
    MAX_MEALS_PER_WEEK: 21,
    MIN_ITEMS_PER_MEAL: 1
  },
  
  BAGEL_TYPES: ['Plain', 'Sesame', 'Everything', 'Whole Wheat', 'Poppy Seed', 'Onion'],
  
  STATUSES: {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    PAID: 'paid',
    CONFIRMED: 'confirmed',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },
  
  PAYMENT_STATUSES: {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  },
  
  BILLING: {
    FREQUENCY: ['weekly', 'monthly'],
    TAX_RATE: TAX_RATE
  }
};

export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  RESTAURANT_OWNER: 'restaurant_owner',
  NURSING_HOME_ADMIN: 'nursing_home_admin',
  NURSING_HOME_USER: 'nursing_home_user'
};

/** Singular labels for badges and dropdowns. Use everywhere for consistency. */
export const ROLE_LABELS = {
  [USER_ROLES.USER]: 'User',
  [USER_ROLES.ADMIN]: 'Admin',
  [USER_ROLES.RESTAURANT_OWNER]: 'Restaurant Owner',
  [USER_ROLES.NURSING_HOME_ADMIN]: 'Nursing Home Admin',
  [USER_ROLES.NURSING_HOME_USER]: 'Nursing Home User'
};

export const ROLE_COLORS = {
  [USER_ROLES.USER]: 'green',
  [USER_ROLES.ADMIN]: 'red',
  [USER_ROLES.RESTAURANT_OWNER]: 'blue',
  [USER_ROLES.NURSING_HOME_ADMIN]: 'pink',
  [USER_ROLES.NURSING_HOME_USER]: 'purple'
};

export const ORDER_CONFIG = {
  STATUSES: ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'],
  PAYMENT_METHODS: ['card', 'cash', 'invoice'],
  MIN_ORDER_AMOUNT: 0,
  MAX_ORDER_AMOUNT: 999999
};

export const VALIDATION_LIMITS = {
  ADDRESS: {
    STREET_MIN: 1,
    STREET_MAX: 200,
    CITY_MIN: 1,
    CITY_MAX: 100,
    STATE_LENGTH: 2,
    ZIP_CODE_LENGTH: 5,
    APARTMENT_MAX: 20,
    DELIVERY_INSTRUCTIONS_MAX: 1000
  },
  CONTACT: {
    NAME_MIN: 1,
    NAME_MAX: 100,
    EMAIL_MAX: 255,
    PHONE_MIN: 10,
    PHONE_MAX: 15
  },
  ORDER: {
    NOTES_MAX: 1000,
    ITEMS_MIN: 1,
    ITEMS_MAX: 100
  },
  RESIDENT: {
    NAME_MIN: 1,
    NAME_MAX: 200,
    ROOM_NUMBER_MAX: 20,
    DIETARY_RESTRICTIONS_MAX: 500,
    ALLERGIES_MAX: 500,
    NOTES_MAX: 1000
  }
};

export const API_CONFIG = {
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

export const DATE_FORMATS = {
  DISPLAY: 'MMM DD, YYYY',
  DISPLAY_WITH_TIME: 'MMM DD, YYYY h:mm A',
  ISO: 'YYYY-MM-DD',
  TIME: 'h:mm A'
};

export const STRIPE_CONFIG = {
  PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  CURRENCY: 'usd',
  COUNTRY: 'US'
};

export const FEATURES = {
  NURSING_HOMES: true,
  GIFT_CARDS: true,
  LOYALTY_PROGRAM: false,
  CATERING: false
};

export default {
  TAX_RATE,
  DEFAULT_DELIVERY_FEE,
  NH_CONFIG,
  USER_ROLES,
  ROLE_COLORS,
  ORDER_CONFIG,
  VALIDATION_LIMITS,
  API_CONFIG,
  PAGINATION,
  DATE_FORMATS,
  STRIPE_CONFIG,
  FEATURES
};
