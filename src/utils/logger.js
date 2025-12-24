// Production-safe logging utility
class Logger {
  constructor() {
    // eslint-disable-next-line no-undef
    this.isDevelopment = process.env.NODE_ENV === 'development';
    // eslint-disable-next-line no-undef
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  // Development-only logging
  debug(message, data = null) {
    if (this.isDevelopment) {
      console.log(`🔍 [DEBUG] ${message}`, data || '');
    }
  }

  // Information logging (allowed in production)
  info(message, data = null) {
    if (this.isDevelopment) {
      console.info(`ℹ️ [INFO] ${message}`, data || '');
    }
    // In production, you would send this to a logging service
    // Example: this.sendToLoggingService('info', message, data);
  }

  // Warning logging
  warn(message, data = null) {
    if (this.isDevelopment) {
      console.warn(`⚠️ [WARN] ${message}`, data || '');
    }
    // Always log warnings in production to monitoring service
    if (this.isProduction) {
      this.sendToMonitoring('warn', message, data);
    }
  }

  // Error logging (always logged)
  error(message, error = null, data = null) {
    const errorMessage = `❌ [ERROR] ${message}`;
    
    if (this.isDevelopment) {
      console.error(errorMessage, error || '', data || '');
    }
    
    // Always log errors in production
    if (this.isProduction) {
      this.sendToMonitoring('error', message, { error, data });
    }
  }

  // Success logging
  success(message, data = null) {
    if (this.isDevelopment) {
      console.log(`✅ [SUCCESS] ${message}`, data || '');
    }
  }

  // API call logging
  api(method, url, status, duration = null) {
    if (this.isDevelopment) {
      const durationText = duration ? ` (${duration}ms)` : '';
      console.log(`🌐 [API] ${method.toUpperCase()} ${url} - ${status}${durationText}`);
    }
  }

  // User action logging
  userAction(action, data = null) {
    if (this.isDevelopment) {
      console.log(`👤 [USER] ${action}`, data || '');
    }
    // In production, send to analytics
    if (this.isProduction) {
      this.sendToAnalytics(action, data);
    }
  }

  // Send to monitoring service (placeholder for production)
  sendToMonitoring(level, message, data) {
    // In production, implement actual monitoring service integration
    // Examples: Sentry, DataDog, LogRocket, etc.
    // Sentry.captureMessage(message, level, { extra: data });
    
    // Suppress linter warnings for unused parameters in placeholder methods
    void level;
    void message;
    void data;
  }

  // Send to analytics service (placeholder for production)
  sendToAnalytics(action, data) {
    // In production, implement actual analytics integration
    // Examples: Google Analytics, Mixpanel, Amplitude, etc.
    // gtag('event', action, data);
    
    // Suppress linter warnings for unused parameters in placeholder methods
    void action;
    void data;
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;