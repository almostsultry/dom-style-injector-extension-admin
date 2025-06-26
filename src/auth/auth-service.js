// src/auth/auth-service.js - Fixed import and configuration issues
import { msalConfig, loginRequest, graphRequest, getStoredConfig } from './msal-config.js';

let msalInstance = null;
let currentAccount = null;

// Initialize MSAL instance with stored or default config
export async function initializeMSAL() {
  try {
    // Get configuration (stored values override defaults)
    const config = await getStoredConfig();

    // Check if we have required configuration
    if (config.auth.clientId === 'your-azure-app-client-id-here') {
      console.warn('MSAL not configured - using placeholder values. Configure in extension options.');
      throw new Error('MSAL configuration required. Please configure Client ID and Tenant ID in extension options.');
    }

    // Import MSAL library - fix the import path
    if (typeof window !== 'undefined' && window.msal) {
      // MSAL already loaded globally
      const { PublicClientApplication } = window.msal;
      msalInstance = new PublicClientApplication(config);
    } else {
      // Try to load from expected location
      try {
        const msalModule = await import('../lib/msal-browser.min.js');
        const { PublicClientApplication } = msalModule;
        msalInstance = new PublicClientApplication(config);
      } catch (importError) {
        console.error('Failed to import MSAL library:', importError);
        throw new Error('MSAL library not found. Ensure msal-browser.min.js is in src/lib/');
      }
    }

    await msalInstance.initialize();
    console.log('MSAL initialized successfully');

    // Check for existing account
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      currentAccount = accounts[0];
      console.log('Found existing account:', currentAccount.username);
    }

    return true;
  } catch (error) {
    console.error('MSAL initialization failed:', error);
    throw error;
  }
}

// Authenticate user with Microsoft
export async function authenticateUser() {
  try {
    if (!msalInstance) {
      await initializeMSAL();
    }

    console.log('Starting authentication flow...');

    // Try silent authentication first if we have an account
    if (currentAccount) {
      try {
        const silentRequest = {
          ...loginRequest,
          account: currentAccount
        };

        const silentResponse = await msalInstance.acquireTokenSilent(silentRequest);
        console.log('Silent authentication successful');

        await storeAuthData(silentResponse);
        return {
          success: true,
          user: {
            username: silentResponse.account.username,
            name: silentResponse.account.name,
            tenantId: silentResponse.account.tenantId
          }
        };
      } catch (silentError) {
        console.log('Silent auth failed, trying interactive:', silentError);
      }
    }

    // Use popup authentication
    const response = await msalInstance.loginPopup(loginRequest);
    currentAccount = response.account;

    await storeAuthData(response);

    console.log('Authentication successful:', currentAccount.username);

    return {
      success: true,
      user: {
        username: currentAccount.username,
        name: currentAccount.name,
        tenantId: currentAccount.tenantId
      }
    };

  } catch (error) {
    console.error('Authentication failed:', error);

    // Handle specific MSAL errors
    if (error.name === 'BrowserAuthError' || error.errorCode === 'popup_window_error') {
      return {
        success: false,
        error: 'Authentication popup was blocked or cancelled. Please allow popups and try again.',
        code: 'AUTH_CANCELLED'
      };
    }

    if (error.errorCode === 'invalid_client') {
      return {
        success: false,
        error: 'Invalid Azure AD configuration. Please check your Client ID and Tenant ID in extension options.',
        code: 'CONFIG_ERROR'
      };
    }

    return {
      success: false,
      error: error.message || 'Authentication failed',
      code: error.errorCode || 'AUTH_ERROR'
    };
  }
}

// Get access token for Microsoft Graph API
export async function getAccessToken(scopes = graphRequest.scopes) {
  try {
    if (!msalInstance || !currentAccount) {
      throw new Error('Not authenticated. Please sign in first.');
    }

    const tokenRequest = {
      scopes: scopes,
      account: currentAccount
    };

    // Try silent token acquisition first
    try {
      const response = await msalInstance.acquireTokenSilent(tokenRequest);
      return response.accessToken;
    } catch (silentError) {
      console.log('Silent token acquisition failed, trying interactive:', silentError);

      // Fall back to interactive token acquisition
      const response = await msalInstance.acquireTokenPopup(tokenRequest);
      return response.accessToken;
    }

  } catch (error) {
    console.error('Token acquisition failed:', error);
    throw error;
  }
}

// Check if user is authenticated
export async function isAuthenticated() {
  try {
    if (!msalInstance) {
      await initializeMSAL();
    }

    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      currentAccount = accounts[0];

      // Try to get a token to verify authentication is still valid
      try {
        await getAccessToken();
        return true;
      } catch (tokenError) {
        console.log('Token validation failed:', tokenError);
        return false;
      }
    }

    return false;
  } catch (error) {
    console.error('Authentication check failed:', error);
    return false;
  }
}

// Get current account
export function getCurrentAccount() {
  return currentAccount;
}

// Logout user
export async function logoutUser() {
  try {
    if (msalInstance && currentAccount) {
      const logoutRequest = {
        account: currentAccount,
        postLogoutRedirectUri: chrome.runtime.getURL('src/popup/popup.html')
      };

      await msalInstance.logoutPopup(logoutRequest);
    }

    // Clear stored authentication data
    await chrome.storage.local.remove([
      'isAuthenticated',
      'userInfo',
      'authTimestamp',
      'tokenRefreshed'
    ]);

    currentAccount = null;
    console.log('Logout successful');

    return { success: true };

  } catch (error) {
    console.error('Logout failed:', error);

    // Even if logout fails, clear local data
    await chrome.storage.local.remove([
      'isAuthenticated',
      'userInfo',
      'authTimestamp',
      'tokenRefreshed'
    ]);

    currentAccount = null;

    return { success: false, error: error.message };
  }
}

// Store authentication data
async function storeAuthData(authResponse) {
  try {
    await chrome.storage.local.set({
      isAuthenticated: true,
      userInfo: {
        username: authResponse.account.username,
        name: authResponse.account.name,
        tenantId: authResponse.account.tenantId,
        homeAccountId: authResponse.account.homeAccountId
      },
      authTimestamp: Date.now()
    });
  } catch (error) {
    console.error('Failed to store auth data:', error);
  }
}

// Get user profile from Microsoft Graph
export async function getUserProfile() {
  try {
    const accessToken = await getAccessToken(['https://graph.microsoft.com/User.Read']);

    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Graph API request failed: ${response.status}`);
    }

    const profile = await response.json();

    // Store profile data
    await chrome.storage.local.set({
      userProfile: profile
    });

    return profile;

  } catch (error) {
    console.error('Failed to get user profile:', error);
    throw error;
  }
}