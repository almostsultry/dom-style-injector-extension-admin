// Secure Backend Client
// Handles all communication with your secure backend service

class SecureBackendClient {
  constructor() {
    this.baseUrl = this.getBackendUrl();
    this.extensionVersion = chrome.runtime.getManifest().version;
  }
  
  getBackendUrl() {
    // Use different URLs for dev/prod
    const isDev = chrome.runtime.getManifest().version.includes('dev') ||
                  localStorage.getItem('DEV_MODE') === 'true';
    
    if (isDev) {
      return 'http://localhost:3000'; // Local development
    }
    
    // Production backend URL - this is PUBLIC, so it's OK to be here
    return 'https://api.yourdomain.com';
  }
  
  async request(endpoint, data = {}, options = {}) {
    try {
      // Get user's auth token
      const token = await this.getUserToken();
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: options.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Extension-Version': this.extensionVersion,
          'X-Request-ID': crypto.randomUUID(),
          ...options.headers
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Request failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Backend request failed for ${endpoint}:`, error);
      throw error;
    }
  }
  
  async getUserToken() {
    // Get token from current session
    const result = await chrome.runtime.sendMessage({ 
      action: 'get-cached-token' 
    });
    
    if (!result.success || !result.token) {
      throw new Error('No valid authentication token');
    }
    
    return result.token;
  }
  
  // License validation through backend
  async validateLicense(tenantId) {
    const response = await this.request('/api/license/validate', {
      tenantId
    });
    
    return response;
  }
  
  // Exchange token for different resource
  async exchangeToken(resource) {
    const response = await this.request('/api/auth/exchange', {
      resource
    });
    
    return response;
  }
  
  // Sync customizations through backend
  async syncCustomizations(customizations, tenantId) {
    const response = await this.request('/api/sync/customizations', {
      customizations,
      tenantId
    });
    
    return response;
  }
  
  // Audit logging
  async logAuditEvent(action, details) {
    try {
      await this.request('/api/audit/log', {
        action,
        details
      });
    } catch (error) {
      // Don't fail operations if audit logging fails
      console.error('Audit logging failed:', error);
    }
  }
  
  // Health check
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return await response.json();
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SecureBackendClient;
} else {
  window.SecureBackendClient = SecureBackendClient;
}