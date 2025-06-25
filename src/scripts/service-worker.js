// src/scripts/service-worker.js - Fixed ESLint issues

/* global self, TextDecoder */

// For service workers, we need to use a different approach than atob
// Helper function to safely decode a Base64Url-encoded string
function decodeBase64Url(base64Url) {
    // Replace URL-safe characters
    base64Url = base64Url.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    const pad = base64Url.length % 4;
    if (pad) {
        if (pad === 2) base64Url += '==';
        else if (pad === 3) base64Url += '=';
    }

    // Decode base64 to string
    const binaryString = self.atob(base64Url); // self.atob is available in service workers
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert to string and parse JSON
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(bytes));
}

// Get D365 organization URL from storage or environment
async function getD365OrgUrl() {
    try {
        // First check sync storage for user configuration
        const { d365OrgUrl } = await chrome.storage.sync.get('d365OrgUrl');
        if (d365OrgUrl) {
            return d365OrgUrl;
        }

        // Fallback to environment-specific default
        const { environment = 'production' } = await chrome.storage.local.get('environment');

        const environments = {
            development: 'https://dev.api.crm.dynamics.com',
            staging: 'https://staging.api.crm.dynamics.com',
            production: 'https://yourorg.api.crm.dynamics.com' // Update this
        };

        return environments[environment] || environments.production;
    } catch (error) {
        console.error('Error getting D365 URL:', error);
        return 'https://yourorg.api.crm.dynamics.com'; // Fallback URL
    }
}

// Check and cache user role
async function checkAndCacheUserRole(token) {
    const d365OrgUrl = await getD365OrgUrl();

    try {
        // Decode token to get user info
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
            throw new Error('Invalid token format');
        }

        const payload = decodeBase64Url(tokenParts[1]);
        const userAadObjectId = payload.oid;

        if (!userAadObjectId) {
            throw new Error("Azure AD Object ID (oid) not found in token.");
        }

        // Query for system user
        const userQueryUrl = `${d365OrgUrl}/api/data/v9.2/systemusers?$filter=azureactivedirectoryobjectid eq ${userAadObjectId}&$select=systemuserid`;

        const userResponse = await fetch(userQueryUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0'
            }
        });

        if (!userResponse.ok) {
            throw new Error(`Failed to fetch system user: ${userResponse.status} ${userResponse.statusText}`);
        }

        const userData = await userResponse.json();
        if (!userData.value || userData.value.length === 0) {
            throw new Error("D365 user not found for this Azure AD account.");
        }

        const systemUserId = userData.value[0].systemuserid;

        // Query for user roles
        const roleQueryUrl = `${d365OrgUrl}/api/data/v9.2/systemusers(${systemUserId})?$expand=systemuserroles_association($select=name)`;

        const roleResponse = await fetch(roleQueryUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0'
            }
        });

        if (!roleResponse.ok) {
            throw new Error(`Failed to fetch roles: ${roleResponse.status} ${roleResponse.statusText}`);
        }

        const roleData = await roleResponse.json();
        const roles = roleData.systemuserroles_association?.map(r => r.name) || [];
        const isAdmin = roles.includes('System Customizer') || roles.includes('System Administrator');

        // Cache the result
        await chrome.storage.local.set({
            userRole: {
                isAdmin: isAdmin,
                roles: roles,
                timestamp: Date.now()
            }
        });

        console.log('User role check complete:', { isAdmin, roles });
        return { isAdmin: isAdmin, roles: roles };

    } catch (error) {
        console.error("Error checking user role:", error);
        return { error: error.message };
    }
}

// Sync customizations to SharePoint (Admin only)
async function syncToSharePoint(authToken) {
    try {
        const { customizations = [] } = await chrome.storage.local.get('customizations');

        // TODO: Implement actual SharePoint sync using the authToken
        // For now, we'll simulate success
        console.log('Syncing to SharePoint with token:', authToken.substring(0, 10) + '...');
        console.log('Customizations to sync:', customizations);

        // In production, this would:
        // 1. Get SharePoint site URL from configuration
        // 2. Use Microsoft Graph API with authToken to write to SharePoint list
        // 3. Handle versioning and conflict resolution

        return { success: true, count: customizations.length };
    } catch (error) {
        console.error('SharePoint sync error:', error);
        return { success: false, error: error.message };
    }
}

// Sync customizations from SharePoint (All users)
async function syncFromSharePoint() {
    try {
        // TODO: Implement actual SharePoint sync
        // For now, we'll return mock data
        const mockCustomizations = [
            {
                id: 'mock-1',
                name: 'Hide Help Panel',
                selector: '#helpPanelContainer',
                css: 'display: none !important;',
                enabled: true,
                createdBy: 'admin@company.com',
                createdDate: new Date().toISOString()
            },
            {
                id: 'mock-2',
                name: 'Highlight Required Fields',
                selector: '.required-field',
                css: 'border: 2px solid #ff0000 !important;',
                enabled: false,
                createdBy: 'admin@company.com',
                createdDate: new Date().toISOString()
            }
        ];

        await chrome.storage.local.set({
            customizations: mockCustomizations,
            lastSync: new Date().toISOString()
        });

        return { success: true, count: mockCustomizations.length };
    } catch (error) {
        console.error('SharePoint sync error:', error);
        return { success: false, error: error.message };
    }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed:', details.reason);

    if (details.reason === 'install') {
        // Set default values
        await chrome.storage.local.set({
            customizations: [],
            environment: 'production',
            lastSync: null
        });

        // Open options page for initial setup
        chrome.runtime.openOptionsPage();
    }
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Service worker received message:', request.action);

    switch (request.action) {
        case "checkUserRole":
            checkAndCacheUserRole(request.token).then(sendResponse);
            return true; // Keep channel open for async response

        case "syncToSharePoint":
            syncToSharePoint(request.token).then(sendResponse);
            return true;

        case "syncFromSharePoint":
            syncFromSharePoint().then(sendResponse);
            return true;

        case "clearCache":
            chrome.storage.local.remove(['userRole']).then(() => {
                sendResponse({ success: true });
            });
            return true;

        case "getConfig":
            getD365OrgUrl().then(url => {
                sendResponse({ d365OrgUrl: url });
            });
            return true;

        default:
            console.warn('Unknown action:', request.action);
            sendResponse({ error: 'Unknown action' });
    }

    return false; // Synchronous response
});

// Handle alarms for periodic sync (optional)
chrome.alarms.create('syncCustomizations', {
    periodInMinutes: 60 // Sync every hour
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'syncCustomizations') {
        syncFromSharePoint().then(result => {
            console.log('Periodic sync completed:', result);
        });
    }
});

// Context menu for quick access to options
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "openOptions",
        title: "DOM Style Injector Settings",
        contexts: ["action"]
    });
});

chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === "openOptions") {
        chrome.runtime.openOptionsPage();
    }
});