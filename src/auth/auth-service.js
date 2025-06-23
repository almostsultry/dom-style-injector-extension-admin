// Microsoft Authentication Library (MSAL) service for admin authentication
import { msalConfig } from './msal-config.js';

let msalInstance = null;
let currentAccount = null;

// Initialize MSAL instance
export async function initializeMSAL() {
  try {
    // Dynamic import of MSAL library
    const { PublicClientApplication } = await import('../lib/msal-browser.min.js');
    
    msalInstance = new PublicClientApplication(msalConfig);
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
    
    const loginRequest = {
      scopes: [
        'https://graph.microsoft.com/Sites.ReadWrite.All',
        'https://graph.microsoft.com/User.Read'
      ],
      prompt: 'select_account'
    };
    
    console.log('Starting authentication flow...');
    
    // Use popup authentication
    const response = await msalInstance.loginPopup(loginRequest);
    
    currentAccount = response.account;
    
    // Store authentication info
    await chrome.storage.local.set({
      isAuthenticated: true,
      userInfo: {
        username: currentAccount.username,
        name: currentAccount.name,
        tenantId: currentAccount.tenantId,
        homeAccountId: currentAccount.homeAccountId
      },
      authTimestamp: Date.now()
    });
    
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
    if (error.name === 'BrowserAuthError') {
      return {
        success: false,
        error: 'Authentication was cancelled or failed. Please try again.',
        code: 'AUTH_CANCELLED'
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
export async function getAccessToken(scopes = ['https://graph.microsoft.com/Sites.ReadWrite.All']) {
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
      console.log('Token acquired silently');
      return response.accessToken;
    } catch (silentError) {
      console.log('Silent token acquisition failed, trying popup:', silentError);
      
      // Fall back to popup
      const response = await msalInstance.acquireTokenPopup(tokenRequest);
      console.log('Token acquired via popup');
      return response.accessToken;
    }
    
  } catch (error) {
    console.error('Token acquisition failed:', error);
    throw error;
  }
}

// Check current authentication status
export async function getAuthStatus() {
  try {
    if (!msalInstance) {
      await initializeMSAL();
    }
    
    const accounts = msalInstance.getAllAccounts();
    const localAuth = await chrome.storage.local.get(['isAuthenticated', 'userInfo']);
    
    if (accounts.length > 0 && localAuth.isAuthenticated) {
      currentAccount = accounts[0];
      
      // Verify token is still valid by trying to get a new one
      try {
        await getAccessToken();
        
        return {
          isAuthenticated: true,
          user: localAuth.userInfo,
          tokenValid: true
        };
      } catch (tokenError) {
        console.log('Token validation failed:', tokenError);
        
        return {
          isAuthenticated: true,
          user: localAuth.userInfo,
          tokenValid: false,
          requiresReauth: true
        };
      }
    }
    
    return {
      isAuthenticated: false,
      user: null,
      tokenValid: false
    };
    
  } catch (error) {
    console.error('Error checking auth status:', error);
    return {
      isAuthenticated: false,
      user: null,
      error: error.message
    };
  }
}

// Refresh authentication token
export async function refreshToken() {
  try {
    if (!currentAccount) {
      throw new Error('No current account to refresh token for');
    }
    
    const tokenRequest = {
      scopes: [
        'https://graph.microsoft.com/Sites.ReadWrite.All',
        'https://graph.microsoft.com/User.Read'
      ],
      account: currentAccount,
      forceRefresh: true
    };
    
    const response = await msalInstance.acquireTokenSilent(tokenRequest);
    
    console.log('Token refreshed successfully');
    
    // Update stored auth info
    await chrome.storage.local.set({
      authTimestamp: Date.now(),
      tokenRefreshed: Date.now()
    });
    
    return response.accessToken;
    
  } catch (error) {
    console.error('Token refresh failed:', error);
    
    // If refresh fails, user needs to re-authenticate
    await logoutUser();
    throw new Error('Token refresh failed. Please sign in again.');
  }
}

// Logout user
export async function logoutUser() {
  try {
    if (msalInstance && currentAccount) {
      const logoutRequest = {
        account: currentAccount,
        postLogoutRedirectUri: chrome.runtime.getURL('popup.html')
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
    
    // Update stored user info
    await chrome.storage.local.set({
      userProfile: {
        id: profile.id,
        displayName: profile.displayName,
        givenName: profile.givenName,
        surname: profile.surname,
        userPrincipalName: profile.userPrincipalName,
        mail: profile.mail,
        jobTitle: profile.jobTitle,
        department: profile.department,
        companyName: profile.companyName
      }
    });
    
    return profile;
    
  } catch (error) {
    console.error('Failed to get user profile:', error);
    throw error;
  }
}

// Check if user has required permissions
export async function checkPermissions(requiredScopes = []) {
  try {
    if (!currentAccount) {
      return { hasPermissions: false, reason: 'Not authenticated' };
    }
    
    // Try to get token with required scopes
    const accessToken = await getAccessToken(requiredScopes);
    
    if (accessToken) {
      return { hasPermissions: true };
    }
    
    return { hasPermissions: false, reason: 'Token acquisition failed' };
    
  } catch (error) {
    console.error('Permission check failed:', error);
    
    return {
      hasPermissions: false,
      reason: error.message,
      requiresConsent: error.errorCode === 'consent_required'
    };
  }
}

// Handle authentication errors
export function handleAuthError(error) {
  console.error('Authentication error:', error);
  
  const errorMap = {
    'popup_window_error': 'Pop-up was blocked. Please allow pop-ups for this extension.',
    'user_cancelled': 'Authentication was cancelled.',
    'consent_required': 'Additional permissions are required. Please grant consent.',
    'interaction_required': 'User interaction is required to complete authentication.',
    'login_required': 'Please sign in to continue.',
    'token_renewal_error': 'Token renewal failed. Please sign in again.',
    'invalid_grant': 'Authentication session has expired. Please sign in again.',
    'network_error': 'Network error occurred. Please check your connection.',
    'temporarily_unavailable': 'Authentication service is temporarily unavailable. Please try again later.'
  };
  
  const userMessage = errorMap[error.errorCode] || error.message || 'An unexpected authentication error occurred.';
  
  return {
    userMessage,
    errorCode: error.errorCode,
    technical: error.message,
    timestamp: Date.now()
  };
}

// Initialize authentication on module load
initializeMSAL().catch(error => {
  console.error('Failed to initialize MSAL on load:', error);
});