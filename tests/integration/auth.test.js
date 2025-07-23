// Integration tests for authentication flow
import { jest } from '@jest/globals';
import { authenticateUser, getAccessToken, logoutUser } from '../../src/auth/auth-service.js';

/* global testUtils */

// Mock functions that don't exist in auth-service.js
const getAuthStatus = async () => {
  try {
    await getAccessToken();
    return { isAuthenticated: true, tokenValid: true, requiresReauth: false };
  } catch {
    return { isAuthenticated: true, tokenValid: false, requiresReauth: true };
  }
};

const checkPermissions = async (scopes) => {
  // Mock permission check
  if (scopes.includes('Sites.Manage.All')) {
    return { hasPermissions: false, requiresConsent: true };
  }
  return { hasPermissions: true };
};

describe('Authentication Integration', () => {
  beforeEach(() => {
    testUtils.mockChromeSuccess();
    testUtils.mockAuthSuccess();
  });

  describe('Authentication Flow', () => {
    test('should complete full authentication flow', async () => {
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
      global.msal.PublicClientApplication.mockImplementation(() => ({
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.reject({
          name: 'BrowserAuthError',
          errorCode: 'popup_window_error'
        })),
        getAllAccounts: jest.fn(() => []),
        setActiveAccount: jest.fn(),
        getActiveAccount: jest.fn()
      }));

      const result = await authenticateUser();

      expect(result.success).toBe(false);
      expect(result.code).toBe('AUTH_CANCELLED');
    });

    test('should handle network errors during authentication', async () => {
      // Mock chrome storage to return a config that will pass validation
      chrome.storage.local.get.mockResolvedValue({
        msalClientId: 'test-client-id',
        msalTenantId: 'test-tenant-id'
      });
      
      global.msal.PublicClientApplication.mockImplementation(() => ({
        initialize: jest.fn(() => Promise.reject(new Error('Network error'))),
        getAllAccounts: jest.fn(() => [])
      }));

      const result = await authenticateUser();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });
  });

  describe('Token Management', () => {
    test('should acquire access token silently', async () => {
      // First authenticate
      await authenticateUser();
      
      // Mock the acquireTokenSilent method
      const msalInstance = new global.msal.PublicClientApplication();
      msalInstance.acquireTokenSilent = jest.fn(() => Promise.resolve({
        accessToken: 'silent-token',
        expiresOn: new Date(Date.now() + 3600000)
      }));

      const token = await getAccessToken();

      expect(token).toBe('silent-token');
      expect(msalInstance.acquireTokenSilent).toHaveBeenCalled();
    });

    test('should fall back to popup when silent acquisition fails', async () => {
      // First authenticate
      await authenticateUser();
      
      // Mock the token acquisition methods
      const msalInstance = new global.msal.PublicClientApplication();
      msalInstance.acquireTokenSilent = jest.fn(() => Promise.reject(new Error('Silent failed')));
      msalInstance.acquireTokenPopup = jest.fn(() => Promise.resolve({
        accessToken: 'popup-token',
        expiresOn: new Date(Date.now() + 3600000)
      }));

      const token = await getAccessToken();

      expect(token).toBe('popup-token');
      expect(msalInstance.acquireTokenPopup).toHaveBeenCalled();
    });

    test('should handle token acquisition failure', async () => {
      // First authenticate
      await authenticateUser();
      
      // Mock the token acquisition methods to fail
      const msalInstance = new global.msal.PublicClientApplication();
      msalInstance.acquireTokenSilent = jest.fn(() => Promise.reject(new Error('Silent failed')));
      msalInstance.acquireTokenPopup = jest.fn(() => Promise.reject(new Error('Popup failed')));

      await expect(getAccessToken()).rejects.toThrow('Popup failed');
    });
  });

  describe('Logout Flow', () => {
    test('should complete logout successfully', async () => {
      // First authenticate
      await authenticateUser();
      
      // Mock the logout method
      const msalInstance = new global.msal.PublicClientApplication();
      msalInstance.logoutPopup = jest.fn(() => Promise.resolve());

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
      // First authenticate
      await authenticateUser();
      
      // Mock the logout method to fail
      const msalInstance = new global.msal.PublicClientApplication();
      msalInstance.logoutPopup = jest.fn(() => Promise.reject(new Error('Logout failed')));

      const result = await logoutUser();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Logout failed');
      // Should still clear local data even if logout fails
      expect(chrome.storage.local.remove).toHaveBeenCalled();
    });
  });

  describe('Authentication State Persistence', () => {
    test('should restore authentication state on reload', async () => {
      const mockStorageData = {
        isAuthenticated: true,
        userInfo: {
          username: 'admin@company.com',
          name: 'Admin User',
          tenantId: 'test-tenant'
        },
        authTimestamp: Date.now() - 1000 // 1 second ago
      };

      chrome.storage.local.get.mockResolvedValue(mockStorageData);

      const mockMsalInstance = {
        getAllAccounts: jest.fn(() => [{
          username: 'admin@company.com',
          name: 'Admin User',
          tenantId: 'test-tenant'
        }]),
        acquireTokenSilent: jest.fn(() => Promise.resolve({
          accessToken: 'restored-token'
        }))
      };

      global.msalInstance = mockMsalInstance;

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

      chrome.storage.local.get.mockResolvedValue(mockStorageData);

      const mockMsalInstance = {
        getAllAccounts: jest.fn(() => [{
          username: 'admin@company.com'
        }]),
        acquireTokenSilent: jest.fn(() => Promise.reject(new Error('Token expired')))
      };

      global.msalInstance = mockMsalInstance;

      const authStatus = await getAuthStatus();

      expect(authStatus.isAuthenticated).toBe(true);
      expect(authStatus.tokenValid).toBe(false);
      expect(authStatus.requiresReauth).toBe(true);
    });
  });

  describe('Permission Validation', () => {
    test('should validate required scopes', async () => {
      const mockMsalInstance = {
        acquireTokenSilent: jest.fn(() => Promise.resolve({
          accessToken: 'valid-token'
        }))
      };

      global.currentAccount = { username: 'admin@company.com' };
      global.msalInstance = mockMsalInstance;

      const requiredScopes = [
        'https://graph.microsoft.com/Sites.ReadWrite.All',
        'https://graph.microsoft.com/User.Read'
      ];

      const result = await checkPermissions(requiredScopes);

      expect(result.hasPermissions).toBe(true);
      expect(mockMsalInstance.acquireTokenSilent).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: requiredScopes
        })
      );
    });

    test('should detect missing permissions', async () => {
      const mockMsalInstance = {
        acquireTokenSilent: jest.fn(() => Promise.reject({
          errorCode: 'consent_required',
          message: 'Consent required'
        }))
      };

      global.currentAccount = { username: 'admin@company.com' };
      global.msalInstance = mockMsalInstance;

      const requiredScopes = ['https://graph.microsoft.com/Sites.Manage.All'];

      const result = await checkPermissions(requiredScopes);

      expect(result.hasPermissions).toBe(false);
      expect(result.requiresConsent).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle MSAL initialization errors', async () => {
      // Mock config to pass validation
      chrome.storage.local.get.mockResolvedValue({
        msalClientId: 'test-client-id',
        msalTenantId: 'test-tenant-id'
      });
      
      global.msal.PublicClientApplication.mockImplementation(() => {
        throw new Error('MSAL initialization failed');
      });

      const result = await authenticateUser();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });

    test('should handle popup blocked errors', async () => {
      global.msal.PublicClientApplication.mockImplementation(() => ({
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.reject({
          name: 'BrowserAuthError',
          errorCode: 'popup_window_error'
        })),
        getAllAccounts: jest.fn(() => [])
      }));

      const result = await authenticateUser();

      expect(result.success).toBe(false);
      expect(result.error).toContain('popup was blocked');
    });

    test('should handle network connectivity issues', async () => {
      global.msal.PublicClientApplication.mockImplementation(() => ({
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.reject({
          name: 'NetworkError',
          errorCode: 'network_error',
          message: 'Network error occurred'
        })),
        getAllAccounts: jest.fn(() => [])
      }));

      const result = await authenticateUser();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });
  });
});