// src/background.js - Fixed Service Worker for DOM Style Injector Extension
// Compatible with Manifest V3 service worker requirements

console.log('DOM Style Injector: Background service worker initialized');

// Global variables for service worker context
let isInitialized = false;

// Constants
const SYNC_INTERVAL_MINUTES = 60;
const AUTH_CACHE_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

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
  switch (request.action) {
    case 'authenticate':
      return await handleAuthentication(request);

    case 'get-auth-status':
      return await handleGetAuthStatus();

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

    case 'get-cached-token':
      return await handleGetCachedToken();

    case 'refresh-token':
      return await handleRefreshToken();

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
      case 'cleanup-storage':
        await cleanupStorage();
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

    // Store authentication info
    await chrome.storage.local.set({
      isAuthenticated: true,
      authTimestamp: Date.now(),
      tokenLastRefresh: Date.now(),
      authMethod: authMethod,
      userInfo: userInfo
    });

    console.log('Authentication successful for user:', userInfo.displayName || userInfo.userPrincipalName);

    return {
      success: true,
      token: authToken,
      userInfo: userInfo,
      authMethod: authMethod,
      timestamp: Date.now()
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

    // Clear all authentication data
    await chrome.storage.local.remove([
      'isAuthenticated',
      'userInfo',
      'authTimestamp',
      'tokenLastRefresh',
      'userRole'
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

    const authToken = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });

    return { success: true, token: authToken };

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
      requiresRefresh: isExpired
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

    // Merge with local customizations (Dataverse takes precedence)
    const { customizations: localCustomizations = [] } = await chrome.storage.local.get('customizations');
    
    // Create a map of Dataverse customizations by ID
    const dataverseMap = new Map(customizations.map(c => [c.id, c]));
    
    // Keep local customizations that don't exist in Dataverse
    const localOnly = localCustomizations.filter(local => 
      !local.source || local.source === 'local'
    );

    // Merge arrays, with Dataverse taking precedence
    const mergedCustomizations = [...customizations, ...localOnly];

    // Update local storage
    await chrome.storage.local.set({
      customizations: mergedCustomizations,
      lastDataverseSync: new Date().toISOString(),
      dataverseSyncCount: customizations.length
    });

    return {
      success: true,
      count: customizations.length,
      totalCount: mergedCustomizations.length,
      timestamp: Date.now(),
      message: `Synced ${customizations.length} customizations from Dataverse`
    };

  } catch (error) {
    console.error('Dataverse sync error:', error);
    return { success: false, error: error.message };
  }
}

async function syncCustomizationToDataverse(customization, authToken, orgUrl, tableName) {
  try {
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

    // Check if record already exists
    const existingRecord = await findExistingDataverseRecord(customization.id, authToken, orgUrl, tableName);

    let response;
    if (existingRecord) {
      // Update existing record
      response = await fetch(`${orgUrl}/api/data/v9.2/${tableName}(${existingRecord.id})`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
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
      throw new Error(`Dataverse API error: ${response.status} ${response.statusText}`);
    }

    console.log(`Successfully synced customization ${customization.name} to Dataverse`);

  } catch (error) {
    console.error(`Error syncing customization ${customization.name} to Dataverse:`, error);
    throw error;
  }
}

async function findExistingDataverseRecord(externalId, authToken, orgUrl, tableName) {
  try {
    const response = await fetch(
      `${orgUrl}/api/data/v9.2/${tableName}?$filter=cr123_externalid eq '${externalId}'&$select=${tableName}id`,
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
    return data.value && data.value.length > 0 ? { id: data.value[0][`${tableName}id`] } : null;

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

console.log('DOM Style Injector: Background service worker setup completed');