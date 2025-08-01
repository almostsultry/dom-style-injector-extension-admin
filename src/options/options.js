// src/options/options.js


import BrandingManager from '../scripts/branding-manager.js';
import AIIntegrationManager from '../scripts/ai-integration-manager.js';

// Permissions configuration (same as popup.js)
const PERMISSIONS = {
    MANAGE_SETTINGS: ['System Administrator', 'System Customizer'],
    MANAGE_LICENSE: ['System Administrator', 'System Customizer'],
    CONFIGURE_SYNC: ['System Administrator', 'System Customizer'],
    SYNC_DATAVERSE: ['System Administrator', 'System Customizer'],
    SYNC_SHAREPOINT: ['System Administrator', 'System Customizer'],
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

// DOM elements
const d365UrlInput = document.getElementById('d365-url');
const clientIdInput = document.getElementById('client-id');
const tenantIdInput = document.getElementById('tenant-id');
const redirectUriElement = document.getElementById('redirect-uri');
const copyRedirectUriBtn = document.getElementById('copy-redirect-uri');
const useMockTokenCheckbox = document.getElementById('use-mock-token');
const mockTokenGroup = document.getElementById('mock-token-group');
const mockTokenTextarea = document.getElementById('mock-token');
const saveSettingsBtn = document.getElementById('save-settings');
const saveStatus = document.getElementById('save-status');
const clearCacheBtn = document.getElementById('clear-cache');
const exportBtn = document.getElementById('export-customizations');
const importFileInput = document.getElementById('import-file');
const roleCacheStatus = document.getElementById('role-cache-status');
const lastSyncElement = document.getElementById('last-sync');
const lastConflictElement = document.getElementById('last-conflict');

// New sync-related elements
const dataverseTableInput = document.getElementById('dataverse-table');
const sharePointUrlInput = document.getElementById('sharepoint-url');
const sharePointListInput = document.getElementById('sharepoint-list');
const conflictResolutionSelect = document.getElementById('conflict-resolution');
const autoSyncCheckbox = document.getElementById('auto-sync');
const syncOnStartupCheckbox = document.getElementById('sync-on-startup');
const syncDataverseBtn = document.getElementById('sync-dataverse');
const syncSharePointBtn = document.getElementById('sync-sharepoint');

// License elements
const licenseEndpointInput = document.getElementById('license-endpoint');
const licenseCheckIntervalInput = document.getElementById('license-check-interval');
const licenseStatusText = document.getElementById('license-status-text');
const licenseLastCheck = document.getElementById('license-last-check');
const checkLicenseBtn = document.getElementById('check-license');

// Support elements
const supportTypeSelect = document.getElementById('support-type');
const supportEmailInput = document.getElementById('support-email');
const supportChatUrlInput = document.getElementById('support-chat-url');
const supportWebformUrlInput = document.getElementById('support-webform-url');
const allowScreenshotsCheckbox = document.getElementById('allow-screenshots');
const supportEmailGroup = document.getElementById('support-email-group');
const supportChatGroup = document.getElementById('support-chat-group');
const supportWebformGroup = document.getElementById('support-webform-group');

// Advanced settings elements
const maxCustomizationsInput = document.getElementById('max-customizations');
const injectionDelayInput = document.getElementById('injection-delay');
const enableCachingCheckbox = document.getElementById('enable-caching');
const debugModeCheckbox = document.getElementById('debug-mode');
const showInjectionBadgeCheckbox = document.getElementById('show-injection-badge');
const logLevelSelect = document.getElementById('log-level');

// New export/import elements
const exportSettingsBtn = document.getElementById('export-settings');
const importSettingsFileInput = document.getElementById('import-settings-file');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Get user permissions
    const permissions = await getUserPermissions();
    
    // Check if user has permission to manage settings
    if (!permissions.MANAGE_SETTINGS) {
        showStatus('You do not have permission to manage settings', 'error');
        // Disable all form inputs
        document.querySelectorAll('input, select, textarea, button').forEach(el => {
            el.disabled = true;
        });
        return;
    }
    
    // Update UI based on specific permissions
    updateUIBasedOnPermissions(permissions);
    
    await loadSettings();
    setupEventListeners();
    updateRedirectUri();
    updateCacheStatus();
});

// Update UI elements based on permissions
function updateUIBasedOnPermissions(permissions) {
    // License management
    if (!permissions.MANAGE_LICENSE) {
        licenseEndpointInput.disabled = true;
        licenseCheckIntervalInput.disabled = true;
        checkLicenseBtn.disabled = true;
    }
    
    // Sync configuration
    if (!permissions.CONFIGURE_SYNC) {
        dataverseTableInput.disabled = true;
        sharePointUrlInput.disabled = true;
        sharePointListInput.disabled = true;
        conflictResolutionSelect.disabled = true;
        autoSyncCheckbox.disabled = true;
        syncOnStartupCheckbox.disabled = true;
    }
    
    // Sync buttons
    if (!permissions.SYNC_DATAVERSE) {
        syncDataverseBtn.style.display = 'none';
    }
    
    if (!permissions.SYNC_SHAREPOINT) {
        syncSharePointBtn.style.display = 'none';
    }
    
    // Export/Import
    if (!permissions.EXPORT_DATA) {
        exportBtn.style.display = 'none';
    }
    
    if (!permissions.IMPORT_DATA) {
        importFileInput.disabled = true;
        const importLabel = document.querySelector('label[for="import-file"]');
        if (importLabel) importLabel.style.display = 'none';
    }
    
    if (!permissions.EXPORT_SETTINGS) {
        exportSettingsBtn.style.display = 'none';
    }
    
    if (!permissions.IMPORT_SETTINGS) {
        importSettingsFileInput.disabled = true;
        const importSettingsLabel = document.querySelector('label[for="import-settings-file"]');
        if (importSettingsLabel) importSettingsLabel.style.display = 'none';
    }
}

