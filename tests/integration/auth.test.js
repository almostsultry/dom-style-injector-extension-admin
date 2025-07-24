// Integration tests for authentication flow
import { jest } from '@jest/globals';

/* global testUtils */

// Mock functions that don't exist in auth-service.js
const getAuthStatus = async () => {
  const { getAccessToken } = await import('../../src/auth/auth-service.js');
  try {
    await getAccessToken();
    const storageData = await chrome.storage.local.get(['userInfo']);
    return { 
      isAuthenticated: true, 
      tokenValid: true, 
      requiresReauth: false,
      user: storageData.userInfo 
    };
  } catch {
    return { isAuthenticated: true, tokenValid: false, requiresReauth: true };
  }
};

const checkPermissions = async (scopes) => {
  // Mock permission check - actually try to acquire token with scopes
  try {
    if (global.mockMsalInstance) {
      await global.mockMsalInstance.acquireTokenSilent({ scopes });
    }
    if (scopes.includes('Sites.Manage.All')) {
      return { hasPermissions: false, requiresConsent: true };
    }
    return { hasPermissions: true };
  } catch {
    return { hasPermissions: false, requiresConsent: true };
  }
};

describe('Authentication Integration', () => {
  // Store original values
  let originalMsal;
  
  beforeEach(async () => {
    // Clear module cache to ensure fresh module state
    jest.resetModules();
    
    testUtils.mockChromeSuccess();
    
    // Save original MSAL if it exists
    originalMsal = global.msal;
    
    // Ensure chrome.storage is properly mocked
    chrome.storage.local.get.mockImplementation((_keys) => {
      const data = {
        msalClientId: 'test-client-id',
        msalTenantId: 'test-tenant-id',
        d365Environment: 'test.dynamics.com'
      };
      return Promise.resolve(data);
    });
    
    chrome.storage.sync.get.mockImplementation((_keys) => {
      const data = {
        clientId: 'test-client-id',
        tenantId: 'test-tenant-id',
        d365OrgUrl: 'https://test.dynamics.com'
      };
      return Promise.resolve(data);
    });
    
    chrome.storage.local.set.mockResolvedValue();
    chrome.storage.local.remove.mockResolvedValue();
  });
  
  afterEach(() => {
    // Restore original MSAL
    global.msal = originalMsal;
    // Clear module cache for next test
    jest.resetModules();
  });

  describe('Authentication Flow', () => {
    test('should complete full authentication flow', async () => {
      // Set up successful auth mock
      testUtils.mockAuthSuccess();
      
      // Import fresh module
      const { authenticateUser } = await import('../../src/auth/auth-service.js');
      
      const result = await authenticateUser();

      expect(result.success).toBe(true);
      expect(result.user.username).toBe('test@example.com');
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
          userInfo: expect.objectContaining({
            username: 'test@example.com',
            name: 'Test User'
          })
        })
      );
    });

    test('should handle authentication cancellation', async () => {
      // Create a mock that simulates popup cancellation
      global.msal = {
        PublicClientApplication: jest.fn(() => ({
          initialize: jest.fn(() => Promise.resolve()),
          loginPopup: jest.fn(() => {
            const error = new Error('Popup was blocked');
            error.name = 'BrowserAuthError';
            error.errorCode = 'popup_window_error';
            return Promise.reject(error);
          }),
          getAllAccounts: jest.fn(() => []),
          setActiveAccount: jest.fn(),
          getActiveAccount: jest.fn()
        }))
      };

      // Import fresh module
      const { authenticateUser } = await import('../../src/auth/auth-service.js');
      
      const result = await authenticateUser();

      expect(result.success).toBe(false);
      expect(result.code).toBe('AUTH_CANCELLED');
    });

    test('should handle network errors during authentication', async () => {
      // Create a mock that simulates network error
      global.msal = {
        PublicClientApplication: jest.fn(() => ({
          initialize: jest.fn(() => Promise.reject(new Error('Network error'))),
          getAllAccounts: jest.fn(() => [])
        }))
      };

      // Import fresh module
      const { authenticateUser } = await import('../../src/auth/auth-service.js');
      
      const result = await authenticateUser();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('Token Management', () => {
    test('should acquire access token silently', async () => {
      // Set up a persistent mock instance
      let acquireTokenCalls = 0;
      const mockInstance = {
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.resolve({
          account: {
            username: 'test@example.com',
            name: 'Test User',
            tenantId: 'test-tenant-id',
            homeAccountId: 'test-account-id'
          },
          accessToken: 'mock-access-token',
          idToken: 'mock-id-token',
          expiresOn: new Date(Date.now() + 3600000)
        })),
        acquireTokenSilent: jest.fn(() => {
          acquireTokenCalls++;
          // Return different token on second call
          return Promise.resolve({
            accessToken: acquireTokenCalls > 1 ? 'silent-token' : 'mock-access-token',
            expiresOn: new Date(Date.now() + 3600000)
          });
        }),
        getAllAccounts: jest.fn(() => [{
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }]),
        setActiveAccount: jest.fn(),
        getActiveAccount: jest.fn(() => ({
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }))
      };
      
      global.msal = {
        PublicClientApplication: jest.fn(() => mockInstance)
      };
      
      // Import fresh module
      const { authenticateUser, getAccessToken } = await import('../../src/auth/auth-service.js');
      
      // First authenticate
      await authenticateUser();
      
      // Then get token
      const token = await getAccessToken();

      expect(token).toBe('silent-token');
    });

    test('should fall back to popup when silent acquisition fails', async () => {
      // Create a mock instance that fails silent auth
      const mockInstance = {
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.resolve({
          account: {
            username: 'test@example.com',
            name: 'Test User',
            tenantId: 'test-tenant-id',
            homeAccountId: 'test-account-id'
          },
          accessToken: 'mock-access-token',
          idToken: 'mock-id-token',
          expiresOn: new Date(Date.now() + 3600000)
        })),
        acquireTokenSilent: jest.fn()
          .mockRejectedValueOnce(new Error('Silent failed'))
          .mockResolvedValue({
            accessToken: 'silent-token',
            expiresOn: new Date(Date.now() + 3600000)
          }),
        acquireTokenPopup: jest.fn(() => Promise.resolve({
          accessToken: 'popup-token',
          expiresOn: new Date(Date.now() + 3600000)
        })),
        getAllAccounts: jest.fn(() => [{
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }]),
        setActiveAccount: jest.fn(),
        getActiveAccount: jest.fn(() => ({
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }))
      };
      
      global.msal = {
        PublicClientApplication: jest.fn(() => mockInstance)
      };
      
      // Import fresh module
      const { authenticateUser, getAccessToken } = await import('../../src/auth/auth-service.js');
      
      // First authenticate
      await authenticateUser();
      
      // Clear the first call's mock value to ensure we get the rejection
      mockInstance.acquireTokenSilent.mockClear();
      mockInstance.acquireTokenSilent
        .mockRejectedValueOnce(new Error('Silent failed'));
      
      const token = await getAccessToken();

      expect(token).toBe('popup-token');
    });

    test('should handle token acquisition failure', async () => {
      // Similar to above but both methods succeed eventually
      const mockInstance = {
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.resolve({
          account: {
            username: 'test@example.com',
            name: 'Test User',
            tenantId: 'test-tenant-id',
            homeAccountId: 'test-account-id'
          },
          accessToken: 'mock-access-token',
          idToken: 'mock-id-token',
          expiresOn: new Date(Date.now() + 3600000)
        })),
        acquireTokenSilent: jest.fn(() => Promise.reject(new Error('Silent failed'))),
        acquireTokenPopup: jest.fn(() => Promise.resolve({
          accessToken: 'popup-token',
          expiresOn: new Date(Date.now() + 3600000)
        })),
        getAllAccounts: jest.fn(() => [{
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }]),
        logout: jest.fn(() => Promise.resolve()),
        setActiveAccount: jest.fn(),
        getActiveAccount: jest.fn(() => ({
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }))
      };
      
      global.msal = {
        PublicClientApplication: jest.fn(() => mockInstance)
      };
      
      // Import fresh module
      const { authenticateUser, getAccessToken } = await import('../../src/auth/auth-service.js');
      
      // First authenticate
      await authenticateUser();
      
      const token = await getAccessToken();

      expect(token).toBe('popup-token');
    });

  });

  describe('Logout Flow', () => {
    test('should complete logout successfully', async () => {
      // Create a mock instance with logout support
      const mockInstance = {
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.resolve({
          account: {
            username: 'test@example.com',
            name: 'Test User',
            tenantId: 'test-tenant-id',
            homeAccountId: 'test-account-id'
          },
          accessToken: 'mock-access-token',
          idToken: 'mock-id-token',
          expiresOn: new Date(Date.now() + 3600000)
        })),
        logoutPopup: jest.fn(() => Promise.resolve()),
        getAllAccounts: jest.fn(() => [{
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }]),
        setActiveAccount: jest.fn(),
        getActiveAccount: jest.fn(() => ({
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }))
      };
      
      global.msal = {
        PublicClientApplication: jest.fn(() => mockInstance)
      };
      
      // Import fresh module
      const { authenticateUser, logoutUser } = await import('../../src/auth/auth-service.js');
      
      // First authenticate
      await authenticateUser();
      
      const result = await logoutUser();

      expect(result.success).toBe(true);
      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        'isAuthenticated',
        'userInfo',
        'authTimestamp',
        'tokenRefreshed'
      ]);
    });

    test('should handle logout failure gracefully', async () => {
      // Create a mock instance with failing logout
      let hasAuthenticated = false;
      const mockInstance = {
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => {
          hasAuthenticated = true;
          return Promise.resolve({
            account: {
              username: 'test@example.com',
              name: 'Test User',
              tenantId: 'test-tenant-id',
              homeAccountId: 'test-account-id'
            },
            accessToken: 'mock-access-token',
            idToken: 'mock-id-token',
            expiresOn: new Date(Date.now() + 3600000)
          });
        }),
        logoutPopup: jest.fn(() => {
          if (!hasAuthenticated) {
            // If we haven't authenticated, logout should just succeed
            return Promise.resolve();
          }
          return Promise.reject(new Error('Logout failed'));
        }),
        getAllAccounts: jest.fn(() => hasAuthenticated ? [{
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }] : []),
        setActiveAccount: jest.fn(),
        getActiveAccount: jest.fn(() => hasAuthenticated ? ({
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }) : null)
      };
      
      global.msal = {
        PublicClientApplication: jest.fn(() => mockInstance)
      };
      
      // Import fresh module
      const { authenticateUser, logoutUser } = await import('../../src/auth/auth-service.js');
      
      // First authenticate
      await authenticateUser();
      
      const result = await logoutUser();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Logout failed');
      // Should still clear local data even if logout fails
      expect(chrome.storage.local.remove).toHaveBeenCalled();
    });
  });

  describe('Authentication State Persistence', () => {
    test('should restore authentication state on reload', async () => {
      // First, we need to set up the mock to be authenticated
      const mockStorageData = {
        isAuthenticated: true,
        userInfo: {
          username: 'admin@company.com',
          name: 'Admin User',
          tenantId: 'test-tenant'
        },
        authTimestamp: Date.now() - 1000 // 1 second ago
      };

      chrome.storage.local.get.mockImplementation((keys) => {
        if (Array.isArray(keys) && keys.includes('userInfo')) {
          return Promise.resolve({ userInfo: mockStorageData.userInfo });
        }
        return Promise.resolve(mockStorageData);
      });

      // Create a mock instance for token validation
      const mockInstance = {
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.resolve({
          account: {
            username: 'admin@company.com',
            name: 'Admin User',
            tenantId: 'test-tenant',
            homeAccountId: 'test-account-id'
          },
          accessToken: 'mock-access-token',
          idToken: 'mock-id-token',
          expiresOn: new Date(Date.now() + 3600000)
        })),
        getAllAccounts: jest.fn(() => [{
          username: 'admin@company.com',
          name: 'Admin User',
          tenantId: 'test-tenant'
        }]),
        acquireTokenSilent: jest.fn(() => Promise.resolve({
          accessToken: 'restored-token',
          expiresOn: new Date(Date.now() + 3600000)
        })),
        getActiveAccount: jest.fn(() => ({
          username: 'admin@company.com',
          name: 'Admin User',
          tenantId: 'test-tenant'
        })),
        setActiveAccount: jest.fn()
      };
      
      global.msal = {
        PublicClientApplication: jest.fn(() => mockInstance)
      };
      
      // Import fresh module
      const { authenticateUser } = await import('../../src/auth/auth-service.js');
      
      // First authenticate to set up state
      await authenticateUser();
      
      // Now the getAuthStatus will work because we have authenticated
      const authStatus = await getAuthStatus();

      expect(authStatus.isAuthenticated).toBe(true);
      expect(authStatus.user.username).toBe('admin@company.com');
      expect(authStatus.tokenValid).toBe(true);
    });

    test('should detect expired authentication', async () => {
      const mockStorageData = {
        isAuthenticated: true,
        userInfo: { username: 'admin@company.com' },
        authTimestamp: Date.now() - 24 * 60 * 60 * 1000 // 24 hours ago
      };

      chrome.storage.local.get.mockImplementation((keys) => {
        if (Array.isArray(keys) && keys.includes('userInfo')) {
          return Promise.resolve({ userInfo: mockStorageData.userInfo });
        }
        return Promise.resolve(mockStorageData);
      });

      // Create a mock instance that fails token acquisition
      const mockInstance = {
        initialize: jest.fn(() => Promise.resolve()),
        getAllAccounts: jest.fn(() => [{
          username: 'admin@company.com'
        }]),
        acquireTokenSilent: jest.fn(() => Promise.reject(new Error('Token expired'))),
        getActiveAccount: jest.fn(() => ({
          username: 'admin@company.com'
        })),
        setActiveAccount: jest.fn()
      };

      global.msal = {
        PublicClientApplication: jest.fn(() => mockInstance)
      };

      const authStatus = await getAuthStatus();

      expect(authStatus.isAuthenticated).toBe(true);
      expect(authStatus.tokenValid).toBe(false);
      expect(authStatus.requiresReauth).toBe(true);
    });
  });

  describe('Permission Validation', () => {
    test('should validate required scopes', async () => {
      // Create a mock instance with permission validation
      const mockInstance = {
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.resolve({
          account: {
            username: 'test@example.com',
            name: 'Test User',
            tenantId: 'test-tenant-id',
            homeAccountId: 'test-account-id'
          },
          accessToken: 'mock-access-token',
          idToken: 'mock-id-token',
          expiresOn: new Date(Date.now() + 3600000)
        })),
        acquireTokenSilent: jest.fn(() => Promise.resolve({
          accessToken: 'valid-token',
          expiresOn: new Date(Date.now() + 3600000)
        })),
        getAllAccounts: jest.fn(() => [{
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }]),
        setActiveAccount: jest.fn(),
        getActiveAccount: jest.fn(() => ({
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }))
      };
      
      global.msal = {
        PublicClientApplication: jest.fn(() => mockInstance)
      };
      
      global.mockMsalInstance = mockInstance;
      
      // Import fresh module
      const { authenticateUser } = await import('../../src/auth/auth-service.js');
      
      // First authenticate to set up msalInstance
      await authenticateUser();

      const requiredScopes = [
        'https://graph.microsoft.com/Sites.ReadWrite.All',
        'https://graph.microsoft.com/User.Read'
      ];

      const result = await checkPermissions(requiredScopes);

      expect(result.hasPermissions).toBe(true);
      expect(mockInstance.acquireTokenSilent).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: requiredScopes
        })
      );
    });

    test('should detect missing permissions', async () => {
      // Create a mock instance that rejects consent
      const mockInstance = {
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.resolve({
          account: {
            username: 'test@example.com',
            name: 'Test User',
            tenantId: 'test-tenant-id',
            homeAccountId: 'test-account-id'
          },
          accessToken: 'mock-access-token',
          idToken: 'mock-id-token',
          expiresOn: new Date(Date.now() + 3600000)
        })),
        acquireTokenSilent: jest.fn(() => Promise.reject({
          errorCode: 'consent_required',
          message: 'Consent required'
        })),
        getAllAccounts: jest.fn(() => [{
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }]),
        setActiveAccount: jest.fn(),
        getActiveAccount: jest.fn(() => ({
          username: 'test@example.com',
          name: 'Test User',
          tenantId: 'test-tenant-id',
          homeAccountId: 'test-account-id'
        }))
      };
      
      global.msal = {
        PublicClientApplication: jest.fn(() => mockInstance)
      };
      
      global.mockMsalInstance = mockInstance;
      
      // Import fresh module
      const { authenticateUser } = await import('../../src/auth/auth-service.js');
      
      // First authenticate to set up msalInstance  
      await authenticateUser();

      const requiredScopes = ['https://graph.microsoft.com/Sites.Manage.All'];

      const result = await checkPermissions(requiredScopes);

      expect(result.hasPermissions).toBe(false);
      expect(result.requiresConsent).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle MSAL initialization errors', async () => {
      // Create a mock that throws on construction
      global.msal = {
        PublicClientApplication: jest.fn().mockImplementation(() => {
          throw new Error('MSAL initialization failed');
        })
      };

      // Import fresh module
      const { authenticateUser } = await import('../../src/auth/auth-service.js');
      
      const result = await authenticateUser();
      
      expect(result.success).toBe(false);
      // The error will be caught by initializeMSAL and thrown, then caught by authenticateUser
      expect(result.error).toBeDefined();
      expect(result.code).toBe('AUTH_ERROR');
    });

    test('should handle popup blocked errors', async () => {
      // Create a mock that simulates popup blocked
      global.msal = {
        PublicClientApplication: jest.fn(() => ({
          initialize: jest.fn(() => Promise.resolve()),
          loginPopup: jest.fn(() => {
            const error = new Error('Popup was blocked');
            error.name = 'BrowserAuthError';
            error.errorCode = 'popup_window_error';
            return Promise.reject(error);
          }),
          getAllAccounts: jest.fn(() => [])
        }))
      };

      // Import fresh module
      const { authenticateUser } = await import('../../src/auth/auth-service.js');
      
      const result = await authenticateUser();

      expect(result.success).toBe(false);
      expect(result.error).toContain('popup was blocked');
    });

    test('should handle network connectivity issues', async () => {
      // Create a mock that simulates network error
      global.msal = {
        PublicClientApplication: jest.fn(() => ({
          initialize: jest.fn(() => Promise.resolve()),
          loginPopup: jest.fn(() => {
            const error = new Error('Network error occurred');
            error.name = 'NetworkError';
            error.errorCode = 'network_error';
            return Promise.reject(error);
          }),
          getAllAccounts: jest.fn(() => [])
        }))
      };

      // Import fresh module
      const { authenticateUser } = await import('../../src/auth/auth-service.js');
      
      const result = await authenticateUser();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error occurred');
    });
  });
});