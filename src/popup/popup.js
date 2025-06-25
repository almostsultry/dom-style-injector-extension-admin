// src/popup/popup.js - Fixed ESLint issues

// Import MSAL (ensure msal-browser is included in your build)
// import { PublicClientApplication } from '@azure/msal-browser';

// For ESLint - declare globals
/* global PublicClientApplication */

// DOM Elements
const loaderView = document.getElementById('loader-view');
const adminView = document.getElementById('admin-view');
const userView = document.getElementById('user-view');
const errorView = document.getElementById('error-view');
const errorMessage = document.getElementById('error-message');

// MSAL Configuration
const msalConfig = {
    auth: {
        clientId: 'YOUR_APP_CLIENT_ID', // Replace with your Azure AD app client ID
        authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID', // Replace with your tenant ID
        redirectUri: chrome.identity.getRedirectURL() // Chrome extension redirect URI
    },
    cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
    }
};

// MSAL instance
let msalInstance = null;

// Initialize MSAL
async function initializeMsal() {
    if (typeof PublicClientApplication !== 'undefined') {
        msalInstance = new PublicClientApplication(msalConfig);
        await msalInstance.initialize();
    }
}

// View rendering function
function renderView(viewName, msg = '') {
    // Hide all views first
    loaderView.style.display = 'none';
    adminView.style.display = 'none';
    userView.style.display = 'none';
    errorView.style.display = 'none';

    // Show the correct view based on the viewName parameter
    switch (viewName) {
        case 'loader-view':
            loaderView.style.display = 'block';
            break;
        case 'admin-view':
            adminView.style.display = 'block';
            initializeAdminView();
            break;
        case 'user-view':
            userView.style.display = 'block';
            initializeUserView();
            break;
        case 'error-view':
            errorMessage.textContent = msg;
            errorView.style.display = 'block';
            break;
    }
}

// Get authentication token using chrome.identity API
// src/popup/popup.js - Complete authentication implementation

