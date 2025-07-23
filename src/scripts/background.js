// src/background.js - Fixed Service Worker for DOM Style Injector Extension
// Compatible with Manifest V3 service worker requirements

console.log('DOM Style Injector: Background service worker initialized');

// Global variables for service worker context
let isInitialized = false;

// Constants
const SYNC_INTERVAL_MINUTES = 60;
const AUTH_CACHE_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

// KMSI helper functions - inline since we can't import in service worker
const KMSI = {
  async checkStatus() {
    try {
      const { kmsiToken, kmsiExpiration, kmsiEnabled } = await chrome.storage.local.get(['kmsiToken', 'kmsiExpiration', 'kmsiEnabled']);
      
      if (kmsiEnabled && kmsiToken && kmsiExpiration) {
        const bufferTime = 5 * 60 * 1000; // 5 minute buffer
        if (kmsiExpiration - bufferTime > Date.now()) {
          console.log('Active KMSI session found, expires:', new Date(kmsiExpiration).toLocaleString());
          return {
            active: true,
            token: kmsiToken,
            expiresAt: kmsiExpiration
          };
        }
      }
      
      return { active: false };
    } catch (error) {
      console.error('Error checking KMSI status:', error);
      return { active: false };
    }
  },
  
  async persistToken(token, expiresIn, isKMSI = false) {
    const expirationTime = Date.now() + (expiresIn * 1000);
    
    if (isKMSI) {
      await chrome.storage.local.set({
        kmsiToken: token,
        kmsiExpiration: expirationTime,
        kmsiEnabled: true,
        kmsiTimestamp: Date.now()
      });
      
      console.log('Token persisted with KMSI, expires:', new Date(expirationTime).toLocaleString());
    }
    
    await chrome.storage.session.set({
      authToken: token,
      tokenExpiration: expirationTime
    });
  },
  
  async clear() {
    await chrome.storage.local.remove(['kmsiToken', 'kmsiExpiration', 'kmsiEnabled', 'kmsiTimestamp']);
    console.log('KMSI session cleared');
  },
  
  shouldUseKMSI(expiresIn) {
    // If token expires in more than 8 hours, likely user selected "keep me signed in"
    const eightHoursInSeconds = 8 * 60 * 60;
    return expiresIn > eightHoursInSeconds;
  }
};

// Service worker lifecycle events
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details);

  try {
    switch (details.reason) {
      case 'install':
        await handleFirstTimeInstall();
        break;
      case 'update':
        await handleExtensionUpdate(details.previousVersion);
        break;
      default:
        console.log('Extension event:', details.reason);
    }
  } catch (error) {
    console.error('Installation/update handler error:', error);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser startup - initializing extension');
  await initializeExtension();
});

// Message handling from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);

  // Handle messages asynchronously
  handleMessage(request)
    .then(response => sendResponse(response))
    .catch(error => {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    });

  return true; // Keep message channel open for async response
});

// Main message handler
async function handleMessage(request) {
  // Always allow license checking
  if (request.action === 'checkLicense') {
    return await handleCheckLicense(request);
  }
  
  // Always allow authentication actions
  const authActions = ['authenticate', 'get-auth-status', 'get-cached-token', 'refresh-token'];
  if (authActions.includes(request.action)) {
    switch (request.action) {
      case 'authenticate':
        return await handleAuthentication(request);
      case 'get-auth-status':
        return await handleGetAuthStatus();
      case 'get-cached-token':
        return await handleGetCachedToken();
      case 'refresh-token':
        return await handleRefreshToken();
    }
  }
  
  // Check license for all other actions
  const { licenseStatus } = await chrome.storage.local.get('licenseStatus');
  
  if (!licenseStatus || !licenseStatus.valid) {
    console.warn(`Action blocked due to invalid license: ${request.action}`);
    return {
      success: false,
      error: 'Valid license required',
      requiresLicense: true,
      action: request.action
    };
  }
  
  // License is valid, proceed with action
  switch (request.action) {
    case 'checkUserRole':
      return await handleCheckUserRole(request);

    case 'logout':
      return await handleLogout();

    case 'sync-customizations':
      return await handleSyncCustomizations(request);

    case 'syncToDataverse':
      return await handleSyncToDataverse(request);

    case 'syncFromDataverse':
      return await handleSyncFromDataverse();

    case 'syncToSharePoint':
      return await handleSyncToSharePoint(request);

    case 'syncFromSharePoint':
      return await handleSyncFromSharePoint();

    case 'background-sync':
      return await handleBackgroundSync();

    default:
      console.log('Unknown message action:', request.action);
      return { success: false, error: 'Unknown action: ' + request.action };
  }
}

// Alarm handlers for periodic sync
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm triggered:', alarm.name);

  try {
    switch (alarm.name) {
      case 'periodic-sync':
        await performPeriodicSync();
        break;
      case 'token-refresh':
        await refreshAuthToken();
        break;
      case 'kmsi-token-refresh':
        console.log('KMSI token refresh triggered');
        await refreshKMSIToken();
        break;
      case 'cleanup-storage':
        await cleanupStorage();
        break;
      case 'license-check':
        console.log('Periodic license check triggered');
        await handleCheckLicense({});
        break;
      default:
        console.log('Unknown alarm:', alarm.name);
    }
  } catch (error) {
    console.error('Alarm handler error:', error);
  }
});

// Installation and initialization functions
async function handleFirstTimeInstall() {
  console.log('First time installation setup');

  try {
    // Set default values
    await chrome.storage.local.set({
      customizations: [],
      environment: 'production',
      lastSync: null,
      extensionVersion: chrome.runtime.getManifest().version,
      installDate: Date.now(),
      isAuthenticated: false
    });

    // Setup default sync settings
    await chrome.storage.sync.set({
      syncEnabled: true,
      autoSyncInterval: SYNC_INTERVAL_MINUTES,
      d365OrgUrl: '',
      dataverseTableName: 'cr123_domstylecustomizations', // Default custom table name
      debugMode: false
    });

    // Setup context menus
    await setupContextMenus();

    console.log('First time setup completed');

  } catch (error) {
    console.error('Error during first time setup:', error);
    throw error;
  }
}

async function handleExtensionUpdate(previousVersion) {
  console.log(`Extension updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`);

  try {
    // Update stored version info
    await chrome.storage.local.set({
      extensionVersion: chrome.runtime.getManifest().version,
      updateDate: Date.now(),
      previousVersion: previousVersion
    });

    // Perform migration if needed
    await performMigration(previousVersion);

    console.log('Extension update completed');

  } catch (error) {
    console.error('Error during extension update:', error);
    throw error;
  }
}

async function initializeExtension() {
  console.log('Initializing extension');
  
  try {
    // Check for KMSI tokens on startup
    const kmsiStatus = await KMSI.checkStatus();
    if (kmsiStatus.active) {
      console.log('Restoring KMSI session from previous authentication');
      // Restore authentication status
      await chrome.storage.local.set({
        isAuthenticated: true,
        authTimestamp: Date.now(),
        kmsiRestored: true
      });
      
      // Schedule token refresh before expiration
      const timeUntilRefresh = kmsiStatus.expiresAt - Date.now() - (30 * 60 * 1000); // 30 min before expiry
      if (timeUntilRefresh > 0) {
        chrome.alarms.create('kmsi-token-refresh', { delayInMinutes: timeUntilRefresh / 60000 });
      }
    }
    
    // Check if sync on startup is enabled
    const { syncOnStartup, licenseEndpoint } = await chrome.storage.sync.get(['syncOnStartup', 'licenseEndpoint']);
    
    if (syncOnStartup) {
      console.log('Sync on startup enabled - performing sync');
      await performPeriodicSync();
    }
    
    // Check license on startup
    console.log('Checking license on startup');
    await handleCheckLicense({});
  } catch (error) {
    console.error('Initialization sync error:', error);
  }

  if (isInitialized) {
    console.log('Extension already initialized');
    return;
  }

  try {
    // Initialize authentication for admin version
    await initializeAuth();

    // Setup periodic sync if authenticated
    const authStatus = await getAuthenticationStatus();
    if (authStatus.isAuthenticated) {
      await setupPeriodicSync();
    }

    // Setup context menus
    await setupContextMenus();

    isInitialized = true;
    console.log('Extension initialization completed');

  } catch (error) {
    console.error('Error initializing extension:', error);
    // Don't throw - allow extension to work in limited capacity
  }
}

// Authentication functions
async function initializeAuth() {
  try {
    // Check if we have the identity permission (admin version)
    const manifest = chrome.runtime.getManifest();
    const hasIdentityPermission = manifest.permissions?.includes('identity');

    if (!hasIdentityPermission) {
      console.log('No identity permission - user version detected');
      return { userVersion: true };
    }

    console.log('Extension with identity permission detected - initializing MSAL authentication');

    // Initialize MSAL configuration
    await initializeMSALConfig();

    return { adminVersion: true, msalInitialized: true };

  } catch (error) {
    console.error('Auth initialization error:', error);
    return { error: error.message };
  }
}

async function initializeMSALConfig() {
  try {
    // Get MSAL configuration from storage or use defaults
    const { msalConfig } = await chrome.storage.sync.get('msalConfig');

    if (!msalConfig || !msalConfig.clientId) {
      console.warn('MSAL configuration not found. Extension will use Chrome identity API as fallback.');
      return { fallbackMode: true };
    }

    console.log('MSAL configuration loaded successfully');
    return { msalConfigured: true };

  } catch (error) {
    console.error('MSAL configuration error:', error);
    return { error: error.message };
  }
}

