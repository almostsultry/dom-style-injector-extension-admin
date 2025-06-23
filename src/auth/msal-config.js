// MSAL configuration for Microsoft Graph authentication
export const msalConfig = {
    auth: {
        // Replace with your Azure AD app registration client ID
        clientId: "your-azure-app-client-id-here",

        // Authority URL for your Azure AD tenant
        // Replace {tenant-id} with your actual tenant ID or use 'common' for multi-tenant
        authority: "https://login.microsoftonline.com/your-tenant-id-here",

        // Redirect URI - use the extension URL
        redirectUri: chrome.runtime.getURL('popup.html'),

        // Post logout redirect URI
        postLogoutRedirectUri: chrome.runtime.getURL('popup.html'),

        // Navigation to login request URL
        navigateToLoginRequestUrl: false
    },

    cache: {
        cacheLocation: "localStorage", // Browser storage for tokens
        storeAuthStateInCookie: false, // Set to true for IE11 support
        secureCookies: true // Use secure cookies in production
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
                        console.log(`MSAL Verbose: ${message}`);
                        break;
                    default:
                        console.log(`MSAL: ${message}`);
                }
            },
            piiLoggingEnabled: false,
            logLevel: 1 // Warning level and above
        },

        windowHashTimeout: 60000,
        iframeHashTimeout: 6000,
        loadFrameTimeout: 0,
        asyncPopups: true
    }
};

// Request scopes for different operations
export const scopeConfig = {
    // Basic user information
    userRead: ["https://graph.microsoft.com/User.Read"],

    // SharePoint access for customizations storage
    sharePointAccess: [
        "https://graph.microsoft.com/Sites.ReadWrite.All",
        "https://graph.microsoft.com/User.Read"
    ],

    // Admin permissions for managing customizations
    adminAccess: [
        "https://graph.microsoft.com/Sites.ReadWrite.All",
        "https://graph.microsoft.com/Sites.Manage.All",
        "https://graph.microsoft.com/User.Read.All",
        "https://graph.microsoft.com/Group.Read.All"
    ],

    // Read-only access for user version
    readOnlyAccess: [
        "https://graph.microsoft.com/Sites.Read.All",
        "https://graph.microsoft.com/User.Read"
    ]
};

// Environment-specific configuration
export const environmentConfig = {
    development: {
        apiEndpoint: "https://graph.microsoft.com/v1.0",
        sharePointSiteUrl: "https://yourtenant.sharepoint.com/sites/dev-customizations",
        logLevel: 3, // Verbose logging
        enableDebug: true
    },

    staging: {
        apiEndpoint: "https://graph.microsoft.com/v1.0",
        sharePointSiteUrl: "https://yourtenant.sharepoint.com/sites/staging-customizations",
        logLevel: 2, // Info logging
        enableDebug: false
    },

    production: {
        apiEndpoint: "https://graph.microsoft.com/v1.0",
        sharePointSiteUrl: "https://yourtenant.sharepoint.com/sites/customizations",
        logLevel: 1, // Warning logging only
        enableDebug: false
    }
};

// Get current environment configuration
export function getCurrentEnvironment() {
    // This would be set during build process
    const environment = process.env.NODE_ENV || 'development';
    return environmentConfig[environment] || environmentConfig.development;
}

// SharePoint list configuration
export const sharePointConfig = {
    // List name for storing customizations
    customizationsListName: "DOMStyleCustomizations",

    // List schema
    listSchema: {
        Title: "Single line of text", // Domain name
        CustomizationData: "Multiple lines of text", // JSON blob
        Version: "Number", // Version number
        IsActive: "Yes/No", // Enable/disable flag
        CreatedBy: "Person or Group", // Auto-populated
        ModifiedBy: "Person or Group", // Auto-populated
        Created: "Date and Time", // Auto-populated
        Modified: "Date and Time", // Auto-populated
        ApprovalStatus: "Choice", // Draft, Pending, Approved, Rejected
        Category: "Choice", // UI, Performance, Accessibility, etc.
        Priority: "Choice", // Low, Medium, High, Critical
        Description: "Multiple lines of text" // Human-readable description
    },

    // Choice field options
    choiceFields: {
        ApprovalStatus: ["Draft", "Pending Review", "Approved", "Rejected"],
        Category: ["UI Enhancement", "Performance", "Accessibility", "Bug Fix", "Custom"],
        Priority: ["Low", "Medium", "High", "Critical"]
    },

    // Permissions configuration
    permissions: {
        // Admin users can create, read, update, delete
        admins: {
            roles: ["Full Control", "Contribute"],
            groups: ["DOM Style Admins", "IT Administrators"]
        },

        // Power users can create and update (pending approval)
        powerUsers: {
            roles: ["Contribute"],
            groups: ["DOM Style Power Users"]
        },

        // Regular users can only read approved customizations
        users: {
            roles: ["Read"],
            groups: ["All Company"]
        }
    }
};

// Error handling configuration
export const errorConfig = {
    // Retry configuration for network errors
    retryConfig: {
        maxRetries: 3,
        retryDelay: 1000, // milliseconds
        backoffMultiplier: 2
    },

    // Error codes that should trigger re-authentication
    reAuthErrors: [
        "invalid_grant",
        "interaction_required",
        "consent_required",
        "login_required",
        "token_renewal_error"
    ],

    // User-friendly error messages
    errorMessages: {
        network: "Network connection issue. Please check your internet connection.",
        auth: "Authentication failed. Please sign in again.",
        permissions: "You don't have permission to perform this action.",
        sharepoint: "SharePoint service is unavailable. Please try again later.",
        generic: "An unexpected error occurred. Please try again."
    }
};

// Feature flags for different extension versions
export const featureFlags = {
    admin: {
        canCreateCustomizations: true,
        canEditCustomizations: true,
        canDeleteCustomizations: true,
        canApproveCustomizations: true,
        canManageUsers: true,
        canExportImport: true,
        hasAdvancedSettings: true,
        canAccessAnalytics: true
    },

    powerUser: {
        canCreateCustomizations: true,
        canEditCustomizations: true,
        canDeleteCustomizations: false, // Own items only
        canApproveCustomizations: false,
        canManageUsers: false,
        canExportImport: true,
        hasAdvancedSettings: false,
        canAccessAnalytics: false
    },

    user: {
        canCreateCustomizations: false,
        canEditCustomizations: false,
        canDeleteCustomizations: false,
        canApproveCustomizations: false,
        canManageUsers: false,
        canExportImport: false,
        hasAdvancedSettings: false,
        canAccessAnalytics: false
    }
};

// Get feature flags for current user role
export function getFeatureFlags(userRole = 'user') {
    return featureFlags[userRole] || featureFlags.user;
  }