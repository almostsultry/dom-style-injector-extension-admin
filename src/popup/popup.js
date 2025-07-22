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
    existingCustomizations: document.getElementById('existingCustomizations')
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

    await chrome.storage.session.set({
        authToken: token,
        tokenExpiration: expirationTime
    });

    console.log('Token cached, expires at:', new Date(expirationTime).toLocaleString());
}

async function getCachedToken() {
    try {
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
    await chrome.storage.local.remove(['userRole']);
    
    if (msalAvailable) {
        try {
            if (typeof window.logoutUser === 'function') await window.logoutUser();
            console.log('MSAL cache cleared');
        } catch (msalError) {
            console.log('Error clearing MSAL cache:', msalError);
        }
    }
    
    console.log('Authentication cache cleared');
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
function initializeAdminView() {
    isAdmin = true;

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
        const formData = collectFormData();

        if (!validateFormData(formData)) {
            return;
        }

        await saveCustomization(formData);

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

    if (customizations.length === 0) {
        elements.emptyState?.classList.remove('hidden');
        elements.customizationList.style.display = 'none';
        return;
    }

    elements.emptyState?.classList.add('hidden');
    elements.customizationList.style.display = 'block';

    customizations.forEach(customization => {
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
                <button class="btn-icon edit" title="Edit" data-action="edit" data-id="${customization.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="btn-icon delete" title="Delete" data-action="delete" data-id="${customization.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                </button>
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
    const confirmed = await showConfirmDialog(`Are you sure you want to delete "${customization.name}"?`);
    if (!confirmed) return;

    try {
        const result = await chrome.storage.local.get('customizations');
        const updatedCustomizations = (result.customizations || [])
            .filter(c => c.id !== customization.id);

        await chrome.storage.local.set({ customizations: updatedCustomizations });

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
        const authToken = await getAuthToken();
        const result = await chrome.runtime.sendMessage({
            action: "syncToSharePoint",
            token: authToken
        });

        if (result.success) {
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