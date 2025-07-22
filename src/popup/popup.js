// src/popup/popup.js - Enhanced version with pseudo-class support and MSAL integration
// Combines existing MSAL authentication with new pseudo-class functionality

// =============================================================================
// MSAL INTEGRATION - Authentication services will be loaded via script tags
// =============================================================================
// MSAL functions will be available globally after auth-service.js loads
// Functions available: initializeMSAL, authenticateUser, isAuthenticated, getCurrentAccount, logoutUser, getAccessToken

// MSAL integration flag
let msalAvailable = false;

// Import MSAL (ensure msal-browser is included in your build)
/* global PublicClientApplication */

// =============================================================================
// PERMISSIONS CONFIGURATION
// =============================================================================
const PERMISSIONS = {
    // Rule Management
    CREATE_RULE: ['System Administrator', 'System Customizer'],
    EDIT_RULE: ['System Administrator', 'System Customizer'],
    DELETE_RULE: ['System Administrator', 'System Customizer'],
    PREVIEW_RULE: ['System Administrator', 'System Customizer'],
    
    // Synchronization
    SYNC_DATAVERSE: ['System Administrator', 'System Customizer'],
    SYNC_SHAREPOINT: ['System Administrator', 'System Customizer'],
    RESOLVE_CONFLICTS: ['System Administrator', 'System Customizer'],
    
    // Settings Management
    MANAGE_SETTINGS: ['System Administrator', 'System Customizer'],
    MANAGE_LICENSE: ['System Administrator', 'System Customizer'],
    CONFIGURE_SYNC: ['System Administrator', 'System Customizer'],
    
    // Data Operations
    EXPORT_DATA: ['System Administrator', 'System Customizer'],
    IMPORT_DATA: ['System Administrator', 'System Customizer'],
    EXPORT_SETTINGS: ['System Administrator', 'System Customizer'],
    IMPORT_SETTINGS: ['System Administrator', 'System Customizer']
};

// Permission check function
async function checkPermission(action) {
    try {
        const { userRole } = await chrome.storage.local.get('userRole');
        
        if (!userRole || !userRole.roles) {
            console.warn('No user role information available');
            return false;
        }
        
        const allowedRoles = PERMISSIONS[action] || [];
        const hasPermission = allowedRoles.some(role => userRole.roles.includes(role));
        
        console.log(`Permission check for ${action}: ${hasPermission ? 'GRANTED' : 'DENIED'}`);
        
        // Audit log
        await logPermissionCheck(action, hasPermission, userRole);
        
        return hasPermission;
    } catch (error) {
        console.error('Permission check error:', error);
        return false;
    }
}

// Get all permissions for current user
async function getUserPermissions() {
    try {
        const { userRole } = await chrome.storage.local.get('userRole');
        
        if (!userRole || !userRole.roles) {
            return {};
        }
        
        const permissions = {};
        
        for (const [action, allowedRoles] of Object.entries(PERMISSIONS)) {
            permissions[action] = allowedRoles.some(role => userRole.roles.includes(role));
        }
        
        return permissions;
    } catch (error) {
        console.error('Error getting user permissions:', error);
        return {};
    }
}

// Audit logging for permission checks
async function logPermissionCheck(action, granted, userRole) {
    try {
        const { auditLog = [] } = await chrome.storage.local.get('auditLog');
        
        const logEntry = {
            timestamp: Date.now(),
            action,
            granted,
            userId: userRole.userId || 'unknown',
            roles: userRole.roles || [],
            url: currentTab?.url || 'unknown'
        };
        
        // Keep only last 1000 entries
        const updatedLog = [...auditLog, logEntry].slice(-1000);
        
        await chrome.storage.local.set({ auditLog: updatedLog });
    } catch (error) {
        console.error('Audit logging error:', error);
    }
}

// Log admin actions
async function logAdminAction(action, details = {}) {
    try {
        const { userRole } = await chrome.storage.local.get('userRole');
        const { adminActionLog = [] } = await chrome.storage.local.get('adminActionLog');
        
        const logEntry = {
            timestamp: Date.now(),
            action,
            details,
            userId: userRole?.userId || 'unknown',
            roles: userRole?.roles || [],
            success: true
        };
        
        // Keep only last 500 admin actions
        const updatedLog = [...adminActionLog, logEntry].slice(-500);
        
        await chrome.storage.local.set({ adminActionLog: updatedLog });
        
        console.log('Admin action logged:', action);
    } catch (error) {
        console.error('Admin action logging error:', error);
    }
}

// =============================================================================
// DOM ELEMENTS - Combined from both versions
// =============================================================================
const elements = {
    // Existing elements from current version
    loaderView: document.getElementById('loader-view'),
    adminView: document.getElementById('admin-view'),
    userView: document.getElementById('user-view'),
    errorView: document.getElementById('error-view'),
    errorMessage: document.getElementById('error-message'),
    openSettingsBtn: document.getElementById('open-settings-btn'),
    retryAuthBtn: document.getElementById('retry-auth-btn'),
    
    // Legacy unified field elements
    form: document.getElementById('styleForm'),
    targetsInput: document.getElementById('targets'),
    stylesInput: document.getElementById('styles'),
    clearBtn: document.getElementById('clearBtn'),
    saveBtn: document.getElementById('saveBtn'),
    status: document.getElementById('status'),
    queryStringSection: document.getElementById('queryStringSection'),
    queryStringList: document.getElementById('queryStringList'),
    
    // NEW: Enhanced elements from draft
    createForm: document.getElementById('create-form'),
    customizationForm: document.getElementById('customization-form'),
    toggleCreateForm: document.getElementById('toggle-create-form'),
    toggleQuickEditor: document.getElementById('toggle-quick-editor'),
    quickEditorSection: document.getElementById('quick-editor-section'),
    ruleName: document.getElementById('rule-name'),
    cssSelector: document.getElementById('css-selector'),
    baseCss: document.getElementById('base-css'),
    testSelector: document.getElementById('test-selector'),
    previewRule: document.getElementById('preview-rule'),
    customizationList: document.getElementById('customization-list'),
    emptyState: document.getElementById('empty-state'),
    ruleCount: document.getElementById('rule-count'),
    syncStatus: document.getElementById('sync-status'),
    syncButton: document.getElementById('sync-rules'),
    
    // NEW: Pseudo-class elements
    pseudoTabs: document.querySelectorAll('.pseudo-tab'),
    pseudoPanels: document.querySelectorAll('.pseudo-panel'),
    pseudoTextareas: document.querySelectorAll('.pseudo-css'),
    pseudoToggles: document.querySelectorAll('.pseudo-enabled'),
    
    // Legacy elements
    cssEditor: document.getElementById('css-editor'),
    saveRuleBtn: document.getElementById('save-rule'),
    clearEditor: document.getElementById('clear-editor'),
    existingCustomizations: document.getElementById('existingCustomizations'),
    
    // Export/Import elements
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    exportOptions: document.getElementById('export-options'),
    importOptions: document.getElementById('import-options'),
    doExportBtn: document.getElementById('do-export'),
    cancelExportBtn: document.getElementById('cancel-export'),
    selectFileBtn: document.getElementById('select-file'),
    cancelImportBtn: document.getElementById('cancel-import'),
    exportMetadataCheckbox: document.getElementById('export-metadata'),
    validateImportCheckbox: document.getElementById('validate-import'),
    importStatusDiv: document.getElementById('import-status'),
    
    // Search/Filter elements
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search'),
    filterStatusSelect: document.getElementById('filter-status'),
    filterSortSelect: document.getElementById('filter-sort'),
    
    // User view elements
    userSearchInput: document.getElementById('user-search-input'),
    userCustomizationList: document.getElementById('user-customization-list'),
    userEmptyState: document.getElementById('user-empty-state'),
    userSyncStatus: document.getElementById('user-sync-status'),
    userSyncButton: document.getElementById('user-sync-rules'),
    userTotalRules: document.getElementById('user-total-rules'),
    userActiveRules: document.getElementById('user-active-rules'),
    userLastSync: document.getElementById('user-last-sync'),
    copyDiagnosticsBtn: document.getElementById('copy-diagnostics'),
    
    // Screenshot elements
    screenshotBtn: document.getElementById('screenshot-btn'),
    screenshotOptions: document.getElementById('screenshot-options'),
    doScreenshotBtn: document.getElementById('do-screenshot'),
    cancelScreenshotBtn: document.getElementById('cancel-screenshot'),
    screenshotStatusDiv: document.getElementById('screenshot-status'),
    screenshotSelector: document.getElementById('screenshot-selector'),
    screenshotMarkup: document.getElementById('screenshot-markup'),
    elementSelectorGroup: document.getElementById('element-selector-group'),
    
    // Eyedropper elements
    eyedropperBtn: document.getElementById('eyedropper-btn')
};

// =============================================================================
// GLOBAL VARIABLES - Combined from both versions
// =============================================================================
let currentTab;
let currentDomain;
let currentUser = null;
let userRole = null;
let isAdmin = false;
let customizations = [];
let editingCustomization = null;
let msalInstance = null;
let customizationActionsPermissions = null;

// NEW: Pseudo-class support
const PSEUDO_CLASSES = [
    'hover', 'active', 'focus', 'focus-within', 'focus-visible',
    'target', 'valid', 'invalid', 'read-write', 'read-only',
    'checked', 'disabled', 'enabled', 'required', 'optional'
];

// MSAL Configuration - will be loaded from storage or use defaults
const msalConfig = {
    auth: {
        clientId: null, // Will be loaded from storage
        authority: null, // Will be loaded from storage
        redirectUri: chrome.identity.getRedirectURL()
    },
    cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
    }
};

// Load MSAL configuration from storage
async function loadMSALConfig() {
    try {
        const config = await chrome.storage.sync.get(['clientId', 'tenantId']);
        
        if (config.clientId && config.tenantId) {
            msalConfig.auth.clientId = config.clientId;
            msalConfig.auth.authority = `https://login.microsoftonline.com/${config.tenantId}`;
            return true;
        }
        
        // Use defaults if not configured
        console.warn('MSAL configuration not found in storage. Please configure in extension options.');
        return false;
    } catch (error) {
        console.error('Error loading MSAL configuration:', error);
        return false;
    }
}

// =============================================================================
// SETTINGS NAVIGATION - From existing version
// =============================================================================
function openSettingsPage() {
    try {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
            return;
        }

        const optionsUrl = chrome.runtime.getURL('src/options/options.html');
        chrome.tabs.create({ url: optionsUrl });

    } catch (error) {
        console.error('Failed to open settings:', error);
        alert(
            'Please open extension settings manually:\n\n' +
            '1. Right-click the extension icon\n' +
            '2. Select "Options" from the menu\n' +
            'OR\n' +
            '1. Go to chrome://extensions\n' +
            '2. Find "D365 DOM Style Injector"\n' +
            '3. Click "Details" then "Extension options"'
        );
    }
}

async function retryAuthentication() {
    try {
        await clearAuthCache();
        renderView('loader-view');
        await initializePopup();
    } catch (error) {
        console.error('Retry failed:', error);
        renderView('error-view', 'Retry failed: ' + error.message);
    }
}

function setupErrorViewEventListeners() {
    if (elements.openSettingsBtn && !elements.openSettingsBtn.hasSettingsListener) {
        elements.openSettingsBtn.addEventListener('click', openSettingsPage);
        elements.openSettingsBtn.hasSettingsListener = true;
    }

    if (elements.retryAuthBtn && !elements.retryAuthBtn.hasRetryListener) {
        elements.retryAuthBtn.addEventListener('click', retryAuthentication);
        elements.retryAuthBtn.hasRetryListener = true;
    }
}

// =============================================================================
// MSAL INITIALIZATION - Enhanced with fallback
// =============================================================================
async function initializeMSALIfAvailable() {
    try {
        // First load MSAL configuration from storage
        const configLoaded = await loadMSALConfig();
        
        if (!configLoaded) {
            console.log('MSAL configuration not available, using chrome.identity fallback');
            msalAvailable = false;
            return false;
        }
        
        // Check if MSAL functions are available globally
        if (typeof window.initializeMSAL === 'function') {
            await window.initializeMSAL();
            msalAvailable = true;
            console.log('MSAL initialized successfully');
            return true;
        } else {
            console.log('MSAL functions not available, using chrome.identity fallback');
            msalAvailable = false;
            return false;
        }
    } catch (msalError) {
        if (msalError.message.includes('configuration required')) {
            console.log('MSAL not configured, will use chrome.identity fallback');
        } else if (msalError.message.includes('MSAL library not found')) {
            console.log('MSAL library not found, using chrome.identity only');
        } else {
            console.warn('MSAL initialization failed:', msalError.message);
        }
        msalAvailable = false;
        return false;
    }
}

// Initialize MSAL (legacy fallback)
async function initializeMsal() {
    if (typeof PublicClientApplication !== 'undefined') {
        // Ensure configuration is loaded
        if (!msalConfig.auth.clientId || !msalConfig.auth.authority) {
            await loadMSALConfig();
        }
        
        if (msalConfig.auth.clientId && msalConfig.auth.authority) {
            msalInstance = new PublicClientApplication(msalConfig);
            await msalInstance.initialize();
        } else {
            console.warn('Cannot initialize MSAL without client ID and tenant ID');
        }
    }
}

