/**
 * Auth Module
 *
 * Provides customer authentication via OTP (one-time password).
 * Handles sessions and customer data.
 */

export class AuthModule {
  constructor(client) {
    this.client = client;
    this._customer = null;
    this._accessToken = null;
    this._refreshToken = null;
    // Cookie-mode state. When the backend's STOREFRONT_COOKIE_AUTH flag is
    // on the login/verify/set-password responses include a `csrf` field
    // and omit `access_token`. We flip into cookie mode the first time we
    // see that shape, stash the CSRF token in memory only (never
    // localStorage) and let the cookie carry the JWT itself.
    this._cookieMode = false;
    this._csrfToken = null;
  }

  /**
   * Whether the client is currently in cookie-auth mode (httpOnly session
   * cookie set by backend, CSRF double-submit). Detected from login
   * response shape — true if the server returned a `csrf` field.
   * @returns {boolean}
   */
  get cookieMode() {
    return this._cookieMode;
  }

  /**
   * Current CSRF token, if any. Surfaced for advanced clients that need to
   * forward it onto their own fetches outside the SDK. The SDK itself
   * attaches it automatically on non-GET requests when in cookie mode.
   * @returns {string|null}
   */
  get csrfToken() {
    return this._csrfToken;
  }

  /**
   * Apply login/verify/set-password response shape. Centralises the
   * decision between header-token mode (legacy) and cookie mode (when the
   * server returned a `csrf` field).
   * @private
   */
  _ingestAuthResponse(response) {
    if (response && response.csrf) {
      // Cookie mode — JWT lives in the httpOnly cookie the server set.
      // Don't store it locally; that's the whole point.
      this._cookieMode = true;
      this._csrfToken = response.csrf;
      this._accessToken = null;
      this._refreshToken = null;
    } else if (response) {
      // Legacy header mode — keep tokens in memory exactly as before.
      if (response.access_token) this._accessToken = response.access_token;
      if (response.refresh_token) this._refreshToken = response.refresh_token;
    }
    if (response && response.customer) {
      this._customer = response.customer;
    }
  }

  /**
   * Get current customer (local state)
   * @returns {Object|null}
   */
  get customer() {
    return this._customer;
  }

  /**
   * Get current access token
   * @returns {string|null}
   */
  get token() {
    return this._accessToken;
  }