// Load saved settings
async function loadSettings() {
    try {
        const settings = await chrome.storage.sync.get([
            'd365OrgUrl',
            'clientId',
            'tenantId',
            'dataverseTableName',
            'sharePointUrl',
            'sharePointListName',
            'conflictResolution',
            'autoSync',
            'syncOnStartup',
            'licenseEndpoint',
            'licenseCheckInterval',
            'supportType',
            'supportEmail',
            'supportChatUrl',
            'supportWebformUrl',
            'allowScreenshots',
            'maxCustomizations',
            'injectionDelay',
            'enableCaching',
            'debugMode',
            'showInjectionBadge',
            'logLevel'
        ]);

        const localSettings = await chrome.storage.local.get([
            'mockToken',
            'userRole',
            'lastSync',
            'lastDataverseSync',
            'lastSyncConflicts',
            'conflictHistory',
            'licenseStatus',
            'licenseLastCheck'
        ]);

        // Populate form fields
        if (settings.d365OrgUrl) d365UrlInput.value = settings.d365OrgUrl;
        if (settings.clientId) clientIdInput.value = settings.clientId;
        if (settings.tenantId) tenantIdInput.value = settings.tenantId;
        
        // Sync settings
        if (settings.dataverseTableName) dataverseTableInput.value = settings.dataverseTableName;
        if (settings.sharePointUrl) sharePointUrlInput.value = settings.sharePointUrl;
        if (settings.sharePointListName) sharePointListInput.value = settings.sharePointListName;
        if (settings.conflictResolution) conflictResolutionSelect.value = settings.conflictResolution;
        if (settings.autoSync !== undefined) autoSyncCheckbox.checked = settings.autoSync;
        if (settings.syncOnStartup !== undefined) syncOnStartupCheckbox.checked = settings.syncOnStartup;

        // License settings
        if (settings.licenseEndpoint) licenseEndpointInput.value = settings.licenseEndpoint;
        if (settings.licenseCheckInterval !== undefined) licenseCheckIntervalInput.value = settings.licenseCheckInterval;
        
        // Support settings
        if (settings.supportType) {
            supportTypeSelect.value = settings.supportType;
            updateSupportFieldsVisibility(settings.supportType);
        }
        if (settings.supportEmail) supportEmailInput.value = settings.supportEmail;
        if (settings.supportChatUrl) supportChatUrlInput.value = settings.supportChatUrl;
        if (settings.supportWebformUrl) supportWebformUrlInput.value = settings.supportWebformUrl;
        if (settings.allowScreenshots !== undefined) allowScreenshotsCheckbox.checked = settings.allowScreenshots;
        
        // Advanced settings
        if (settings.maxCustomizations !== undefined) maxCustomizationsInput.value = settings.maxCustomizations;
        if (settings.injectionDelay !== undefined) injectionDelayInput.value = settings.injectionDelay;
        if (settings.enableCaching !== undefined) enableCachingCheckbox.checked = settings.enableCaching;
        if (settings.debugMode !== undefined) debugModeCheckbox.checked = settings.debugMode;
        if (settings.showInjectionBadge !== undefined) showInjectionBadgeCheckbox.checked = settings.showInjectionBadge;
        if (settings.logLevel) logLevelSelect.value = settings.logLevel;

        // Check if using mock token
        if (localSettings.mockToken) {
            useMockTokenCheckbox.checked = true;
            mockTokenGroup.style.display = 'block';
            mockTokenTextarea.value = localSettings.mockToken;
        }
        
        // Update conflict info
        if (localSettings.lastSyncConflicts && localSettings.lastSyncConflicts.length > 0) {
            const lastConflict = localSettings.lastSyncConflicts[localSettings.lastSyncConflicts.length - 1];
            lastConflictElement.textContent = `${localSettings.lastSyncConflicts.length} conflicts (${lastConflict.resolution})`;
        }
        
        // Update license status
        if (localSettings.licenseStatus) {
            licenseStatusText.textContent = localSettings.licenseStatus.valid ? 'Valid' : 'Invalid';
            if (localSettings.licenseLastCheck) {
                licenseLastCheck.textContent = new Date(localSettings.licenseLastCheck).toLocaleString();
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showStatus('Error loading settings', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    saveSettingsBtn.addEventListener('click', saveSettings);
    copyRedirectUriBtn.addEventListener('click', copyRedirectUri);
    clearCacheBtn.addEventListener('click', clearCache);
    syncDataverseBtn.addEventListener('click', () => syncWithDataverse());
    syncSharePointBtn.addEventListener('click', () => syncWithSharePoint());
    exportBtn.addEventListener('click', exportCustomizations);
    importFileInput.addEventListener('change', importCustomizations);
    checkLicenseBtn.addEventListener('click', checkLicense);
    exportSettingsBtn.addEventListener('click', exportSettings);
    importSettingsFileInput.addEventListener('change', importSettings);

    // Toggle mock token textarea
    useMockTokenCheckbox.addEventListener('change', (e) => {
        mockTokenGroup.style.display = e.target.checked ? 'block' : 'none';
        if (!e.target.checked) {
            mockTokenTextarea.value = '';
        }
    });
    
    // Support type change handler
    supportTypeSelect.addEventListener('change', (e) => {
        updateSupportFieldsVisibility(e.target.value);
    });

    // Add input validation
    d365UrlInput.addEventListener('input', validateD365Url);
    clientIdInput.addEventListener('input', validateGuid);
    tenantIdInput.addEventListener('input', validateGuid);
    sharePointUrlInput.addEventListener('input', validateSharePointUrl);
    licenseEndpointInput.addEventListener('input', validateUrl);
    supportChatUrlInput.addEventListener('input', validateUrl);
    supportWebformUrlInput.addEventListener('input', validateUrl);
    supportEmailInput.addEventListener('input', validateEmail);
    maxCustomizationsInput.addEventListener('input', validateNumberRange);
    injectionDelayInput.addEventListener('input', validateNumberRange);
    licenseCheckIntervalInput.addEventListener('input', validateNumberRange);
}

// Update redirect URI
function updateRedirectUri() {
    const redirectUri = chrome.identity.getRedirectURL();
    redirectUriElement.textContent = redirectUri;
}

// Copy redirect URI to clipboard
async function copyRedirectUri() {
    const redirectUri = redirectUriElement.textContent;

    try {
        // Use chrome.clipboard API or fallback
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(redirectUri);
        } else {
            // Fallback method
            const textArea = document.createElement('textarea');
            textArea.value = redirectUri;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }

        copyRedirectUriBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyRedirectUriBtn.textContent = 'Copy';
        }, 2000);
    } catch (error) {
        console.error('Failed to copy:', error);
        showStatus('Failed to copy redirect URI', 'error');
    }
}

// Validate D365 URL
function validateD365Url(e) {
    const url = e.target.value;
    const isValid = /^https:\/\/[\w-]+\.crm\d*\.dynamics\.com\/?$/.test(url);

    e.target.classList.toggle('invalid', url && !isValid);
    return isValid;
}

// Validate GUID format
function validateGuid(e) {
    const guid = e.target.value;
    const isValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid);

    e.target.classList.toggle('invalid', guid && !isValid);
    return isValid;
}