// =============================================================================
// ENHANCED AUTHENTICATION - MSAL + chrome.identity hybrid
// =============================================================================
async function getAuthToken() {
    try {
        // Try MSAL authentication first if available
        if (msalAvailable) {
            try {
                if (typeof window.isAuthenticated === 'function' && await window.isAuthenticated()) {
                    const account = typeof window.getCurrentAccount === 'function' ? window.getCurrentAccount() : null;
                    if (account) {
                        console.log('Using existing MSAL authentication:', account.username);
                        const token = typeof window.getAccessToken === 'function' ? await window.getAccessToken() : null;
                        return token;
                    }
                }

                console.log('Starting MSAL authentication...');
                const result = typeof window.authenticateUser === 'function' ? await window.authenticateUser() : { success: false, error: 'MSAL not available' };

                if (result.success) {
                    console.log('MSAL authentication successful:', result.user.username);
                    const token = await getAccessToken();
                    return token;
                } else {
                    throw new Error(result.error);
                }
            } catch (msalError) {
                console.log('MSAL authentication failed, falling back to chrome.identity:', msalError.message);
            }
        }

        // Fallback to chrome.identity implementation
        console.log('Using chrome.identity authentication...');

        const config = await chrome.storage.sync.get(['d365OrgUrl', 'clientId', 'tenantId']);

        if (!config.d365OrgUrl) {
            throw new Error('Extension configuration required. Please configure your D365 organization URL and Azure AD settings to continue.');
        }

        if (!config.clientId || !config.tenantId) {
            throw new Error('Azure AD configuration required. Please configure Client ID and Tenant ID in extension options.');
        }

        // Check for cached token first
        const cachedToken = await getCachedToken();
        if (cachedToken) {
            return cachedToken;
        }

        // Get new token
        const authUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?` +
            `client_id=${config.clientId}&` +
            `response_type=token&` +
            `redirect_uri=${encodeURIComponent(chrome.identity.getRedirectURL())}&` +
            `scope=${encodeURIComponent('https://graph.microsoft.com/User.Read https://graph.microsoft.com/Sites.Read.All')}&` +
            `response_mode=fragment`;

        return new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow(
                {
                    url: authUrl,
                    interactive: true
                },
                (responseUrl) => {
                    if (chrome.runtime.lastError) {
                        console.error('Auth error:', chrome.runtime.lastError);
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }

                    if (!responseUrl) {
                        reject(new Error('No response URL received'));
                        return;
                    }

                    try {
                        const url = new URL(responseUrl);
                        const hashParams = new URLSearchParams(url.hash.substring(1));
                        const accessToken = hashParams.get('access_token');

                        if (!accessToken) {
                            const error = hashParams.get('error');
                            const errorDescription = hashParams.get('error_description');

                            if (error) {
                                reject(new Error(`OAuth error: ${error} - ${errorDescription || 'Unknown error'}`));
                            } else {
                                reject(new Error('No access token in response'));
                            }
                            return;
                        }

                        validateToken(accessToken);

                        const expiresIn = parseInt(hashParams.get('expires_in') || '3600');
                        cacheToken(accessToken, expiresIn);

                        resolve(accessToken);
                    } catch (error) {
                        console.error('Error parsing auth response:', error);
                        reject(error);
                    }
                }
            );
        });
    } catch (error) {
        console.error('Authentication error:', error);

        const cachedToken = await getCachedToken();
        if (cachedToken) {
            console.log('Using cached token');
            return cachedToken;
        }

        const { mockToken } = await chrome.storage.local.get('mockToken');
        if (mockToken) {
            console.warn('Using mock token for development');
            return mockToken;
        }

        throw error;
    }
}

// =============================================================================
// TOKEN MANAGEMENT - From existing version
// =============================================================================
function validateToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid token format');
        }

        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

        if (!payload.oid && !payload.sub) {
            throw new Error('Token missing user identifier (oid or sub)');
        }

        if (!payload.aud) {
            throw new Error('Token missing audience (aud) claim');
        }

        if (payload.exp && payload.exp * 1000 < Date.now()) {
            throw new Error('Token has expired');
        }

        console.log('Token validated successfully');
    } catch (error) {
        console.error('Token validation error:', error);
        throw error;
    }
}

async function cacheToken(token, expiresIn) {
    const expirationTime = Date.now() + (expiresIn * 1000);
    
    // Check if this is a KMSI scenario based on token lifetime
    const eightHoursInSeconds = 8 * 60 * 60;
    const isKMSI = expiresIn > eightHoursInSeconds;
    
    if (isKMSI) {
        // Token expires in more than 8 hours, likely KMSI is active
        console.log('KMSI detected - token expires in', Math.floor(expiresIn / 3600), 'hours');
        
        // Store in local storage for persistence across browser sessions
        await chrome.storage.local.set({
            kmsiToken: token,
            kmsiExpiration: expirationTime,
            kmsiEnabled: true,
            kmsiTimestamp: Date.now()
        });
    }

    // Always store in session storage for current session
    await chrome.storage.session.set({
        authToken: token,
        tokenExpiration: expirationTime
    });

    console.log('Token cached, expires at:', new Date(expirationTime).toLocaleString());
    if (isKMSI) {
        console.log('Keep Me Signed In is active - token will persist across browser sessions');
    }
}

async function getCachedToken() {
    try {
        // First check for KMSI token in local storage
        const { kmsiToken, kmsiExpiration, kmsiEnabled } = await chrome.storage.local.get(['kmsiToken', 'kmsiExpiration', 'kmsiEnabled']);
        
        if (kmsiEnabled && kmsiToken && kmsiExpiration) {
            const bufferTime = 5 * 60 * 1000; // 5 minutes
            if (kmsiExpiration - bufferTime > Date.now()) {
                console.log('Found valid KMSI token (Keep Me Signed In active)');
                return kmsiToken;
            } else {
                console.log('KMSI token expired');
                await chrome.storage.local.remove(['kmsiToken', 'kmsiExpiration', 'kmsiEnabled']);
            }
        }
        
        // Fall back to session storage
        const { authToken, tokenExpiration } = await chrome.storage.session.get(['authToken', 'tokenExpiration']);

        if (authToken && tokenExpiration) {
            const bufferTime = 5 * 60 * 1000; // 5 minutes
            if (tokenExpiration - bufferTime > Date.now()) {
                console.log('Found valid cached token');
                return authToken;
            } else {
                console.log('Cached token expired');
                await chrome.storage.session.remove(['authToken', 'tokenExpiration']);
            }
        }
    } catch (error) {
        console.error('Error retrieving cached token:', error);
    }

    return null;
}

async function clearAuthCache() {
    await chrome.storage.session.remove(['authToken', 'tokenExpiration']);
    await chrome.storage.local.remove(['userRole', 'kmsiToken', 'kmsiExpiration', 'kmsiEnabled', 'kmsiTimestamp']);
    
    if (msalAvailable) {
        try {
            if (typeof window.logoutUser === 'function') await window.logoutUser();
            console.log('MSAL cache cleared');
        } catch (msalError) {
            console.log('Error clearing MSAL cache:', msalError);
        }
    }
    
    console.log('Authentication cache cleared (including KMSI data)');
}

// =============================================================================
// VIEW MANAGEMENT - Enhanced from draft
// =============================================================================
function renderView(viewName, msg = '') {
    // Hide all views first
    elements.loaderView.style.display = 'none';
    elements.adminView.style.display = 'none';
    elements.userView.style.display = 'none';
    elements.errorView.style.display = 'none';

    // Show the correct view based on the viewName parameter
    switch (viewName) {
        case 'loader-view':
            elements.loaderView.style.display = 'block';
            break;
        case 'admin-view':
            elements.adminView.style.display = 'block';
            initializeAdminView();
            break;
        case 'user-view':
            elements.userView.style.display = 'block';
            initializeUserView();
            break;
        case 'error-view':
            elements.errorMessage.textContent = msg;
            elements.errorView.style.display = 'block';
            setupErrorViewEventListeners();
            break;
    }
}

// =============================================================================
// INITIALIZATION - Combined approach
// =============================================================================
async function initializePopup() {
    renderView('loader-view');

    try {
        // Initialize export/import manager
        await initializeExportImportManager();
        
        // Initialize search/filter manager
        await initializeSearchFilterManager();
        
        // Initialize screenshot and eyedropper managers
        await initializeScreenshotManager();
        await initializeEyedropperManager();
        
        // Initialize branding
        await initializeBranding();
        
        // Initialize AI integration
        await initializeAIIntegration();
        
        // Initialize Visio integration
        await initializeVisioIntegration();
        
        // Initialize Documentation Generator
        await initializeDocumentationGenerator();
        
        // Check license first
        const licenseCheck = await chrome.runtime.sendMessage({ action: 'checkLicense' });
        
        if (!licenseCheck.success || !licenseCheck.licensed) {
            // Redirect to license required page
            window.location.href = chrome.runtime.getURL('license-required.html');
            return;
        }
        
        // Initialize MSAL if available
        await initializeMSALIfAvailable();
        await initializeMsal(); // Legacy fallback

        // Get current tab info
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tabs[0];

        if (!currentTab || !currentTab.url) {
            throw new Error('Cannot access this page');
        }

        const url = new URL(currentTab.url);
        currentDomain = url.hostname;

        // Check cached role first
        const { userRole } = await chrome.storage.local.get('userRole');
        const eightHours = 8 * 60 * 60 * 1000;
        const cacheIsFresh = userRole && (Date.now() - userRole.timestamp < eightHours);

        if (cacheIsFresh) {
            console.log('Using cached user role:', userRole);
            renderView(userRole.isAdmin ? 'admin-view' : 'user-view');
            return;
        }

        console.log('Getting fresh auth token...');
        const authToken = await getAuthToken();

        const result = await chrome.runtime.sendMessage({
            action: "checkUserRole",
            token: authToken
        });

        if (result.error) {
            throw new Error(result.error);
        }

        console.log('User role check result:', result);
        isAdmin = result.isAdmin;
        renderView(result.isAdmin ? 'admin-view' : 'user-view');

    } catch (error) {
        console.error("Initialization failed:", error);

        let errorMsg = error.message;
        if (error.message.includes('not configured') || error.message.includes('configuration required')) {
            errorMsg = 'Extension configuration required. Please configure your D365 organization URL and Azure AD settings to continue.';
        } else if (error.message.includes('Authentication')) {
            errorMsg = 'Authentication failed. Please ensure you are logged into your Microsoft account and try again.';
        } else if (error.message.includes('cancelled')) {
            errorMsg = 'Authentication was cancelled. Please try again when ready to sign in.';
        } else if (error.message.includes('OAuth error')) {
            errorMsg = 'OAuth authentication error. Please check your Azure AD configuration and try again.';
        }

        renderView('error-view', errorMsg);
    }
}

// =============================================================================
// ADMIN VIEW INITIALIZATION - Enhanced with pseudo-class support
// =============================================================================
async function initializeAdminView() {
    isAdmin = true;

    try {
        // Get user permissions
        const permissions = await getUserPermissions();
        
        // Update UI based on permissions
        updateUIBasedOnPermissions(permissions);
        
        // Initialize form elements if using legacy mode
        initializeFormElements();

        // Setup event listeners based on available elements
        if (elements.form) {
            // Legacy mode - setup unified field listeners
            setupLegacyEventListeners();
        }

        // NEW: Setup enhanced event listeners
        setupEnhancedEventListeners();

        // NEW: Initialize pseudo-class tabs
        initializePseudoClassTabs();

        // Load existing customizations
        loadCustomizations(true);

        // Setup logout functionality
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
    } catch (error) {
        console.error('Error initializing admin view:', error);
        showNotification('Failed to initialize: ' + error.message, 'error');
    }
}

// Initialize user view
async function initializeUserView() {
    isAdmin = false;

    try {
        // Load customizations for user view
        await loadCustomizations(false);
        
        // Update user view UI
        updateUserView();
        
        // Setup user-specific event listeners (already done in main initialization)
        
        console.log('User view initialized');
    } catch (error) {
        console.error('Error initializing user view:', error);
        showNotification('Failed to initialize user view: ' + error.message, 'error');
    }
}

// Update UI elements based on user permissions
function updateUIBasedOnPermissions(permissions) {
    // Toggle create form button
    if (elements.toggleCreateForm) {
        elements.toggleCreateForm.style.display = permissions.CREATE_RULE ? 'flex' : 'none';
    }
    
    // Preview button
    if (elements.previewRule) {
        elements.previewRule.style.display = permissions.PREVIEW_RULE ? 'inline-block' : 'none';
    }
    
    // Save button in forms
    const saveButtons = document.querySelectorAll('button[type="submit"]');
    saveButtons.forEach(btn => {
        if (!permissions.CREATE_RULE && !permissions.EDIT_RULE) {
            btn.style.display = 'none';
        }
    });
    
    // Sync buttons
    if (elements.syncButton) {
        elements.syncButton.style.display = 
            (permissions.SYNC_DATAVERSE || permissions.SYNC_SHAREPOINT) ? 'inline-block' : 'none';
    }
    
    const syncRulesBtn = document.getElementById('sync-rules');
    if (syncRulesBtn) {
        syncRulesBtn.style.display = 
            (permissions.SYNC_DATAVERSE || permissions.SYNC_SHAREPOINT) ? 'inline-block' : 'none';
    }
    
    // Export/Import buttons
    const exportBtns = document.querySelectorAll('[data-action="export"], #export-customizations');
    exportBtns.forEach(btn => {
        btn.style.display = permissions.EXPORT_DATA ? 'inline-block' : 'none';
    });
    
    const importBtns = document.querySelectorAll('[data-action="import"], [for="import-file"]');
    importBtns.forEach(btn => {
        btn.style.display = permissions.IMPORT_DATA ? 'inline-block' : 'none';
    });
    
    // Settings button
    if (elements.openSettingsBtn) {
        elements.openSettingsBtn.style.display = permissions.MANAGE_SETTINGS ? 'inline-block' : 'none';
    }
    
    // Update customization actions based on permissions
    updateCustomizationActionsVisibility(permissions);
}

// Update visibility of action buttons in customization list
function updateCustomizationActionsVisibility(permissions) {
    // This will be called after customizations are loaded
    customizationActionsPermissions = permissions;
}

// Initialize form DOM elements (legacy support)
function initializeFormElements() {
    // Re-query elements that might not have been available at startup
    elements.form = elements.form || document.getElementById('styleForm');
    elements.targetsInput = elements.targetsInput || document.getElementById('targets');
    elements.stylesInput = elements.stylesInput || document.getElementById('styles');
    elements.clearBtn = elements.clearBtn || document.getElementById('clearBtn');
    elements.saveBtn = elements.saveBtn || document.getElementById('saveBtn');
    elements.status = elements.status || document.getElementById('status');
    elements.queryStringSection = elements.queryStringSection || document.getElementById('queryStringSection');
    elements.queryStringList = elements.queryStringList || document.getElementById('queryStringList');
    elements.existingCustomizations = elements.existingCustomizations || document.getElementById('existingCustomizations');
    elements.cssEditor = elements.cssEditor || document.getElementById('css-editor');
    elements.saveRuleBtn = elements.saveRuleBtn || document.getElementById('save-rule');
}

// =============================================================================
// USER VIEW INITIALIZATION
// =============================================================================
async function initializeUserView() {
    isAdmin = false;

    // Setup user event listeners
    const syncBtn = document.getElementById('user-sync-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', handleUserSync);
    }

    // Load existing customizations
    loadCustomizations(false);

    // Setup logout functionality
    const logoutBtnUser = document.getElementById('logout-btn-user');
    if (logoutBtnUser) {
        logoutBtnUser.addEventListener('click', handleLogout);
    }
}

// =============================================================================
// LOGOUT FUNCTIONALITY - From existing version
// =============================================================================
async function handleLogout() {
    try {
        renderView('loader-view');

        if (msalAvailable) {
            try {
                const result = typeof window.logoutUser === 'function' ? await window.logoutUser() : { success: false };
                if (result.success) {
                    console.log('MSAL logout successful');
                }
            } catch (msalError) {
                console.log('MSAL logout failed, clearing local cache:', msalError.message);
            }
        }

        await chrome.storage.session.remove(['authToken', 'tokenExpiration']);
        await chrome.storage.local.remove(['userRole', 'isAuthenticated', 'userInfo', 'authTimestamp']);

        await initializePopup();

    } catch (error) {
        console.error('Logout failed:', error);
        renderView('error-view', 'Logout failed: ' + error.message);
    }
}

// =============================================================================
// LEGACY EVENT LISTENERS - For backward compatibility
// =============================================================================
function setupLegacyEventListeners() {
    // Form submission
    if (elements.form) {
        elements.form.addEventListener('submit', async function (e) {
            e.preventDefault();

            try {
                const { targets, styles } = validateLegacyForm();
                const result = await applyStylesToPage(targets, styles);

                if (result.success) {
                    showStatus(`Style applied successfully! Found ${result.count} element(s).`);
                    await saveLegacyFieldValues();
                } else {
                    showStatus(result.message, true);
                }

            } catch (error) {
                handleError(error, 'form submission');
            }
        });
    }

    // Save customization (legacy)
    if (elements.saveBtn) {
        elements.saveBtn.addEventListener('click', async function () {
            try {
                const { targets, styles } = validateLegacyForm();
                await saveLegacyCustomization(targets, styles);
                showStatus('Customization saved successfully!');
                await loadExistingCustomizations();
            } catch (error) {
                handleError(error, 'save customization');
            }
        });
    }

    // Clear form (legacy)
    if (elements.clearBtn) {
        elements.clearBtn.addEventListener('click', function () {
            if (elements.targetsInput) elements.targetsInput.value = '';
            if (elements.stylesInput) elements.stylesInput.value = '';

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.remove(['targets', 'styles']);
            }

            showStatus('Form cleared');
        });
    }

    // CSS Editor functionality (legacy)
    if (elements.cssEditor) {
        elements.cssEditor.addEventListener('input', handleCssEditorInput);
    }

    if (elements.saveRuleBtn) {
        elements.saveRuleBtn.addEventListener('click', handleSaveRule);
    }

    if (elements.clearEditor) {
        elements.clearEditor.addEventListener('click', handleClearEditor);
    }

    // Auto-save field values on input
    if (elements.targetsInput) elements.targetsInput.addEventListener('input', saveLegacyFieldValues);
    if (elements.stylesInput) elements.stylesInput.addEventListener('input', saveLegacyFieldValues);
}

// =============================================================================
// ENHANCED EVENT LISTENERS - New pseudo-class functionality
// =============================================================================
function setupEnhancedEventListeners() {
    // Toggle quick editor
    if (elements.toggleQuickEditor) {
        elements.toggleQuickEditor.addEventListener('click', toggleQuickEditor);
    }

    // Sync button
    if (elements.syncButton) {
        elements.syncButton.addEventListener('click', handleSyncWithSharePoint);
    }

    // Form events
    if (elements.toggleCreateForm) {
        elements.toggleCreateForm.addEventListener('click', toggleCreateForm);
    }

    if (elements.customizationForm) {
        elements.customizationForm.addEventListener('submit', handleSubmitCustomization);
    }

    if (elements.testSelector) {
        elements.testSelector.addEventListener('click', testCurrentSelector);
    }
    
    if (elements.previewRule) {
        elements.previewRule.addEventListener('click', previewCurrentRule);
    }

    // Pseudo-class tab events
    elements.pseudoTabs?.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            switchPseudoClassTab(tab.dataset.pseudo);
        });
    });

    // Auto-save pseudo-class content
    elements.pseudoTextareas?.forEach(textarea => {
        textarea.addEventListener('input', debounce(savePseudoClassContent, 500));
    });

    // Pseudo-class toggle events
    elements.pseudoToggles?.forEach(toggle => {
        toggle.addEventListener('change', handlePseudoClassToggle);
    });
    
    // Export/Import event listeners
    if (elements.exportBtn) {
        elements.exportBtn.addEventListener('click', showExportOptions);
    }
    
    if (elements.importBtn) {
        elements.importBtn.addEventListener('click', showImportOptions);
    }
    
    if (elements.doExportBtn) {
        elements.doExportBtn.addEventListener('click', handleExport);
    }
    
    if (elements.cancelExportBtn) {
        elements.cancelExportBtn.addEventListener('click', hideExportOptions);
    }
    
    if (elements.selectFileBtn) {
        elements.selectFileBtn.addEventListener('click', handleImportFileSelection);
    }
    
    if (elements.cancelImportBtn) {
        elements.cancelImportBtn.addEventListener('click', hideImportOptions);
    }
    
    // Search/Filter event listeners
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    if (elements.clearSearchBtn) {
        elements.clearSearchBtn.addEventListener('click', clearSearch);
    }
    
    if (elements.filterStatusSelect) {
        elements.filterStatusSelect.addEventListener('change', handleFilterChange);
    }
    
    if (elements.filterSortSelect) {
        elements.filterSortSelect.addEventListener('change', handleSortChange);
    }
    
    // User view event listeners
    if (elements.userSearchInput) {
        elements.userSearchInput.addEventListener('input', debounce(handleUserSearch, 300));
    }
    
    if (elements.userSyncButton) {
        elements.userSyncButton.addEventListener('click', handleUserSync);
    }
    
    if (elements.copyDiagnosticsBtn) {
        elements.copyDiagnosticsBtn.addEventListener('click', copyDiagnostics);
    }
    
    // Screenshot event listeners
    if (elements.screenshotBtn) {
        elements.screenshotBtn.addEventListener('click', showScreenshotOptions);
    }
    
    if (elements.doScreenshotBtn) {
        elements.doScreenshotBtn.addEventListener('click', handleScreenshot);
    }
    
    if (elements.cancelScreenshotBtn) {
        elements.cancelScreenshotBtn.addEventListener('click', hideScreenshotOptions);
    }
    
    // Screenshot type change listener
    document.addEventListener('change', (e) => {
        if (e.target.name === 'screenshot-type') {
            toggleElementSelectorGroup(e.target.value === 'element');
        }
    });
    
    // Eyedropper event listener
    if (elements.eyedropperBtn) {
        elements.eyedropperBtn.addEventListener('click', handleEyedropper);
    }
}

// =============================================================================
// CUSTOMIZATION MANAGEMENT - Enhanced with new format support
// =============================================================================
async function loadCustomizations(adminMode) {
    try {
        const result = await chrome.storage.local.get('customizations');
        let storedCustomizations = result.customizations || [];

        // Handle both legacy and new format
        if (typeof storedCustomizations === 'object' && !Array.isArray(storedCustomizations)) {
            // Legacy format - convert to new format
            storedCustomizations = await migrateLegacyCustomizations(storedCustomizations);
        }

        customizations = storedCustomizations;

        // Initialize search/filter manager with loaded customizations
        await initializeSearchFilterManager();
        if (searchFilterManager) {
            searchFilterManager.setCustomizations(customizations);
        }

        // Update UI based on available elements
        if (elements.customizationList) {
            updateCustomizationList();
        } else if (elements.existingCustomizations) {
            await loadExistingCustomizations(); // Legacy display
        }

        updateRuleCount();

    } catch (error) {
        console.error('Error loading customizations:', error);
        showNotification('Failed to load customizations: ' + error.message, 'error');
    }
}

async function saveCustomization(customization) {
    try {
        const result = await chrome.storage.local.get('customizations');
        let existingCustomizations = result.customizations || [];

        // Ensure we have array format
        if (typeof existingCustomizations === 'object' && !Array.isArray(existingCustomizations)) {
            existingCustomizations = await migrateLegacyCustomizations(existingCustomizations);
        }

        // Update or add customization
        const existingIndex = existingCustomizations.findIndex(c => c.id === customization.id);

        if (existingIndex >= 0) {
            existingCustomizations[existingIndex] = customization;
        } else {
            existingCustomizations.push(customization);
        }

        await chrome.storage.local.set({ customizations: existingCustomizations });

        // Update content script
        await notifyContentScript('updateCustomization', customization);

        // Preview functionality
async function previewCurrentRule() {
    try {
        // Check permission
        if (!await checkPermission('PREVIEW_RULE')) {
            showNotification('You do not have permission to preview rules', 'error');
            return;
        }
        
        const formData = collectFormData();
        
        if (!formData.selector) {
            showNotification('Please enter a CSS selector', 'error');
            return;
        }
        
        // Build customization object for preview
        const previewCustomization = {
            id: 'preview-' + Date.now(),
            name: formData.name || 'Preview Rule',
            selector: formData.selector,
            css: formData.baseCss || '',
            pseudoClasses: formData.pseudoClasses || {},
            enabled: true,
            isPreview: true,
            createdAt: Date.now()
        };
        
        // Send preview to content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            showNotification('Cannot access current tab', 'error');
            return;
        }
        
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'previewCustomization',
            customization: previewCustomization
        });
        
        if (response && response.success) {
            showNotification('Preview active', 'success');
            
            // Change preview button to "Stop Preview"
            elements.previewRule.textContent = 'Stop Preview';
            elements.previewRule.classList.add('btn-warning');
            
            // Add click handler to stop preview
            const stopPreview = async () => {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'stopPreview',
                    customizationId: previewCustomization.id
                });
                
                elements.previewRule.textContent = 'Preview';
                elements.previewRule.classList.remove('btn-warning');
                elements.previewRule.removeEventListener('click', stopPreview);
                elements.previewRule.addEventListener('click', previewCurrentRule);
                
                showNotification('Preview stopped', 'info');
            };
            
            elements.previewRule.removeEventListener('click', previewCurrentRule);
            elements.previewRule.addEventListener('click', stopPreview);
            
        } else {
            showNotification('Failed to start preview', 'error');
        }
        
    } catch (error) {
        console.error('Preview error:', error);
        showNotification('Preview failed: ' + error.message, 'error');
    }
}

        // Sync with SharePoint if admin
        if (isAdmin) {
            await syncWithSharePoint(customization);
        }

    } catch (error) {
        console.error('Error saving customization:', error);
        throw error;
    }
}

// =============================================================================
// PSEUDO-CLASS FUNCTIONALITY - From draft
// =============================================================================
function initializePseudoClassTabs() {
    const firstTab = elements.pseudoTabs?.[0];
    const firstPanel = elements.pseudoPanels?.[0];

    if (firstTab && firstPanel) {
        firstTab.classList.add('active');
        firstPanel.classList.add('active');
    }
}

function switchPseudoClassTab(pseudoClass) {
    elements.pseudoTabs?.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.pseudo === pseudoClass);
    });

    elements.pseudoPanels?.forEach(panel => {
        panel.classList.toggle('active', panel.dataset.pseudo === pseudoClass);
    });
}

function handlePseudoClassToggle(event) {
    const toggle = event.target;
    const pseudoClass = toggle.dataset.pseudo;
    const isEnabled = toggle.checked;

    const tab = document.querySelector(`[data-pseudo="${pseudoClass}"]`);
    if (tab) {
        tab.classList.toggle('enabled', isEnabled);
        tab.style.fontWeight = isEnabled ? '600' : '500';
    }

    if (isEnabled) {
        switchPseudoClassTab(pseudoClass);
    }
}

function toggleCreateForm() {
    const isVisible = elements.createForm?.classList.contains('active');

    if (isVisible) {
        elements.createForm.classList.remove('active');
        elements.toggleCreateForm.innerHTML = '<span class="btn-text">New Rule</span><span class="btn-icon">+</span>';
        clearForm();
    } else {
        elements.createForm?.classList.add('active');
        elements.toggleCreateForm.innerHTML = '<span class="btn-text">Cancel</span><span class="btn-icon">×</span>';
        elements.ruleName?.focus();
    }
}

function clearForm() {
    if (elements.ruleName) elements.ruleName.value = '';
    if (elements.cssSelector) elements.cssSelector.value = '';
    if (elements.baseCss) elements.baseCss.value = '';

    elements.pseudoTextareas?.forEach(textarea => {
        textarea.value = '';
    });

    elements.pseudoToggles?.forEach(toggle => {
        toggle.checked = false;
    });

    editingCustomization = null;
    switchPseudoClassTab('hover');
}

async function handleSubmitCustomization(event) {
    event.preventDefault();

    try {
        // Check permission
        const isEditing = !!editingCustomization;
        const requiredPermission = isEditing ? 'EDIT_RULE' : 'CREATE_RULE';
        
        if (!await checkPermission(requiredPermission)) {
            showNotification(`You do not have permission to ${isEditing ? 'edit' : 'create'} rules`, 'error');
            return;
        }
        
        const formData = collectFormData();

        if (!validateFormData(formData)) {
            return;
        }

        await saveCustomization(formData);
        
        // Log admin action
        await logAdminAction(requiredPermission, {
            ruleName: formData.name,
            selector: formData.selector,
            hasPseudoClasses: Object.keys(formData.pseudoClasses || {}).length > 0,
            isEdit: isEditing
        });

        toggleCreateForm();
        await loadCustomizations(true);

        showNotification('Customization saved successfully', 'success');

    } catch (error) {
        console.error('Error saving customization:', error);
        showNotification('Failed to save customization: ' + error.message, 'error');
    }
}

function collectFormData() {
    const formData = {
        id: editingCustomization?.id || generateId(),
        name: elements.ruleName?.value.trim() || 'Unnamed Rule',
        selector: elements.cssSelector?.value.trim() || '',
        css: elements.baseCss?.value.trim() || '',
        pseudoClasses: {},
        enabled: true,
        created: editingCustomization?.created || new Date().toISOString(),
        updated: new Date().toISOString()
    };

    // Collect pseudo-class data
    elements.pseudoToggles?.forEach(toggle => {
        const pseudoClass = toggle.dataset.pseudo;
        const isEnabled = toggle.checked;

        if (isEnabled) {
            const textarea = document.querySelector(`[data-pseudo="${pseudoClass}"] .pseudo-css`);
            const css = textarea?.value.trim();

            if (css) {
                formData.pseudoClasses[pseudoClass] = parseCSSProperties(css);
            }
        }
    });

    return formData;
}

function validateFormData(formData) {
    if (!formData.name) {
        showNotification('Please enter a rule name', 'error');
        elements.ruleName?.focus();
        return false;
    }

    if (!formData.selector) {
        showNotification('Please enter a CSS selector', 'error');
        elements.cssSelector?.focus();
        return false;
    }

    if (!formData.css && Object.keys(formData.pseudoClasses).length === 0) {
        showNotification('Please enter either base CSS or pseudo-class styles', 'error');
        elements.baseCss?.focus();
        return false;
    }

    try {
        document.querySelector(formData.selector);
    } catch (error) {
        showNotification('Invalid CSS selector: ' + error.message, 'error');
        elements.cssSelector?.focus();
        return false;
    }

    return true;
}

async function testCurrentSelector() {
    const selector = elements.cssSelector?.value.trim();

    if (!selector) {
        showNotification('Please enter a selector to test', 'error');
        return;
    }

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url.includes('dynamics.com')) {
            showNotification('Please navigate to a Dynamics 365 page to test selectors', 'error');
            return;
        }

        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'testSelector',
            selector: selector
        });

        if (response?.success) {
            showNotification(`Selector found ${response.count} elements`, 'success');
        } else {
            showNotification(response?.message || 'No elements found', 'error');
        }

    } catch (error) {
        console.error('Error testing selector:', error);
        showNotification('Failed to test selector: ' + error.message, 'error');
    }
}

// =============================================================================
// UI UPDATE FUNCTIONS - Enhanced from draft
// =============================================================================
function updateCustomizationList() {
    if (!elements.customizationList) return;

    elements.customizationList.innerHTML = '';

    // Get filtered results if search/filter is active
    const displayCustomizations = searchFilterManager ? 
        searchFilterManager.getFilteredResults() : 
        customizations;

    if (displayCustomizations.length === 0) {
        // Check if it's due to search/filter or no customizations at all
        if (customizations.length > 0 && searchFilterManager) {
            // Show no search results message
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                </svg>
                <p>No rules match your search</p>
                <p class="suggestion">Try adjusting your filters or search term</p>
            `;
            elements.customizationList.appendChild(noResults);
            elements.emptyState?.classList.add('hidden');
        } else {
            // Show empty state
            elements.emptyState?.classList.remove('hidden');
            elements.customizationList.style.display = 'none';
        }
        return;
    }

    elements.emptyState?.classList.add('hidden');
    elements.customizationList.style.display = 'block';

    // Show search results info if search is active
    if (searchFilterManager && (elements.searchInput?.value || elements.filterStatusSelect?.value !== 'all')) {
        const stats = searchFilterManager.getStatistics();
        const info = document.createElement('div');
        info.className = 'search-results-info';
        info.innerHTML = `Showing <strong>${stats.filtered}</strong> of <strong>${stats.total}</strong> rules`;
        elements.customizationList.appendChild(info);
    }

    displayCustomizations.forEach(customization => {
        const item = createCustomizationItem(customization);
        elements.customizationList.appendChild(item);
    });
}