  /**
   * Get current refresh token
   * @returns {string|null}
   */
  get refreshToken() {
    return this._refreshToken;
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  get isAuthenticated() {
    if (this._cookieMode) {
      // Source of truth in cookie mode is the httpOnly cookie which JS
      // can't see. We treat the in-memory CSRF + customer as the proxy.
      return !!this._csrfToken && !!this._customer;
    }
    return !!this._accessToken && !!this._customer;
  }

  /**
   * Set auth token (for restoring session). No-op when in cookie mode —
   * tokens aren't stored client-side at all in that path.
   * @param {string} token - Access token
   * @param {string} [refreshToken] - Refresh token
   */
  setToken(token, refreshToken) {
    if (this._cookieMode) return;
    this._accessToken = token;
    if (refreshToken) {
      this._refreshToken = refreshToken;
    }
  }

  /**
   * Refresh the access token using the stored refresh token
   * @returns {Promise<{access_token: string, token_type: string, expires_in: number}>}
   */
  async refreshAccessToken() {
    // Cookie mode: the server reads the refresh token off the hd_refresh
    // cookie and sets new cookies on the response. Body is empty.
    if (this._cookieMode) {
      const url = `${this.client.baseURL}/api/storefront/auth/refresh`;
      const response = await this.client._fetch(url, {
        method: "POST",
        body: JSON.stringify({}),
      });
      this._ingestAuthResponse(response);
      return response;
    }

    if (!this._refreshToken) {
      throw new Error("No refresh token available");
    }

    const url = `${this.client.baseURL}/api/storefront/auth/refresh`;
    const response = await this.client._fetch(url, {
      method: "POST",
      body: JSON.stringify({ refresh_token: this._refreshToken }),
    });

    this._accessToken = response.access_token;
    // Refresh-token rotation (server may issue a fresh refresh token on
    // every refresh). Adopt it if present so the next refresh uses the
    // current row and the old one is burned server-side.
    if (response.refresh_token) {
      this._refreshToken = response.refresh_token;
    }
    return response;
  }

  /**
   * Request OTP code for authentication
   * @param {string} email - Customer email
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.accepts_marketing] - Marketing consent
   * @returns {Promise<{message: string, email: string}>}
   */
  async requestOTP(email, options = {}) {
    if (!email) {
      throw new Error("email is required");
    }

    const body = { email };
    if (options.accepts_marketing !== undefined) {
      body.accepts_marketing = options.accepts_marketing;
    }
    if (options.captcha_token) {
      body.captcha_token = options.captcha_token;
    }

    const url = `${this.client.baseURL}/api/storefront/auth/request-otp`;
    return this.client._fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Verify OTP code and authenticate
   * @param {Object} options - Verification options
   * @param {string} options.email - Customer email
   * @param {string} options.code - OTP code
   * @returns {Promise<{access_token: string, refresh_token: string, customer: Object}>}
   */
  async verifyOTP(options) {
    const { email, code } = options;

    if (!email || !code) {
      throw new Error("email and code are required");
    }

    const url = `${this.client.baseURL}/api/storefront/auth/verify-otp`;
    const response = await this.client._fetch(url, {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });

    // Update local state — handles both cookie mode (csrf field present)
    // and legacy header mode (access_token / refresh_token in body).
    this._ingestAuthResponse(response);

    return response;
  }

  /**
   * Login with email and password
   * @param {Object} options
   * @param {string} options.email - Customer email
   * @param {string} options.password - Customer password
   * @returns {Promise<{access_token: string, refresh_token: string, customer: Object}>}
   */
  async login(options) {
    const { email, password, captcha_token } = options;

    if (!email || !password) {
      throw new Error("email and password are required");
    }

    const body = { email, password };
    if (captcha_token) body.captcha_token = captcha_token;

    const url = `${this.client.baseURL}/api/storefront/auth/login`;
    const response = await this.client._fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
    });

    this._ingestAuthResponse(response);

    return response;
  }

