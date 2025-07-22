// src/options/options.js

/* global Blob, URL, navigator */

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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupEventListeners();
    updateRedirectUri();
    updateCacheStatus();
});

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
            'syncOnStartup'
        ]);

        const localSettings = await chrome.storage.local.get([
            'mockToken',
            'userRole',
            'lastSync',
            'lastDataverseSync',
            'lastSyncConflicts',
            'conflictHistory'
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

    // Toggle mock token textarea
    useMockTokenCheckbox.addEventListener('change', (e) => {
        mockTokenGroup.style.display = e.target.checked ? 'block' : 'none';
        if (!e.target.checked) {
            mockTokenTextarea.value = '';
        }
    });

    // Add input validation
    d365UrlInput.addEventListener('input', validateD365Url);
    clientIdInput.addEventListener('input', validateGuid);
    tenantIdInput.addEventListener('input', validateGuid);
    sharePointUrlInput.addEventListener('input', validateSharePointUrl);
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

// Save settings
async function saveSettings() {
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
            syncOnStartup
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

// Auto-refresh cache status
setInterval(updateCacheStatus, 5000);