function createCustomizationItem(customization) {
    const item = document.createElement('div');
    item.className = 'customization-item';

    if (customization.pseudoClasses && Object.keys(customization.pseudoClasses).length > 0) {
        item.classList.add('has-pseudo-classes');
    }

    const hasPseudoClasses = customization.pseudoClasses && Object.keys(customization.pseudoClasses).length > 0;
    const pseudoClassBadges = hasPseudoClasses ?
        Object.keys(customization.pseudoClasses).map(pseudo =>
            `<span class="state-badge ${pseudo}">:${pseudo}</span>`
        ).join('') : '';
    
    // Get permissions or use default if not available
    const permissions = customizationActionsPermissions || {};
    
    // Build action buttons based on permissions
    const editButton = permissions.EDIT_RULE !== false ? `
        <button class="btn-icon edit" title="Edit" data-action="edit" data-id="${customization.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
        </button>` : '';
    
    const deleteButton = permissions.DELETE_RULE !== false ? `
        <button class="btn-icon delete" title="Delete" data-action="delete" data-id="${customization.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
        </button>` : '';

    item.innerHTML = `
        <div class="customization-header">
            <div class="customization-info">
                <h3 class="customization-name">${escapeHtml(customization.name)}</h3>
                <p class="customization-selector">${escapeHtml(customization.selector)}</p>
                <div class="customization-states">
                    ${customization.css ? '<span class="state-badge base">base</span>' : ''}
                    ${pseudoClassBadges}
                </div>
            </div>
            <div class="customization-actions">
                <button class="btn-icon test" title="Test selector" data-action="test" data-id="${customization.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M9 12L11 14L15 10"/>
                        <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"/>
                    </svg>
                </button>
                ${editButton}
                ${deleteButton}
                <label class="toggle-switch">
                    <input type="checkbox" ${customization.enabled ? 'checked' : ''} data-action="toggle" data-id="${customization.id}">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        </div>
    `;

    item.addEventListener('click', handleCustomizationAction);
    return item;
}

