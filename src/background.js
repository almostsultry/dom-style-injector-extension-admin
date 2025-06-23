// Background service worker for DOM Style Injector Extension
console.log('DOM Style Injector: Background service worker initialized');

// Import authentication and sync services for admin version
import('./auth/auth-service.js').then(authModule => {
  console.log('Auth service loaded');
}).catch(err => {
  console.log('Auth service not available (user version)');
});

// Installation and update handlers
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details);
  
  if (details.reason === 'install') {
    // First time installation
    await handleFirstTimeInstall();
  } else if (details.reason === 'update') {
    // Extension update
    await handleExtensionUpdate(details.previousVersion);
  }
});

// Startup handler
chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser startup - initializing extension');
  await initializeExtension();
});

// Message handling from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  switch (request.action) {
    case 'authenticate':
      handleAuthentication(request, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'sync-customizations':
      handleSyncCustomizations(request, sendResponse);
      return true;
      
    case 'get-auth-status':
      handleGetAuthStatus(sendResponse);
      return true;
      
    case 'logout':
      handleLogout(sendResponse);
      return true;
      
    case 'background-sync':
      handleBackgroundSync(request, sendResponse);
      return true;
      
    default:
      console.log('Unknown message action:', request.action);
      sendResponse({ error: 'Unknown action' });
  }
});

// Alarm handlers for periodic sync
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm triggered:', alarm.name);
  
  switch (alarm.name) {
    case 'periodic-sync':
      await performPeriodicSync();
      break;
      
    case 'token-refresh':
      await refreshAuthToken();
      break;
      
    default:
      console.log('Unknown alarm:', alarm.name);
  }
});

// Context menu setup (admin version only)
async function setupContextMenus() {
  try {
    // Remove existing context menus
    await chrome.contextMenus.removeAll();
    
    // Add admin-specific context menus
    chrome.contextMenus.create({
      id: 'inspect-element',
      title: 'Inspect for Style Injection',
      contexts: ['all'],
      documentUrlPatterns: ['https://ambata.crm.dynamics.com/*']
    });
    
    chrome.contextMenus.create({
      id: 'sync-now',
      title: 'Sync Customizations Now',
      contexts: ['action']
    });
    
  } catch (error) {
    console.log('Context menus not available in user version');
  }
}

// Context menu click handler
chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  console.log('Context menu clicked:', info.menuItemId);
  
  switch (info.menuItemId) {
    case 'inspect-element':
      // Inject inspection script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: enableElementInspection
      });
      break;
      
    case 'sync-now':
      await performManualSync();
      break;
  }
});

// Installation handlers
async function handleFirstTimeInstall() {
  console.log('First time installation - setting up defaults');
  
  try {
    // Set default configuration
    await chrome.storage.local.set({
      extensionVersion: chrome.runtime.getManifest().version,
      installDate: Date.now(),
      syncEnabled: true,
      autoSyncInterval: 60, // minutes
      lastSyncTime: null
    });
    
    // Setup periodic sync alarm
    await chrome.alarms.create('periodic-sync', {
      delayInMinutes: 60,
      periodInMinutes: 60
    });
    
    // Setup context menus
    await setupContextMenus();
    
    // Open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html')
    });
    
  } catch (error) {
    console.error('Error during first time setup:', error);
  }
}

async function handleExtensionUpdate(previousVersion) {
  console.log(`Extension updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`);
  
  try {
    // Update stored version
    await chrome.storage.local.set({
      extensionVersion: chrome.runtime.getManifest().version,
      updateDate: Date.now(),
      previousVersion: previousVersion
    });
    
    // Perform any migration logic here
    await performMigration(previousVersion);
    
  } catch (error) {
    console.error('Error during extension update:', error);
  }
}

async function initializeExtension() {
  console.log('Initializing extension');
  
  try {
    // Check if authenticated (admin version only)
    const authStatus = await checkAuthenticationStatus();
    
    if (authStatus.isAuthenticated) {
      // Setup periodic sync
      await setupPeriodicSync();
    }
    
    // Setup context menus
    await setupContextMenus();
    
  } catch (error) {
    console.error('Error initializing extension:', error);
  }
}

// Authentication handlers (admin version only)
async function handleAuthentication(request, sendResponse) {
  try {
    // Dynamic import for admin version only
    const { authenticateUser } = await import('./auth/auth-service.js');
    const result = await authenticateUser();
    sendResponse(result);
  } catch (error) {
    console.error('Authentication error:', error);
    sendResponse({ error: 'Authentication service not available' });
  }
}

async function handleGetAuthStatus(sendResponse) {
  try {
    const authStatus = await checkAuthenticationStatus();
    sendResponse(authStatus);
  } catch (error) {
    console.error('Error checking auth status:', error);
    sendResponse({ isAuthenticated: false, error: error.message });
  }
}

