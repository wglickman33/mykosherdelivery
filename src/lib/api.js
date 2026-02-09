import logger from "../utils/logger";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = this.getStoredToken();
    this.requestCount = 0;
  }

  getStoredToken() {
    try {
      return localStorage.getItem("mkd-auth-token");
    } catch (error) {
      logger.error("Error accessing localStorage for token:", error);
      return null;
    }
  }

  setToken(token) {
    try {
      this.token = token;
      if (token) {
        localStorage.setItem("mkd-auth-token", token);
        logger.debug("Auth token stored successfully");
      } else {
        localStorage.removeItem("mkd-auth-token");
        logger.debug("Auth token removed");
      }
    } catch (error) {
      logger.error("Error storing token:", error);
    }
  }

  getToken() {
    return this.token || this.getStoredToken();
  }

  validateConfig() {
    if (!this.baseURL || this.baseURL.includes("placeholder")) {
      logger.warn("API base URL not properly configured");
      return false;
    }
    return true;
  }

  async request(endpoint, options = {}) {
    const requestId = ++this.requestCount;
    const startTime = performance.now();
    const url = `${this.baseURL}${endpoint}`;

    if (!this.validateConfig()) {
      throw new Error(
        "API client not properly configured. Please check environment variables."
      );
    }

    const token = this.getToken();

    const config = {
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId.toString(),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      logger.debug(`API Request [${requestId}]`, {
        method: config.method || "GET",
        url: endpoint,
        hasAuth: !!token,
      });

      const response = await fetch(url, config);
      const duration = Math.round(performance.now() - startTime);

      logger.api(config.method || "GET", endpoint, response.status, duration);

      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        const hadToken = !!token;
        if (
          hadToken &&
          (errorData.error === "Token expired" ||
            errorData.error === "Invalid token" ||
            errorData.error === "Token revoked")
        ) {
          logger.warn("Token invalid for this server - clearing (e.g. switched API URL)", errorData);
          this.setToken(null);
          try {
            window.dispatchEvent(new CustomEvent("mkd-auth-invalid"));
          } catch (e) {
            logger.debug("mkd-auth-invalid dispatch", e);
          }
        } else if (hadToken) {
          this.setToken(null);
          try {
            window.dispatchEvent(new CustomEvent("mkd-auth-invalid"));
          } catch (e) {
            logger.debug("mkd-auth-invalid dispatch", e);
          }
        }
        throw new Error(errorData.message || "Authentication required. Please sign in again.");
      }

      if (response.status === 403) {
        logger.warn("Access forbidden for current user");
        throw new Error("You do not have permission to access this resource.");
      }

      if (response.status === 404) {
        logger.warn(`Resource not found: ${endpoint}`);
        throw new Error("The requested resource was not found.");
      }

      if (response.status === 429) {
        logger.warn("Rate limit exceeded");
        throw new Error("Too many requests. Please try again later.");
      }

      if (response.status >= 500) {
        logger.error(`Server error: ${response.status}`);
        let errorMessage = "Server error. Please try again later.";
        let serverErrorName, serverStack;
        try {
          const errorData = await response.json();
          serverErrorName = errorData.serverErrorName;
          serverStack = errorData.serverStack;
          errorMessage =
            errorData.message ||
            errorData.error ||
            errorData.details?.message ||
            errorData.originalMessage ||
            errorMessage;
          logger.error("Server error details:", {
            message: errorMessage,
            serverErrorName,
            serverStack: serverStack ? serverStack.split("\n").slice(0, 3) : undefined,
            fullError: errorData,
          });
        } catch (jsonError) {
          logger.error("Failed to parse error response:", jsonError);
        }
        const err = new Error(errorMessage);
        if (serverErrorName) err.serverErrorName = serverErrorName;
        if (serverStack) err.serverStack = serverStack;
        throw err;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message ||
          `HTTP ${response.status}: ${response.statusText}`;
        logger.error(`API Error [${requestId}]`, {
          status: response.status,
          message: errorMessage,
        });
        throw new Error(errorMessage);
      }

      if (response.status === 204) {
        return null;
      }

      const data = await response.json();
      logger.debug(`API Success [${requestId}]`, {
        status: response.status,
        duration,
      });

      return data;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);

      if (error.name === "TypeError" && error.message.includes("fetch")) {
        logger.error(`Network error [${requestId}]`, {
          endpoint,
          duration,
          error: error.message,
        });
        throw new Error(
          "Network error. Please check your internet connection."
        );
      }

      logger.error(`API Request failed [${requestId}]`, {
        endpoint,
        duration,
        error: error.message,
      });
      throw error;
    }
  }

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: "GET" });
  }

  async getBlob(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString ? `${endpoint}?${queryString}` : endpoint;
    const url = `${this.baseURL}${path}`;
    if (!this.validateConfig()) {
      throw new Error("API client not properly configured. Please check environment variables.");
    }
    const token = this.getToken();
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
    }
    return response.blob();
  }

  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }

  async healthCheck() {
    try {
      const response = await this.get("/health");
      logger.info("API health check passed", response);
      return response;
    } catch (error) {
      logger.error("API health check failed", error);
      throw error;
    }
  }

  async validatePromoCode(code) {
    try {
      const response = await this.post('/promo-codes/validate', { code });
      logger.info("Promo code validated successfully", { code, response });
      return response;
    } catch (error) {
      logger.error("Promo code validation failed", { code, error });
      throw error;
    }
  }

  async calculatePromoDiscount(code, subtotal) {
    try {
      const response = await this.post('/promo-codes/calculate-discount', { code, subtotal });
      logger.info("Promo discount calculated successfully", { code, subtotal, response });
      return response;
    } catch (error) {
      logger.error("Promo discount calculation failed", { code, subtotal, error });
      throw error;
    }
  }

  async validateGiftCard(code) {
    const response = await this.post('/gift-cards/validate', { code: code.trim() });
    return response;
  }

  async getMyGiftCards() {
    const response = await this.get('/gift-cards/mine');
    return response;
  }
}

const apiClient = new ApiClient();

logger.debug("API Client initialized", {
  baseURL: API_BASE_URL,
  hasToken: !!apiClient.getToken(),
  configValid: apiClient.validateConfig(),
});

export default apiClient;
export { API_BASE_URL };
