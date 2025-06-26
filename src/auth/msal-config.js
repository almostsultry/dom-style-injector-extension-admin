// src/auth/msal-config.js - Fixed to work with your existing structure
export const msalConfig = {
    auth: {
        // You need to replace these with your actual Azure AD app values
        clientId: "your-azure-app-client-id-here", // Get from Azure Portal
        authority: "https://login.microsoftonline.com/your-tenant-id-here", // Replace tenant-id

        // Use chrome extension URL format
        redirectUri: chrome.runtime.getURL('src/popup/popup.html'),
        postLogoutRedirectUri: chrome.runtime.getURL('src/popup/popup.html'),

        // Extension-specific settings
        navigateToLoginRequestUrl: false
    },

    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
        secureCookies: true
    },

    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) {
                    return;
                }

                switch (level) {
                    case 0: // Error
                        console.error(`MSAL Error: ${message}`);
                        break;
                    case 1: // Warning
                        console.warn(`MSAL Warning: ${message}`);
                        break;
                    case 2: // Info
                        console.info(`MSAL Info: ${message}`);
                        break;
                    case 3: // Verbose
                        console.debug(`MSAL Debug: ${message}`);
                        break;
                }
            },
            logLevel: 2,
            piiLoggingEnabled: false
        },

        // Extension-specific timeouts
        windowHashTimeout: 60000,
        iframeHashTimeout: 6000,
        loadFrameTimeout: 0
    }
};

// Login request for standard authentication
export const loginRequest = {
    scopes: [
        'openid',
        'profile',
        'User.Read',
        'https://graph.microsoft.com/Sites.ReadWrite.All'
    ],
    prompt: 'select_account'
};

// Token request for Microsoft Graph API calls
export const graphRequest = {
    scopes: ['https://graph.microsoft.com/Sites.ReadWrite.All', 'https://graph.microsoft.com/User.Read']
};

// SharePoint-specific configuration
export const sharepointConfig = {
    listName: "DOM_Style_Customizations",
    fields: {
        Title: "Single line of text",
        CSS_Code: "Multiple lines of text",
        JavaScript_Code: "Multiple lines of text",
        Target_URL: "Single line of text",
        Is_Active: "Yes/No",
        ApprovalStatus: "Choice",
        Category: "Choice",
        Priority: "Choice",
        Description: "Multiple lines of text"
    },

    choiceFields: {
        ApprovalStatus: ["Draft", "Pending Review", "Approved", "Rejected"],
        Category: ["UI Enhancement", "Performance", "Accessibility", "Bug Fix", "Custom"],
        Priority: ["Low", "Medium", "High", "Critical"]
    }
};

// Function to get configuration from storage (will override defaults)
export async function getStoredConfig() {
    try {
        const stored = await chrome.storage.sync.get(['clientId', 'tenantId', 'd365OrgUrl']);

        if (stored.clientId && stored.tenantId) {
            return {
                ...msalConfig,
                auth: {
                    ...msalConfig.auth,
                    clientId: stored.clientId,
                    authority: `https://login.microsoftonline.com/${stored.tenantId}`,
                    // Add D365 scope if URL is configured
                    d365OrgUrl: stored.d365OrgUrl
                }
            };
        }

        return msalConfig;
    } catch (error) {
        console.error('Error getting stored config:', error);
        return msalConfig;
    }
}