async function handleAuthentication() {
  try {
    console.log('Starting Microsoft authentication flow...');

    // Check if we have identity permission
    const manifest = chrome.runtime.getManifest();
    if (!manifest.permissions?.includes('identity')) {
      throw new Error('Identity permission not available - user version cannot authenticate');
    }

    // Try MSAL authentication first, fall back to Chrome identity API
    let authToken;
    let authMethod = 'chrome-identity';

    try {
      // Attempt MSAL authentication
      authToken = await authenticateWithMSAL();
      authMethod = 'msal';
      console.log('Authentication successful via MSAL');
    } catch (msalError) {
      console.warn('MSAL authentication failed, falling back to Chrome identity API:', msalError.message);

      // Fallback to Chrome identity API
      authToken = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({
          interactive: true,
          scopes: [
            'https://graph.microsoft.com/User.Read',
            'https://graph.microsoft.com/.default'
          ]
        }, (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(token);
          }
        });
      });
      console.log('Authentication successful via Chrome identity API');
    }

    if (!authToken) {
      throw new Error('Failed to obtain authentication token from both MSAL and Chrome identity API');
    }

    // Validate token and get user information
    const userInfo = await validateTokenAndGetUserInfo(authToken);

    // Check token expiration to determine if KMSI should be used
    let expiresIn = 3600; // Default 1 hour
    let isKMSI = false;
    
    try {
      // Decode JWT token to get expiration
      const tokenParts = authToken.split('.');
      if (tokenParts.length === 3) {
        const base64Payload = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(globalThis.atob(base64Payload));
        
        if (payload.exp) {
          const expirationTime = payload.exp * 1000; // Convert to milliseconds
          expiresIn = Math.floor((expirationTime - Date.now()) / 1000);
          
          // Check if this is a KMSI token (longer than 8 hours)
          isKMSI = KMSI.shouldUseKMSI(expiresIn);
          
          if (isKMSI) {
            console.log('KMSI detected - token expires in', Math.floor(expiresIn / 3600), 'hours');
            await KMSI.persistToken(authToken, expiresIn, true);
          } else {
            console.log('Standard token - expires in', Math.floor(expiresIn / 3600), 'hours');
            await KMSI.persistToken(authToken, expiresIn, false);
          }
        }
      }
    } catch (decodeError) {
      console.warn('Could not decode token expiration:', decodeError);
      // Still persist token in session storage
      await KMSI.persistToken(authToken, expiresIn, false);
    }

    // Store authentication info
    await chrome.storage.local.set({
      isAuthenticated: true,
      authTimestamp: Date.now(),
      tokenLastRefresh: Date.now(),
      authMethod: authMethod,
      userInfo: userInfo,
      isKMSI: isKMSI
    });

    console.log('Authentication successful for user:', userInfo.displayName || userInfo.userPrincipalName);

    return {
      success: true,
      token: authToken,
      userInfo: userInfo,
      authMethod: authMethod,
      timestamp: Date.now(),
      isKMSI: isKMSI,
      expiresIn: expiresIn
    };

  } catch (error) {
    console.error('Authentication failed:', error);

    return {
      success: false,
      error: error.message,
      code: error.name || 'AUTH_ERROR'
    };
  }
}

// MSAL authentication function
async function authenticateWithMSAL() {
  try {
    // This would integrate with MSAL library
    // For now, we'll simulate MSAL authentication
    throw new Error('MSAL not fully implemented - using Chrome identity fallback');
  } catch (error) {
    throw new Error(`MSAL authentication failed: ${error.message}`);
  }
}