  /**
   * Set a password for the authenticated customer
   * @param {string} password - New password (min 8 characters)
   * @returns {Promise<{message: string, customer: Object}>}
   */
  async setPassword(password) {
    if (!this.isAuthenticated && !this._accessToken) {
      throw new Error("Not authenticated");
    }

    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const url = `${this.client.baseURL}/api/storefront/auth/set-password`;
    const headers = {};
    if (!this._cookieMode && this._accessToken) {
      headers.Authorization = `Bearer ${this._accessToken}`;
    }
    const response = await this.client._fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ password }),
    });

    // In cookie mode the server may rotate the CSRF token here; ingest so
    // the SDK's in-memory copy stays in sync.
    this._ingestAuthResponse(response);

    return response;
  }

  /**
   * Request a password reset code
   * @param {string} email - Customer email
   * @returns {Promise<{message: string}>}
   */
  async requestPasswordReset(email) {
    if (!email) {
      throw new Error("email is required");
    }

    const url = `${this.client.baseURL}/api/storefront/auth/forgot-password`;
    return this.client._fetch(url, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  /**
   * Reset password using OTP code
   * @param {Object} options
   * @param {string} options.email - Customer email
   * @param {string} options.code - OTP code
   * @param {string} options.password - New password (min 8 characters)
   * @returns {Promise<{message: string}>}
   */
  async resetPassword(options) {
    const { email, code, password } = options;

    if (!email || !code || !password) {
      throw new Error("email, code, and password are required");
    }

    const url = `${this.client.baseURL}/api/storefront/auth/reset-password`;
    return this.client._fetch(url, {
      method: "POST",
      body: JSON.stringify({ email, code, password }),
    });
  }

  /**
   * Get current customer profile
   * Requires authentication
   * @returns {Promise<{customer: Object}>}
   */
  async getProfile() {
    if (!this._accessToken) {
      throw new Error("Not authenticated");
    }

    const url = `${this.client.baseURL}/api/storefront/auth/me`;
    const response = await this.client._fetch(url, {
      headers: {
        Authorization: `Bearer ${this._accessToken}`,
      },
    });

    this._customer = response.customer;
    return response;
  }

  /**
   * Update customer profile
   * Backend expects snake_case fields:
   * - first_name, last_name, phone
   * - address_line1, address_line2, city, state, zip_code, country
   * - accepts_marketing
   * @param {Object} data - Profile data to update (snake_case format)
   * @returns {Promise<{customer: Object}>}
   */
  async updateProfile(data) {
    if (!this._accessToken) {
      throw new Error("Not authenticated");
    }

    const url = `${this.client.baseURL}/api/storefront/auth/me`;
    const response = await this.client._fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this._accessToken}`,
      },
      // Pass through data as-is - backend expects snake_case
      body: JSON.stringify(data),
    });

    this._customer = response.customer;
    return response;
  }

  /**
   * Logout - clear local state
   * @returns {Promise<void>}
   */
  async logout() {
    const wasAuthed = this._cookieMode || !!this._accessToken;
    if (wasAuthed) {
      try {
        const url = `${this.client.baseURL}/api/storefront/auth/logout`;
        const headers = {};
        if (!this._cookieMode && this._accessToken) {
          headers.Authorization = `Bearer ${this._accessToken}`;
        }
        await this.client._fetch(url, {
          method: "POST",
          headers,
        });
      } catch (e) {
        // Ignore logout errors
      }
    }

    this._customer = null;
    this._accessToken = null;
    this._refreshToken = null;
    this._cookieMode = false;
    this._csrfToken = null;
  }

  /**
   * Update customer metadata (key-value pairs)
   * Merges with existing metadata. Set a key to null to remove it.
   * @param {Object} metadata - Key-value pairs to merge
   * @returns {Promise<{customer: Object}>}
   *
   * @example
   * await dash.auth.updateMetadata({ preferred_color: "blue", loyalty_tier: "gold" });
   * // Remove a key:
   * await dash.auth.updateMetadata({ preferred_color: null });
   */
  async updateMetadata(metadata) {
    if (!this._accessToken) {
      throw new Error("Not authenticated");
    }

    return this.updateProfile({ metadata });
  }

  /**
   * Get customer's order history
   * @param {Object} [options] - Pagination options
   * @param {number} [options.limit=20] - Number of orders per page
   * @param {number} [options.offset=0] - Pagination offset
   * @returns {Promise<{orders: Object[], pagination: Object}>}
   */
  async getOrders(options = {}) {
    if (!this._accessToken) {
      throw new Error("Not authenticated");
    }

    const params = new URLSearchParams();
    if (options.limit) params.append("limit", options.limit);
    if (options.offset) params.append("offset", options.offset);

    const qs = params.toString();
    const url = `${this.client.baseURL}/api/storefront/auth/orders${qs ? `?${qs}` : ""}`;
    return this.client._fetch(url, {
      headers: {
        Authorization: `Bearer ${this._accessToken}`,
      },
    });
  }

  /**
   * Get a single order by ID
   * @param {string} orderId - Order ID
   * @returns {Promise<{order: Object}>}
   */
  async getOrder(orderId) {
    if (!this._accessToken) {
      throw new Error("Not authenticated");
    }

    const url = `${this.client.baseURL}/api/storefront/auth/orders/${orderId}`;
    return this.client._fetch(url, {
      headers: {
        Authorization: `Bearer ${this._accessToken}`,
      },
    });
  }

  /**
   * Check if current IP/session is banned
   * @returns {Promise<{banned: boolean, reason?: string}>}
   */
  async checkBan() {
    const url = `${this.client.baseURL}/api/storefront/auth/check-ban`;
    const headers = {};
    if (this._accessToken) {
      headers.Authorization = `Bearer ${this._accessToken}`;
    }
    return this.client._fetch(url, { headers });
  }

  /**
   * Associate a guest cart with authenticated customer
   * @param {string} cartId - Guest cart ID to merge
   * @returns {Promise<{cart: Object}>}
   */
  async mergeCart(cartId) {
    if (!this._accessToken) {
      throw new Error("Not authenticated");
    }

    const url = `${this.client.baseURL}/api/storefront/auth/merge-cart`;
    return this.client._fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this._accessToken}`,
      },
      body: JSON.stringify({ cart_id: cartId }),
    });
  }
}

export default AuthModule;