async function handleCustomizationAction(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();

    const action = target.dataset.action;
    const customizationId = target.dataset.id;
    const customization = customizations.find(c => c.id === customizationId);

    if (!customization) return;

    try {
        switch (action) {
            case 'test':
                await testCustomization(customization);
                break;
            case 'edit':
                if (!await checkPermission('EDIT_RULE')) {
                    showNotification('You do not have permission to edit rules', 'error');
                    return;
                }
                editCustomization(customization);
                break;
            case 'delete':
                await deleteCustomization(customization);
                break;
            case 'toggle':
                await toggleCustomization(customization);
                break;
        }
    } catch (error) {
        console.error(`Error handling ${action}:`, error);
        showNotification(`Failed to ${action} customization: ${error.message}`, 'error');
    }
}

async function testCustomization(customization) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url.includes('dynamics.com')) {
            showNotification('Please navigate to a Dynamics 365 page to test', 'error');
            return;
        }

        const baseResponse = await chrome.tabs.sendMessage(tab.id, {
            action: 'testSelector',
            selector: customization.selector
        });

        let message = `Base selector: ${baseResponse.count || 0} elements`;

        if (customization.pseudoClasses && Object.keys(customization.pseudoClasses).length > 0) {
            const pseudoTests = [];
            for (const pseudo of Object.keys(customization.pseudoClasses)) {
                const pseudoResponse = await chrome.tabs.sendMessage(tab.id, {
                    action: 'testPseudoClass',
                    selector: customization.selector,
                    pseudoClass: pseudo
                });
                pseudoTests.push(`${pseudo}: ${pseudoResponse.elementsFound || 0}`);
            }
            message += `\nPseudo-classes: ${pseudoTests.join(', ')}`;
        }

        showNotification(message, 'success');

    } catch (error) {
        console.error('Error testing customization:', error);
        showNotification('Failed to test customization: ' + error.message, 'error');
    }
}

function editCustomization(customization) {
    editingCustomization = customization;

    if (elements.ruleName) elements.ruleName.value = customization.name || '';
    if (elements.cssSelector) elements.cssSelector.value = customization.selector || '';
    if (elements.baseCss) elements.baseCss.value = customization.css || '';

    elements.pseudoToggles?.forEach(toggle => {
        const pseudoClass = toggle.dataset.pseudo;
        const hasData = customization.pseudoClasses && customization.pseudoClasses[pseudoClass];

        toggle.checked = hasData;

        if (hasData) {
            const textarea = document.querySelector(`[data-pseudo="${pseudoClass}"] .pseudo-css`);
            if (textarea) {
                const cssText = Object.entries(customization.pseudoClasses[pseudoClass])
                    .map(([prop, value]) => `${prop}: ${value}`)
                    .join(';\n');
                textarea.value = cssText;
            }
        }
    });

    if (!elements.createForm?.classList.contains('active')) {
        toggleCreateForm();
    }

    elements.ruleName?.focus();
}

async function deleteCustomization(customization) {
    // Check permission first
    if (!await checkPermission('DELETE_RULE')) {
        showNotification('You do not have permission to delete rules', 'error');
        return;
    }
    
    const confirmed = await showConfirmDialog(`Are you sure you want to delete "${customization.name}"?`);
    if (!confirmed) return;

    try {
        const result = await chrome.storage.local.get('customizations');
        const updatedCustomizations = (result.customizations || [])
            .filter(c => c.id !== customization.id);

        await chrome.storage.local.set({ customizations: updatedCustomizations });
        
        // Log admin action
        await logAdminAction('DELETE_RULE', {
            ruleName: customization.name,
            selector: customization.selector,
            ruleId: customization.id
        });

        await notifyContentScript('removeCustomization', { id: customization.id });

        await loadCustomizations(true);

        showNotification('Customization deleted successfully', 'success');

    } catch (error) {
        console.error('Error deleting customization:', error);
        throw error;
    }
}

async function toggleCustomization(customization) {
    try {
        customization.enabled = !customization.enabled;

        const result = await chrome.storage.local.get('customizations');
        const updatedCustomizations = (result.customizations || [])
            .map(c => c.id === customization.id ? customization : c);

        await chrome.storage.local.set({ customizations: updatedCustomizations });

        await notifyContentScript('updateCustomization', customization);

        await loadCustomizations(true);

    } catch (error) {
        console.error('Error toggling customization:', error);
        throw error;
    }
}

function updateRuleCount() {
    if (!elements.ruleCount) return;

    const count = customizations.length;
    elements.ruleCount.textContent = `${count} rule${count !== 1 ? 's' : ''}`;
}

// =============================================================================
// SHAREPOINT SYNC - From draft
// =============================================================================
async function handleSyncWithSharePoint() {
    try {
        // Check permission
        if (!await checkPermission('SYNC_SHAREPOINT')) {
            showNotification('You do not have permission to sync with SharePoint', 'error');
            return;
        }
        
        const authToken = await getAuthToken();
        const result = await chrome.runtime.sendMessage({
            action: "syncToSharePoint",
            token: authToken
        });

        if (result.success) {
            // Log admin action
            await logAdminAction('SYNC_SHAREPOINT', {
                customizationCount: result.count || 0,
                syncType: 'upload'
            });
            
            showNotification('Successfully synced to SharePoint!', 'success');
            await loadCustomizations(true);
        } else {
            throw new Error(result.error || 'Sync failed');
        }
    } catch (error) {
        console.error('SharePoint sync error:', error);
        showNotification('Sync failed: ' + error.message, 'error');
    }
}

async function handleUserSync() {
    try {
        const result = await chrome.runtime.sendMessage({
            action: "syncFromSharePoint"
        });

        if (result.success) {
            showNotification('Successfully synced customizations!', 'success');
            await loadCustomizations(false);
        } else {
            throw new Error(result.error || 'Sync failed');
        }
    } catch (error) {
        console.error('User sync error:', error);
        showNotification('Sync failed: ' + error.message, 'error');
    }
}

async function syncWithSharePoint(customization) {
    if (!isAdmin) return;

    try {
        console.log('Syncing with SharePoint:', customization);
        // Real implementation would use Microsoft Graph API
    } catch (error) {
        console.error('SharePoint sync error:', error);
        // Don't throw - local save should still work
    }
}

// =============================================================================
// LEGACY SUPPORT FUNCTIONS - For backward compatibility
// =============================================================================
function handleCssEditorInput() {
    if (elements.cssEditor && elements.saveRuleBtn) {
        if (elements.cssEditor.value.trim()) {
            elements.saveRuleBtn.disabled = false;
        } else {
            elements.saveRuleBtn.disabled = true;
        }
    }
}

async function handleSaveRule() {
    try {
        const cssContent = elements.cssEditor.value.trim();
        if (!cssContent) {
            showNotification('Please enter some CSS rules', 'error');
            return;
        }

        const customization = {
            id: generateId(),
            name: 'Quick CSS Rule',
            css: cssContent,
            selector: extractSelectorFromCSS(cssContent),
            enabled: true,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        await saveCustomization(customization);
        elements.cssEditor.value = '';
        elements.saveRuleBtn.disabled = true;

        showNotification('CSS rule saved successfully', 'success');
        await loadCustomizations(true);

    } catch (error) {
        console.error('Error saving CSS rule:', error);
        showNotification('Failed to save CSS rule: ' + error.message, 'error');
    }
}

function handleClearEditor() {
    elements.cssEditor.value = '';
    elements.saveRuleBtn.disabled = true;
    showNotification('Editor cleared', 'success');
}

function toggleQuickEditor() {
    if (elements.quickEditorSection) {
        const isVisible = elements.quickEditorSection.style.display !== 'none';
        elements.quickEditorSection.style.display = isVisible ? 'none' : 'block';
        elements.toggleQuickEditor.textContent = isVisible ? 'Show' : 'Hide';
    }
}

// Legacy form validation and parsing
function validateLegacyForm() {
    if (!elements.targetsInput || !elements.stylesInput) {
        throw new Error('Form elements not found');
    }

    const targetsValue = elements.targetsInput.value.trim();
    const stylesValue = elements.stylesInput.value.trim();

    if (!targetsValue) {
        throw new Error('Target(s) field is required');
    }

    if (!stylesValue) {
        throw new Error('Style(s) field is required');
    }

    const targets = parseTargets(targetsValue);
    const styles = parseStyles(stylesValue);

    if (targets.length === 0) {
        throw new Error('At least one valid target is required');
    }

    if (styles.length === 0) {
        throw new Error('At least one valid style is required');
    }

    return { targets, styles };
}

function parseTargets(targetsString) {
    if (!targetsString?.trim()) return [];

    const targets = [];
    const parts = targetsString.split(';').map(s => s.trim()).filter(s => s);

    for (const part of parts) {
        const match = part.match(/^([^=]+)="([^"]*)"$/);
        if (match) {
            const property = match[1].trim();
            const value = match[2];
            targets.push({ property, value });
        } else {
            throw new Error(`Invalid target format: "${part}". Expected format: property="value"`);
        }
    }

    return targets;
}