// Validate token and extract user information
async function validateTokenAndGetUserInfo(token) {
  try {
    // DEVELOPMENT MODE - Return mock user info
    const validator = new LicenseValidator();
    if (validator.isDevelopment) {
      console.log('🔧 DEVELOPMENT MODE: Returning mock user info');
      return {
        id: 'dev-user-' + Math.random().toString(36).substr(2, 9),
        displayName: 'Development User',
        userPrincipalName: 'devuser@devtenant.onmicrosoft.com',
        mail: 'devuser@devtenant.onmicrosoft.com',
        jobTitle: 'Developer',
        officeLocation: 'Development Environment',
        preferredLanguage: 'en-US'
      };
    }
    
    // Call Microsoft Graph to get user information
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status} ${response.statusText}`);
    }

    const userInfo = await response.json();

    return {
      id: userInfo.id,
      displayName: userInfo.displayName,
      userPrincipalName: userInfo.userPrincipalName,
      mail: userInfo.mail,
      jobTitle: userInfo.jobTitle,
      department: userInfo.department,
      companyName: userInfo.companyName
    };

  } catch (error) {
    console.error('Error validating token and getting user info:', error);
    throw error;
  }
}

async function handleGetAuthStatus() {
  try {
    const authStatus = await getAuthenticationStatus();
    return authStatus;
  } catch (error) {
    console.error('Error checking auth status:', error);
    return {
      isAuthenticated: false,
      error: error.message
    };
  }
}

async function handleCheckUserRole(request) {
  try {
    if (!request.token) {
      throw new Error('Authentication token required for role verification');
    }

    console.log('Starting System Customizer role verification...');

    // Check cached role first (but with shorter cache for security)
    const { userRole, userRoleDetails } = await chrome.storage.local.get(['userRole', 'userRoleDetails']);
    const ROLE_CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours for role caching (shorter for security)

    if (userRole && userRoleDetails && (Date.now() - userRole.timestamp < ROLE_CACHE_DURATION)) {
      console.log('Using cached System Customizer role verification');

      // Verify cached data integrity
      if (userRoleDetails.verification && userRoleDetails.verification.method === 'dataverse-api') {
        return {
          ...userRole,
          cached: true,
          details: userRoleDetails,
          message: userRoleDetails.message || 'Using cached role verification'
        };
      }
    }

    console.log('Cached role data expired or invalid, performing fresh System Customizer verification...');

    // Get D365 organization URL
    const d365OrgUrl = await getD365OrgUrl();
    if (!d365OrgUrl || d365OrgUrl.includes('yourorg.')) {
      throw new Error('Dynamics 365 organization URL not configured. Please configure your D365 organization URL in extension settings before proceeding.');
    }

    console.log(`Verifying System Customizer role against: ${d365OrgUrl}`);

    // Perform comprehensive role check in Dataverse
    const roleResult = await checkUserRoleInD365(request.token, d365OrgUrl);

    // Create standardized role response
    const userRoleData = {
      isAdmin: roleResult.isAdmin,
      roles: roleResult.roles || [],
      timestamp: Date.now(),
      d365OrgUrl: d365OrgUrl,
      verification: roleResult.verification || {
        method: 'dataverse-api',
        timestamp: Date.now(),
        success: roleResult.isAdmin
      },
      error: roleResult.error,
      message: roleResult.message
    };

    // Cache the result with detailed information
    await chrome.storage.local.set({
      userRole: userRoleData,
      userRoleDetails: roleResult
    });

    // Log role verification result
    if (roleResult.isAdmin) {
      console.log(`✅ System Customizer verification successful for role: ${roleResult.primaryRole}`);
      console.log(`User has admin privileges with roles: ${roleResult.roles.join(', ')}`);
    } else {
      console.log(`❌ System Customizer verification failed`);
      console.log(`User roles found: ${roleResult.roles.join(', ') || 'None'}`);
      console.log(`Error: ${roleResult.error || 'Insufficient privileges'}`);
    }

    // Return comprehensive role information
    return {
      ...userRoleData,
      details: roleResult,
      success: !roleResult.error,
      cached: false
    };

  } catch (error) {
    console.error('System Customizer role verification error:', error);

    // Store error details for troubleshooting
    await chrome.storage.local.set({
      lastRoleCheckError: {
        timestamp: Date.now(),
        error: error.message,
        stack: error.stack
      }
    });

    return {
      success: false,
      error: error.message,
      isAdmin: false,
      roles: [],
      timestamp: Date.now(),
      verification: {
        method: 'dataverse-api',
        timestamp: Date.now(),
        success: false,
        error: error.message
      },
      message: `System Customizer role verification failed: ${error.message}. Please ensure you have access to Dynamics 365 and the proper security role assigned.`
    };
  }
}

async function handleLogout() {
  try {
    // Clear Chrome identity token
    const manifest = chrome.runtime.getManifest();
    if (manifest.permissions?.includes('identity')) {
      await new Promise((resolve) => {
        chrome.identity.clearAllCachedAuthTokens(resolve);
      });
    }

    // Clear KMSI data
    await KMSI.clear();
    
    // Clear session storage
    await chrome.storage.session.clear();
    
    // Clear all authentication data
    await chrome.storage.local.remove([
      'isAuthenticated',
      'userInfo',
      'authTimestamp',
      'tokenLastRefresh',
      'userRole',
      'userRoleDetails',
      'kmsiRestored'
    ]);

    // Clear sync alarms
    await chrome.alarms.clearAll();

    console.log('Logout completed');

    return { success: true };

  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

// Synchronization functions - Updated for Dataverse
async function handleSyncCustomizations(request) {
  try {
    const direction = request.direction || 'bidirectional';
    console.log('Starting sync:', direction);

    // Check authentication
    const authStatus = await getAuthenticationStatus();
    if (!authStatus.isAuthenticated) {
      throw new Error('Authentication required for sync');
    }

    let result;
    switch (direction) {
      case 'upload': {
        const uploadResult = await syncToDataverse(request.token);
        result = uploadResult;
        break;
      }
      case 'download': {
        const downloadResult = await syncFromDataverse();
        result = downloadResult;
        break;
      }
      case 'bidirectional': {
        const uploadResult = await syncToDataverse(request.token);
        const downloadResult = await syncFromDataverse();
        result = {
          success: uploadResult.success && downloadResult.success,
          uploaded: uploadResult.count || 0,
          downloaded: downloadResult.count || 0
        };
        break;
      }
      default:
        throw new Error('Invalid sync direction: ' + direction);
    }

    // Update last sync time
    await chrome.storage.local.set({
      lastSyncTime: Date.now(),
      lastSyncResult: result
    });

    return result;

  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, error: error.message };
  }
}

async function handleSyncToDataverse(request) {
  return await syncToDataverse(request.token);
}

async function handleSyncFromDataverse() {
  return await syncFromDataverse();
}

async function handleSyncToSharePoint(request) {
  return await syncToSharePoint(request.token);
}

async function handleSyncFromSharePoint() {
  return await syncFromSharePoint();
}

async function handleBackgroundSync() {
  try {
    await performPeriodicSync();
    return { success: true };
  } catch (error) {
    console.error('Background sync error:', error);
    return { success: false, error: error.message };
  }
}

// Token management functions
async function handleGetCachedToken() {
  try {
    // First check for KMSI token
    const kmsiStatus = await KMSI.checkStatus();
    if (kmsiStatus.active) {
      console.log('Using KMSI token');
      return { success: true, token: kmsiStatus.token, kmsi: true };
    }
    
    // Then check session storage token
    const { authToken, tokenExpiration } = await chrome.storage.session.get(['authToken', 'tokenExpiration']);
    
    if (authToken && tokenExpiration) {
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      if (tokenExpiration - bufferTime > Date.now()) {
        console.log('Using session token');
        return { success: true, token: authToken, kmsi: false };
      }
    }
    
    // Fall back to checking regular auth status
    const { isAuthenticated, authTimestamp } = await chrome.storage.local.get(['isAuthenticated', 'authTimestamp']);

    if (!isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if token is still valid (within 8 hours)
    const tokenAge = Date.now() - (authTimestamp || 0);
    if (tokenAge > AUTH_CACHE_DURATION) {
      return { success: false, error: 'Token expired' };
    }

    // Get fresh token from Chrome identity
    const manifest = chrome.runtime.getManifest();
    if (!manifest.permissions?.includes('identity')) {
      return { success: false, error: 'Identity permission not available' };
    }

    const freshAuthToken = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });

    return { success: true, token: freshAuthToken, kmsi: false };

  } catch (error) {
    console.error('Get cached token error:', error);
    return { success: false, error: error.message };
  }
}

async function handleRefreshToken() {
  try {
    // Clear current token
    await new Promise((resolve) => {
      chrome.identity.clearAllCachedAuthTokens(resolve);
    });

    // Get new token
    const tokenResult = await handleAuthentication({});
    return tokenResult;

  } catch (error) {
    console.error('Token refresh error:', error);
    return { success: false, error: error.message };
  }
}

// Utility functions
async function getAuthenticationStatus() {
  try {
    // Check for KMSI token first
    const kmsiStatus = await KMSI.checkStatus();
    if (kmsiStatus.active) {
      return {
        isAuthenticated: true,
        tokenAge: 0,
        requiresRefresh: false,
        isKMSI: true,
        expiresAt: kmsiStatus.expiresAt
      };
    }
    
    // Check session storage token
    const { authToken, tokenExpiration } = await chrome.storage.session.get(['authToken', 'tokenExpiration']);
    
    if (authToken && tokenExpiration) {
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      if (tokenExpiration - bufferTime > Date.now()) {
        return {
          isAuthenticated: true,
          tokenAge: Date.now() - (tokenExpiration - (3600 * 1000)), // Approximate age
          requiresRefresh: false,
          isKMSI: false
        };
      }
    }
    
    // Fall back to regular auth check
    const { isAuthenticated, authTimestamp } = await chrome.storage.local.get(['isAuthenticated', 'authTimestamp']);

    if (!isAuthenticated || !authTimestamp) {
      return { isAuthenticated: false };
    }

    // Check if authentication is still valid
    const authAge = Date.now() - authTimestamp;
    const isExpired = authAge > AUTH_CACHE_DURATION;

    return {
      isAuthenticated: !isExpired,
      tokenAge: authAge,
      requiresRefresh: isExpired,
      isKMSI: false
    };

  } catch (error) {
    console.error('Error checking authentication status:', error);
    return { isAuthenticated: false, error: error.message };
  }
}

async function getD365OrgUrl() {
  try {
    // Check sync storage first (user configuration)
    const { d365OrgUrl } = await chrome.storage.sync.get('d365OrgUrl');
    if (d365OrgUrl && d365OrgUrl.trim()) {
      return d365OrgUrl.trim();
    }

    // Fallback to local storage
    const { environment = 'production' } = await chrome.storage.local.get('environment');

    const environments = {
      development: 'https://dev.api.crm.dynamics.com',
      staging: 'https://staging.api.crm.dynamics.com',
      production: 'https://yourorg.api.crm.dynamics.com' // This should be configured
    };

    return environments[environment] || environments.production;

  } catch (error) {
    console.error('Error getting D365 URL:', error);
    return 'https://yourorg.api.crm.dynamics.com';
  }
}

async function getDataverseTableName() {
  try {
    const { dataverseTableName } = await chrome.storage.sync.get('dataverseTableName');
    return dataverseTableName || 'cr123_domstylecustomizations'; // Default custom table name
  } catch (error) {
    console.error('Error getting Dataverse table name:', error);
    return 'cr123_domstylecustomizations';
  }
}

async function checkUserRoleInD365(authToken, orgUrl) {
  try {
    console.log('Checking user role in Dataverse for System Customizer access...');
    
    // DEVELOPMENT MODE - Return mock admin role
    const validator = new LicenseValidator();
    if (validator.isDevelopment) {
      const devSettings = validator.getDevModeSettings();
      const shouldMockAdmin = devSettings.mockAdminRole !== false; // Default true
      
      console.log('🔧 DEVELOPMENT MODE: Returning mock role', shouldMockAdmin ? '(Admin)' : '(User)');
      
      if (shouldMockAdmin) {
        return {
          isAdmin: true,
          roles: ['System Administrator', 'System Customizer'],
          roleDetails: [
            {
              name: 'System Administrator',
              id: 'mock-role-admin',
              businessUnitId: 'mock-bu-1'
            },
            {
              name: 'System Customizer',
              id: 'mock-role-customizer',
              businessUnitId: 'mock-bu-1'
            }
          ],
          primaryRole: 'System Administrator',
          privileges: {
            canCustomize: true,
            canAdminister: true,
            canCreateApps: true
          },
          verification: {
            method: 'development-mode',
            timestamp: Date.now(),
            orgUrl: orgUrl || 'https://devorg.crm.dynamics.com',
            userId: 'dev-user-12345',
            userDisplayName: 'Development User'
          },
          message: 'Development mode - full admin access granted'
        };
      } else {
        return {
          isAdmin: false,
          roles: ['Sales User'],
          roleDetails: [
            {
              name: 'Sales User',
              id: 'mock-role-sales',
              businessUnitId: 'mock-bu-1'
            }
          ],
          primaryRole: 'Sales User',
          privileges: {
            canCustomize: false,
            canAdminister: false,
            canCreateApps: false
          },
          verification: {
            method: 'development-mode',
            timestamp: Date.now(),
            orgUrl: orgUrl || 'https://devorg.crm.dynamics.com',
            userId: 'dev-user-12345',
            userDisplayName: 'Development User'
          },
          message: 'Development mode - regular user access'
        };
      }
    }

    // First, get user information from Microsoft Graph
    const userInfo = await validateTokenAndGetUserInfo(authToken);

    // Get the user's Azure AD Object ID for Dataverse lookup
    let userAadObjectId;

    try {
      // Try to decode the token to get AAD Object ID
      const tokenParts = authToken.split('.');
      if (tokenParts.length === 3) {
        // Use self.atob which is available in service worker context
        const base64Payload = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(globalThis.atob(base64Payload));
        userAadObjectId = payload.oid;
      }
    } catch (error) {
      console.warn('Could not decode token, using Graph API user ID as fallback:', error.message);
    }

    // Use either decoded OID or Graph user ID
    const lookupId = userAadObjectId || userInfo.id;

    if (!lookupId) {
      throw new Error("Could not determine user identifier for Dataverse lookup");
    }

    console.log(`Looking up user in Dataverse with identifier: ${lookupId.substring(0, 8)}...`);

    // Query Dataverse for user information using Azure AD Object ID
    const userQueryUrl = `${orgUrl}/api/data/v9.2/systemusers?$filter=azureactivedirectoryobjectid eq ${lookupId}&$select=systemuserid,fullname,domainname`;

    const userResponse = await fetch(userQueryUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Prefer': 'odata.include-annotations="*"'
      }
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      throw new Error(`Failed to fetch user from Dataverse: ${userResponse.status} ${userResponse.statusText}. ${errorText}`);
    }

    const userData = await userResponse.json();

    if (!userData.value || userData.value.length === 0) {
      throw new Error(`User with Azure AD Object ID ${lookupId} not found in Dataverse organization. Please ensure the user is properly synchronized and licensed in Dynamics 365.`);
    }

    const systemUser = userData.value[0];
    const systemUserId = systemUser.systemuserid;

    console.log(`Found Dataverse user: ${systemUser.fullname} (${systemUser.domainname})`);

    // Query for user's security roles with specific focus on System Customizer
    const roleQueryUrl = `${orgUrl}/api/data/v9.2/systemusers(${systemUserId})?$expand=systemuserroles_association($select=name,roleid,businessunitid)`;

    const roleResponse = await fetch(roleQueryUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Prefer': 'odata.include-annotations="*"'
      }
    });

    if (!roleResponse.ok) {
      const errorText = await roleResponse.text();
      throw new Error(`Failed to fetch user roles from Dataverse: ${roleResponse.status} ${roleResponse.statusText}. ${errorText}`);
    }

    const roleData = await roleResponse.json();
    const userRoles = roleData.systemuserroles_association || [];
    const roleNames = userRoles.map(role => role.name);

    console.log(`User roles found: ${roleNames.join(', ')}`);

    // Check specifically for System Customizer role (primary requirement)
    const hasSystemCustomizer = roleNames.includes('System Customizer');

    // Also check for System Administrator as it includes all privileges
    const hasSystemAdministrator = roleNames.includes('System Administrator');

    // Additional roles that might have customization privileges
    const hasEnvironmentMaker = roleNames.includes('Environment Maker');
    const hasCustomizationPrivileges = hasSystemCustomizer || hasSystemAdministrator;

    // Log detailed role analysis
    console.log('Role Analysis:', {
      hasSystemCustomizer,
      hasSystemAdministrator,
      hasEnvironmentMaker,
      totalRoles: roleNames.length,
      isAdmin: hasCustomizationPrivileges
    });

    // Detailed role verification with specific messaging
    const roleVerification = {
      isAdmin: hasCustomizationPrivileges,
      roles: roleNames,
      roleDetails: userRoles.map(role => ({
        name: role.name,
        id: role.roleid,
        businessUnitId: role.businessunitid
      })),
      primaryRole: hasSystemCustomizer ? 'System Customizer' :
        hasSystemAdministrator ? 'System Administrator' :
          'Standard User',
      privileges: {
        canCustomize: hasCustomizationPrivileges,
        canAdminister: hasSystemAdministrator,
        canCreateApps: hasEnvironmentMaker
      },
      verification: {
        method: 'dataverse-api',
        timestamp: Date.now(),
        orgUrl: orgUrl,
        userId: systemUserId,
        userDisplayName: systemUser.fullname
      }
    };

    // Store detailed role information for caching
    await chrome.storage.local.set({
      userRoleDetails: roleVerification,
      lastRoleCheck: Date.now()
    });

    if (!hasCustomizationPrivileges) {
      console.warn(`User ${systemUser.fullname} does not have System Customizer or System Administrator role. Current roles: ${roleNames.join(', ')}`);

      // Provide helpful guidance
      roleVerification.message = `To use admin features, you need the "System Customizer" security role in Dynamics 365. Current roles: ${roleNames.join(', ')}. Please contact your system administrator to request access.`;
    } else {
      console.log(`✅ User ${systemUser.fullname} has sufficient privileges with role: ${roleVerification.primaryRole}`);
      roleVerification.message = `Access granted with ${roleVerification.primaryRole} role.`;
    }

    return roleVerification;

  } catch (error) {
    console.error('Dataverse role check error:', error);

    // Return detailed error information
    return {
      isAdmin: false,
      roles: [],
      error: error.message,
      errorType: error.name || 'DataverseRoleCheckError',
      verification: {
        method: 'dataverse-api',
        timestamp: Date.now(),
        success: false,
        errorDetails: error.message
      },
      message: `Unable to verify System Customizer role: ${error.message}. Please ensure you have access to the Dynamics 365 organization and try again.`
    };
  }
}

// =============================================================================
// DATAVERSE CONFLICT RESOLUTION
// =============================================================================

// Conflict resolution strategies
const ConflictResolutionStrategy = {
  LOCAL_WINS: 'local_wins',
  REMOTE_WINS: 'remote_wins',
  NEWEST_WINS: 'newest_wins',
  MERGE: 'merge',
  MANUAL: 'manual'
};

// Check if two customizations are equal
function areCustomizationsEqual(custom1, custom2) {
  const props = ['name', 'selector', 'css', 'enabled', 'targetUrl', 'priority', 'category'];
  
  for (const prop of props) {
    if (custom1[prop] !== custom2[prop]) {
      return false;
    }
  }

  // Compare pseudo-classes
  const pseudo1 = custom1.pseudoClasses || {};
  const pseudo2 = custom2.pseudoClasses || {};
  
  if (Object.keys(pseudo1).length !== Object.keys(pseudo2).length) {
    return false;
  }

  for (const key in pseudo1) {
    if (JSON.stringify(pseudo1[key]) !== JSON.stringify(pseudo2[key])) {
      return false;
    }
  }

  return true;
}

// Resolve conflict between local and remote customization
async function resolveDataverseConflict(local, remote, strategy) {
  // Compare timestamps
  const localTime = new Date(local.modifiedOn || local.updated || local.created || 0).getTime();
  const remoteTime = new Date(remote.modifiedOn || remote.updated || remote.created || 0).getTime();

  // Check if there's actually a conflict
  if (areCustomizationsEqual(local, remote)) {
    return {
      hasConflict: false,
      resolved: remote,
      resolution: 'no_conflict'
    };
  }

  let resolved;
  let resolution;

  switch (strategy) {
    case ConflictResolutionStrategy.LOCAL_WINS:
      resolved = { ...local, conflictResolution: 'local_wins', source: 'local' };
      resolution = 'local_wins';
      break;

    case ConflictResolutionStrategy.REMOTE_WINS:
      resolved = { ...remote, conflictResolution: 'remote_wins', source: 'dataverse' };
      resolution = 'remote_wins';
      break;

    case ConflictResolutionStrategy.NEWEST_WINS:
      if (localTime > remoteTime) {
        resolved = { ...local, conflictResolution: 'local_newer', source: 'local' };
        resolution = 'local_newer';
      } else {
        resolved = { ...remote, conflictResolution: 'remote_newer', source: 'dataverse' };
        resolution = 'remote_newer';
      }
      break;

    case ConflictResolutionStrategy.MERGE:
      // Simple merge - combine CSS and keep newest of other properties
      resolved = {
        ...remote,
        name: localTime > remoteTime ? local.name : remote.name,
        css: mergeCss(local.css, remote.css),
        pseudoClasses: { ...(remote.pseudoClasses || {}), ...(local.pseudoClasses || {}) },
        enabled: local.enabled && remote.enabled,
        priority: Math.max(local.priority || 1, remote.priority || 1),
        conflictResolution: 'merged',
        source: 'merged',
        mergedAt: new Date().toISOString()
      };
      resolution = 'merged';
      break;

    default:
      // Default to remote wins
      resolved = { ...remote, conflictResolution: 'default_remote', source: 'dataverse' };
      resolution = 'default_remote';
  }

  return {
    hasConflict: true,
    resolved,
    resolution,
    localTime,
    remoteTime
  };
}

// Merge CSS strings
function mergeCss(css1, css2) {
  if (!css1) return css2;
  if (!css2) return css1;
  if (css1 === css2) return css1;

  // Simple merge - combine both with a comment separator
  return `/* === Local CSS === */\n${css1}\n\n/* === Remote CSS === */\n${css2}`;
}

// Get conflict resolution strategy from settings
async function getConflictResolutionStrategy() {
  try {
    const { conflictResolution } = await chrome.storage.sync.get('conflictResolution');
    return conflictResolution || ConflictResolutionStrategy.NEWEST_WINS;
  } catch (error) {
    console.error('Error getting conflict resolution strategy:', error);
    return ConflictResolutionStrategy.NEWEST_WINS;
  }
}

// =============================================================================
// DATAVERSE SYNCHRONIZATION
// =============================================================================

// Dataverse synchronization functions
async function syncToDataverse(authToken) {
  try {
    console.log('Syncing customizations to Dataverse...');

    // Get local customizations
    const { customizations = [] } = await chrome.storage.local.get('customizations');

    if (customizations.length === 0) {
      return { success: true, count: 0, message: 'No customizations to sync' };
    }

    const d365OrgUrl = await getD365OrgUrl();
    const tableName = await getDataverseTableName();

    let successCount = 0;
    const errors = [];

    for (const customization of customizations) {
      try {
        await syncCustomizationToDataverse(customization, authToken, d365OrgUrl, tableName);
        successCount++;
      } catch (error) {
        console.error(`Failed to sync customization ${customization.id}:`, error);
        errors.push({
          id: customization.id,
          name: customization.name,
          error: error.message
        });
      }
    }

    return {
      success: errors.length === 0,
      count: successCount,
      errors: errors,
      timestamp: Date.now()
    };

  } catch (error) {
    console.error('Dataverse sync error:', error);
    return { success: false, error: error.message };
  }
}

async function syncFromDataverse() {
  try {
    console.log('Syncing customizations from Dataverse...');

    // Get authentication token
    const { authToken } = await chrome.storage.session.get(['authToken']);
    if (!authToken) {
      throw new Error('Authentication required for Dataverse sync');
    }

    const d365OrgUrl = await getD365OrgUrl();
    const tableName = await getDataverseTableName();

    // Query Dataverse for customizations
    const queryUrl = `${d365OrgUrl}/api/data/v9.2/${tableName}?$select=cr123_customizationid,cr123_name,cr123_selector,cr123_css,cr123_javascript,cr123_enabled,cr123_description,cr123_targeturl,cr123_priority,cr123_category,cr123_pseudoclasses,createdon,modifiedon,_createdby_value&$filter=statecode eq 0&$orderby=cr123_priority asc,cr123_name asc`;

    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Prefer': 'odata.include-annotations="*"'
      }
    });

    if (!response.ok) {
      throw new Error(`Dataverse query failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const dataverseCustomizations = data.value || [];

    // Transform Dataverse records to local format
    const customizations = dataverseCustomizations.map(record => ({
      id: record.cr123_customizationid || generateId(),
      name: record.cr123_name,
      selector: record.cr123_selector,
      css: record.cr123_css || '',
      javascript: record.cr123_javascript || '',
      enabled: record.cr123_enabled || false,
      description: record.cr123_description || '',
      targetUrl: record.cr123_targeturl || '',
      priority: record.cr123_priority || 1,
      category: record.cr123_category || 'General',
      pseudoClasses: record.cr123_pseudoclasses ? JSON.parse(record.cr123_pseudoclasses) : {},
      createdOn: record.createdon,
      modifiedOn: record.modifiedon,
      source: 'dataverse',
      dataverseId: record[`${tableName}id`]
    }));

    // Get local customizations and conflict resolution strategy
    const { customizations: localCustomizations = [] } = await chrome.storage.local.get('customizations');
    const strategy = await getConflictResolutionStrategy();
    
    // Create maps for efficient lookup
    const localMap = new Map(localCustomizations.map(c => [c.id, c]));
    const remoteMap = new Map(customizations.map(c => [c.id, c]));
    
    // Process conflicts and merge
    const mergedCustomizations = [];
    const conflicts = [];
    const resolutions = [];
    
    // Process all unique IDs
    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
    
    for (const id of allIds) {
      const local = localMap.get(id);
      const remote = remoteMap.get(id);
      
      if (local && remote) {
        // Both exist - potential conflict
        const result = await resolveDataverseConflict(local, remote, strategy);
        
        if (result.hasConflict) {
          conflicts.push({
            id,
            local,
            remote,
            resolution: result.resolution,
            resolved: result.resolved
          });
          resolutions.push(result.resolution);
        }
        
        mergedCustomizations.push(result.resolved);
      } else if (local && !remote) {
        // Only exists locally - keep it
        mergedCustomizations.push({ ...local, source: 'local' });
      } else if (!local && remote) {
        // Only exists remotely - add it
        mergedCustomizations.push({ ...remote, source: 'dataverse' });
      }
    }

    // Store conflict resolution history if there were conflicts
    if (conflicts.length > 0) {
      const conflictHistory = await chrome.storage.local.get('conflictHistory') || {};
      conflictHistory.dataverse = conflictHistory.dataverse || [];
      conflictHistory.dataverse.push({
        timestamp: new Date().toISOString(),
        conflicts: conflicts.length,
        resolutions,
        strategy
      });
      await chrome.storage.local.set({ conflictHistory });
    }

    // Update local storage
    await chrome.storage.local.set({
      customizations: mergedCustomizations,
      lastDataverseSync: new Date().toISOString(),
      dataverseSyncCount: customizations.length,
      lastSyncConflicts: conflicts
    });

    return {
      success: true,
      count: customizations.length,
      totalCount: mergedCustomizations.length,
      conflicts: conflicts.length,
      conflictResolutions: resolutions,
      strategy,
      timestamp: Date.now(),
      message: `Synced ${customizations.length} customizations from Dataverse${conflicts.length > 0 ? ` with ${conflicts.length} conflicts resolved using ${strategy} strategy` : ''}`
    };

  } catch (error) {
    console.error('Dataverse sync error:', error);
    return { success: false, error: error.message };
  }
}