async function handleLogout(sendResponse) {
  try {
    const { logoutUser } = await import('./auth/auth-service.js');
    await logoutUser();
    
    // Clear sync alarms
    await chrome.alarms.clearAll();
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Sync handlers
async function handleSyncCustomizations(request, sendResponse) {
  try {
    const { performSync } = await import('./sync/sync-manager.js');
    const result = await performSync(request.direction || 'bidirectional');
    sendResponse(result);
  } catch (error) {
    console.error('Sync error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleBackgroundSync(request, sendResponse) {
  try {
    await performPeriodicSync();
    sendResponse({ success: true });
  } catch (error) {
    console.error('Background sync error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Periodic sync
async function performPeriodicSync() {
  console.log('Performing periodic sync');
  
  try {
    const authStatus = await checkAuthenticationStatus();
    
    if (!authStatus.isAuthenticated) {
      console.log('Not authenticated - skipping sync');
      return;
    }
    
    const { performSync } = await import('./sync/sync-manager.js');
    const result = await performSync('download'); // Download updates from SharePoint
    
    // Update last sync time
    await chrome.storage.local.set({
      lastSyncTime: Date.now(),
      lastSyncResult: result
    });
    
    console.log('Periodic sync completed:', result);
    
  } catch (error) {
    console.error('Periodic sync failed:', error);
    
    // Store error for debugging
    await chrome.storage.local.set({
      lastSyncError: {
        timestamp: Date.now(),
        error: error.message
      }
    });
  }
}

async function performManualSync() {
  console.log('Performing manual sync');
  
  try {
    const { performSync } = await import('./sync/sync-manager.js');
    const result = await performSync('bidirectional');
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/admin-icon48.png',
      title: 'Sync Complete',
      message: `Synchronized ${result.updated || 0} customizations`
    });
    
    return result;
    
  } catch (error) {
    console.error('Manual sync failed:', error);
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/admin-icon48.png',
      title: 'Sync Failed',
      message: error.message
    });
    
    throw error;
  }
}

// Utility functions
async function checkAuthenticationStatus() {
  try {
    const { getAuthStatus } = await import('./auth/auth-service.js');
    return await getAuthStatus();
  } catch (error) {
    // Auth service not available (user version)
    return { isAuthenticated: false, userVersion: true };
  }
}

async function setupPeriodicSync() {
  try {
    const config = await chrome.storage.local.get(['syncEnabled', 'autoSyncInterval']);
    
    if (config.syncEnabled) {
      const interval = config.autoSyncInterval || 60;
      
      await chrome.alarms.create('periodic-sync', {
        delayInMinutes: interval,
        periodInMinutes: interval
      });
      
      console.log(`Periodic sync setup with ${interval} minute interval`);
    }
  } catch (error) {
    console.error('Error setting up periodic sync:', error);
  }
}

async function refreshAuthToken() {
  try {
    const { refreshToken } = await import('./auth/auth-service.js');
    await refreshToken();
    console.log('Auth token refreshed successfully');
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
}

async function performMigration(previousVersion) {
  console.log(`Performing migration from version ${previousVersion}`);
  
  // Add version-specific migration logic here
  try {
    if (previousVersion.startsWith('0.')) {
      // Migrate from beta to v1.0
      await migrateBetaToV1();
    }
    
    // Add more migration logic as needed
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

async function migrateBetaToV1() {
  console.log('Migrating from beta to v1.0');
  
  // Example migration logic
  const oldData = await chrome.storage.local.get('betaCustomizations');
  
  if (oldData.betaCustomizations) {
    // Transform old format to new format
    const newData = {
      customizations: transformCustomizations(oldData.betaCustomizations)
    };
    
    await chrome.storage.local.set(newData);
    await chrome.storage.local.remove('betaCustomizations');
    
    console.log('Beta data migrated successfully');
  }
}

function transformCustomizations(oldCustomizations) {
  // Transform customizations from old format to new format
  // This is a placeholder - implement actual transformation logic
  return oldCustomizations;
}

// Element inspection function (injected into page)
function enableElementInspection() {
  console.log('Element inspection enabled');
  
  // Add click listener for element inspection
  document.addEventListener('click', function inspectHandler(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const element = event.target;
    const elementInfo = {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      attributes: {}
    };
    
    // Collect all attributes
    for (let attr of element.attributes) {
      elementInfo.attributes[attr.name] = attr.value;
    }
    
    // Send element info to popup
    chrome.runtime.sendMessage({
      action: 'element-inspected',
      elementInfo: elementInfo
    });
    
    // Remove the inspection listener
    document.removeEventListener('click', inspectHandler);
    
    // Visual feedback
    element.style.outline = '3px solid red';
    setTimeout(() => {
      element.style.outline = '';
    }, 2000);
  }, true);
  
  // Add visual indicator
  document.body.style.cursor = 'crosshair';
  
  // Remove cursor after 10 seconds
  setTimeout(() => {
    document.body.style.cursor = '';
  }, 10000);
}