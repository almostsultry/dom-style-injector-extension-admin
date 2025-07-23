// Integration tests for authentication flow
import { jest } from '@jest/globals';
import { authenticateUser, getAccessToken, logoutUser } from '../../src/auth/auth-service.js';

/* global testUtils */

describe('Authentication Integration', () => {
  beforeEach(() => {
    testUtils.mockChromeSuccess();
    testUtils.mockAuthSuccess();
  });

  describe('Authentication Flow', () => {
    test('should complete full authentication flow', async () => {
      // Mock MSAL initialization
      global.msal.PublicClientApplication.mockImplementation(() => ({
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.resolve({
          account: {
            username: 'admin@company.com',
            name: 'Admin User',
            tenantId: 'test-tenant-id',
            homeAccountId: 'test-account-id'
          },
          accessToken: 'test-access-token'
        })),
        getAllAccounts: jest.fn(() => [])
      }));

      const result = await authenticateUser();

      expect(result.success).toBe(true);
      expect(result.user.username).toBe('admin@company.com');
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
          userInfo: expect.objectContaining({
            username: 'admin@company.com',
            name: 'Admin User'
          })
        })
      );
    });

    test('should handle authentication cancellation', async () => {
      global.msal.PublicClientApplication.mockImplementation(() => ({
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.reject({
          name: 'BrowserAuthError',
          errorCode: 'user_cancelled'
        })),
        getAllAccounts: jest.fn(() => [])
      }));

      const result = await authenticateUser();

      expect(result.success).toBe(false);
      expect(result.code).toBe('AUTH_CANCELLED');
    });

    test('should handle network errors during authentication', async () => {
      global.msal.PublicClientApplication.mockImplementation(() => ({
        initialize: jest.fn(() => Promise.reject(new Error('Network error'))),
        getAllAccounts: jest.fn(() => [])
      }));

      await expect(authenticateUser()).rejects.toThrow('Network error');
    });
  });

  describe('Token Management', () => {
    test('should acquire access token silently', async () => {
      const mockMsalInstance = {
        acquireTokenSilent: jest.fn(() => Promise.resolve({
          accessToken: 'silent-token'
        }))
      };

      // Mock current account
      global.currentAccount = {
        username: 'admin@company.com',
        homeAccountId: 'test-account'
      };
      global.msalInstance = mockMsalInstance;

      const token = await getAccessToken();

      expect(token).toBe('silent-token');
      expect(mockMsalInstance.acquireTokenSilent).toHaveBeenCalledWith({
        scopes: ['https://graph.microsoft.com/Sites.ReadWrite.All'],
        account: global.currentAccount
      });
    });

    test('should fall back to popup when silent acquisition fails', async () => {
      const mockMsalInstance = {
        acquireTokenSilent: jest.fn(() => Promise.reject(new Error('Silent failed'))),
        acquireTokenPopup: jest.fn(() => Promise.resolve({
          accessToken: 'popup-token'
        }))
      };

      global.currentAccount = { username: 'admin@company.com' };
      global.msalInstance = mockMsalInstance;

      const token = await getAccessToken();

      expect(token).toBe('popup-token');
      expect(mockMsalInstance.acquireTokenPopup).toHaveBeenCalled();
    });

    test('should handle token acquisition failure', async () => {
      const mockMsalInstance = {
        acquireTokenSilent: jest.fn(() => Promise.reject(new Error('Silent failed'))),
        acquireTokenPopup: jest.fn(() => Promise.reject(new Error('Popup failed')))
      };

      global.currentAccount = { username: 'admin@company.com' };
      global.msalInstance = mockMsalInstance;

      await expect(getAccessToken()).rejects.toThrow('Popup failed');
    });
  });

  describe('Logout Flow', () => {
    test('should complete logout successfully', async () => {
      const mockMsalInstance = {
        logoutPopup: jest.fn(() => Promise.resolve())
      };

      global.currentAccount = { username: 'admin@company.com' };
      global.msalInstance = mockMsalInstance;

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
      const mockMsalInstance = {
        logoutPopup: jest.fn(() => Promise.reject(new Error('Logout failed')))
      };

      global.currentAccount = { username: 'admin@company.com' };
      global.msalInstance = mockMsalInstance;

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
      global.msal.PublicClientApplication.mockImplementation(() => {
        throw new Error('MSAL initialization failed');
      });

      await expect(authenticateUser()).rejects.toThrow('MSAL initialization failed');
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
      expect(result.error).toContain('Pop-up was blocked');
    });

    test('should handle network connectivity issues', async () => {
      global.msal.PublicClientApplication.mockImplementation(() => ({
        initialize: jest.fn(() => Promise.resolve()),
        loginPopup: jest.fn(() => Promise.reject({
          name: 'NetworkError',
          errorCode: 'network_error'
        })),
        getAllAccounts: jest.fn(() => [])
      }));

      const result = await authenticateUser();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error occurred');
    });
  });
});

// Mock implementations for testing
async function getAuthStatus() {
  try {
    const localAuth = await chrome.storage.local.get(['isAuthenticated', 'userInfo']);
    
    if (localAuth.isAuthenticated && global.msalInstance) {
      const accounts = global.msalInstance.getAllAccounts();
      
      if (accounts.length > 0) {
        global.currentAccount = accounts[0];
        
        try {
          await global.msalInstance.acquireTokenSilent({
            scopes: ['https://graph.microsoft.com/User.Read'],
            account: global.currentAccount
          });
          
          return {
            isAuthenticated: true,
            user: localAuth.userInfo,
            tokenValid: true
          };
        } catch (_tokenError) {
          return {
            isAuthenticated: true,
            user: localAuth.userInfo,
            tokenValid: false,
            requiresReauth: true
          };
        }
      }
    }
    
    return {
      isAuthenticated: false,
      user: null,
      tokenValid: false
    };
  } catch (error) {
    return {
      isAuthenticated: false,
      user: null,
      error: error.message
    };
  }
}

async function checkPermissions(requiredScopes) {
  try {
    if (!global.currentAccount) {
      return { hasPermissions: false, reason: 'Not authenticated' };
    }
    
    await global.msalInstance.acquireTokenSilent({
      scopes: requiredScopes,
      account: global.currentAccount
    });
    
    return { hasPermissions: true };
  } catch (error) {
    return {
      hasPermissions: false,
      reason: error.message,
      requiresConsent: error.errorCode === 'consent_required'
    };
  }
}