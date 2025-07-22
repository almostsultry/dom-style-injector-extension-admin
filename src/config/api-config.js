// API Configuration - Centralized configuration file
// WARNING: This file should NEVER contain actual API keys in production
// See SECURITY.md for proper key management

const API_CONFIG = {
  // Public configuration (safe for client)
  PUBLIC: {
    // Microsoft endpoints (no secrets needed for these)
    MICROSOFT_LOGIN_URL: 'https://login.microsoftonline.com',
    MICROSOFT_GRAPH_URL: 'https://graph.microsoft.com/v1.0',
    MICROSOFT_ADMIN_CENTER: 'https://admin.microsoft.com',
    
    // OAuth settings (public client flow - no secret needed)
    // This uses the "public client" flow which doesn't require a secret
    OAUTH: {
      CLIENT_ID: 'YOUR_PUBLIC_CLIENT_ID', // This is public, safe to be in code
      TENANT_ID: 'common', // or your specific tenant
      REDIRECT_URI: chrome?.identity?.getRedirectURL() || 'https://localhost/callback',
      SCOPES: [
        'User.Read',
        'offline_access', // For refresh tokens
        'openid',
        'profile'
      ]
    },
    
    // Extension metadata (public)
    EXTENSION: {
      PUBLISHER_ID: 'YOUR_PUBLISHER_ID', // From Partner Center
      PRODUCT_ID: 'dom-style-injector',
      VERSION: chrome?.runtime?.getManifest()?.version || '1.0.0'
    }
  },
  
  // Server endpoints (your backend services)
  // These handle sensitive operations without exposing keys
  BACKEND: {
    // Your secure backend API that handles sensitive operations
    // This URL is public, but the backend requires authentication
    BASE_URL: 'https://api.yourdomain.com', // Change to your actual backend URL
    
    // Endpoints that your backend exposes
    ENDPOINTS: {
      // License validation through your backend
      VALIDATE_LICENSE: '/api/license/validate',
      ASSIGN_LICENSE: '/api/license/assign',
      CHECK_TENANT: '/api/license/tenant',
      
      // Secure token exchange
      EXCHANGE_TOKEN: '/api/auth/exchange',
      REFRESH_TOKEN: '/api/auth/refresh',
      
      // Audit and logging
      AUDIT_LOG: '/api/audit/log',
      
      // Secure storage operations
      SYNC_CUSTOMIZATIONS: '/api/sync/customizations',
      BACKUP_DATA: '/api/sync/backup'
    }
  },
  
  // Development configuration
  DEVELOPMENT: {
    USE_MOCK_BACKEND: true,
    MOCK_RESPONSES: true,
    BYPASS_AUTH: false,
    LOG_LEVEL: 'debug'
  }
};

// Helper to get config based on environment
function getConfig() {
  const isDevelopment = chrome?.runtime?.getManifest()?.version?.includes('dev') || 
                       localStorage.getItem('DEV_MODE') === 'true';
  
  if (isDevelopment && API_CONFIG.DEVELOPMENT.USE_MOCK_BACKEND) {
    // Return development config with mock endpoints
    return {
      ...API_CONFIG,
      BACKEND: {
        BASE_URL: 'http://localhost:3000',
        ENDPOINTS: API_CONFIG.BACKEND.ENDPOINTS
      }
    };
  }
  
  return API_CONFIG;
}

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_CONFIG, getConfig };
} else {
  window.API_CONFIG = API_CONFIG;
  window.getConfig = getConfig;
}