// Validate SharePoint URL
function validateSharePointUrl(e) {
    const url = e.target.value;
    const isValid = /^https:\/\/[\w-]+\.sharepoint\.com(\/sites\/[\w-]+)?/.test(url);
    
    e.target.classList.toggle('invalid', url && !isValid);
    return isValid;
}

// Validate generic URL
function validateUrl(e) {
    const url = e.target.value;
    const isValid = /^https?:\/\/.+/.test(url);
    
    e.target.classList.toggle('invalid', url && !isValid);
    return isValid;
}

// Validate email
function validateEmail(e) {
    const email = e.target.value;
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    
    e.target.classList.toggle('invalid', email && !isValid);
    return isValid;
}

// Validate number range
function validateNumberRange(e) {
    const value = parseInt(e.target.value);
    const min = parseInt(e.target.min) || 0;
    const max = parseInt(e.target.max) || Infinity;
    const isValid = !isNaN(value) && value >= min && value <= max;
    
    e.target.classList.toggle('invalid', e.target.value && !isValid);
    return isValid;
}

// Update support fields visibility
function updateSupportFieldsVisibility(supportType) {
    supportEmailGroup.style.display = supportType === 'email' ? 'block' : 'none';
    supportChatGroup.style.display = supportType === 'chat' ? 'block' : 'none';
    supportWebformGroup.style.display = supportType === 'webform' ? 'block' : 'none';
}

