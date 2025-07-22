// Development configuration for DOM Style Injector Extension
// This file contains all development/test configurations to enable local development
// without requiring actual Microsoft 365 licenses or API keys

const DEV_CONFIG = {
  // Enable development mode
  ENABLE_DEV_MODE: true,
  
  // Mock API responses
  MOCK_API_RESPONSES: {
    // Mock license validation
    LICENSE_VALIDATION: {
      enabled: true,
      mockValidLicense: true, // Set to false to test unlicensed behavior
      mockLicenseType: 'PREMIUM', // BASIC, STANDARD, PREMIUM
      mockTenantId: 'dev-tenant-12345',
      mockUserId: 'dev-user-67890'
    },
    
    // Mock Microsoft Graph API
    MICROSOFT_GRAPH: {
      enabled: true,
      mockUserInfo: {
        displayName: 'Dev User',
        userPrincipalName: 'devuser@devtenant.onmicrosoft.com',
        id: 'dev-user-67890',
        mail: 'devuser@devtenant.onmicrosoft.com'
      },
      mockOrganization: {
        id: 'dev-tenant-12345',
        displayName: 'Development Organization',
        verifiedDomains: [
          { name: 'devtenant.onmicrosoft.com', isDefault: true }
        ]
      }
    },
    
    // Mock Dataverse API
    DATAVERSE: {
      enabled: true,
      mockOrgUrl: 'https://devorg.crm.dynamics.com',
      mockCustomizations: [
        {
          id: 'mock-cust-1',
          name: 'Mock Button Style',
          selector: '.btn-primary',
          css: 'background: #667eea; color: white;',
          enabled: true,
          targetUrl: '*',
          priority: 1,
          category: 'buttons',
          created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          modified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'mock-cust-2',
          name: 'Mock Form Style',
          selector: '.form-control',
          css: 'border: 2px solid #667eea;',
          enabled: true,
          targetUrl: '*/forms/*',
          priority: 2,
          category: 'forms',
          created: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          modified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    },
    
    // Mock SharePoint API
    SHAREPOINT: {
      enabled: true,
      mockSiteUrl: 'https://devtenant.sharepoint.com/sites/DOMStyleInjector',
      mockListId: 'mock-list-12345',
      mockDocumentLibraryId: 'mock-doclib-67890'
    }
  },
  
  // Development API Keys (for testing)
  API_KEYS: {
    // These are dummy keys for development only
    MICROSOFT_CLIENT_ID: 'dev-client-id-12345',
    MICROSOFT_CLIENT_SECRET: 'dev-client-secret-67890',
    PUBLISHER_ID: 'DEV_PUBLISHER_ID',
    LICENSE_SERVICE_PLAN_ID: 'DEV_SERVICE_PLAN_ID',
    LICENSE_SKU_ID: 'DEV_SKU_ID'
  },
  
  // Feature flags for development
  FEATURES: {
    SKIP_AUTH: false, // Skip authentication in dev mode
    BYPASS_PERMISSIONS: false, // Bypass permission checks
    VERBOSE_LOGGING: true, // Enable detailed console logging
    SHOW_DEV_TOOLS: true, // Show development tools in UI
    MOCK_SYNC_DELAY: 1000, // Simulate network delay (ms)
    AUTO_GRANT_ADMIN: true // Automatically grant admin role in dev mode
  },
  
  // Development endpoints
  ENDPOINTS: {
    // Local development server endpoints (if you set up a mock server)
    MOCK_AUTH_SERVER: 'http://localhost:3000/auth',
    MOCK_LICENSE_SERVER: 'http://localhost:3000/license',
    MOCK_DATAVERSE_SERVER: 'http://localhost:3000/dataverse',
    MOCK_SHAREPOINT_SERVER: 'http://localhost:3000/sharepoint'
  }
};

// Helper function to check if we're in development mode
function isDevelopmentMode() {
  // Multiple ways to enable dev mode:
  // 1. Check manifest version
  const manifest = chrome.runtime.getManifest();
  if (manifest.version.includes('dev') || manifest.version.includes('beta')) {
    return true;
  }
  
  // 2. Check extension ID (unpacked extensions have specific pattern)
  if (!chrome.runtime.id || chrome.runtime.id.length !== 32) {
    return true;
  }
  
  // 3. Check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('dev') === 'true') {
    return true;
  }
  
  // 4. Check localStorage flag
  if (localStorage.getItem('DEV_MODE') === 'true') {
    return true;
  }
  
  // 5. Check if running on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return true;
  }
  
  return false;
}

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEV_CONFIG, isDevelopmentMode };
} else {
  window.DEV_CONFIG = DEV_CONFIG;
  window.isDevelopmentMode = isDevelopmentMode;
}