function parseStyles(stylesString) {
    if (!stylesString?.trim()) return [];

    const styles = [];
    const parts = stylesString.split(';').map(s => s.trim()).filter(s => s);

    for (const part of parts) {
        const colonIndex = part.indexOf(':');
        if (colonIndex === -1) {
            throw new Error(`Invalid style format: "${part}". Expected format: property: value`);
        }

        const property = part.substring(0, colonIndex).trim();
        const value = part.substring(colonIndex + 1).trim();

        if (!property || !value) {
            throw new Error(`Invalid style format: "${part}". Property and value cannot be empty`);
        }

        if (!validateCSSProperty(property)) {
            throw new Error(`Invalid CSS property: "${property}"`);
        }

        styles.push({ property, value });
    }

    return styles;
}

function validateCSSProperty(property) {
    const cssPropertyRegex = /^[a-z]+(-[a-z]+)*$/;
    return cssPropertyRegex.test(property);
}

async function saveLegacyFieldValues() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && elements.targetsInput && elements.stylesInput) {
        await chrome.storage.local.set({
            targets: elements.targetsInput.value,
            styles: elements.stylesInput.value
        });
    }
}

async function saveLegacyCustomization(targets, styles) {
    const selectedQueryParams = getSelectedQueryParams();
    const queryPattern = generateQueryPattern(selectedQueryParams);

    try {
        const result = await chrome.storage.local.get('customizations');
        const customizations = result.customizations || {};

        if (!customizations[currentDomain]) {
            customizations[currentDomain] = [{
                id: `${currentDomain}_${Date.now()}`,
                domain: currentDomain,
                queryStrings: {}
            }];
        }

        const domainData = customizations[currentDomain][0];

        if (!domainData.queryStrings[queryPattern]) {
            domainData.queryStrings[queryPattern] = {};
        }

        // For each target, create a selector and store all styles
        targets.forEach(target => {
            const selector = generateSelector(target);

            if (!domainData.queryStrings[queryPattern][selector]) {
                domainData.queryStrings[queryPattern][selector] = {};
            }

            // Add all styles to this selector
            styles.forEach(style => {
                domainData.queryStrings[queryPattern][selector][style.property] = style.value;
            });
        });

        await chrome.storage.local.set({ customizations });

    } catch (error) {
        throw new Error(`Failed to save customization: ${error.message}`);
    }
}

function generateSelector(target) {
    const { property, value } = target;

    if (property === 'id') {
        return `#${value}`;
    } else if (property === 'class') {
        return `.${value}`;
    } else {
        return `[${property}="${value}"]`;
    }
}

async function applyStylesToPage(targets, styles) {
    try {
        if (currentTab.url.startsWith('chrome://') ||
            currentTab.url.startsWith('edge://') ||
            currentTab.url.startsWith('moz-extension://')) {
            throw new Error('Cannot access browser internal pages');
        }

        const result = await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            func: injectUnifiedStyles,
            args: [targets, styles]
        });

        if (result && result[0] && result[0].result) {
            return result[0].result;
        } else {
            throw new Error('Unexpected response from content script');
        }
    } catch (error) {
        throw new Error(`Script injection failed: ${error.message}`);
    }
}

// Content script injection function for unified styles
function injectUnifiedStyles(targets, styles) {
    console.log('Injecting unified styles:', { targets, styles });

    try {
        let totalElementsFound = 0;
        const results = [];

        targets.forEach((target, targetIndex) => {
            let elements = [];
            const { property, value } = target;

            if (property === 'id') {
                const element = document.getElementById(value);
                if (element) elements = [element];
            } else if (property === 'class') {
                elements = Array.from(document.getElementsByClassName(value));
            } else {
                const selector = `[${property}="${value}"]`;
                console.log(`Using selector for target ${targetIndex}:`, selector);
                elements = Array.from(document.querySelectorAll(selector));
            }

            console.log(`Found ${elements.length} elements for target ${targetIndex} (${property}="${value}")`);

            if (elements.length > 0) {
                totalElementsFound += elements.length;

                elements.forEach((element, elementIndex) => {
                    styles.forEach((style, styleIndex) => {
                        const jsPropertyName = style.property.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
                        console.log(`Applying style ${styleIndex} to element ${elementIndex} of target ${targetIndex}:`, jsPropertyName, '=', style.value);
                        element.style[jsPropertyName] = style.value;
                    });
                });

                results.push({
                    target: `${property}="${value}"`,
                    elementsFound: elements.length,
                    stylesApplied: styles.length
                });
            } else {
                results.push({
                    target: `${property}="${value}"`,
                    elementsFound: 0,
                    stylesApplied: 0
                });
            }
        });

        if (totalElementsFound === 0) {
            return {
                success: false,
                message: `No elements found for any of the specified targets`,
                details: results
            };
        }

        const styleCount = styles.length;
        const targetCount = targets.length;

        return {
            success: true,
            count: totalElementsFound,
            message: `Applied ${styleCount} style(s) to ${totalElementsFound} element(s) across ${targetCount} target(s)`,
            details: results
        };

    } catch (error) {
        console.error('Error in injectUnifiedStyles:', error);
        return {
            success: false,
            message: `Error: ${error.message}`
        };
    }
}

// Legacy existing customizations display
async function loadExistingCustomizations() {
    if (!elements.existingCustomizations) return;

    try {
        const result = await chrome.storage.local.get('customizations');
        const customizations = result.customizations || {};

        if (!customizations[currentDomain] || !customizations[currentDomain][0]) {
            elements.existingCustomizations.innerHTML = `
                <div class="empty-state">
                    <p>No customizations found</p>
                    <small>Create your first style rule above</small>
                </div>
            `;
            return;
        }

        const domainData = customizations[currentDomain][0];
        const queryStrings = domainData.queryStrings;

        let html = '';
        let count = 0;

        Object.entries(queryStrings).forEach(([queryPattern, selectors]) => {
            Object.entries(selectors).forEach(([selector, styles]) => {
                Object.entries(styles).forEach(([property, value]) => {
                    count++;
                    html += `
                        <div class="customization-item">
                            <div class="customization-info">
                                <div class="customization-name">${selector}</div>
                                <div class="customization-details">${property}: ${value}</div>
                                <div class="customization-details">Query: ${queryPattern || 'All pages'}</div>
                            </div>
                            <div class="customization-actions">
                                <button class="btn-icon" onclick="editCustomization('${selector}', '${property}', '${value}', '${queryPattern}')" title="Edit">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button class="btn-icon" onclick="deleteCustomization('${selector}', '${property}', '${queryPattern}')" title="Delete">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `;
                });
            });
        });

        if (count === 0) {
            elements.existingCustomizations.innerHTML = `
                <div class="empty-state">
                    <p>No customizations found</p>
                    <small>Create your first style rule above</small>
                </div>
            `;
        } else {
            elements.existingCustomizations.innerHTML = html;
        }

    } catch (error) {
        console.error('Error loading customizations:', error);
    }
}

function getSelectedQueryParams() {
    if (!elements.queryStringList) return {};

    const checkboxes = elements.queryStringList.querySelectorAll('input[type="checkbox"]:checked');
    const selectedParams = {};

    checkboxes.forEach(checkbox => {
        const [key, value] = checkbox.value.split('=');
        selectedParams[key] = value;
    });

    return selectedParams;
}

function generateQueryPattern(selectedParams) {
    return Object.entries(selectedParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
}

// =============================================================================
// UTILITY FUNCTIONS - Combined from both versions
// =============================================================================
function generateId() {
    return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function parseCSSProperties(cssText) {
    const properties = {};
    const declarations = cssText.split(';');

    declarations.forEach(declaration => {
        const [property, value] = declaration.split(':').map(s => s.trim());
        if (property && value) {
            properties[property] = value;
        }
    });

    return properties;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function extractSelectorFromCSS(css) {
    const match = css.match(/^([^{]+)/);
    return match ? match[1].trim() : '.example-selector';
}

function savePseudoClassContent() {
    console.log('Pseudo-class content updated');
}

// Notification functions
function showNotification(message, type = 'info') {
    let messageEl = document.getElementById('popup-message');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = 'popup-message';
        messageEl.className = `message message-${type}`;

        const content = document.querySelector('.content');
        if (content) {
            content.insertBefore(messageEl, content.firstChild);
        }
    }

    messageEl.className = `message message-${type}`;
    messageEl.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            ${type === 'success' ?
            '<path d="M9 12L11 14L15 10"/><path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"/>' :
            '<circle cx="12" cy="12" r="10"/><path d="M15 9L9 15"/><path d="M9 9L15 15"/>'
        }
        </svg>
        <span>${escapeHtml(message)}</span>
    `;

    setTimeout(() => {
        messageEl.remove();
    }, 5000);
}

// Legacy status display function
function showStatus(message, isError = false) {
    if (!elements.status) {
        // Fall back to new notification system
        showNotification(message, isError ? 'error' : 'success');
        return;
    }

    elements.status.textContent = message;
    elements.status.className = `status ${isError ? 'error' : 'success'}`;
    elements.status.style.display = 'block';

    setTimeout(() => {
        elements.status.style.display = 'none';
    }, 3000);
}

function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.innerHTML = `
            <div class="confirm-content">
                <p>${escapeHtml(message)}</p>
                <div class="confirm-buttons">
                    <button class="confirm-yes">Yes</button>
                    <button class="confirm-no">No</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        dialog.querySelector('.confirm-yes').addEventListener('click', () => {
            dialog.remove();
            resolve(true);
        });

        dialog.querySelector('.confirm-no').addEventListener('click', () => {
            dialog.remove();
            resolve(false);
        });
    });
}

async function notifyContentScript(action, data) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            await chrome.tabs.sendMessage(tab.id, { action, ...data });
        }
    } catch (error) {
        console.log('Content script not available:', error.message);
    }
}

function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);

    let userMessage = 'An unexpected error occurred';

    if (error.message.includes('Invalid target format')) {
        userMessage = 'Invalid target format. Use: property="value"';
    } else if (error.message.includes('Invalid style format')) {
        userMessage = 'Invalid style format. Use: property: value';
    } else if (error.message.includes('Invalid CSS property')) {
        userMessage = 'Invalid CSS property name';
    } else if (error.message.includes('Cannot access')) {
        userMessage = 'Cannot access this page type';
    } else if (error.message.includes('Authentication')) {
        userMessage = 'Authentication required';
    }

    showStatus(userMessage, true);

    // Shake the form for validation errors
    if (error.message.includes('Invalid') && elements.form) {
        elements.form.classList.add('shake');
        setTimeout(() => elements.form.classList.remove('shake'), 500);
    }
}

// =============================================================================
// LEGACY MIGRATION - Support for old customization format
// =============================================================================
async function migrateLegacyCustomizations(legacyCustomizations) {
    const migratedCustomizations = [];

    try {
        // Convert legacy format to new format
        Object.entries(legacyCustomizations).forEach(([domain, domainData]) => {
            if (domainData && domainData[0] && domainData[0].queryStrings) {
                Object.entries(domainData[0].queryStrings).forEach(([queryPattern, selectors]) => {
                    Object.entries(selectors).forEach(([selector, styles]) => {
                        Object.entries(styles).forEach(([property, value]) => {
                            migratedCustomizations.push({
                                id: generateId(),
                                name: `Legacy: ${property} on ${selector}`,
                                selector: selector,
                                css: `${property}: ${value}`,
                                pseudoClasses: {},
                                enabled: true,
                                created: new Date().toISOString(),
                                updated: new Date().toISOString(),
                                migrated: true,
                                legacy: {
                                    domain: domain,
                                    queryPattern: queryPattern,
                                    property: property,
                                    value: value
                                }
                            });
                        });
                    });
                });
            }
        });

        // Save migrated customizations
        if (migratedCustomizations.length > 0) {
            await chrome.storage.local.set({ customizations: migratedCustomizations });
            console.log('Legacy customizations migrated:', migratedCustomizations.length);
        }

    } catch (error) {
        console.error('Error migrating legacy customizations:', error);
    }

    return migratedCustomizations;
}

// =============================================================================
// GLOBAL FUNCTIONS - Legacy support
// =============================================================================
window.editCustomization = function (selector, property, value, queryPattern) {
    if (userRole !== 'admin' && !isAdmin) return;

    // Convert selector back to target format
    let targetString = '';
    if (selector.startsWith('#')) {
        targetString = `id="${selector.substring(1)}"`;
    } else if (selector.startsWith('.')) {
        targetString = `class="${selector.substring(1)}"`;
    } else {
        // Extract from attribute selector [property="value"]
        const match = selector.match(/\[([^=]+)="([^"]*)"\]/);
        if (match) {
            targetString = `${match[1]}="${match[2]}"`;
        }
    }

    if (elements.targetsInput) elements.targetsInput.value = targetString;
    if (elements.stylesInput) elements.stylesInput.value = `${property}: ${value}`;

    // Scroll to form
    if (elements.adminView) elements.adminView.scrollTop = 0;
};

