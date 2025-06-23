// Jest test setup file
import 'jest-webextension-mock';

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock Chrome APIs
global.chrome = {
  runtime: {
    getManifest: jest.fn(() => ({
      name: 'DOM Style Injector - Admin',
      version: '1.0.0',
      manifest_version: 3
    })),
    getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    }
  },
  
  storage: {
    local: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve())
    }
  },
  
  tabs: {
    query: jest.fn(() => Promise.resolve([{
      id: 1,
      url: 'https://ambata.crm.dynamics.com/test'
    }])),
    create: jest.fn(() => Promise.resolve({ id: 2 }))
  },
  
  scripting: {
    executeScript: jest.fn(() => Promise.resolve([{ result: { success: true } }]))
  },
  
  alarms: {
    create: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    clearAll: jest.fn(() => Promise.resolve()),
    onAlarm: {
      addListener: jest.fn()
    }
  },
  
  contextMenus: {
    create: jest.fn(),
    removeAll: jest.fn(() => Promise.resolve()),
    onClicked: {
      addListener: jest.fn()
    }
  },
  
  notifications: {
    create: jest.fn(() => Promise.resolve('notification-id'))
  }
};

// Mock fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('')
  })
);

// Mock MSAL
global.msal = {
  PublicClientApplication: jest.fn(() => ({
    initialize: jest.fn(() => Promise.resolve()),
    loginPopup: jest.fn(() => Promise.resolve({
      account: {
        username: 'test@company.com',
        name: 'Test User',
        tenantId: 'test-tenant'
      }
    })),
    logoutPopup: jest.fn(() => Promise.resolve()),
    getAllAccounts: jest.fn(() => []),
    acquireTokenSilent: jest.fn(() => Promise.resolve({
      accessToken: 'test-token'
    })),
    acquireTokenPopup: jest.fn(() => Promise.resolve({
      accessToken: 'test-token'
    }))
  }))
};

// Test data fixtures
global.testData = {
  validCustomization: {
    domain: 'ambata.crm.dynamics.com',
    queryStrings: {
      'etn=account': {
        '[data-id="editFormRoot"]': {
          'background-color': '#90881375'
        }
      }
    }
  },
  
  validManifest: {
    manifest_version: 3,
    name: 'DOM Style Injector - Admin',
    version: '1.0.0',
    permissions: ['activeTab', 'scripting', 'storage']
  },
  
  mockSharePointResponse: {
    value: [{
      id: '1',
      fields: {
        Title: 'ambata.crm.dynamics.com',
        CustomizationData: JSON.stringify({
          domain: 'ambata.crm.dynamics.com',
          queryStrings: {}
        }),
        Version: 1,
        IsActive: true,
        ApprovalStatus: 'Approved'
      },
      createdDateTime: '2025-01-01T00:00:00Z',
      lastModifiedDateTime: '2025-01-01T00:00:00Z'
    }]
  }
};

// Test utilities
global.testUtils = {
  // Create a mock DOM element
  createElement: (tagName, attributes = {}) => {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  },
  
  // Wait for async operations
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock successful Chrome API responses
  mockChromeSuccess: () => {
    chrome.storage.local.get.mockResolvedValue({ customizations: {} });
    chrome.storage.local.set.mockResolvedValue();
    chrome.tabs.query.mockResolvedValue([{
      id: 1,
      url: 'https://ambata.crm.dynamics.com/test'
    }]);
    chrome.scripting.executeScript.mockResolvedValue([{
      result: { success: true, count: 1 }
    }]);
  },
  
  // Mock Chrome API errors
  mockChromeError: (errorMessage = 'Test error') => {
    chrome.storage.local.get.mockRejectedValue(new Error(errorMessage));
    chrome.tabs.query.mockRejectedValue(new Error(errorMessage));
    chrome.scripting.executeScript.mockRejectedValue(new Error(errorMessage));
  },
  
  // Mock authentication success
  mockAuthSuccess: () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600
      })
    });
  },
  
  // Mock SharePoint API responses
  mockSharePointSuccess: () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(testData.mockSharePointResponse)
    });
  }
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  
  // Reset Chrome API mocks to default state
  chrome.storage.local.get.mockResolvedValue({});
  chrome.storage.local.set.mockResolvedValue();
  chrome.tabs.query.mockResolvedValue([{
    id: 1,
    url: 'https://ambata.crm.dynamics.com/test'
  }]);
  chrome.scripting.executeScript.mockResolvedValue([{
    result: { success: true, count: 1 }
  }]);
  
  // Reset fetch mock
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('')
  });
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Suppress specific warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});