class Logger {
  constructor() {
    this.isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV;
    this.isProduction = import.meta.env.MODE === 'production' || import.meta.env.PROD;
  }

  debug(message, data = null) {
    if (this.isDevelopment) {
      console.log(`🔍 [DEBUG] ${message}`, data || '');
    }
  }

  info(message, data = null) {
    if (this.isDevelopment) {
      console.info(`ℹ️ [INFO] ${message}`, data || '');
    }
  }

  warn(message, data = null) {
    if (this.isDevelopment) {
      console.warn(`⚠️ [WARN] ${message}`, data || '');
    }
    if (this.isProduction) {
      this.sendToMonitoring('warn', message, data);
    }
  }

  error(message, error = null, data = null) {
    const errorMessage = `❌ [ERROR] ${message}`;
    
    if (this.isDevelopment) {
      console.error(errorMessage, error || '', data || '');
    }
    
    if (this.isProduction) {
      this.sendToMonitoring('error', message, { error, data });
    }
  }

  success(message, data = null) {
    if (this.isDevelopment) {
      console.log(`✅ [SUCCESS] ${message}`, data || '');
    }
  }

  api(method, url, status, duration = null) {
    if (this.isDevelopment) {
      const durationText = duration ? ` (${duration}ms)` : '';
      console.log(`🌐 [API] ${method.toUpperCase()} ${url} - ${status}${durationText}`);
    }
  }

  userAction(action, data = null) {
    if (this.isDevelopment) {
      console.log(`👤 [USER] ${action}`, data || '');
    }
    if (this.isProduction) {
      this.sendToAnalytics(action, data);
    }
  }

  sendToMonitoring(level, message, data) {
    
    void level;
    void message;
    void data;
  }

  sendToAnalytics(action, data) {
    
    void action;
    void data;
  }
}

const logger = new Logger();

export default logger;