window.deleteCustomization = async function (selector, property, queryPattern) {
    if (userRole !== 'admin' && !isAdmin) return;

    if (!confirm('Are you sure you want to delete this customization?')) {
        return;
    }

    try {
        const result = await chrome.storage.local.get('customizations');
        const customizations = result.customizations || {};

        if (customizations[currentDomain] && customizations[currentDomain][0]) {
            const domainData = customizations[currentDomain][0];

            if (domainData.queryStrings[queryPattern] &&
                domainData.queryStrings[queryPattern][selector] &&
                domainData.queryStrings[queryPattern][selector][property]) {

                delete domainData.queryStrings[queryPattern][selector][property];

                // Clean up empty objects
                if (Object.keys(domainData.queryStrings[queryPattern][selector]).length === 0) {
                    delete domainData.queryStrings[queryPattern][selector];
                }

                if (Object.keys(domainData.queryStrings[queryPattern]).length === 0) {
                    delete domainData.queryStrings[queryPattern];
                }

                await chrome.storage.local.set({ customizations });

                // Reload the customizations list
                await loadExistingCustomizations();

                showStatus('Customization deleted successfully');
            }
        }
    } catch (error) {
        showStatus('Error deleting customization', true);
        console.error('Delete customization error:', error);
    }
};

// =============================================================================
// SEARCH/FILTER FUNCTIONALITY
// =============================================================================
let searchFilterManager = null;

// =============================================================================
// SCREENSHOT & EYEDROPPER MANAGERS
// =============================================================================
let screenshotManager = null;
let eyedropperManager = null;

// Initialize the search/filter manager
async function initializeSearchFilterManager() {
    if (!searchFilterManager && window.SearchFilterManager) {
        searchFilterManager = new window.SearchFilterManager();
        searchFilterManager.setCustomizations(customizations);
    }
}

// Handle search input
function handleSearch() {
    const searchTerm = elements.searchInput?.value || '';
    
    if (searchTerm) {
        elements.clearSearchBtn.style.display = 'block';
    } else {
        elements.clearSearchBtn.style.display = 'none';
    }
    
    if (searchFilterManager) {
        searchFilterManager.search(searchTerm);
        updateCustomizationList();
    }
}

// Clear search
function clearSearch() {
    if (elements.searchInput) {
        elements.searchInput.value = '';
        elements.clearSearchBtn.style.display = 'none';
    }
    
    if (searchFilterManager) {
        searchFilterManager.search('');
        updateCustomizationList();
    }
}

// Handle filter change
function handleFilterChange() {
    const filterValue = elements.filterStatusSelect?.value || 'all';
    
    if (searchFilterManager) {
        searchFilterManager.setFilter('enabled', filterValue);
        updateCustomizationList();
    }
}

// Handle sort change
function handleSortChange() {
    const sortValue = elements.filterSortSelect?.value || 'modified-desc';
    const [sortBy, sortOrder] = sortValue.split('-');
    
    if (searchFilterManager) {
        searchFilterManager.setFilter('sortBy', sortBy);
        searchFilterManager.setFilter('sortOrder', sortOrder);
        updateCustomizationList();
    }
}

// Initialize screenshot manager
async function initializeScreenshotManager() {
    if (!screenshotManager && window.ScreenshotManager) {
        screenshotManager = new window.ScreenshotManager();
        await screenshotManager.initialize();
    }
}

// Initialize eyedropper manager
async function initializeEyedropperManager() {
    if (!eyedropperManager && window.EyedropperManager) {
        eyedropperManager = new window.EyedropperManager();
        await eyedropperManager.initialize();
        
        // Set up callbacks
        eyedropperManager.setCallbacks({
            onColorPicked: (color) => {
                console.log('Color picked:', color);
                // You can update UI or insert color into active field
                if (elements.baseCss && elements.baseCss.matches(':focus')) {
                    const currentValue = elements.baseCss.value;
                    elements.baseCss.value = currentValue + `\ncolor: ${color.hex};`;
                }
            },
            onElementSelected: (elementInfo) => {
                console.log('Element selected:', elementInfo);
                // Update selector field
                if (elements.cssSelector) {
                    elements.cssSelector.value = elementInfo.selector;
                }
                // Auto-fill some basic styles
                if (elements.baseCss) {
                    const styles = eyedropperManager.getElementStyles(elementInfo.element);
                    const cssText = Object.entries(styles)
                        .map(([prop, value]) => `${prop}: ${value};`)
                        .join('\n');
                    elements.baseCss.value = cssText;
                }
            }
        });
    }
}

// =============================================================================
// EXPORT/IMPORT FUNCTIONALITY
// =============================================================================
let exportImportManager = null;

// Initialize the export/import manager
async function initializeExportImportManager() {
    if (!exportImportManager && window.ExportImportManager) {
        exportImportManager = new window.ExportImportManager();
    }
}

// Show export options panel
function showExportOptions() {
    if (elements.exportOptions) {
        elements.exportOptions.style.display = 'block';
        elements.importOptions.style.display = 'none';
    }
}

// Hide export options panel
function hideExportOptions() {
    if (elements.exportOptions) {
        elements.exportOptions.style.display = 'none';
    }
}

// Show import options panel
function showImportOptions() {
    if (elements.importOptions) {
        elements.importOptions.style.display = 'block';
        elements.exportOptions.style.display = 'none';
        elements.importStatusDiv.style.display = 'none';
    }
}

// Hide import options panel
function hideImportOptions() {
    if (elements.importOptions) {
        elements.importOptions.style.display = 'none';
        elements.importStatusDiv.style.display = 'none';
    }
}

// Handle export
async function handleExport() {
    try {
        // Check permission
        if (!await checkPermission('EXPORT_DATA')) {
            showNotification('You do not have permission to export data', 'error');
            return;
        }
        
        await initializeExportImportManager();
        
        const format = document.querySelector('input[name="export-format"]:checked')?.value || 'json';
        const includeMetadata = elements.exportMetadataCheckbox?.checked ?? true;
        
        const exportData = await exportImportManager.exportCustomizations({
            format,
            includeMetadata
        });
        
        // Download the file
        exportImportManager.downloadFile(
            exportData.content,
            exportData.filename,
            exportData.mimeType
        );
        
        showNotification('Export completed successfully', 'success');
        hideExportOptions();
        
        // Log admin action
        await logAdminAction('EXPORT_DATA', {
            format,
            customizationCount: customizations.length,
            includeMetadata
        });
        
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Export failed: ' + error.message, 'error');
    }
}

// Handle import file selection
async function handleImportFileSelection() {
    try {
        // Check permission
        if (!await checkPermission('IMPORT_DATA')) {
            showNotification('You do not have permission to import data', 'error');
            return;
        }
        
        await initializeExportImportManager();
        
        const fileData = await exportImportManager.uploadFile('.json,.csv,.xlsx');
        
        // Show status
        showImportStatus('Processing file...', 'info');
        
        const mergeStrategy = document.querySelector('input[name="merge-strategy"]:checked')?.value || 'merge';
        const validateBeforeImport = elements.validateImportCheckbox?.checked ?? true;
        
        const result = await exportImportManager.importCustomizations(fileData.content, {
            format: fileData.format,
            mergeStrategy,
            validateBeforeImport
        });
        
        // Show results
        if (result.success) {
            let statusMessage = `Successfully imported ${result.imported} rule(s)`;
            
            if (result.conflicts > 0) {
                statusMessage += `\n${result.conflicts} conflicts were resolved`;
            }
            
            showImportStatus(statusMessage, 'success');
            
            // Reload customizations
            await loadCustomizations(isAdmin);
            
            // Log admin action
            await logAdminAction('IMPORT_DATA', {
                format: fileData.format,
                imported: result.imported,
                total: result.total,
                conflicts: result.conflicts,
                mergeStrategy
            });
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                hideImportOptions();
            }, 3000);
            
        } else {
            showImportStatus('Import failed', 'error');
        }
        
    } catch (error) {
        console.error('Import error:', error);
        showImportStatus('Import failed: ' + error.message, 'error');
    }
}

// Show import status message
function showImportStatus(message, type = 'info') {
    if (elements.importStatusDiv) {
        elements.importStatusDiv.className = 'import-status ' + type;
        elements.importStatusDiv.textContent = message;
        elements.importStatusDiv.style.display = 'block';
    }
}

// =============================================================================
// USER VIEW FUNCTIONALITY
// =============================================================================
let userSearchTerm = '';

// Handle user search
function handleUserSearch() {
    userSearchTerm = elements.userSearchInput?.value.toLowerCase() || '';
    updateUserCustomizationList();
}

// Handle user sync
async function handleUserSync() {
    try {
        elements.userSyncButton.disabled = true;
        elements.userSyncStatus.textContent = 'Syncing...';
        
        // Trigger sync through background
        const result = await chrome.runtime.sendMessage({ action: 'syncRules' });
        
        if (result.success) {
            elements.userSyncStatus.textContent = 'Synced successfully';
            const now = new Date();
            elements.userLastSync.textContent = now.toLocaleTimeString();
            
            // Reload customizations
            await loadCustomizations(false);
            updateUserView();
        } else {
            elements.userSyncStatus.textContent = 'Sync failed';
        }
        
    } catch (error) {
        console.error('User sync error:', error);
        elements.userSyncStatus.textContent = 'Sync error';
    } finally {
        elements.userSyncButton.disabled = false;
        
        // Reset status after 3 seconds
        setTimeout(() => {
            elements.userSyncStatus.textContent = 'Ready';
        }, 3000);
    }
}

// Copy diagnostics information
async function copyDiagnostics() {
    try {
        const diagnostics = {
            extensionVersion: chrome.runtime.getManifest().version,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: currentTab?.url || 'Unknown',
            customizationCount: customizations.length,
            activeRules: customizations.filter(c => c.enabled !== false).length,
            errors: []
        };
        
        // Check for rule errors
        customizations.forEach(rule => {
            try {
                document.querySelector(rule.selector);
            } catch (e) {
                diagnostics.errors.push({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    selector: rule.selector,
                    error: 'Invalid selector'
                });
            }
        });
        
        const diagnosticsText = `DOM Style Injector Diagnostics
===========================
Generated: ${diagnostics.timestamp}
Extension Version: ${diagnostics.extensionVersion}
Current URL: ${diagnostics.url}

Rules Summary:
- Total Rules: ${diagnostics.customizationCount}
- Active Rules: ${diagnostics.activeRules}
- Rules with Errors: ${diagnostics.errors.length}

${diagnostics.errors.length > 0 ? `\nErrors Found:\n${diagnostics.errors.map(e => 
    `- Rule "${e.ruleName}" (${e.ruleId}): ${e.error}`
).join('\n')}` : 'No errors detected'}

System Info:
${diagnostics.userAgent}
`;
        
        await navigator.clipboard.writeText(diagnosticsText);
        
        // Show feedback
        elements.copyDiagnosticsBtn.textContent = 'Copied!';
        setTimeout(() => {
            elements.copyDiagnosticsBtn.textContent = 'Copy Diagnostics';
        }, 2000);
        
    } catch (error) {
        console.error('Copy diagnostics error:', error);
        showNotification('Failed to copy diagnostics', 'error');
    }
}

// Update user view UI
function updateUserView() {
    if (!elements.userCustomizationList) return;
    
    // Update statistics
    const totalRules = customizations.length;
    const activeRules = customizations.filter(c => c.enabled !== false).length;
    
    if (elements.userTotalRules) elements.userTotalRules.textContent = totalRules;
    if (elements.userActiveRules) elements.userActiveRules.textContent = activeRules;
    
    // Update last sync time
    chrome.storage.local.get('lastSyncTime', (result) => {
        if (result.lastSyncTime && elements.userLastSync) {
            const lastSync = new Date(result.lastSyncTime);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastSync) / 60000);
            
            if (diffMinutes < 1) {
                elements.userLastSync.textContent = 'Just now';
            } else if (diffMinutes < 60) {
                elements.userLastSync.textContent = `${diffMinutes}m ago`;
            } else if (diffMinutes < 1440) {
                const hours = Math.floor(diffMinutes / 60);
                elements.userLastSync.textContent = `${hours}h ago`;
            } else {
                elements.userLastSync.textContent = lastSync.toLocaleDateString();
            }
        }
    });
    
    updateUserCustomizationList();
}

// Update user customization list
function updateUserCustomizationList() {
    if (!elements.userCustomizationList) return;
    
    elements.userCustomizationList.innerHTML = '';
    
    // Filter customizations based on search
    let displayCustomizations = customizations.filter(c => c.enabled !== false);
    
    if (userSearchTerm) {
        displayCustomizations = displayCustomizations.filter(c => {
            const searchableText = [
                c.name,
                c.selector,
                c.css,
                c.category
            ].filter(Boolean).join(' ').toLowerCase();
            
            return searchableText.includes(userSearchTerm);
        });
    }
    
    if (displayCustomizations.length === 0) {
        elements.userEmptyState?.classList.remove('hidden');
        elements.userCustomizationList.style.display = 'none';
        return;
    }
    
    elements.userEmptyState?.classList.add('hidden');
    elements.userCustomizationList.style.display = 'block';
    
    displayCustomizations.forEach(customization => {
        const item = createUserCustomizationItem(customization);
        elements.userCustomizationList.appendChild(item);
    });
}

// Create user customization item (read-only)
function createUserCustomizationItem(customization) {
    const item = document.createElement('div');
    item.className = 'customization-item user-item';
    
    const hasPseudoClasses = customization.pseudoClasses && 
        Object.keys(customization.pseudoClasses).length > 0;
    
    const pseudoClassBadges = hasPseudoClasses ?
        Object.keys(customization.pseudoClasses).map(pseudo =>
            `<span class="state-badge ${pseudo}">:${pseudo}</span>`
        ).join('') : '';
    
    item.innerHTML = `
        <div class="customization-info">
            <div class="customization-name">${escapeHtml(customization.name || 'Unnamed Rule')}</div>
            <div class="customization-details">${escapeHtml(customization.selector)}</div>
            ${customization.category ? 
                `<div class="customization-details">Category: ${escapeHtml(customization.category)}</div>` : 
                ''}
            ${pseudoClassBadges ? 
                `<div class="pseudo-class-badges">${pseudoClassBadges}</div>` : 
                ''}
        </div>
        <div class="customization-status">
            <span class="status-badge active">Active</span>
        </div>
    `;
    
    return item;
}