// Save settings
async function saveSettings() {
    // Check permission
    if (!await checkPermission('MANAGE_SETTINGS')) {
        showStatus('You do not have permission to manage settings', 'error');
        return;
    }
    
    saveSettingsBtn.disabled = true;
    showStatus('Saving...', 'info');

    try {
        // Get form values
        const d365OrgUrl = d365UrlInput.value.trim().replace(/\/$/, ''); // Remove trailing slash
        const clientId = clientIdInput.value.trim();
        const tenantId = tenantIdInput.value.trim();
        
        // Get sync settings
        const dataverseTableName = dataverseTableInput.value.trim() || 'cr123_domstylecustomizations';
        const sharePointUrl = sharePointUrlInput.value.trim();
        const sharePointListName = sharePointListInput.value.trim() || 'DOM Style Customizations';
        const conflictResolution = conflictResolutionSelect.value;
        const autoSync = autoSyncCheckbox.checked;
        const syncOnStartup = syncOnStartupCheckbox.checked;

        // Validate
        if (!d365OrgUrl) {
            throw new Error('D365 Organization URL is required');
        }

        if (!validateD365Url({ target: d365UrlInput })) {
            throw new Error('Invalid D365 URL format');
        }
        
        if (sharePointUrl && !validateSharePointUrl({ target: sharePointUrlInput })) {
            throw new Error('Invalid SharePoint URL format');
        }

        // Get all settings values
        const licenseEndpoint = licenseEndpointInput.value.trim();
        const licenseCheckInterval = parseInt(licenseCheckIntervalInput.value) || 24;
        const supportType = supportTypeSelect.value;
        const supportEmail = supportEmailInput.value.trim();
        const supportChatUrl = supportChatUrlInput.value.trim();
        const supportWebformUrl = supportWebformUrlInput.value.trim();
        const allowScreenshots = allowScreenshotsCheckbox.checked;
        const maxCustomizations = parseInt(maxCustomizationsInput.value) || 100;
        const injectionDelay = parseInt(injectionDelayInput.value) || 100;
        const enableCaching = enableCachingCheckbox.checked;
        const debugMode = debugModeCheckbox.checked;
        const showInjectionBadge = showInjectionBadgeCheckbox.checked;
        const logLevel = logLevelSelect.value;
        
        // Validate additional fields
        if (licenseEndpoint && !validateUrl({ target: licenseEndpointInput })) {
            throw new Error('Invalid license endpoint URL');
        }
        
        if (supportType === 'email' && supportEmail && !validateEmail({ target: supportEmailInput })) {
            throw new Error('Invalid support email address');
        }
        
        if (supportType === 'chat' && supportChatUrl && !validateUrl({ target: supportChatUrlInput })) {
            throw new Error('Invalid chat widget URL');
        }
        
        if (supportType === 'webform' && supportWebformUrl && !validateUrl({ target: supportWebformUrlInput })) {
            throw new Error('Invalid support form URL');
        }

        // Save to sync storage
        await chrome.storage.sync.set({
            d365OrgUrl,
            clientId: clientId || null,
            tenantId: tenantId || null,
            dataverseTableName,
            sharePointUrl: sharePointUrl || null,
            sharePointListName,
            conflictResolution,
            autoSync,
            syncOnStartup,
            licenseEndpoint: licenseEndpoint || null,
            licenseCheckInterval,
            supportType,
            supportEmail: supportEmail || null,
            supportChatUrl: supportChatUrl || null,
            supportWebformUrl: supportWebformUrl || null,
            allowScreenshots,
            maxCustomizations,
            injectionDelay,
            enableCaching,
            debugMode,
            showInjectionBadge,
            logLevel
        });

        // Handle mock token
        if (useMockTokenCheckbox.checked && mockTokenTextarea.value.trim()) {
            await chrome.storage.local.set({
                mockToken: mockTokenTextarea.value.trim()
            });
        } else {
            await chrome.storage.local.remove('mockToken');
        }
        
        // Update alarms based on auto-sync setting
        if (autoSync) {
            chrome.alarms.create('periodicSync', { periodInMinutes: 60 });
        } else {
            chrome.alarms.clear('periodicSync');
        }

        // Clear auth cache when settings change
        await clearAuthCache();

        showStatus('Settings saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus(error.message, 'error');
    } finally {
        saveSettingsBtn.disabled = false;
    }
}

// Clear cache
async function clearCache() {
    try {
        await clearAuthCache();
        await chrome.storage.local.remove(['userRole', 'lastSync']);

        showStatus('Cache cleared successfully', 'success');
        updateCacheStatus();
    } catch (error) {
        console.error('Error clearing cache:', error);
        showStatus('Failed to clear cache', 'error');
    }
}

// Clear auth cache
async function clearAuthCache() {
    await chrome.storage.session.remove(['authToken', 'tokenExpiration']);
    console.log('Authentication cache cleared');
}

// Sync with Dataverse
async function syncWithDataverse() {
    try {
        showStatus('Syncing with Dataverse...', 'info');
        syncDataverseBtn.disabled = true;
        syncDataverseBtn.classList.add('syncing');

        const response = await chrome.runtime.sendMessage({
            action: 'syncFromDataverse'
        });

        if (response.success) {
            let message = `Synced ${response.count} customizations from Dataverse`;
            if (response.conflicts > 0) {
                message += ` (${response.conflicts} conflicts resolved)`;
            }
            showStatus(message, 'success');
            updateCacheStatus();
        } else {
            throw new Error(response.error || 'Dataverse sync failed');
        }
    } catch (error) {
        console.error('Dataverse sync error:', error);
        showStatus('Dataverse sync failed: ' + error.message, 'error');
    } finally {
        syncDataverseBtn.disabled = false;
        syncDataverseBtn.classList.remove('syncing');
    }
}

// Sync with SharePoint
async function syncWithSharePoint() {
    try {
        showStatus('Syncing with SharePoint...', 'info');
        syncSharePointBtn.disabled = true;
        syncSharePointBtn.classList.add('syncing');

        const response = await chrome.runtime.sendMessage({
            action: 'syncFromSharePoint'
        });

        if (response.success) {
            showStatus(`Synced ${response.count} customizations from SharePoint`, 'success');
            updateCacheStatus();
        } else {
            throw new Error(response.error || 'SharePoint sync failed');
        }
    } catch (error) {
        console.error('SharePoint sync error:', error);
        showStatus('SharePoint sync failed: ' + error.message, 'error');
    } finally {
        syncSharePointBtn.disabled = false;
        syncSharePointBtn.classList.remove('syncing');
    }
}

// Export customizations
async function exportCustomizations() {
    try {
        const { customizations = [] } = await chrome.storage.local.get('customizations');

        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            customizations
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `dom-style-injector-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
        showStatus('Customizations exported successfully', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showStatus('Export failed', 'error');
    }
}

// Import customizations
async function importCustomizations(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate import data
        if (!data.customizations || !Array.isArray(data.customizations)) {
            throw new Error('Invalid import file format');
        }

        // Show custom confirmation dialog
        const count = data.customizations.length;
        const confirmed = await showConfirmDialog(
            `Import ${count} customization${count !== 1 ? 's' : ''}?`,
            'This will replace existing customizations.'
        );

        if (!confirmed) {
            return;
        }

        // Import customizations
        await chrome.storage.local.set({
            customizations: data.customizations,
            lastImport: new Date().toISOString()
        });

        showStatus(`Imported ${count} customizations successfully`, 'success');
    } catch (error) {
        console.error('Import error:', error);
        showStatus('Import failed: ' + error.message, 'error');
    } finally {
        // Clear the file input
        e.target.value = '';
    }
}

// Custom confirmation dialog
function showConfirmDialog(title, message) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog-overlay';
        dialog.innerHTML = `
            <div class="confirm-dialog">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="dialog-buttons">
                    <button class="btn btn-secondary" id="confirm-no">Cancel</button>
                    <button class="btn btn-primary" id="confirm-yes">Import</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const handleChoice = (confirmed) => {
            dialog.remove();
            resolve(confirmed);
        };

        document.getElementById('confirm-yes').addEventListener('click', () => handleChoice(true));
        document.getElementById('confirm-no').addEventListener('click', () => handleChoice(false));
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) handleChoice(false);
        });
    });
}

