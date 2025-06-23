// user-version/popup.js
(function() {
    'use strict';

    // DOM elements
    const syncButton = document.getElementById('sync-button');
    const syncButtonText = document.getElementById('sync-button-text');
    const syncStatus = document.getElementById('sync-status');
    const customizationList = document.getElementById('customization-list');
    const customizationCount = document.getElementById('customization-count');
    const errorContainer = document.getElementById('error-container');

    // State
    let customizations = [];
    let isSyncing = false;

    // Initialize
    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        try {
            await loadCustomizations();
            await updateSyncStatus();
            setupEventListeners();
        } catch (error) {
            showError('Failed to initialize: ' + error.message);
        }
    }

    function setupEventListeners() {
        syncButton.addEventListener('click', handleSync);
        
        // Listen for changes from content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'customizationsUpdated') {
                loadCustomizations();
            }
        });
    }

    async function loadCustomizations() {
        try {
            const result = await chrome.storage.local.get('customizations');
            customizations = result.customizations || [];
            renderCustomizations();
            updateCustomizationCount();
        } catch (error) {
            console.error('Error loading customizations:', error);
            showError('Failed to load customizations: ' + error.message);
        }
    }

    async function updateSyncStatus() {
        try {
            const result = await chrome.storage.sync.get('lastSync');
            const lastSync = result.lastSync;
            
            if (lastSync) {
                const date = new Date(lastSync);
                const timeAgo = getTimeAgo(date);
                syncStatus.textContent = `Last synced: ${timeAgo}`;
            } else {
                syncStatus.textContent = 'Never synced';
            }
        } catch (error) {
            syncStatus.textContent = 'Sync status unknown';
        }
    }

    function getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    }

    function renderCustomizations() {
        if (customizations.length === 0) {
            customizationList.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p>No customizations yet</p>
                    <p style="font-size: 12px; margin-top: 5px;">Click sync to load customizations</p>
                </div>
            `;
            return;
        }

        const html = customizations.map(customization => `
            <div class="customization-item" data-id="${customization.id}">
                <div class="customization-info">
                    <div class="customization-name">${escapeHtml(customization.name)}</div>
                    <div class="customization-details">
                        ${escapeHtml(customization.domain)} • ${escapeHtml(customization.targetElement)}
                    </div>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" 
                           ${customization.isActive ? 'checked' : ''} 
                           data-id="${customization.id}">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `).join('');

        customizationList.innerHTML = html;

        // Add toggle event listeners
        customizationList.querySelectorAll('.toggle-switch input').forEach(toggle => {
            toggle.addEventListener('change', handleToggle);
        });
    }

    function updateCustomizationCount() {
        const activeCount = customizations.filter(c => c.isActive).length;
        const totalCount = customizations.length;
        
        if (totalCount === 0) {
            customizationCount.textContent = '';
        } else {
            customizationCount.textContent = `${activeCount} of ${totalCount} active`;
        }
    }

    async function handleSync() {
        if (isSyncing) return;

        isSyncing = true;
        syncButton.disabled = true;
        syncButton.classList.add('syncing');
        syncButtonText.innerHTML = '<span class="loading-spinner"></span>Syncing...';
        clearError();

        try {
            // Send sync request to background script
            const response = await chrome.runtime.sendMessage({ action: 'sync' });
            
            if (response.success) {
                // Update local storage with new customizations
                await chrome.storage.local.set({ 
                    customizations: response.customizations 
                });
                
                // Update sync timestamp
                await chrome.storage.sync.set({ 
                    lastSync: new Date().toISOString() 
                });
                
                // Reload and update UI
                customizations = response.customizations;
                renderCustomizations();
                updateCustomizationCount();
                await updateSyncStatus();
                
                // Show success feedback
                syncButtonText.textContent = 'Sync Complete!';
                setTimeout(() => {
                    syncButtonText.textContent = 'Sync Customizations';
                }, 2000);
            } else {
                throw new Error(response.error || 'Sync failed');
            }
        } catch (error) {
            console.error('Sync error:', error);
            showError('Sync failed: ' + error.message);
            syncButtonText.textContent = 'Sync Failed';
            setTimeout(() => {
                syncButtonText.textContent = 'Sync Customizations';
            }, 2000);
        } finally {
            isSyncing = false;
            syncButton.disabled = false;
            syncButton.classList.remove('syncing');
        }
    }

    async function handleToggle(event) {
        const customizationId = event.target.dataset.id;
        const isActive = event.target.checked;

        try {
            // Update local state
            const customization = customizations.find(c => c.id === customizationId);
            if (customization) {
                customization.isActive = isActive;
                
                // Save to storage
                await chrome.storage.local.set({ customizations });
                
                // Notify content scripts
                chrome.tabs.query({}, tabs => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'toggleCustomization',
                            customizationId,
                            isActive
                        }).catch(() => {
                            // Ignore errors for tabs that don't have content script
                        });
                    });
                });
                
                updateCustomizationCount();
            }
        } catch (error) {
            console.error('Error toggling customization:', error);
            showError('Failed to toggle customization');
            // Revert toggle state
            event.target.checked = !isActive;
        }
    }

    function showError(message) {
        errorContainer.innerHTML = `
            <div class="error-message">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ${escapeHtml(message)}
            </div>
        `;
    }

    function clearError() {
        errorContainer.innerHTML = '';
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Check for permission errors
    chrome.permissions.contains({
        permissions: ['storage']
    }, (result) => {
        if (!result) {
            errorContainer.innerHTML = `
                <div class="permission-error">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Permission required for storage access
                </div>
            `;
        }
    });
})();