async function syncCustomizationToDataverse(customization, authToken, orgUrl, tableName) {
  try {
    // Check if record already exists
    const existingRecord = await findExistingDataverseRecord(customization.id, authToken, orgUrl, tableName);
    
    // If it exists, check for conflicts
    if (existingRecord && existingRecord.data) {
      const strategy = await getConflictResolutionStrategy();
      
      // Transform the existing Dataverse record to local format for comparison
      const remoteCustomization = {
        id: existingRecord.data.cr123_customizationid,
        name: existingRecord.data.cr123_name,
        selector: existingRecord.data.cr123_selector,
        css: existingRecord.data.cr123_css || '',
        enabled: existingRecord.data.cr123_enabled,
        targetUrl: existingRecord.data.cr123_targeturl || '',
        priority: existingRecord.data.cr123_priority || 1,
        category: existingRecord.data.cr123_category || 'General',
        pseudoClasses: existingRecord.data.cr123_pseudoclasses ? JSON.parse(existingRecord.data.cr123_pseudoclasses) : {},
        modifiedOn: existingRecord.data.modifiedon
      };
      
      // Check for conflicts
      const conflictResult = await resolveDataverseConflict(customization, remoteCustomization, strategy);
      
      if (conflictResult.hasConflict) {
        console.log(`Conflict detected for ${customization.name}, resolved with: ${conflictResult.resolution}`);
        
        // Use the resolved version
        customization = conflictResult.resolved;
      }
    }
    
    // Prepare data for Dataverse custom table
    const dataverseRecord = {
      'cr123_customizationid': customization.id,
      'cr123_name': customization.name,
      'cr123_selector': customization.selector,
      'cr123_css': customization.css || '',
      'cr123_javascript': customization.javascript || '',
      'cr123_enabled': customization.enabled !== false,
      'cr123_description': customization.description || '',
      'cr123_targeturl': customization.targetUrl || '',
      'cr123_priority': customization.priority || 1,
      'cr123_category': customization.category || 'General',
      'cr123_pseudoclasses': customization.pseudoClasses ? JSON.stringify(customization.pseudoClasses) : null
    };

    let response;
    if (existingRecord) {
      // Update existing record
      response = await fetch(`${orgUrl}/api/data/v9.2/${tableName}(${existingRecord.id})`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          'If-Match': '*' // Force update regardless of ETag
        },
        body: JSON.stringify(dataverseRecord)
      });
    } else {
      // Create new record
      dataverseRecord['cr123_externalid'] = customization.id; // Store original ID for reference

      response = await fetch(`${orgUrl}/api/data/v9.2/${tableName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        },
        body: JSON.stringify(dataverseRecord)
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dataverse API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log(`Successfully synced customization ${customization.name} to Dataverse`);
    return { success: true, action: existingRecord ? 'updated' : 'created' };

  } catch (error) {
    console.error(`Error syncing customization ${customization.name} to Dataverse:`, error);
    throw error;
  }
}

async function findExistingDataverseRecord(externalId, authToken, orgUrl, tableName) {
  try {
    const response = await fetch(
      `${orgUrl}/api/data/v9.2/${tableName}?$filter=cr123_customizationid eq '${externalId}'&$select=${tableName}id,cr123_customizationid,cr123_name,cr123_selector,cr123_css,cr123_javascript,cr123_enabled,cr123_description,cr123_targeturl,cr123_priority,cr123_category,cr123_pseudoclasses,modifiedon`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    if (!response.ok) {
      return null; // Record doesn't exist or error occurred
    }

    const data = await response.json();
    if (data.value && data.value.length > 0) {
      const record = data.value[0];
      return {
        id: record[`${tableName}id`],
        data: record // Return full data for conflict resolution
      };
    }
    return null;

  } catch (error) {
    console.error('Error finding existing Dataverse record:', error);
    return null;
  }
}

// SharePoint synchronization functions (alternative to Dataverse)
async function syncToSharePoint(authToken) {
  try {
    console.log('Syncing customizations to SharePoint...');

    // Get SharePoint configuration
    const { sharePointUrl, sharePointListName } = await chrome.storage.sync.get(['sharePointUrl', 'sharePointListName']);
    
    if (!sharePointUrl || !sharePointListName) {
      throw new Error('SharePoint configuration missing. Please configure SharePoint URL and list name in settings.');
    }

    // Get local customizations
    const { customizations = [] } = await chrome.storage.local.get('customizations');

    if (customizations.length === 0) {
      return { success: true, count: 0, message: 'No customizations to sync' };
    }

    // Get SharePoint list metadata
    const listUrl = `${sharePointUrl}/_api/web/lists/getbytitle('${sharePointListName}')`;
    const listResponse = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json;odata=verbose'
      }
    });

    if (!listResponse.ok) {
      throw new Error(`SharePoint list access failed: ${listResponse.status} ${listResponse.statusText}`);
    }

    let successCount = 0;
    const errors = [];

    // Sync each customization to SharePoint
    for (const customization of customizations) {
      try {
        await syncCustomizationToSharePoint(customization, authToken, sharePointUrl, sharePointListName);
        successCount++;
      } catch (error) {
        console.error(`Failed to sync customization ${customization.name}:`, error);
        errors.push({
          name: customization.name,
          error: error.message
        });
      }
    }

    return {
      success: errors.length === 0,
      count: successCount,
      errors: errors,
      timestamp: Date.now(),
      message: `Synced ${successCount} of ${customizations.length} customizations to SharePoint`
    };

  } catch (error) {
    console.error('SharePoint sync error:', error);
    return { success: false, error: error.message };
  }
}

async function syncFromSharePoint() {
  try {
    console.log('Syncing customizations from SharePoint...');

    // Get authentication token
    const { authToken } = await chrome.storage.session.get(['authToken']);
    if (!authToken) {
      throw new Error('Authentication required for SharePoint sync');
    }

    // Get SharePoint configuration
    const { sharePointUrl, sharePointListName } = await chrome.storage.sync.get(['sharePointUrl', 'sharePointListName']);
    
    if (!sharePointUrl || !sharePointListName) {
      throw new Error('SharePoint configuration missing');
    }

    // Query SharePoint list
    const queryUrl = `${sharePointUrl}/_api/web/lists/getbytitle('${sharePointListName}')/items?$select=ID,Title,Selector,CSS,JavaScript,Enabled,Description,TargetURL,Priority,Category,PseudoClasses,Created,Modified,Author/Title&$expand=Author&$filter=Enabled eq true&$orderby=Priority asc,Title asc`;

    const response = await fetch(queryUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json;odata=verbose'
      }
    });

    if (!response.ok) {
      throw new Error(`SharePoint query failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const sharePointItems = data.d.results || [];

    // Transform SharePoint items to local format
    const customizations = sharePointItems.map(item => ({
      id: `sp_${item.ID}`,
      name: item.Title,
      selector: item.Selector,
      css: item.CSS || '',
      javascript: item.JavaScript || '',
      enabled: item.Enabled !== false,
      description: item.Description || '',
      targetUrl: item.TargetURL || '',
      priority: item.Priority || 1,
      category: item.Category || 'General',
      pseudoClasses: item.PseudoClasses ? JSON.parse(item.PseudoClasses) : {},
      createdOn: item.Created,
      modifiedOn: item.Modified,
      createdBy: item.Author ? item.Author.Title : 'Unknown',
      source: 'sharepoint',
      sharePointId: item.ID
    }));

    // Merge with local customizations
    const { customizations: localCustomizations = [] } = await chrome.storage.local.get('customizations');
    
    // Keep local customizations that don't exist in SharePoint
    const localOnly = localCustomizations.filter(local => 
      !local.source || local.source === 'local'
    );

    // Merge arrays, with SharePoint taking precedence
    const mergedCustomizations = [...customizations, ...localOnly];

    // Update local storage
    await chrome.storage.local.set({
      customizations: mergedCustomizations,
      lastSharePointSync: new Date().toISOString(),
      sharePointSyncCount: customizations.length
    });

    return {
      success: true,
      count: customizations.length,
      totalCount: mergedCustomizations.length,
      timestamp: Date.now(),
      message: `Synced ${customizations.length} customizations from SharePoint`
    };

  } catch (error) {
    console.error('SharePoint sync error:', error);
    return { success: false, error: error.message };
  }
}