// =============================================================================
// SCREENSHOT FUNCTIONALITY
// =============================================================================

// Show screenshot options
function showScreenshotOptions() {
    if (elements.screenshotOptions) {
        elements.screenshotOptions.style.display = 'block';
        elements.exportOptions.style.display = 'none';
        elements.importOptions.style.display = 'none';
    }
}

// Hide screenshot options
function hideScreenshotOptions() {
    if (elements.screenshotOptions) {
        elements.screenshotOptions.style.display = 'none';
    }
}

// Toggle element selector group
function toggleElementSelectorGroup(show) {
    if (elements.elementSelectorGroup) {
        elements.elementSelectorGroup.style.display = show ? 'block' : 'none';
    }
}

// Handle screenshot capture
async function handleScreenshot() {
    try {
        await initializeScreenshotManager();
        
        const screenshotType = document.querySelector('input[name="screenshot-type"]:checked')?.value || 'visible';
        const enableMarkup = elements.screenshotMarkup?.checked ?? true;
        
        showScreenshotStatus('Capturing screenshot...', 'info');
        
        let screenshot;
        
        // Capture based on selected type
        switch (screenshotType) {
            case 'visible':
                screenshot = await screenshotManager.captureVisibleTab();
                break;
            case 'fullpage':
                // Need to inject into active tab
                screenshot = await captureFullPageFromTab();
                break;
            case 'element':
                const selector = elements.screenshotSelector?.value;
                if (!selector) {
                    throw new Error('Please specify an element selector');
                }
                screenshot = await captureElementFromTab(selector);
                break;
            default:
                throw new Error('Invalid screenshot type');
        }
        
        if (screenshot) {
            showScreenshotStatus('Screenshot captured successfully!', 'success');
            
            if (enableMarkup) {
                // Initialize markup interface (this would be in content script)
                showScreenshotStatus('Opening markup editor...', 'info');
                // For now, just download the screenshot
                screenshotManager.downloadImage(screenshot.dataUrl, `screenshot-${screenshot.timestamp}.png`);
            } else {
                // Direct download
                screenshotManager.downloadImage(screenshot.dataUrl, `screenshot-${screenshot.timestamp}.png`);
            }
            
            // Save to history
            await screenshotManager.saveToHistory(screenshot);
            
            hideScreenshotOptions();
        }
        
    } catch (error) {
        console.error('Screenshot error:', error);
        showScreenshotStatus('Failed to capture screenshot: ' + error.message, 'error');
    }
}

// Capture full page from active tab
async function captureFullPageFromTab() {
    try {
        // Get active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        
        // Inject screenshot manager into the page
        await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['src/scripts/screenshot-manager.js']
        });
        
        // Execute capture
        const result = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: async () => {
                const manager = new ScreenshotManager();
                await manager.initialize();
                return await manager.captureFullPage();
            }
        });
        
        return result[0].result;
        
    } catch (error) {
        console.error('Full page capture error:', error);
        throw error;
    }
}

// Capture element from active tab
async function captureElementFromTab(selector) {
    try {
        // Get active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        
        // Inject screenshot manager into the page
        await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['src/scripts/screenshot-manager.js']
        });
        
        // Execute capture
        const result = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: async (sel) => {
                const manager = new ScreenshotManager();
                await manager.initialize();
                return await manager.captureElement(sel);
            },
            args: [selector]
        });
        
        return result[0].result;
        
    } catch (error) {
        console.error('Element capture error:', error);
        throw error;
    }
}

// Show screenshot status
function showScreenshotStatus(message, type = 'info') {
    if (elements.screenshotStatusDiv) {
        elements.screenshotStatusDiv.className = 'import-status ' + type;
        elements.screenshotStatusDiv.textContent = message;
        elements.screenshotStatusDiv.style.display = 'block';
    }
}

// =============================================================================
// EYEDROPPER FUNCTIONALITY
// =============================================================================

// Handle eyedropper activation
async function handleEyedropper() {
    try {
        await initializeEyedropperManager();
        
        if (!eyedropperManager.isSupported()) {
            showNotification('EyeDropper API not supported in this browser', 'error');
            return;
        }
        
        // Show options menu
        const action = await showEyedropperOptions();
        
        if (action === 'color') {
            // Pick color
            const color = await eyedropperManager.pickColor();
            if (color) {
                showNotification(`Color picked: ${color.hex}`, 'success');
            }
        } else if (action === 'element') {
            // Pick element - need to inject into active tab
            await pickElementFromTab();
        }
        
    } catch (error) {
        console.error('Eyedropper error:', error);
        showNotification('Eyedropper failed: ' + error.message, 'error');
    }
}

