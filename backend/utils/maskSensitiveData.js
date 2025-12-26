const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'apiKey',
  'api_key',
  'apikey',
  'authorization',
  'authorization',
  'auth',
  'cookie',
  'session',
  'sessionId',
  'credit_card',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
  'social_security',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'stripe_secret',
  'stripeSecret',
  'mailchimp_api_key',
  'mailchimpApiKey',
  'shipday_api_key',
  'shipdayApiKey',
  'google_places_api_key',
  'googlePlacesApiKey'
];

const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret[_-]?key/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /authorization/i,
  /password/i,
  /bearer\s+\w+/i
];

function maskSensitiveData(data, depth = 0) {
  if (depth > 10) {
    return '[Max depth reached]';
  }

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item, depth + 1));
  }

  if (data instanceof Date) {
    return data;
  }

  const masked = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    const isSensitiveField = SENSITIVE_FIELDS.some(field => 
      lowerKey.includes(field.toLowerCase())
    );
    
    const matchesPattern = SENSITIVE_PATTERNS.some(pattern => 
      pattern.test(key)
    );
    
    if (isSensitiveField || matchesPattern) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value, depth + 1);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

module.exports = { maskSensitiveData };