// Get authentication token using chrome.identity API
async function getAuthToken() {
    try {
        // Get configuration from storage
        const config = await chrome.storage.sync.get(['d365OrgUrl', 'clientId', 'tenantId']);

        // Validate configuration
        if (!config.d365OrgUrl) {
            throw new Error('D365 organization URL not configured. Please set it in extension options.');
        }

        if (!config.clientId || !config.tenantId) {
            // For initial development, use environment defaults
            config.clientId = config.clientId || 'YOUR_DEFAULT_CLIENT_ID';
            config.tenantId = config.tenantId || 'YOUR_DEFAULT_TENANT_ID';

            // Warn about using defaults
            console.warn('Using default Azure AD configuration. Please configure in extension options.');
        }

        // Build OAuth2 URL for Microsoft identity platform
        const redirectUrl = chrome.identity.getRedirectURL();
        const scopes = [
            'openid',
            'profile',
            'User.Read',
            `${config.d365OrgUrl}/user_impersonation`
        ];

        const authUrl = new URL(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`);
        authUrl.searchParams.append('client_id', config.clientId);
        authUrl.searchParams.append('response_type', 'token');
        authUrl.searchParams.append('redirect_uri', redirectUrl);
        authUrl.searchParams.append('scope', scopes.join(' '));
        authUrl.searchParams.append('response_mode', 'fragment');
        authUrl.searchParams.append('state', crypto.randomUUID());
        authUrl.searchParams.append('nonce', crypto.randomUUID());

        console.log('Redirect URL:', redirectUrl);
        console.log('Auth URL:', authUrl.toString());

        // Launch auth flow
        return new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow(
                {
                    url: authUrl.toString(),
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
                        // Parse the response URL to extract the token
                        const url = new URL(responseUrl);
                        const hashParams = new URLSearchParams(url.hash.substring(1));
                        const accessToken = hashParams.get('access_token');

                        if (!accessToken) {
                            // Check for error in response
                            const error = hashParams.get('error');
                            const errorDescription = hashParams.get('error_description');

                            if (error) {
                                reject(new Error(`OAuth error: ${error} - ${errorDescription || 'Unknown error'}`));
                            } else {
                                reject(new Error('No access token in response'));
                            }
                            return;
                        }

                        // Validate token has required claims
                        validateToken(accessToken);

                        // Cache token with expiration
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

        // Check for cached token before falling back to mock
        const cachedToken = await getCachedToken();
        if (cachedToken) {
            console.log('Using cached token');
            return cachedToken;
        }

        // Development fallback
        const { mockToken } = await chrome.storage.local.get('mockToken');
        if (mockToken) {
            console.warn('Using mock token for development');
            return mockToken;
        }

        throw error;
    }
}

// Validate token has required claims
function validateToken(token) {
    try {
        // Parse token to check claims
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid token format');
        }

        // Decode payload (base64url)
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

        // Check required claims
        if (!payload.oid && !payload.sub) {
            throw new Error('Token missing user identifier (oid or sub)');
        }

        if (!payload.aud) {
            throw new Error('Token missing audience (aud) claim');
        }

        // Check token expiration
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            throw new Error('Token has expired');
        }

        console.log('Token validated successfully');
    } catch (error) {
        console.error('Token validation error:', error);
        throw error;
    }
}

// Cache token with expiration
async function cacheToken(token, expiresIn) {
    const expirationTime = Date.now() + (expiresIn * 1000);

    await chrome.storage.session.set({
        authToken: token,
        tokenExpiration: expirationTime
    });

    console.log('Token cached, expires at:', new Date(expirationTime).toLocaleString());
}

// Get cached token if still valid
async function getCachedToken() {
    try {
        const { authToken, tokenExpiration } = await chrome.storage.session.get(['authToken', 'tokenExpiration']);

        if (authToken && tokenExpiration) {
            // Check if token is still valid (with 5 minute buffer)
            const bufferTime = 5 * 60 * 1000; // 5 minutes
            if (tokenExpiration - bufferTime > Date.now()) {
                console.log('Found valid cached token');
                return authToken;
            } else {
                console.log('Cached token expired');
                // Clear expired token
                await chrome.storage.session.remove(['authToken', 'tokenExpiration']);
            }
        }
    } catch (error) {
        console.error('Error retrieving cached token:', error);
    }

    return null;
}

// Clear cached authentication
async function clearAuthCache() {
    await chrome.storage.session.remove(['authToken', 'tokenExpiration']);
    await chrome.storage.local.remove(['userRole']);
    console.log('Authentication cache cleared');
}

// Refresh token if needed (for future implementation)
async function refreshTokenIfNeeded() {
    const cachedToken = await getCachedToken();
    if (!cachedToken) {
        // Token expired or not found, get new one
        return await getAuthToken();
    }
    return cachedToken;
}

// Initialize popup
async function initializePopup() {
    // Show loader view immediately
    renderView('loader-view');

    try {
        // Initialize MSAL if available
        await initializeMsal();

        // Check cached role first
        const { userRole } = await chrome.storage.local.get('userRole');
        const eightHours = 8 * 60 * 60 * 1000;
        const cacheIsFresh = userRole && (Date.now() - userRole.timestamp < eightHours);

        if (cacheIsFresh) {
            console.log('Using cached user role:', userRole);
            renderView(userRole.isAdmin ? 'admin-view' : 'user-view');
            return;
        }

        // Get fresh auth token
        console.log('Getting fresh auth token...');
        const authToken = await getAuthToken();

        // Check user role via service worker
        const result = await chrome.runtime.sendMessage({
            action: "checkUserRole",
            token: authToken
        });

        if (result.error) {
            throw new Error(result.error);
        }

        console.log('User role check result:', result);
        renderView(result.isAdmin ? 'admin-view' : 'user-view');

    } catch (error) {
        console.error("Initialization failed:", error);

        // Provide helpful error messages
        let errorMsg = error.message;
        if (error.message.includes('not configured')) {
            errorMsg += '\n\nClick the extension icon while holding Alt to open settings.';
        } else if (error.message.includes('Authentication')) {
            errorMsg += '\n\nPlease ensure you are logged into your Microsoft account.';
        }

        renderView('error-view', errorMsg);
    }
}

// Initialize admin-specific functionality
function initializeAdminView() {
    // Add event listeners for admin controls
    const createBtn = document.getElementById('create-customization-btn');
    const syncBtn = document.getElementById('sync-sharepoint-btn');

    if (createBtn) {
        createBtn.addEventListener('click', handleCreateCustomization);
    }

    if (syncBtn) {
        syncBtn.addEventListener('click', handleSyncWithSharePoint);
    }

    // Load existing customizations
    loadCustomizations(true); // true = admin mode
}

// Initialize user-specific functionality
function initializeUserView() {
    // Add event listeners for user controls
    const syncBtn = document.getElementById('user-sync-btn');

    if (syncBtn) {
        syncBtn.addEventListener('click', handleUserSync);
    }

    // Load existing customizations
    loadCustomizations(false); // false = user mode
}

// Handle creating new customization (admin only)
async function handleCreateCustomization() {
    // Implementation for creating customizations
    console.log('Creating new customization...');
    // TODO: Implement customization creation UI
}

// Handle SharePoint sync (admin only)
async function handleSyncWithSharePoint() {
    try {
        const authToken = await getAuthToken();
        const result = await chrome.runtime.sendMessage({
            action: "syncToSharePoint",
            token: authToken
        });

        if (result.success) {
            // Using a simple notification instead of alert
            showNotification('Successfully synced to SharePoint!', 'success');
            loadCustomizations(true);
        } else {
            throw new Error(result.error || 'Sync failed');
        }
    } catch (error) {
        console.error('SharePoint sync error:', error);
        showNotification('Sync failed: ' + error.message, 'error');
    }
}

// Handle user sync
async function handleUserSync() {
    try {
        const result = await chrome.runtime.sendMessage({
            action: "syncFromSharePoint"
        });

        if (result.success) {
            showNotification('Successfully synced customizations!', 'success');
            loadCustomizations(false);
        } else {
            throw new Error(result.error || 'Sync failed');
        }
    } catch (error) {
        console.error('User sync error:', error);
        showNotification('Sync failed: ' + error.message, 'error');
    }
}

// Show notification instead of alert
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Load customizations
async function loadCustomizations(isAdmin) {
    try {
        const { customizations = [] } = await chrome.storage.local.get('customizations');
        const container = document.getElementById(isAdmin ? 'admin-customizations' : 'user-customizations');

        if (!container) return;

        container.innerHTML = '';

        if (customizations.length === 0) {
            container.innerHTML = '<p class="no-customizations">No customizations found</p>';
            return;
        }

        customizations.forEach(customization => {
            const item = createCustomizationItem(customization, isAdmin);
            container.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading customizations:', error);
    }
}

// Create customization item element
function createCustomizationItem(customization, isAdmin) {
    const div = document.createElement('div');
    div.className = 'customization-item';
    div.innerHTML = `
        <div class="customization-header">
            <h4>${customization.name || 'Unnamed'}</h4>
            <label class="toggle-switch">
                <input type="checkbox" ${customization.enabled ? 'checked' : ''} 
                       data-id="${customization.id}">
                <span class="toggle-slider"></span>
            </label>
        </div>
        <p class="customization-selector">${customization.selector || 'No selector'}</p>
        ${isAdmin ? `
            <div class="customization-actions">
                <button class="edit-btn" data-id="${customization.id}">Edit</button>
                <button class="delete-btn" data-id="${customization.id}">Delete</button>
            </div>
        ` : ''}
    `;

    // Add event listeners
    const toggle = div.querySelector('input[type="checkbox"]');
    toggle.addEventListener('change', (e) => toggleCustomization(customization.id, e.target.checked));

    if (isAdmin) {
        const editBtn = div.querySelector('.edit-btn');
        const deleteBtn = div.querySelector('.delete-btn');

        editBtn.addEventListener('click', () => editCustomization(customization.id));
        deleteBtn.addEventListener('click', () => deleteCustomization(customization.id));
    }

    return div;
}

// Toggle customization
async function toggleCustomization(id, enabled) {
    try {
        const { customizations = [] } = await chrome.storage.local.get('customizations');
        const customization = customizations.find(c => c.id === id);

        if (customization) {
            customization.enabled = enabled;
            await chrome.storage.local.set({ customizations });

            // Notify content scripts
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'updateCustomization',
                        customization
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error toggling customization:', error);
    }
}

// Edit customization (admin only)
function editCustomization(id) {
    // TODO: Implement edit UI
    console.log('Editing customization:', id);
}

// Delete customization (admin only)
async function deleteCustomization(id) {
    // Using a custom confirmation dialog instead of window.confirm
    const confirmed = await showConfirmDialog('Are you sure you want to delete this customization?');
    if (!confirmed) return;

    try {
        const { customizations = [] } = await chrome.storage.local.get('customizations');
        const filtered = customizations.filter(c => c.id !== id);
        await chrome.storage.local.set({ customizations: filtered });

        // Reload the list
        loadCustomizations(true);
    } catch (error) {
        console.error('Error deleting customization:', error);
    }
}

// Custom confirm dialog
function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.innerHTML = `
            <div class="confirm-content">
                <p>${message}</p>
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

// Handle settings/options
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'openOptions') {
        chrome.runtime.openOptionsPage();
    }
    // Return false since we're not using sendResponse
    return false;
});

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePopup);
} else {
    initializePopup();
}