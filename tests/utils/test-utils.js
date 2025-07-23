// Test utilities for shared test functionality
import { jest } from '@jest/globals';

export const testUtils = {
  // Mock Chrome API for success scenarios
  mockChromeSuccess: () => {
    global.chrome = {
      ...global.chrome,
      runtime: {
        ...global.chrome.runtime,
        lastError: null,
        sendMessage: jest.fn((message, callback) => {
          if (callback) {
            callback({ success: true });
          }
          return Promise.resolve({ success: true });
        }),
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        }
      },
      storage: {
        local: {
          get: jest.fn((keys, callback) => {
            if (callback) callback({});
            return Promise.resolve({});
          }),
          set: jest.fn((items, callback) => {
            if (callback) callback();
            return Promise.resolve();
          }),
          clear: jest.fn((callback) => {
            if (callback) callback();
            return Promise.resolve();
          })
        },
        sync: {
          get: jest.fn((keys, callback) => {
            if (callback) callback({});
            return Promise.resolve({});
          }),
          set: jest.fn((items, callback) => {
            if (callback) callback();
            return Promise.resolve();
          })
        }
      },
      tabs: {
        query: jest.fn((query, callback) => {
          if (callback) callback([{ id: 1, url: 'https://test.com' }]);
          return Promise.resolve([{ id: 1, url: 'https://test.com' }]);
        }),
        sendMessage: jest.fn((tabId, message, callback) => {
          if (callback) callback({ success: true });
          return Promise.resolve({ success: true });
        })
      }
    };
  },

  // Mock Chrome API for error scenarios
  mockChromeError: (errorMessage = 'Test error') => {
    global.chrome = {
      ...global.chrome,
      runtime: {
        ...global.chrome.runtime,
        lastError: { message: errorMessage },
        sendMessage: jest.fn((message, callback) => {
          if (callback) {
            callback({ success: false, error: errorMessage });
          }
          return Promise.resolve({ success: false, error: errorMessage });
        })
      }
    };
  },

  // Create mock DOM element
  createMockElement: (tag, attributes = {}) => {
    const element = document.createElement(tag);
    Object.keys(attributes).forEach(key => {
      if (key === 'textContent') {
        element.textContent = attributes[key];
      } else if (key === 'innerHTML') {
        element.innerHTML = attributes[key];
      } else {
        element.setAttribute(key, attributes[key]);
      }
    });
    return element;
  },

  // Wait for async operations
  waitForAsync: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock fetch responses
  mockFetch: (response, ok = true) => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok,
        status: ok ? 200 : 400,
        json: () => Promise.resolve(response),
        text: () => Promise.resolve(JSON.stringify(response))
      })
    );
  },

  // Mock authentication state
  mockAuthState: (isAuthenticated = true, userRole = 'System Administrator') => {
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      const result = {
        isAuthenticated,
        userRole,
        authTimestamp: Date.now()
      };
      if (callback) callback(result);
      return Promise.resolve(result);
    });
  },

  // Mock authentication success
  mockAuthSuccess: () => {
    // Mock chrome storage to return valid MSAL config
    const validConfig = {
      msalClientId: 'test-client-id',
      msalTenantId: 'test-tenant-id',
      d365Environment: 'test.dynamics.com'
    };
    
    const syncConfig = {
      clientId: 'test-client-id',
      tenantId: 'test-tenant-id',
      d365OrgUrl: 'https://test.dynamics.com'
    };
    
    global.chrome.storage.local.get = jest.fn((keys, callback) => {
      if (callback) callback(validConfig);
      return Promise.resolve(validConfig);
    });
    
    global.chrome.storage.sync.get = jest.fn((keys, callback) => {
      if (callback) callback(syncConfig);
      return Promise.resolve(syncConfig);
    });
    
    // Mock MSAL
    global.window = global.window || {};
    global.msal = global.window.msal = {
      PublicClientApplication: jest.fn(() => ({
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
          accessToken: 'mock-access-token',
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
      }))
    };
    
    global.chrome.identity = {
      getAuthToken: jest.fn((options, callback) => {
        if (callback) callback('mock-auth-token');
        return Promise.resolve('mock-auth-token');
      }),
      removeCachedAuthToken: jest.fn((options, callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          displayName: 'Test User',
          mail: 'test@example.com',
          id: 'test-user-id'
        })
      })
    );
  },

  // Mock SharePoint success
  mockSharePointSuccess: () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('graph.microsoft.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            value: [{
              id: 'test-file-id',
              name: 'customizations.json',
              content: JSON.stringify({
                version: '1.0.0',
                customizations: []
              })
            }]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({})
      });
    });
  }
};

// Make testUtils available globally for tests
global.testUtils = testUtils;