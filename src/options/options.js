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
const forceSyncBtn = document.getElementById('force-sync');
const exportBtn = document.getElementById('export-customizations');
const importFileInput = document.getElementById('import-file');
const roleCacheStatus = document.getElementById('role-cache-status');
const lastSyncElement = document.getElementById('last-sync');

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
            'tenantId'
        ]);

        const localSettings = await chrome.storage.local.get([
            'mockToken',
            'userRole',
            'lastSync'
        ]);

        // Populate form fields
        if (settings.d365OrgUrl) d365UrlInput.value = settings.d365OrgUrl;
        if (settings.clientId) clientIdInput.value = settings.clientId;
        if (settings.tenantId) tenantIdInput.value = settings.tenantId;

        // Check if using mock token
        if (localSettings.mockToken) {
            useMockTokenCheckbox.checked = true;
            mockTokenGroup.style.display = 'block';
            mockTokenTextarea.value = localSettings.mockToken;
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
    forceSyncBtn.addEventListener('click', forceSync);
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

// Save settings
async function saveSettings() {
    saveSettingsBtn.disabled = true;
    showStatus('Saving...', 'info');

    try {
        // Get form values
        const d365OrgUrl = d365UrlInput.value.trim().replace(/\/$/, ''); // Remove trailing slash
        const clientId = clientIdInput.value.trim();
        const tenantId = tenantIdInput.value.trim();

        // Validate
        if (!d365OrgUrl) {
            throw new Error('D365 Organization URL is required');
        }

        if (!validateD365Url({ target: d365UrlInput })) {
            throw new Error('Invalid D365 URL format');
        }

        // Save to sync storage
        await chrome.storage.sync.set({
            d365OrgUrl,
            clientId: clientId || null,
            tenantId: tenantId || null
        });

        // Handle mock token
        if (useMockTokenCheckbox.checked && mockTokenTextarea.value.trim()) {
            await chrome.storage.local.set({
                mockToken: mockTokenTextarea.value.trim()
            });
        } else {
            await chrome.storage.local.remove('mockToken');
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

// Force sync
async function forceSync() {
    try {
        showStatus('Syncing...', 'info');

        const response = await chrome.runtime.sendMessage({
            action: 'syncFromSharePoint'
        });

        if (response.success) {
            showStatus(`Synced ${response.count} customizations`, 'success');
            updateCacheStatus();
        } else {
            throw new Error(response.error || 'Sync failed');
        }
    } catch (error) {
        console.error('Sync error:', error);
        showStatus('Sync failed: ' + error.message, 'error');
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
        const { userRole, lastSync } = await chrome.storage.local.get(['userRole', 'lastSync']);

        if (userRole) {
            const age = Date.now() - userRole.timestamp;
            const hours = Math.floor(age / (1000 * 60 * 60));
            const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));

            roleCacheStatus.textContent = `${userRole.isAdmin ? 'Admin' : 'User'} (${hours}h ${minutes}m old)`;
        } else {
            roleCacheStatus.textContent = 'Not cached';
        }

        if (lastSync) {
            lastSyncElement.textContent = new Date(lastSync).toLocaleString();
        } else {
            lastSyncElement.textContent = 'Never';
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