// Update cache status
async function updateCacheStatus() {
    try {
        const data = await chrome.storage.local.get([
            'userRole', 
            'lastSync',
            'lastDataverseSync',
            'lastSyncConflicts',
            'conflictHistory'
        ]);

        // Update role cache status
        if (data.userRole) {
            const age = Date.now() - data.userRole.timestamp;
            const hours = Math.floor(age / (1000 * 60 * 60));
            const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));

            roleCacheStatus.textContent = `${data.userRole.isAdmin ? 'Admin' : 'User'} (${hours}h ${minutes}m old)`;
        } else {
            roleCacheStatus.textContent = 'Not cached';
        }

        // Update last sync time
        const lastSyncTime = data.lastDataverseSync || data.lastSync;
        if (lastSyncTime) {
            lastSyncElement.textContent = new Date(lastSyncTime).toLocaleString();
        } else {
            lastSyncElement.textContent = 'Never';
        }
        
        // Update conflict status
        if (data.lastSyncConflicts && data.lastSyncConflicts.length > 0) {
            const conflicts = data.lastSyncConflicts;
            const resolutions = conflicts.map(c => c.resolution);
            const uniqueResolutions = [...new Set(resolutions)];
            lastConflictElement.textContent = `${conflicts.length} conflicts (${uniqueResolutions.join(', ')})`;
        } else if (data.conflictHistory && data.conflictHistory.dataverse && data.conflictHistory.dataverse.length > 0) {
            const lastHistory = data.conflictHistory.dataverse[data.conflictHistory.dataverse.length - 1];
            lastConflictElement.textContent = `Last: ${lastHistory.conflicts} conflicts (${new Date(lastHistory.timestamp).toLocaleDateString()})`;
        } else {
            lastConflictElement.textContent = 'None';
        }
    } catch (error) {
        console.error('Error updating cache status:', error);
    }
}

// Show status message
function showStatus(message, type = 'info') {
    saveStatus.textContent = message;
    saveStatus.className = `status-${type}`;

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            saveStatus.textContent = '';
            saveStatus.className = '';
        }, 3000);
    }
}

// Check license status
async function checkLicense() {
    try {
        checkLicenseBtn.disabled = true;
        checkLicenseBtn.textContent = 'Checking...';
        
        const { licenseEndpoint } = await chrome.storage.sync.get('licenseEndpoint');
        
        if (!licenseEndpoint) {
            licenseStatusText.textContent = 'Not Configured';
            showStatus('License endpoint not configured', 'warning');
            return;
        }
        
        // Send message to background script to check license
        const response = await chrome.runtime.sendMessage({
            action: 'checkLicense',
            endpoint: licenseEndpoint
        });
        
        if (response.success) {
            licenseStatusText.textContent = response.valid ? 'Valid' : 'Invalid';
            licenseLastCheck.textContent = new Date().toLocaleString();
            
            // Store license status
            await chrome.storage.local.set({
                licenseStatus: { valid: response.valid, details: response.details },
                licenseLastCheck: Date.now()
            });
            
            showStatus(response.valid ? 'License is valid' : 'License is invalid', response.valid ? 'success' : 'error');
        } else {
            throw new Error(response.error || 'License check failed');
        }
    } catch (error) {
        console.error('License check error:', error);
        showStatus('License check failed: ' + error.message, 'error');
        licenseStatusText.textContent = 'Error';
    } finally {
        checkLicenseBtn.disabled = false;
        checkLicenseBtn.textContent = 'Check Now';
    }
}