// Show eyedropper options
function showEyedropperOptions() {
    return new Promise((resolve) => {
        // Create simple option dialog
        const dialog = document.createElement('div');
        dialog.className = 'eyedropper-options-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        dialog.innerHTML = `
            <h3 style="margin: 0 0 16px 0; font-size: 16px;">Choose Action</h3>
            <button id="pick-color-btn" class="btn btn-primary" style="margin-right: 8px;">Pick Color</button>
            <button id="pick-element-btn" class="btn btn-secondary" style="margin-right: 8px;">Select Element</button>
            <button id="cancel-eyedropper-btn" class="btn btn-secondary">Cancel</button>
        `;
        
        document.body.appendChild(dialog);
        
        dialog.querySelector('#pick-color-btn').onclick = () => {
            dialog.remove();
            resolve('color');
        };
        
        dialog.querySelector('#pick-element-btn').onclick = () => {
            dialog.remove();
            resolve('element');
        };
        
        dialog.querySelector('#cancel-eyedropper-btn').onclick = () => {
            dialog.remove();
            resolve(null);
        };
    });
}

// Pick element from active tab
async function pickElementFromTab() {
    try {
        // Get active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        
        // Inject eyedropper manager into the page
        await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['src/scripts/eyedropper-manager.js']
        });
        
        // Execute element picker
        await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: async () => {
                const manager = new EyedropperManager();
                await manager.initialize();
                
                return new Promise((resolve) => {
                    manager.setCallbacks({
                        onElementSelected: (elementInfo) => {
                            resolve(elementInfo);
                        }
                    });
                    
                    manager.enableElementInspector();
                });
            }
        });
        
    } catch (error) {
        console.error('Element picker error:', error);
        throw error;
    }
}

// =============================================================================
// MESSAGE HANDLING
// =============================================================================
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'openOptions') {
        chrome.runtime.openOptionsPage();
    }
    return false;
});

// =============================================================================
// INITIALIZATION
// =============================================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePopup);
} else {
    initializePopup();
}

// =============================================================================
// DEBUGGING
// =============================================================================
window.popupDebug = {
    customizations,
    currentUser,
    isAdmin,
    elements,
    reloadCustomizations: () => loadCustomizations(true),
    testSelector: testCurrentSelector,
    clearAuth: clearAuthCache,
    getAuthToken: getAuthToken,

    // New pseudo-class debugging
    PSEUDO_CLASSES,
    collectFormData,
    validateFormData,
    switchPseudoClassTab,

    // Legacy support
    migrateLegacyCustomizations,
    
    // MSAL status
    msalAvailable,
    msalInstance
};

// =============================================================================
// BRANDING FUNCTIONALITY
// =============================================================================
let brandingManager = null;

async function initializeBranding() {
    try {
        // Check if BrandingManager is available
        if (typeof BrandingManager === 'undefined') {
            console.warn('BrandingManager not found. Branding features will be disabled.');
            return;
        }
        
        brandingManager = new BrandingManager();
        await brandingManager.initialize();
        
        console.log('Branding initialized in popup');
    } catch (error) {
        console.error('Failed to initialize branding:', error);
    }
}

// =============================================================================
// AI INTEGRATION FUNCTIONALITY
// =============================================================================
let aiIntegrationManager = null;
let aiAssistDialog = null;

async function initializeAIIntegration() {
    try {
        // Check if AIIntegrationManager is available
        if (typeof AIIntegrationManager === 'undefined') {
            console.warn('AIIntegrationManager not found. AI features will be disabled.');
            return;
        }
        
        aiIntegrationManager = new AIIntegrationManager();
        await aiIntegrationManager.initialize();
        
        // Setup AI assist button
        const aiAssistBtn = document.getElementById('ai-assist-btn');
        if (aiAssistBtn) {
            aiAssistBtn.addEventListener('click', showAIAssistDialog);
            
            // Check if any AI provider is configured
            const configuredProviders = aiIntegrationManager.getConfiguredProviders();
            if (configuredProviders.length === 0) {
                aiAssistBtn.disabled = true;
                aiAssistBtn.title = 'No AI providers configured. Please configure in settings.';
            }
        }
        
        console.log('AI Integration initialized in popup');
    } catch (error) {
        console.error('Failed to initialize AI integration:', error);
    }
}

// Show AI assist dialog
async function showAIAssistDialog() {
    if (!aiIntegrationManager) return;
    
    // Check AI features are enabled
    const settings = await chrome.storage.sync.get([
        'aiCssGeneration',
        'aiImprovements',
        'aiDocumentation',
        'defaultAIProvider'
    ]);
    
    if (!settings.aiCssGeneration && !settings.aiImprovements && !settings.aiDocumentation) {
        showNotification('AI features are disabled. Enable them in settings.', 'warning');
        return;
    }
    
    // Create AI assist dialog
    aiAssistDialog = document.createElement('div');
    aiAssistDialog.className = 'ai-assist-dialog';
    aiAssistDialog.innerHTML = `
        <div class="ai-assist-content">
            <h3>AI Assistant</h3>
            <div class="ai-options">
                ${settings.aiCssGeneration ? `
                <button class="ai-option" data-action="generate">
                    <span class="ai-icon">✨</span>
                    <span class="ai-label">Generate CSS</span>
                    <small>Describe styles in plain English</small>
                </button>
                ` : ''}
                ${settings.aiImprovements ? `
                <button class="ai-option" data-action="improve">
                    <span class="ai-icon">💡</span>
                    <span class="ai-label">Improve Rule</span>
                    <small>Get optimization suggestions</small>
                </button>
                ` : ''}
                ${settings.aiDocumentation ? `
                <button class="ai-option" data-action="document">
                    <span class="ai-icon">📝</span>
                    <span class="ai-label">Generate Docs</span>
                    <small>Create documentation for rules</small>
                </button>
                ` : ''}
            </div>
            <button class="close-btn" onclick="closeAIAssistDialog()">✕</button>
        </div>
    `;
    
    document.body.appendChild(aiAssistDialog);
    
    // Add event listeners
    aiAssistDialog.querySelectorAll('.ai-option').forEach(btn => {
        btn.addEventListener('click', handleAIAction);
    });
}

// Handle AI action
async function handleAIAction(e) {
    const action = e.currentTarget.dataset.action;
    const defaultProvider = (await chrome.storage.sync.get('defaultAIProvider')).defaultAIProvider || 'openai';
    
    closeAIAssistDialog();
    
    switch (action) {
        case 'generate':
            showAIGenerateDialog(defaultProvider);
            break;
        case 'improve':
            await showAIImproveDialog(defaultProvider);
            break;
        case 'document':
            await generateDocumentation(defaultProvider);
            break;
    }
}

// Show AI generate CSS dialog
function showAIGenerateDialog(provider) {
    const dialog = document.createElement('div');
    dialog.className = 'ai-generate-dialog';
    dialog.innerHTML = `
        <div class="ai-generate-content">
            <h3>Generate CSS with AI</h3>
            <div class="form-group">
                <label>Describe the styles you want:</label>
                <textarea id="ai-description" rows="4" placeholder="e.g., Make all buttons blue with rounded corners and a subtle shadow"></textarea>
            </div>
            <div class="form-group">
                <label>Target Element (optional):</label>
                <input type="text" id="ai-target" placeholder="e.g., button, .submit-btn">
            </div>
            <div class="ai-actions">
                <button class="btn btn-primary" onclick="generateCSSWithAI('${provider}')">Generate</button>
                <button class="btn btn-secondary" onclick="this.closest('.ai-generate-dialog').remove()">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    document.getElementById('ai-description').focus();
}

// Generate CSS with AI
window.generateCSSWithAI = async function(provider) {
    const description = document.getElementById('ai-description').value.trim();
    const targetElement = document.getElementById('ai-target').value.trim() || '.class-name';
    
    if (!description) {
        showNotification('Please describe the styles you want', 'error');
        return;
    }
    
    try {
        showNotification('Generating CSS...', 'info');
        document.querySelector('.ai-generate-dialog').remove();
        
        const result = await aiIntegrationManager.generateCSS(description, targetElement, provider);
        
        // Pre-fill the form with generated CSS
        if (elements.ruleName) elements.ruleName.value = `AI Generated: ${description.substring(0, 30)}...`;
        if (elements.selector) elements.selector.value = targetElement;
        if (elements.styleTextarea) elements.styleTextarea.value = result.css;
        
        if (!elements.createForm?.classList.contains('active')) {
            toggleCreateForm();
        }
        
        showNotification('CSS generated successfully!', 'success');
    } catch (error) {
        console.error('AI generation error:', error);
        showNotification(`Failed to generate CSS: ${error.message}`, 'error');
    }
};

// Show AI improve dialog
async function showAIImproveDialog(provider) {
    // Get current form data
    const formData = collectFormData();
    
    if (!formData.selector || Object.keys(formData.styles).length === 0) {
        showNotification('Please create a rule first before requesting improvements', 'warning');
        return;
    }
    
    try {
        showNotification('Analyzing rule for improvements...', 'info');
        
        const customization = {
            selector: formData.selector,
            styles: formData.styles,
            pseudoClasses: formData.pseudoClasses
        };
        
        const result = await aiIntegrationManager.suggestImprovements(customization, provider);
        
        // Show suggestions dialog
        showImprovementSuggestions(result.suggestions);
    } catch (error) {
        console.error('AI improvement error:', error);
        showNotification(`Failed to get improvements: ${error.message}`, 'error');
    }
}

// Show improvement suggestions
function showImprovementSuggestions(suggestions) {
    const dialog = document.createElement('div');
    dialog.className = 'ai-suggestions-dialog';
    dialog.innerHTML = `
        <div class="ai-suggestions-content">
            <h3>AI Improvement Suggestions</h3>
            <div class="suggestions-list">
                ${suggestions.map((s, i) => `
                    <div class="suggestion-item">
                        <h4>${s.title}</h4>
                        <p>${s.description}</p>
                        ${s.code ? `<pre>${s.code}</pre>` : ''}
                        <button class="btn btn-sm btn-primary" onclick="applySuggestion(${i})">Apply</button>
                    </div>
                `).join('')}
            </div>
            <button class="btn btn-secondary" onclick="this.closest('.ai-suggestions-dialog').remove()">Close</button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Store suggestions for apply function
    window.aiSuggestions = suggestions;
}

// Apply suggestion
window.applySuggestion = function(index) {
    const suggestion = window.aiSuggestions[index];
    if (suggestion && suggestion.code) {
        // Parse and apply the CSS
        const cssText = suggestion.code.trim();
        if (elements.styleTextarea) {
            elements.styleTextarea.value = cssText;
        }
        
        document.querySelector('.ai-suggestions-dialog').remove();
        showNotification('Suggestion applied!', 'success');
    }
};

// Generate documentation
async function generateDocumentation(provider) {
    try {
        // Get all customizations
        const { customizations = [] } = await chrome.storage.local.get('customizations');
        
        if (customizations.length === 0) {
            showNotification('No customizations to document', 'warning');
            return;
        }
        
        showNotification('Generating documentation...', 'info');
        
        const result = await aiIntegrationManager.generateDocumentation(customizations, provider);
        
        // Create download link
        const blob = new Blob([result.documentation], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dom-style-documentation-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('Documentation generated and downloaded!', 'success');
    } catch (error) {
        console.error('Documentation generation error:', error);
        showNotification(`Failed to generate documentation: ${error.message}`, 'error');
    }
}

// Close AI assist dialog
window.closeAIAssistDialog = function() {
    if (aiAssistDialog) {
        aiAssistDialog.remove();
        aiAssistDialog = null;
    }
};

// Add CSS for AI dialogs
const aiStyles = document.createElement('style');
aiStyles.textContent = `
.ai-assist-dialog,
.ai-generate-dialog,
.ai-suggestions-dialog {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.ai-assist-content,
.ai-generate-content,
.ai-suggestions-content {
    background: white;
    border-radius: 8px;
    padding: 20px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    position: relative;
}

.ai-options {
    display: grid;
    gap: 10px;
    margin-top: 20px;
}

.ai-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 15px;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    background: #f8f9fa;
    cursor: pointer;
    transition: all 0.2s;
}

.ai-option:hover {
    background: #e9ecef;
    transform: translateY(-2px);
}

.ai-icon {
    font-size: 24px;
    margin-bottom: 8px;
}

.ai-label {
    font-weight: 600;
    margin-bottom: 4px;
}

.ai-option small {
    color: #6c757d;
    font-size: 12px;
}

.close-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #6c757d;
}

.suggestions-list {
    max-height: 400px;
    overflow-y: auto;
    margin: 20px 0;
}

.suggestion-item {
    border: 1px solid #e9ecef;
    padding: 15px;
    margin-bottom: 10px;
    border-radius: 4px;
}

.suggestion-item h4 {
    margin: 0 0 10px 0;
    color: #007acc;
}

.suggestion-item pre {
    background: #f8f9fa;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 12px;
}

.ai-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
    justify-content: flex-end;
}
`;
document.head.appendChild(aiStyles);

// =============================================================================
// VISIO INTEGRATION FUNCTIONALITY
// =============================================================================
let visioIntegrationManager = null;
let visioOptionsVisible = false;

async function initializeVisioIntegration() {
    try {
        // Check if VisioIntegrationManager is available
        if (typeof VisioIntegrationManager === 'undefined') {
            console.warn('VisioIntegrationManager not found. Visio features will be disabled.');
            return;
        }
        
        visioIntegrationManager = new VisioIntegrationManager();
        await visioIntegrationManager.initialize();
        
        // Setup Visio button
        const visioBtn = document.getElementById('visio-btn');
        if (visioBtn) {
            visioBtn.addEventListener('click', toggleVisioOptions);
            
            // Check if user has Visio license
            const availability = await visioIntegrationManager.checkVisioAvailability();
            if (!availability.available) {
                visioBtn.disabled = true;
                visioBtn.title = `Visio not available: ${availability.reason}`;
            }
        }
        
        // Setup Visio option buttons
        const doVisioBtn = document.getElementById('do-visio');
        const cancelVisioBtn = document.getElementById('cancel-visio');
        
        if (doVisioBtn) {
            doVisioBtn.addEventListener('click', createVisioDiagram);
        }
        
        if (cancelVisioBtn) {
            cancelVisioBtn.addEventListener('click', () => {
                toggleVisioOptions(false);
            });
        }
        
        console.log('Visio Integration initialized in popup');
    } catch (error) {
        console.error('Failed to initialize Visio integration:', error);
    }
}

// Toggle Visio options panel
function toggleVisioOptions(show) {
    const visioOptions = document.getElementById('visio-options');
    if (!visioOptions) return;
    
    if (show === undefined) {
        visioOptionsVisible = !visioOptionsVisible;
    } else {
        visioOptionsVisible = show;
    }
    
    // Hide other panels
    const exportOptions = document.getElementById('export-options');
    const importOptions = document.getElementById('import-options');
    const screenshotOptions = document.getElementById('screenshot-options');
    
    if (exportOptions) exportOptions.style.display = 'none';
    if (importOptions) importOptions.style.display = 'none';
    if (screenshotOptions) screenshotOptions.style.display = 'none';
    
    visioOptions.style.display = visioOptionsVisible ? 'block' : 'none';
}

// Create Visio diagram
async function createVisioDiagram() {
    if (!visioIntegrationManager) {
        showNotification('Visio integration not initialized', 'error');
        return;
    }
    
    const visioStatus = document.getElementById('visio-status');
    const doVisioBtn = document.getElementById('do-visio');
    
    try {
        // Check permission
        if (!await checkPermission('EXPORT_DATA')) {
            showNotification('Permission denied for exporting data', 'error');
            return;
        }
        
        // Get diagram type
        const diagramType = document.querySelector('input[name="visio-type"]:checked')?.value || 'architecture';
        const openInEditor = document.getElementById('visio-open-editor')?.checked ?? true;
        
        // Show status
        if (visioStatus) {
            visioStatus.style.display = 'block';
            visioStatus.textContent = 'Creating Visio diagram...';
            visioStatus.className = 'import-status info';
        }
        
        // Disable button
        if (doVisioBtn) doVisioBtn.disabled = true;
        
        // Get customizations
        const { customizations = [] } = await chrome.storage.local.get('customizations');
        
        if (customizations.length === 0) {
            showNotification('No customizations to visualize', 'warning');
            if (visioStatus) visioStatus.style.display = 'none';
            if (doVisioBtn) doVisioBtn.disabled = false;
            return;
        }
        
        // Create diagram
        const result = await visioIntegrationManager.createDiagram(customizations, diagramType);
        
        if (result.success) {
            showNotification('Visio diagram created successfully!', 'success');
            
            if (visioStatus) {
                visioStatus.textContent = 'Diagram created successfully!';
                visioStatus.className = 'import-status success';
            }
            
            // Open in Visio Online if requested
            if (openInEditor && result.editUrl) {
                window.open(result.editUrl, '_blank');
            }
            
            // Hide options after success
            setTimeout(() => {
                toggleVisioOptions(false);
                if (visioStatus) visioStatus.style.display = 'none';
            }, 2000);
        } else {
            throw new Error(result.error || 'Failed to create diagram');
        }
        
    } catch (error) {
        console.error('Visio diagram creation error:', error);
        showNotification(`Failed to create diagram: ${error.message}`, 'error');
        
        if (visioStatus) {
            visioStatus.textContent = `Error: ${error.message}`;
            visioStatus.className = 'import-status error';
        }
    } finally {
        if (doVisioBtn) doVisioBtn.disabled = false;
    }
}

// =============================================================================
// DOCUMENTATION GENERATION FUNCTIONALITY
// =============================================================================
let documentationGenerator = null;
let docsOptionsVisible = false;

async function initializeDocumentationGenerator() {
    try {
        // Check if DocumentationGenerator is available
        if (typeof DocumentationGenerator === 'undefined') {
            console.warn('DocumentationGenerator not found. Documentation features will be disabled.');
            return;
        }
        
        documentationGenerator = new DocumentationGenerator();
        await documentationGenerator.initialize();
        
        // Setup documentation button
        const generateDocsBtn = document.getElementById('generate-docs-btn');
        if (generateDocsBtn) {
            generateDocsBtn.addEventListener('click', toggleDocsOptions);
        }
        
        // Setup documentation option buttons
        const doGenerateDocsBtn = document.getElementById('do-generate-docs');
        const cancelDocsBtn = document.getElementById('cancel-docs');
        
        if (doGenerateDocsBtn) {
            doGenerateDocsBtn.addEventListener('click', generateDocumentation);
        }
        
        if (cancelDocsBtn) {
            cancelDocsBtn.addEventListener('click', () => {
                toggleDocsOptions(false);
            });
        }
        
        // Setup diagram type toggle
        const includeDiagramsCheckbox = document.getElementById('docs-include-diagrams');
        if (includeDiagramsCheckbox) {
            includeDiagramsCheckbox.addEventListener('change', (e) => {
                const diagramTypesSection = document.getElementById('docs-diagram-types');
                if (diagramTypesSection) {
                    diagramTypesSection.style.display = e.target.checked ? 'block' : 'none';
                }
            });
        }
        
        console.log('Documentation Generator initialized in popup');
    } catch (error) {
        console.error('Failed to initialize Documentation Generator:', error);
    }
}

// Toggle documentation options panel
function toggleDocsOptions(show) {
    const docsOptions = document.getElementById('docs-options');
    if (!docsOptions) return;
    
    if (show === undefined) {
        docsOptionsVisible = !docsOptionsVisible;
    } else {
        docsOptionsVisible = show;
    }
    
    // Hide other panels
    const exportOptions = document.getElementById('export-options');
    const importOptions = document.getElementById('import-options');
    const screenshotOptions = document.getElementById('screenshot-options');
    const visioOptions = document.getElementById('visio-options');
    
    if (exportOptions) exportOptions.style.display = 'none';
    if (importOptions) importOptions.style.display = 'none';
    if (screenshotOptions) screenshotOptions.style.display = 'none';
    if (visioOptions) visioOptions.style.display = 'none';
    
    docsOptions.style.display = docsOptionsVisible ? 'block' : 'none';
}

// Generate documentation
async function generateDocumentation() {
    if (!documentationGenerator) {
        showNotification('Documentation generator not initialized', 'error');
        return;
    }
    
    const docsStatus = document.getElementById('docs-status');
    const doGenerateDocsBtn = document.getElementById('do-generate-docs');
    
    try {
        // Check permission
        if (!await checkPermission('EXPORT_DATA')) {
            showNotification('Permission denied for exporting data', 'error');
            return;
        }
        
        // Get options
        const options = {
            includeOverview: document.getElementById('docs-overview')?.checked ?? true,
            includeTechnical: document.getElementById('docs-technical')?.checked ?? true,
            includeUserGuide: document.getElementById('docs-user-guide')?.checked ?? true,
            includeApiDocs: document.getElementById('docs-api')?.checked ?? false,
            includeDiagrams: document.getElementById('docs-include-diagrams')?.checked ?? true,
            diagramTypes: []
        };
        
        // Get selected diagram types
        if (options.includeDiagrams) {
            const diagramCheckboxes = document.querySelectorAll('input[name="docs-diagram-type"]:checked');
            options.diagramTypes = Array.from(diagramCheckboxes).map(cb => cb.value);
        }
        
        // Get AI provider if AI enhancement is enabled
        if (document.getElementById('docs-ai-enhance')?.checked && aiIntegrationManager) {
            const configuredProviders = aiIntegrationManager.getConfiguredProviders();
            if (configuredProviders.length > 0) {
                options.aiProvider = configuredProviders[0]; // Use first configured provider
            }
        }
        
        // Show status
        if (docsStatus) {
            docsStatus.style.display = 'block';
            docsStatus.textContent = 'Generating documentation...';
            docsStatus.className = 'import-status info';
        }
        
        // Disable button
        if (doGenerateDocsBtn) doGenerateDocsBtn.disabled = true;
        
        // Get customizations
        const { customizations = [] } = await chrome.storage.local.get('customizations');
        
        if (customizations.length === 0) {
            showNotification('No customizations to document', 'warning');
            if (docsStatus) docsStatus.style.display = 'none';
            if (doGenerateDocsBtn) doGenerateDocsBtn.disabled = false;
            return;
        }
        
        // Update status for diagram creation
        if (options.includeDiagrams && options.diagramTypes.length > 0) {
            if (docsStatus) {
                docsStatus.textContent = 'Creating diagrams...';
            }
        }
        
        // Generate documentation
        const result = await documentationGenerator.generateFullDocumentation(customizations, options);
        
        if (result.success) {
            showNotification('Documentation generated successfully!', 'success');
            
            if (docsStatus) {
                docsStatus.textContent = 'Documentation generated! Downloading...';
                docsStatus.className = 'import-status success';
            }
            
            // Download the documentation
            const blob = new Blob([result.documentation], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DOM-Style-Injector-Documentation-${new Date().toISOString().split('T')[0]}.md`;
            a.click();
            URL.revokeObjectURL(url);
            
            // Hide options after success
            setTimeout(() => {
                toggleDocsOptions(false);
                if (docsStatus) docsStatus.style.display = 'none';
            }, 2000);
        } else {
            throw new Error(result.error || 'Failed to generate documentation');
        }
        
    } catch (error) {
        console.error('Documentation generation error:', error);
        showNotification(`Failed to generate documentation: ${error.message}`, 'error');
        
        if (docsStatus) {
            docsStatus.textContent = `Error: ${error.message}`;
            docsStatus.className = 'import-status error';
        }
    } finally {
        if (doGenerateDocsBtn) doGenerateDocsBtn.disabled = false;
    }
}