async function syncCustomizationToSharePoint(customization, authToken, sharePointUrl, listName) {
  try {
    // Prepare data for SharePoint list
    const sharePointItem = {
      '__metadata': { 'type': 'SP.Data.' + listName.replace(/\s/g, '') + 'ListItem' },
      'Title': customization.name,
      'Selector': customization.selector,
      'CSS': customization.css || '',
      'JavaScript': customization.javascript || '',
      'Enabled': customization.enabled !== false,
      'Description': customization.description || '',
      'TargetURL': customization.targetUrl || '',
      'Priority': customization.priority || 1,
      'Category': customization.category || 'General',
      'PseudoClasses': customization.pseudoClasses ? JSON.stringify(customization.pseudoClasses) : '',
      'ExternalID': customization.id
    };

    // Check if item already exists
    const existingItem = await findExistingSharePointItem(customization.id, authToken, sharePointUrl, listName);

    let response;
    if (existingItem) {
      // Update existing item
      response = await fetch(`${sharePointUrl}/_api/web/lists/getbytitle('${listName}')/items(${existingItem.ID})`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose',
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE'
        },
        body: JSON.stringify(sharePointItem)
      });
    } else {
      // Create new item
      response = await fetch(`${sharePointUrl}/_api/web/lists/getbytitle('${listName}')/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose'
        },
        body: JSON.stringify(sharePointItem)
      });
    }

    if (!response.ok) {
      throw new Error(`SharePoint API error: ${response.status} ${response.statusText}`);
    }

    console.log(`Successfully synced customization ${customization.name} to SharePoint`);

  } catch (error) {
    console.error(`Error syncing customization ${customization.name} to SharePoint:`, error);
    throw error;
  }
}

async function findExistingSharePointItem(externalId, authToken, sharePointUrl, listName) {
  try {
    const queryUrl = `${sharePointUrl}/_api/web/lists/getbytitle('${listName}')/items?$filter=ExternalID eq '${externalId}'&$select=ID`;
    
    const response = await fetch(queryUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json;odata=verbose'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.d.results && data.d.results.length > 0 ? data.d.results[0] : null;

  } catch (error) {
    console.error('Error finding existing SharePoint item:', error);
    return null;
  }
}

async function performPeriodicSync() {
  console.log('Performing periodic sync');

  try {
    const authStatus = await getAuthenticationStatus();

    if (!authStatus.isAuthenticated) {
      console.log('Not authenticated - skipping periodic sync');
      return;
    }

    // Only download updates during periodic sync to avoid conflicts
    const result = await syncFromDataverse();

    // Update last sync time
    await chrome.storage.local.set({
      lastPeriodicSync: Date.now(),
      lastPeriodicSyncResult: result
    });

    console.log('Periodic sync completed:', result);

  } catch (error) {
    console.error('Periodic sync failed:', error);

    // Store error for debugging
    await chrome.storage.local.set({
      lastSyncError: {
        timestamp: Date.now(),
        error: error.message,
        type: 'periodic'
      }
    });
  }
}

async function setupPeriodicSync() {
  try {
    const { syncEnabled, autoSyncInterval } = await chrome.storage.sync.get(['syncEnabled', 'autoSyncInterval']);

    // Clear existing alarms
    await chrome.alarms.clear('periodic-sync');

    if (syncEnabled) {
      const interval = autoSyncInterval || SYNC_INTERVAL_MINUTES;

      await chrome.alarms.create('periodic-sync', {
        delayInMinutes: interval,
        periodInMinutes: interval
      });

      console.log(`Periodic sync setup with ${interval} minute interval`);
    } else {
      console.log('Periodic sync disabled');
    }

  } catch (error) {
    console.error('Error setting up periodic sync:', error);
  }
}

async function setupContextMenus() {
  try {
    // Clear existing context menus
    await chrome.contextMenus.removeAll();

    // Add context menu for customization
    chrome.contextMenus.create({
      id: 'add-customization',
      title: 'Add DOM Style Customization',
      contexts: ['page'],
      documentUrlPatterns: [
        'https://*.dynamics.com/*',
        'https://*.crm.dynamics.com/*',
        'https://*.crm2.dynamics.com/*',
        'https://*.crm3.dynamics.com/*',
        'https://*.crm4.dynamics.com/*',
        'https://*.crm5.dynamics.com/*'
      ]
    });

    console.log('Context menus setup completed');

  } catch (error) {
    console.error('Error setting up context menus:', error);
  }
}

async function refreshAuthToken() {
  try {
    const authStatus = await getAuthenticationStatus();

    if (!authStatus.isAuthenticated) {
      console.log('Not authenticated - skipping token refresh');
      return;
    }

    // Refresh token using Chrome identity
    const tokenResult = await handleRefreshToken();

    if (tokenResult.success) {
      console.log('Auth token refreshed successfully');

      // Update refresh timestamp
      await chrome.storage.local.set({
        tokenLastRefresh: Date.now()
      });
    } else {
      console.error('Token refresh failed:', tokenResult.error);
    }

  } catch (error) {
    console.error('Token refresh error:', error);
  }
}

async function refreshKMSIToken() {
  try {
    console.log('Refreshing KMSI token...');
    
    // Check if we still have a valid KMSI session
    const kmsiStatus = await KMSI.checkStatus();
    if (!kmsiStatus.active) {
      console.log('KMSI session no longer active, skipping refresh');
      return;
    }
    
    // Get fresh token
    const manifest = chrome.runtime.getManifest();
    if (!manifest.permissions?.includes('identity')) {
      console.error('Identity permission not available for KMSI refresh');
      return;
    }
    
    const authToken = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });
    
    if (authToken) {
      // Decode token to get new expiration
      let expiresIn = 3600; // Default 1 hour
      
      try {
        const tokenParts = authToken.split('.');
        if (tokenParts.length === 3) {
          const base64Payload = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(globalThis.atob(base64Payload));
          
          if (payload.exp) {
            const expirationTime = payload.exp * 1000;
            expiresIn = Math.floor((expirationTime - Date.now()) / 1000);
          }
        }
      } catch (error) {
        console.warn('Could not decode refreshed token:', error);
      }
      
      // Check if it's still a KMSI token
      const isKMSI = KMSI.shouldUseKMSI(expiresIn);
      
      if (isKMSI) {
        await KMSI.persistToken(authToken, expiresIn, true);
        console.log('KMSI token refreshed, expires in', Math.floor(expiresIn / 3600), 'hours');
        
        // Schedule next refresh
        const timeUntilRefresh = expiresIn - (30 * 60); // 30 min before expiry
        if (timeUntilRefresh > 0) {
          chrome.alarms.create('kmsi-token-refresh', { delayInMinutes: timeUntilRefresh / 60 });
        }
      } else {
        console.log('Refreshed token is not KMSI, clearing KMSI data');
        await KMSI.clear();
      }
    }
    
  } catch (error) {
    console.error('KMSI token refresh error:', error);
    // Clear KMSI data on error
    await KMSI.clear();
  }
}

async function performMigration(previousVersion) {
  console.log(`Performing migration from version ${previousVersion}`);

  try {
    // Version-specific migration logic
    const currentVersion = chrome.runtime.getManifest().version;

    if (previousVersion.startsWith('1.')) {
      // Migration from v1.x to v2.x
      console.log('Migrating from v1.x to v2.x');

      // Migrate old storage format if needed
      const oldData = await chrome.storage.local.get(['styles', 'rules']);
      if (oldData.styles || oldData.rules) {
        const customizations = [
          ...(oldData.styles || []),
          ...(oldData.rules || [])
        ].map(item => ({
          ...item,
          id: item.id || generateId(),
          migrated: true,
          migratedAt: Date.now()
        }));

        await chrome.storage.local.set({ customizations });
        await chrome.storage.local.remove(['styles', 'rules']);

        console.log(`Migrated ${customizations.length} customizations`);
      }
    }

    // Update migration info
    await chrome.storage.local.set({
      migrationCompleted: Date.now(),
      migratedFrom: previousVersion,
      migratedTo: currentVersion
    });

    console.log('Migration completed successfully');

  } catch (error) {
    console.error('Migration error:', error);

    // Store migration error for debugging
    await chrome.storage.local.set({
      migrationError: {
        timestamp: Date.now(),
        error: error.message,
        fromVersion: previousVersion
      }
    });
  }
}

async function cleanupStorage() {
  try {
    console.log('Performing storage cleanup');

    // Clean up old sync errors (keep only last 10)
    const { syncErrors = [] } = await chrome.storage.local.get('syncErrors');
    if (syncErrors.length > 10) {
      const recentErrors = syncErrors.slice(-10);
      await chrome.storage.local.set({ syncErrors: recentErrors });
    }

    // Clean up expired tokens and temporary data
    const keysToCheck = ['tempToken', 'tempAuthData', 'processingSync'];
    const data = await chrome.storage.local.get(keysToCheck);

    for (const [key, value] of Object.entries(data)) {
      if (value && value.timestamp) {
        const age = Date.now() - value.timestamp;
        if (age > 24 * 60 * 60 * 1000) { // 24 hours
          await chrome.storage.local.remove(key);
          console.log(`Cleaned up expired data: ${key}`);
        }
      }
    }

    console.log('Storage cleanup completed');

  } catch (error) {
    console.error('Storage cleanup error:', error);
  }
}

// Utility function to generate unique IDs
function generateId() {
  return 'cust_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'add-customization') {
    try {
      // Open popup or send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'show-customization-dialog',
        elementInfo: {
          url: info.pageUrl,
          frameUrl: info.frameUrl
        }
      });

      console.log('Context menu action completed:', response);

    } catch (error) {
      console.error('Context menu action error:', error);
    }
  }
});

// Initialize extension when service worker starts
initializeExtension().catch(error => {
  console.error('Failed to initialize extension:', error);
});

// Secure Backend Client for sensitive operations
class SecureBackendClient {
  constructor() {
    this.baseUrl = this.getBackendUrl();
    this.extensionVersion = chrome.runtime.getManifest().version;
  }
  
  getBackendUrl() {
    const isDev = chrome.runtime.getManifest().version.includes('dev') ||
                  localStorage.getItem('DEV_MODE') === 'true';
    
    // In development, use local Docker container
    if (isDev) {
      return 'http://localhost:3000';
    }
    
    // In production, use your actual backend URL
    // TODO: Update this with your production backend URL
    return 'https://api.yourdomain.com';
  }
  
  async request(endpoint, data = {}) {
    try {
      const token = await this.getUserToken();
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Extension-Version': this.extensionVersion,
          'X-Request-ID': crypto.randomUUID()
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
    const result = await handleGetCachedToken();
    if (!result.success || !result.token) {
      throw new Error('No valid authentication token');
    }
    return result.token;
  }
}

// License checking functionality - Microsoft 365 Admin Center Integration
class LicenseValidator {
  constructor() {
    // Check if we're in development mode
    this.isDevelopment = this.checkDevelopmentMode();
    
    // Initialize secure backend client
    this.backendClient = new SecureBackendClient();
    
    // Public configuration only - no secrets!
    this.publicConfig = {
      clientId: 'YOUR_PUBLIC_CLIENT_ID', // This is public, OK to be in code
      authority: 'https://login.microsoftonline.com/common'
    };
  }
  
  checkDevelopmentMode() {
    // Multiple ways to enable dev mode
    const manifest = chrome.runtime.getManifest();
    
    // Check manifest version for dev/beta
    if (manifest.version.includes('dev') || manifest.version.includes('beta')) {
      return true;
    }
    
    // Check if extension is unpacked (dev mode)
    if (!chrome.runtime.id || chrome.runtime.id.length !== 32) {
      return true;
    }
    
    // Check storage for dev mode flag
    const devModeEnabled = localStorage.getItem('DEV_MODE') === 'true';
    if (devModeEnabled) {
      return true;
    }
    
    // Check for development manifest key
    if (manifest.key && manifest.key.includes('MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQ')) {
      return false; // Production key pattern
    }
    
    return false;
  }
  
  getDevModeSettings() {
    try {
      const settings = localStorage.getItem('DEV_MODE_SETTINGS');
      return settings ? JSON.parse(settings) : {};
    } catch (error) {
      return {};
    }
  }

  async validateUserLicense(accessToken) {
    try {
      console.log('Validating Microsoft 365 license...');
      
      // DEVELOPMENT MODE - Return mock license
      if (this.isDevelopment) {
        console.log('🔧 DEVELOPMENT MODE: Returning mock license');
        return this.getMockLicenseResponse(true);
      }

      // In production, use secure backend for license validation
      // The backend holds the client secret and makes the actual Graph API calls
      const { d365OrgUrl } = await chrome.storage.sync.get('d365OrgUrl');
      const tenantId = this.extractTenantId(d365OrgUrl);
      
      // Call your secure backend - no secrets in the extension!
      const licenseResult = await this.backendClient.request('/api/license/validate', {
        tenantId: tenantId
      });
      
      return licenseResult;
      
    } catch (error) {
      console.error('License validation error:', error);
      
      // Handle specific error cases
      if (error.message.includes('401') || error.message.includes('auth')) {
        return {
          valid: false,
          error: 'Authentication required',
          requiresAuth: true
        };
      }
      
      return {
        valid: false,
        error: error.message,
        fallbackToCache: true
      };
    }
  }
  
  extractTenantId(d365OrgUrl) {
    if (!d365OrgUrl) return null;
    const match = d365OrgUrl.match(/https:\/\/([\w-]+)\./);
    return match ? match[1] : null;
  }
  
  // Mock response for development
  getMockLicenseResponse(isValid = true) {
    // Check dev mode settings
    const devSettings = this.getDevModeSettings();
    const shouldMockValid = devSettings.mockValidLicense !== false; // Default true
    
    const mockTenantId = devSettings.mockTenantId || 'dev-tenant-' + Math.random().toString(36).substr(2, 9);
    
    if (shouldMockValid && isValid) {
      return {
        valid: true,
        licensed: true,
        details: {
          skuPartNumber: 'DOMSTYLEINJECTOR_PREMIUM_DEV',
          servicePlans: [
            {
              servicePlanId: this.licenseServicePlanId,
              servicePlanName: 'DOM_STYLE_INJECTOR_DEV',
              provisioningStatus: 'Success'
            }
          ]
        },
        expiresOn: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        assignedOn: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        licenseType: 'Premium Development',
        tenantId: mockTenantId,
        tenantName: 'Development Tenant',
        features: {
          maxCustomizations: -1, // Unlimited
          syncEnabled: true,
          advancedFeatures: true,
          supportLevel: 'premium'
        },
        isDevelopment: true
      };
    } else {
      return {
        valid: false,
        licensed: false,
        hasUnassignedLicenses: false,
        message: 'No valid license found (Development Mode)',
        isDevelopment: true
      };
    }
  }

  // In production, these methods won't be called directly
  // They're kept for development mode only
  async getUserLicenses(accessToken) {
    // DEVELOPMENT MODE ONLY
    if (this.isDevelopment) {
      console.log('🔧 DEVELOPMENT MODE: Returning mock user licenses');
      return this.getMockUserLicenses();
    }
    
    // In production, the backend handles all Graph API calls
    throw new Error('Direct API calls not allowed - use secure backend');
  }
  
  getMockUserLicenses() {
    return [
      {
        id: 'mock-license-1',
        skuId: this.skuId,
        skuPartNumber: 'DOMSTYLEINJECTOR_PREMIUM_DEV',
        assignedDateTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        servicePlans: [
          {
            servicePlanId: this.licenseServicePlanId,
            servicePlanName: 'DOM_STYLE_INJECTOR_DEV',
            provisioningStatus: 'Success',
            appliesTo: 'User'
          }
        ]
      }
    ];
  }

  async getTenantLicenses(accessToken) {
    try {
      // DEVELOPMENT MODE - Return mock tenant licenses
      if (this.isDevelopment) {
        console.log('🔧 DEVELOPMENT MODE: Returning mock tenant licenses');
        return this.getMockTenantLicenses();
      }
      
      const response = await fetch(`${this.graphEndpoint}/subscribedSkus`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get tenant licenses: ${response.status}`);
      }

      const data = await response.json();
      return data.value || [];
    } catch (error) {
      console.warn('Could not fetch tenant licenses:', error);
      return [];
    }
  }
  
  getMockTenantLicenses() {
    return [
      {
        id: 'mock-sku-1',
        skuId: this.skuId,
        skuPartNumber: 'DOMSTYLEINJECTOR_PREMIUM_DEV',
        prepaidUnits: {
          enabled: 10,
          suspended: 0,
          warning: 0
        },
        consumedUnits: 5, // 5 assigned, 5 available
        servicePlans: [
          {
            servicePlanId: this.licenseServicePlanId,
            servicePlanName: 'DOM_STYLE_INJECTOR_DEV',
            provisioningStatus: 'Success',
            appliesTo: 'User'
          }
        ]
      }
    ];
  }

  checkForValidLicense(userLicenses) {
    return userLicenses.find(license => {
      // Check if license contains our service plan
      const hasServicePlan = license.servicePlans?.some(plan => 
        plan.servicePlanId === this.licenseServicePlanId &&
        plan.provisioningStatus === 'Success'
      );
      
      return hasServicePlan || license.skuId === this.skuId;
    });
  }

  checkForUnassignedLicenses(tenantLicenses) {
    const extensionSku = tenantLicenses.find(sku => 
      sku.skuId === this.skuId || 
      sku.servicePlans?.some(plan => plan.servicePlanId === this.licenseServicePlanId)
    );
    
    if (extensionSku) {
      const available = extensionSku.prepaidUnits.enabled - extensionSku.consumedUnits;
      return available > 0;
    }
    
    return false;
  }

  async getLicenseDetails(accessToken, license) {
    try {
      // Get additional details about the license
      const response = await fetch(`${this.graphEndpoint}/me/licenseDetails/${license.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get license details');
      }

      const details = await response.json();
      
      // Get tenant information
      const tenantInfo = await this.getTenantInfo(accessToken);
      
      return {
        ...details,
        tenantId: tenantInfo.id,
        tenantName: tenantInfo.displayName,
        assignedDate: license.assignedDateTime,
        expiryDate: this.calculateExpiryDate(license),
        features: this.getEnabledFeatures(license.servicePlans)
      };
    } catch (error) {
      console.warn('Could not fetch detailed license info:', error);
      return license;
    }
  }

  async getTenantInfo(accessToken) {
    try {
      // DEVELOPMENT MODE - Return mock tenant info
      if (this.isDevelopment) {
        console.log('🔧 DEVELOPMENT MODE: Returning mock tenant info');
        return {
          id: 'dev-tenant-' + Math.random().toString(36).substr(2, 9),
          displayName: 'Development Tenant',
          verifiedDomains: [
            {
              name: 'devtenant.onmicrosoft.com',
              isDefault: true
            }
          ]
        };
      }
      
      const response = await fetch(`${this.graphEndpoint}/organization`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get tenant info');
      }

      const data = await response.json();
      return data.value[0] || {};
    } catch (error) {
      console.warn('Could not fetch tenant info:', error);
      return {};
    }
  }

  verifyLicenseStatus(licenseDetails) {
    // Check if license has expiry date
    if (licenseDetails.expiryDate) {
      const expiryDate = new Date(licenseDetails.expiryDate);
      if (expiryDate < new Date()) {
        return false;
      }
    }
    
    // Check service plan status
    const activePlans = licenseDetails.servicePlans?.filter(plan => 
      plan.provisioningStatus === 'Success' &&
      plan.servicePlanId === this.licenseServicePlanId
    );
    
    return activePlans && activePlans.length > 0;
  }

  calculateExpiryDate(license) {
    // Microsoft 365 licenses typically don't have explicit expiry in the API
    // They're subscription-based and renew monthly/annually
    // You might need to implement custom logic based on your agreement with Microsoft
    
    // For now, we'll assume license is valid as long as it's assigned
    return null;
  }

  getEnabledFeatures(servicePlans) {
    const features = {
      maxCustomizations: 1000, // Default limits
      syncEnabled: true,
      advancedFeatures: false,
      supportLevel: 'standard'
    };
    
    // Map service plans to features
    // This would be customized based on your license tiers
    servicePlans?.forEach(plan => {
      if (plan.servicePlanName?.includes('PREMIUM')) {
        features.maxCustomizations = -1; // Unlimited
        features.advancedFeatures = true;
        features.supportLevel = 'premium';
      }
    });
    
    return features;
  }

  async cacheLicenseResult(result) {
    const cacheData = {
      ...result,
      cachedAt: Date.now(),
      cacheExpiry: Date.now() + (4 * 60 * 60 * 1000) // Cache for 4 hours
    };
    
    await chrome.storage.local.set({ 
      licenseCache: cacheData,
      lastLicenseCheck: Date.now()
    });
  }

  async getCachedLicense() {
    const { licenseCache } = await chrome.storage.local.get('licenseCache');
    
    if (licenseCache && licenseCache.cacheExpiry > Date.now()) {
      console.log('Using cached license validation');
      return {
        ...licenseCache,
        fromCache: true
      };
    }
    
    return null;
  }

  async validateOnStartup(accessToken) {
    try {
      // Check cache first
      const cached = await this.getCachedLicense();
      if (cached) {
        return cached;
      }
      
      // Perform fresh validation
      const result = await this.validateUserLicense(accessToken);
      
      // Cache successful validation
      if (result.valid) {
        await this.cacheLicenseResult(result);
      }
      
      return result;
    } catch (error) {
      console.error('Startup license validation failed:', error);
      
      // Try to use cached license as fallback
      const cached = await this.getCachedLicense();
      if (cached) {
        return { ...cached, fallbackUsed: true };
      }
      
      return {
        valid: false,
        error: error.message,
        requiresOnlineValidation: true
      };
    }
  }
}

// Global license validator instance
const licenseValidator = new LicenseValidator();

async function handleCheckLicense(request) {
  try {
    console.log('Checking Microsoft 365 license...');
    
    // Get access token
    const tokenResult = await handleGetCachedToken();
    if (!tokenResult.success || !tokenResult.token) {
      return {
        success: false,
        error: 'Authentication required for license validation',
        requiresAuth: true
      };
    }
    
    // Validate license through Microsoft 365
    const licenseResult = await licenseValidator.validateOnStartup(tokenResult.token);
    
    // Store license status
    await chrome.storage.local.set({
      licenseStatus: {
        valid: licenseResult.valid,
        licensed: licenseResult.licensed,
        lastChecked: Date.now(),
        expiresOn: licenseResult.expiresOn,
        tenantId: licenseResult.tenantId,
        features: licenseResult.features || {},
        message: licenseResult.message
      }
    });
    
    // Schedule next license check
    if (licenseResult.valid) {
      // Check again in 12 hours
      chrome.alarms.create('license-check', { delayInMinutes: 12 * 60 });
    } else {
      // Check more frequently if not licensed
      chrome.alarms.create('license-check', { delayInMinutes: 60 });
    }
    
    // If not licensed, show notification
    if (!licenseResult.valid) {
      chrome.notifications.create('license-required', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon-128.png'),
        title: 'License Required',
        message: licenseResult.message || 'Please purchase a license through Microsoft 365 Admin Center',
        buttons: [{ title: 'Open Admin Center' }],
        requireInteraction: true
      });
    }
    
    return {
      success: true,
      licensed: licenseResult.valid,
      details: licenseResult
    };
    
  } catch (error) {
    console.error('License check error:', error);
    
    // Check cached license as fallback
    const { licenseStatus } = await chrome.storage.local.get('licenseStatus');
    
    if (licenseStatus && licenseStatus.lastChecked) {
      // Use cached license for up to 7 days
      const cacheAge = Date.now() - licenseStatus.lastChecked;
      const maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (cacheAge < maxCacheAge) {
        console.log('Using cached license status');
        return {
          success: true,
          licensed: licenseStatus.valid,
          fromCache: true,
          details: licenseStatus
        };
      }
    }
    
    return {
      success: false,
      error: error.message,
      requiresOnlineCheck: true
    };
  }
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'license-required' && buttonIndex === 0) {
    // Open Microsoft 365 Admin Center
    chrome.tabs.create({ url: 'https://admin.microsoft.com/Adminportal/Home#/licenses' });
  }
});

// License enforcement - prevent functionality without valid license
async function enforceLicense() {
  const { licenseStatus } = await chrome.storage.local.get('licenseStatus');
  
  if (!licenseStatus || !licenseStatus.valid) {
    // Block all functionality if not licensed
    console.warn('Extension functionality blocked - no valid license');
    
    // Show license required page
    chrome.tabs.create({ 
      url: chrome.runtime.getURL('license-required.html') 
    });
    
    return false;
  }
  
  return true;
}

// Intercept all actions to check license
async function withLicenseCheck(action, callback) {
  const hasLicense = await enforceLicense();
  
  if (!hasLicense) {
    return {
      success: false,
      error: 'Valid license required',
      requiresLicense: true
    };
  }
  
  return callback();
}

console.log('DOM Style Injector: Background service worker setup completed');