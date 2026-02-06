// Tax and Fee Configuration
const TAX_RATE = 0.0825; // 8.25% sales tax
const DEFAULT_DELIVERY_FEE = 5.99;

// Nursing Home Configuration
const NH_CONFIG = {
  // Order deadline configuration
  DEADLINE: {
    DAY: 'Sunday',
    HOUR: 12,
    MINUTE: 0,
    TIMEZONE: 'America/New_York'
  },
  
  // Meal configuration
  MEALS: {
    TYPES: ['breakfast', 'lunch', 'dinner'],
    DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    MAX_ITEMS_PER_MEAL: 10,
    MAX_MEALS_PER_WEEK: 21, // 3 meals × 7 days
    MIN_ITEMS_PER_MEAL: 1
  },
  
  // Bagel types
  BAGEL_TYPES: ['Plain', 'Sesame', 'Everything', 'Whole Wheat', 'Poppy Seed', 'Onion'],
  
  // Order statuses
  STATUSES: {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    PAID: 'paid',
    CONFIRMED: 'confirmed',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },
  
  // Payment statuses
  PAYMENT_STATUSES: {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  },
  
  // Billing configuration
  BILLING: {
    FREQUENCY: ['weekly', 'monthly'],
    TAX_RATE: TAX_RATE
  }
};

// User Roles
const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  RESTAURANT_OWNER: 'restaurant_owner',
  NURSING_HOME_ADMIN: 'nursing_home_admin',
  NURSING_HOME_USER: 'nursing_home_user'
};

// Order Configuration
const ORDER_CONFIG = {
  STATUSES: ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'],
  PAYMENT_METHODS: ['card', 'cash', 'invoice'],
  MIN_ORDER_AMOUNT: 0,
  MAX_ORDER_AMOUNT: 999999,
  NUMBER_PREFIX: {
    REGULAR: 'MKD',
    NURSING_HOME_RESIDENT: 'NH-RES',
    NURSING_HOME_BULK: 'NH'
  }
};

// Validation Limits
const VALIDATION_LIMITS = {
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

// API Configuration
const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
    PAYMENT_MAX_REQUESTS: 5
  }
};

// Pagination Defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

// Stripe Configuration
const STRIPE_CONFIG = {
  CURRENCY: 'usd',
  COUNTRY: 'US'
};

module.exports = {
  TAX_RATE,
  DEFAULT_DELIVERY_FEE,
  NH_CONFIG,
  USER_ROLES,
  ORDER_CONFIG,
  VALIDATION_LIMITS,
  API_CONFIG,
  PAGINATION,
  STRIPE_CONFIG
};