// Export settings
async function exportSettings() {
    try {
        const settings = await chrome.storage.sync.get();
        const localSettings = await chrome.storage.local.get(['mockToken']);
        
        const exportData = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            settings: { ...settings },
            hasMockToken: !!localSettings.mockToken
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `dom-injector-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        showStatus('Settings exported successfully', 'success');
    } catch (error) {
        console.error('Export settings error:', error);
        showStatus('Failed to export settings', 'error');
    }
}

// Import settings
async function importSettings(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Validate import data
        if (!data.settings || typeof data.settings !== 'object') {
            throw new Error('Invalid settings file format');
        }
        
        const confirmed = await showConfirmDialog(
            'Import Settings?',
            'This will replace all current settings. Are you sure?'
        );
        
        if (!confirmed) {
            return;
        }
        
        // Import settings
        await chrome.storage.sync.set(data.settings);
        
        // Reload settings in UI
        await loadSettings();
        
        showStatus('Settings imported successfully', 'success');
    } catch (error) {
        console.error('Import settings error:', error);
        showStatus('Failed to import settings: ' + error.message, 'error');
    } finally {
        // Clear the file input
        e.target.value = '';
    }
}

// Auto-refresh cache status
setInterval(updateCacheStatus, 5000);

// Branding functionality
let brandingManager = null;

// Branding elements
const logoUploadInput = document.getElementById('logo-upload');
const logoPreview = document.getElementById('logo-preview');
const removeLogoBtn = document.getElementById('remove-logo');
const iconUploadInput = document.getElementById('icon-upload');
const iconPreviews = document.querySelectorAll('.icon-preview');
const removeIconBtn = document.getElementById('remove-icon');
const primaryColorInput = document.getElementById('primary-color');
const primaryColorText = document.getElementById('primary-color-text');
const secondaryColorInput = document.getElementById('secondary-color');
const secondaryColorText = document.getElementById('secondary-color-text');
const accentColorInput = document.getElementById('accent-color');
const accentColorText = document.getElementById('accent-color-text');
const themeSelect = document.getElementById('theme-select');
const themePreview = document.getElementById('theme-preview');
const companyNameInput = document.getElementById('company-name');
const brandingSupportEmailInput = document.querySelector('#branding-section #support-email');
const brandingSupportUrlInput = document.getElementById('support-url');
const customCssTextarea = document.getElementById('custom-css');
const previewBrandingBtn = document.getElementById('preview-branding');
const resetBrandingBtn = document.getElementById('reset-branding');
const exportBrandingBtn = document.getElementById('export-branding');
const importBrandingInput = document.getElementById('import-branding');

// Initialize branding manager
async function initializeBrandingManager() {
    try {
        // Check if BrandingManager is available
        if (typeof BrandingManager === 'undefined') {
            console.error('BrandingManager not found. Make sure branding-manager.js is loaded.');
            return;
        }
        
        brandingManager = new BrandingManager();
        await brandingManager.initialize();
        
        // Load current branding into UI
        loadBrandingSettings();
        
        // Setup branding event listeners
        setupBrandingEventListeners();
        
        console.log('Branding manager initialized');
    } catch (error) {
        console.error('Failed to initialize branding manager:', error);
    }
}

// Load branding settings into UI
function loadBrandingSettings() {
    if (!brandingManager) return;
    
    const branding = brandingManager.getCurrentBranding();
    
    // Logo
    if (branding.logoUrl) {
        updateLogoPreview(branding.logoUrl);
        removeLogoBtn.style.display = 'inline-block';
    }
    
    // Icon
    if (branding.iconUrl) {
        updateIconPreviews(branding.iconUrl);
        removeIconBtn.style.display = 'inline-block';
    }
    
    // Colors
    primaryColorInput.value = branding.primaryColor;
    primaryColorText.value = branding.primaryColor;
    secondaryColorInput.value = branding.secondaryColor;
    secondaryColorText.value = branding.secondaryColor;
    accentColorInput.value = branding.accentColor;
    accentColorText.value = branding.accentColor;
    
    // Theme
    themeSelect.value = branding.theme;
    updateThemePreview(branding.theme);
    
    // Company info
    companyNameInput.value = branding.companyName || '';
    if (brandingSupportEmailInput) brandingSupportEmailInput.value = branding.supportEmail || '';
    if (brandingSupportUrlInput) brandingSupportUrlInput.value = branding.supportUrl || '';
    
    // Custom CSS
    customCssTextarea.value = branding.customCSS || '';
}

// Setup branding event listeners
function setupBrandingEventListeners() {
    // Logo upload
    logoUploadInput.addEventListener('change', handleLogoUpload);
    removeLogoBtn.addEventListener('click', removeLogo);
    
    // Icon upload
    iconUploadInput.addEventListener('change', handleIconUpload);
    removeIconBtn.addEventListener('click', removeIcon);
    
    // Color inputs sync
    primaryColorInput.addEventListener('input', (e) => {
        primaryColorText.value = e.target.value;
        saveBrandingDebounced();
    });
    primaryColorText.addEventListener('input', (e) => {
        if (isValidColor(e.target.value)) {
            primaryColorInput.value = e.target.value;
            saveBrandingDebounced();
        }
    });
    
    secondaryColorInput.addEventListener('input', (e) => {
        secondaryColorText.value = e.target.value;
        saveBrandingDebounced();
    });
    secondaryColorText.addEventListener('input', (e) => {
        if (isValidColor(e.target.value)) {
            secondaryColorInput.value = e.target.value;
            saveBrandingDebounced();
        }
    });
    
    accentColorInput.addEventListener('input', (e) => {
        accentColorText.value = e.target.value;
        saveBrandingDebounced();
    });
    accentColorText.addEventListener('input', (e) => {
        if (isValidColor(e.target.value)) {
            accentColorInput.value = e.target.value;
            saveBrandingDebounced();
        }
    });
    
    // Theme selection
    themeSelect.addEventListener('change', (e) => {
        updateThemePreview(e.target.value);
        saveBrandingDebounced();
    });
    
    // Company info
    companyNameInput.addEventListener('input', saveBrandingDebounced);
    if (brandingSupportEmailInput) brandingSupportEmailInput.addEventListener('input', saveBrandingDebounced);
    if (brandingSupportUrlInput) brandingSupportUrlInput.addEventListener('input', saveBrandingDebounced);
    customCssTextarea.addEventListener('input', saveBrandingDebounced);
    
    // Action buttons
    previewBrandingBtn.addEventListener('click', previewBranding);
    resetBrandingBtn.addEventListener('click', resetBranding);
    exportBrandingBtn.addEventListener('click', exportBranding);
    importBrandingInput.addEventListener('change', importBranding);
}

// Handle logo upload
async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file || !brandingManager) return;
    
    try {
        showStatus('Uploading logo...', 'info');
        const logoUrl = await brandingManager.uploadLogo(file);
        updateLogoPreview(logoUrl);
        removeLogoBtn.style.display = 'inline-block';
        await saveBranding();
        showStatus('Logo uploaded successfully', 'success');
    } catch (error) {
        console.error('Logo upload error:', error);
        showStatus('Failed to upload logo: ' + error.message, 'error');
    }
    
    // Clear input
    e.target.value = '';
}

// Update logo preview
function updateLogoPreview(logoUrl) {
    logoPreview.innerHTML = `<img src="${logoUrl}" alt="Company Logo">`;
}

// Remove logo
async function removeLogo() {
    logoPreview.innerHTML = '<span>No logo uploaded</span>';
    removeLogoBtn.style.display = 'none';
    await saveBranding();
}

// Handle icon upload
async function handleIconUpload(e) {
    const file = e.target.files[0];
    if (!file || !brandingManager) return;
    
    try {
        showStatus('Processing icon...', 'info');
        const icons = await brandingManager.uploadIcon(file);
        
        // Use the largest icon as the main icon URL
        const iconUrl = icons[128] || icons[48] || icons[16];
        updateIconPreviews(iconUrl);
        removeIconBtn.style.display = 'inline-block';
        
        await saveBranding();
        showStatus('Icon uploaded successfully', 'success');
    } catch (error) {
        console.error('Icon upload error:', error);
        showStatus('Failed to upload icon: ' + error.message, 'error');
    }
    
    // Clear input
    e.target.value = '';
}

// Update icon previews
function updateIconPreviews(iconUrl) {
    iconPreviews.forEach(preview => {
        preview.innerHTML = `<img src="${iconUrl}" alt="Icon">`;
    });
}

// Remove icon
async function removeIcon() {
    iconPreviews.forEach(preview => {
        const size = preview.dataset.size;
        preview.innerHTML = size;
    });
    removeIconBtn.style.display = 'none';
    await saveBranding();
}

// Update theme preview
function updateThemePreview(theme) {
    if (!brandingManager) return;
    
    themePreview.innerHTML = '';
    const preview = brandingManager.generateThemePreview(theme);
    themePreview.appendChild(preview);
}

// Save branding (debounced)
let saveBrandingTimeout;
function saveBrandingDebounced() {
    clearTimeout(saveBrandingTimeout);
    saveBrandingTimeout = setTimeout(saveBranding, 500);
}

// Save branding
async function saveBranding() {
    if (!brandingManager) return;
    
    try {
        const branding = {
            logoUrl: logoPreview.querySelector('img')?.src || null,
            iconUrl: iconPreviews[0].querySelector('img')?.src || null,
            primaryColor: primaryColorInput.value,
            secondaryColor: secondaryColorInput.value,
            accentColor: accentColorInput.value,
            theme: themeSelect.value,
            companyName: companyNameInput.value,
            supportEmail: brandingSupportEmailInput?.value || '',
            supportUrl: brandingSupportUrlInput?.value || '',
            customCSS: customCssTextarea.value
        };
        
        const result = await brandingManager.saveBranding(branding);
        
        if (!result.success) {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Save branding error:', error);
        showStatus('Failed to save branding: ' + error.message, 'error');
    }
}

// Preview branding
function previewBranding() {
    if (!brandingManager) return;
    
    // Apply branding temporarily
    brandingManager.applyBranding();
    showStatus('Branding preview applied', 'info');
    
    // Revert after 5 seconds
    setTimeout(() => {
        showStatus('Preview ended', 'info');
    }, 5000);
}

// Reset branding
async function resetBranding() {
    if (!brandingManager) return;
    
    const confirmed = await showConfirmDialog(
        'Reset Branding?',
        'This will reset all branding to default values. Are you sure?'
    );
    
    if (!confirmed) return;
    
    try {
        await brandingManager.resetBranding();
        loadBrandingSettings();
        showStatus('Branding reset to default', 'success');
    } catch (error) {
        console.error('Reset branding error:', error);
        showStatus('Failed to reset branding', 'error');
    }
}

// Export branding
function exportBranding() {
    if (!brandingManager) return;
    
    brandingManager.exportBranding();
    showStatus('Branding configuration exported', 'success');
}

// Import branding
async function importBranding(e) {
    const file = e.target.files[0];
    if (!file || !brandingManager) return;
    
    try {
        const text = await file.text();
        const result = await brandingManager.importBranding(text);
        
        if (result.success) {
            loadBrandingSettings();
            showStatus(result.message, 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Import branding error:', error);
        showStatus('Failed to import branding: ' + error.message, 'error');
    } finally {
        e.target.value = '';
    }
}

// Validate color
function isValidColor(color) {
    const s = new Option().style;
    s.color = color;
    return s.color !== '';
}

// Initialize branding when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBrandingManager);
} else {
    initializeBrandingManager();
}

// =============================================================================
// AI INTEGRATION FUNCTIONALITY
// =============================================================================
let aiIntegrationManager = null;

// AI provider elements
const aiProviders = ['openai', 'anthropic', 'microsoft', 'google', 'grok'];
const aiElements = {};

// Initialize AI elements
function initializeAIElements() {
    aiProviders.forEach(provider => {
        aiElements[provider] = {
            keyInput: document.getElementById(`${provider}-key`),
            status: document.getElementById(`${provider}-status`),
            saveBtn: document.getElementById(`save-${provider}`),
            testBtn: document.getElementById(`test-${provider}`),
            removeBtn: document.getElementById(`remove-${provider}`)
        };
    });
    
    // Additional elements
    aiElements.azureEndpoint = document.getElementById('azure-endpoint');
    aiElements.defaultProvider = document.getElementById('default-ai-provider');
    aiElements.aiCssGeneration = document.getElementById('ai-css-generation');
    aiElements.aiImprovements = document.getElementById('ai-improvements');
    aiElements.aiDocumentation = document.getElementById('ai-documentation');
    aiElements.secureBackendUrl = document.getElementById('secure-backend-url');
}

// Initialize AI integration manager
async function initializeAIIntegrationManager() {
    try {
        // Check if AIIntegrationManager is available
        if (typeof AIIntegrationManager === 'undefined') {
            console.warn('AIIntegrationManager not found. AI features will be disabled.');
            return;
        }
        
        aiIntegrationManager = new AIIntegrationManager();
        await aiIntegrationManager.initialize();
        
        // Initialize UI elements
        initializeAIElements();
        
        // Load AI settings
        await loadAISettings();
        
        // Setup AI event listeners
        setupAIEventListeners();
        
        // Update provider statuses
        updateProviderStatuses();
        
        console.log('AI Integration manager initialized');
    } catch (error) {
        console.error('Failed to initialize AI integration manager:', error);
    }
}

// Load AI settings
async function loadAISettings() {
    try {
        const settings = await chrome.storage.sync.get([
            'defaultAIProvider',
            'aiCssGeneration',
            'aiImprovements',
            'aiDocumentation',
            'secureBackendUrl',
            'azureOpenAIEndpoint'
        ]);
        
        if (settings.defaultAIProvider) {
            aiElements.defaultProvider.value = settings.defaultAIProvider;
        }
        
        if (settings.azureOpenAIEndpoint) {
            aiElements.azureEndpoint.value = settings.azureOpenAIEndpoint;
        }
        
        if (settings.secureBackendUrl) {
            aiElements.secureBackendUrl.value = settings.secureBackendUrl;
        }
        
        aiElements.aiCssGeneration.checked = settings.aiCssGeneration ?? true;
        aiElements.aiImprovements.checked = settings.aiImprovements ?? true;
        aiElements.aiDocumentation.checked = settings.aiDocumentation ?? true;
        
    } catch (error) {
        console.error('Failed to load AI settings:', error);
    }
}

// Setup AI event listeners
function setupAIEventListeners() {
    // Provider-specific listeners
    aiProviders.forEach(provider => {
        const elements = aiElements[provider];
        
        elements.saveBtn.addEventListener('click', () => saveAPIKey(provider));
        elements.testBtn.addEventListener('click', () => testAPIConnection(provider));
        elements.removeBtn.addEventListener('click', () => removeAPIKey(provider));
    });
    
    // Settings listeners
    aiElements.defaultProvider.addEventListener('change', saveAISettings);
    aiElements.aiCssGeneration.addEventListener('change', saveAISettings);
    aiElements.aiImprovements.addEventListener('change', saveAISettings);
    aiElements.aiDocumentation.addEventListener('change', saveAISettings);
    aiElements.secureBackendUrl.addEventListener('change', saveAISettings);
    aiElements.azureEndpoint.addEventListener('change', saveAISettings);
}

// Save API key
async function saveAPIKey(provider) {
    if (!aiIntegrationManager) return;
    
    const elements = aiElements[provider];
    const apiKey = elements.keyInput.value.trim();
    
    if (!apiKey) {
        showStatus('Please enter an API key', 'error');
        return;
    }
    
    // Special handling for Microsoft/Azure
    if (provider === 'microsoft') {
        const azureEndpoint = aiElements.azureEndpoint.value.trim();
        if (!azureEndpoint) {
            showStatus('Please enter Azure OpenAI endpoint', 'error');
            return;
        }
    }
    
    try {
        elements.saveBtn.disabled = true;
        elements.saveBtn.textContent = 'Saving...';
        
        const result = await aiIntegrationManager.saveAPIKey(provider, apiKey);
        
        if (result.success) {
            showStatus(`${aiIntegrationManager.providers[provider].name} API key saved`, 'success');
            elements.keyInput.value = ''; // Clear the input
            updateProviderStatus(provider, true);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Failed to save API key:', error);
        showStatus(`Failed to save API key: ${error.message}`, 'error');
    } finally {
        elements.saveBtn.disabled = false;
        elements.saveBtn.textContent = 'Save';
    }
}

// Test API connection
async function testAPIConnection(provider) {
    if (!aiIntegrationManager) return;
    
    const elements = aiElements[provider];
    
    try {
        elements.testBtn.disabled = true;
        elements.testBtn.textContent = 'Testing...';
        
        const result = await aiIntegrationManager.testConnection(provider);
        
        if (result.success) {
            showStatus(`${aiIntegrationManager.providers[provider].name} connection successful`, 'success');
            updateProviderStatus(provider, true);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Connection test failed:', error);
        showStatus(`Connection test failed: ${error.message}`, 'error');
        updateProviderStatus(provider, false, true);
    } finally {
        elements.testBtn.disabled = false;
        elements.testBtn.textContent = 'Test';
    }
}

// Remove API key
async function removeAPIKey(provider) {
    if (!aiIntegrationManager) return;
    
    const confirmed = await showConfirmDialog(
        'Remove API Key?',
        `Are you sure you want to remove the ${aiIntegrationManager.providers[provider].name} API key?`
    );
    
    if (!confirmed) return;
    
    try {
        const result = await aiIntegrationManager.deleteAPIKey(provider);
        
        if (result.success) {
            showStatus(`${aiIntegrationManager.providers[provider].name} API key removed`, 'success');
            updateProviderStatus(provider, false);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Failed to remove API key:', error);
        showStatus(`Failed to remove API key: ${error.message}`, 'error');
    }
}

// Update provider status
function updateProviderStatus(provider, configured, error = false) {
    const statusEl = aiElements[provider].status;
    
    if (error) {
        statusEl.textContent = 'Error';
        statusEl.className = 'provider-status error';
    } else if (configured) {
        statusEl.textContent = 'Configured';
        statusEl.className = 'provider-status configured';
    } else {
        statusEl.textContent = 'Not Configured';
        statusEl.className = 'provider-status';
    }
}

// Update all provider statuses
function updateProviderStatuses() {
    if (!aiIntegrationManager) return;
    
    const configuredProviders = aiIntegrationManager.getConfiguredProviders();
    
    aiProviders.forEach(provider => {
        updateProviderStatus(provider, configuredProviders.includes(provider));
    });
}

// Save AI settings
async function saveAISettings() {
    try {
        const settings = {
            defaultAIProvider: aiElements.defaultProvider.value,
            aiCssGeneration: aiElements.aiCssGeneration.checked,
            aiImprovements: aiElements.aiImprovements.checked,
            aiDocumentation: aiElements.aiDocumentation.checked,
            secureBackendUrl: aiElements.secureBackendUrl.value.trim(),
            azureOpenAIEndpoint: aiElements.azureEndpoint.value.trim()
        };
        
        await chrome.storage.sync.set(settings);
        
        // Update AI manager with new backend URL if changed
        if (aiIntegrationManager && settings.secureBackendUrl) {
            aiIntegrationManager.secureBackendUrl = settings.secureBackendUrl;
        }
        
    } catch (error) {
        console.error('Failed to save AI settings:', error);
        showStatus('Failed to save AI settings', 'error');
    }
}

// Toggle API key visibility
window.toggleKeyVisibility = function(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
    } else {
        input.type = 'password';
        button.textContent = '👁';
    }
};

// Initialize AI integration when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAIIntegrationManager);
} else {
    initializeAIIntegrationManager();
}