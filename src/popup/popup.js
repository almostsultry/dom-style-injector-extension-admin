// popup/popup.js - Fixed version

// Global availability checks and polyfills
(function () {
    'use strict';

    // Check for required globals and provide fallbacks
    if (typeof crypto === 'undefined') {
        console.error('crypto API not available. This extension requires a modern browser.');
        // Could show error message to user
    }

    if (typeof URL === 'undefined') {
        console.error('URL API not available. This extension requires a modern browser.');
    }

    if (typeof URLSearchParams === 'undefined') {
        console.error('URLSearchParams API not available. This extension requires a modern browser.');
    }

    if (typeof atob === 'undefined') {
        console.error('atob function not available. This extension requires a modern browser.');
    }
})();

// DOM Elements - these should match your popup.html structure
const loaderView = document.getElementById('loader-view');
const adminView = document.getElementById('admin-view');
const userView = document.getElementById('user-view');
const errorView = document.getElementById('error-view');
const errorMessage = document.getElementById('error-message');

// MSAL instance
let msalInstance = null;

// Initialize MSAL
async function initializeMsal() {
    try {
        // Get Azure AD configuration from storage
        const { azureConfig } = await chrome.storage.sync.get('azureConfig');
        const config = azureConfig || {};

        if (!config.clientId || !config.tenantId) {
            console.warn('Azure AD configuration not found, skipping MSAL initialization');
            return false;
        }

        // Check if MSAL library is available
        if (typeof PublicClientApplication === 'undefined') {
            console.warn('MSAL library not available, skipping initialization');
            return false;
        }

        // MSAL Configuration
        const msalConfig = {
            auth: {
                clientId: config.clientId,
                authority: `https://login.microsoftonline.com/${config.tenantId}`,
                redirectUri: chrome.identity.getRedirectURL()
            },
            cache: {
                cacheLocation: 'localStorage',
                storeAuthStateInCookie: false
            }
        };

        msalInstance = new PublicClientApplication(msalConfig);
        await msalInstance.initialize();

        console.log('MSAL initialized successfully');
        return true;
    } catch (error) {
        console.error('MSAL initialization failed:', error);
        // Don't throw error, just log it and continue without MSAL
        return false;
    }
}

// View rendering function
function renderView(viewName, errorMsg = '') {
    // Hide all views first
    if (loaderView) loaderView.style.display = 'none';
    if (adminView) adminView.style.display = 'none';
    if (userView) userView.style.display = 'none';
    if (errorView) errorView.style.display = 'none';

    // Show the correct view based on the viewName parameter
    switch (viewName) {
        case 'loader-view':
            if (loaderView) {
                loaderView.style.display = 'block';
            } else {
                console.warn('Loader view element not found');
            }
            break;
        case 'admin-view':
            if (adminView) {
                adminView.style.display = 'block';
                initializeAdminView();
            } else {
                console.warn('Admin view element not found');
            }
            break;
        case 'user-view':
            if (userView) {
                userView.style.display = 'block';
                initializeUserView();
            } else {
                console.warn('User view element not found');
            }
            break;
        case 'error-view':
            if (errorView) {
                if (errorMessage) {
                    errorMessage.textContent = errorMsg;
                }
                errorView.style.display = 'block';
            } else {
                console.warn('Error view element not found');
                console.error('Error:', errorMsg);
            }
            break;
        default:
            console.warn(`Unknown view: ${viewName}`);
    }
}

// Initialize admin-specific functionality
function initializeAdminView() {
    try {
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
    } catch (error) {
        console.error('Error initializing admin view:', error);
    }
}

// Initialize user-specific functionality
function initializeUserView() {
    try {
        // Add event listeners for user controls
        const syncBtn = document.getElementById('user-sync-btn');

        if (syncBtn) {
            syncBtn.addEventListener('click', handleUserSync);
        }

        // Load existing customizations
        loadCustomizations(false); // false = user mode
    } catch (error) {
        console.error('Error initializing user view:', error);
    }
}

// Handle creating new customization (admin only)
async function handleCreateCustomization() {
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

// Load customizations (placeholder)
async function loadCustomizations(isAdmin) {
    try {
        const { customizations = [] } = await chrome.storage.local.get('customizations');
        console.log(`Loading ${customizations.length} customizations (admin: ${isAdmin})`);
        // TODO: Render customizations in UI
    } catch (error) {
        console.error('Error loading customizations:', error);
    }
}

// Show notification (placeholder)
function showNotification(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    // TODO: Implement actual notification UI
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

// Clear cached authentication - now used in logout functionality
async function clearAuthCache() {
    await chrome.storage.session.remove(['authToken', 'tokenExpiration']);
    await chrome.storage.local.remove(['userRole']);
    console.log('Authentication cache cleared');
}

// Refresh token if needed - now used in initialization
async function refreshTokenIfNeeded() {
    const cachedToken = await getCachedToken();
    if (!cachedToken) {
        // Token expired or not found, get new one
        return await getAuthToken();
    }
    return cachedToken;
}

// Add logout functionality that uses clearAuthCache
async function logout() {
    try {
        await clearAuthCache();
        renderView('login-view');
        console.log('User logged out successfully');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Validate token has required claims
function validateToken(token) {
    try {
        // Check if atob is available before using
        if (typeof atob === 'undefined') {
            throw new Error('Token validation not available - browser compatibility issue');
        }

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

// Initialize popup - now uses refreshTokenIfNeeded
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

        // Get fresh auth token using refresh function
        console.log('Getting fresh auth token...');
        const authToken = await refreshTokenIfNeeded();

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

        // Show error view
        renderView('error-view', { error: errorMsg });
    }
}

// Get authentication token
async function getAuthToken() {
    try {
        const { azureConfig } = await chrome.storage.sync.get('azureConfig');
        const config = azureConfig || {};

        if (!config.clientId || !config.tenantId) {
            throw new Error('Azure AD configuration not found. Please set it in extension options.');
        }

        // Check for required APIs
        if (typeof URL === 'undefined' || typeof URLSearchParams === 'undefined' || typeof crypto === 'undefined') {
            throw new Error('Required browser APIs not available. Please update your browser.');
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

// Add event listeners for logout button when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePopup);
} else {
    initializePopup();
}