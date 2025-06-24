// user-version/background.js
// Simple background service worker for user version

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('DOM Style Injector User Extension installed');
        // Set default sync interval
        chrome.storage.local.set({
            syncInterval: 3600000, // 1 hour in milliseconds
            lastSync: null
        });
    }
});

// Handle sync requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'sync') {
        performSync().then(sendResponse);
        return true; // Keep channel open for async response
    }
});

// Mock sync function for user version
// In production, this would connect to your SharePoint/API
async function performSync() {
    try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock response - in production, fetch from SharePoint
        const mockCustomizations = [
            {
                id: 'mock-1',
                name: 'Form Header Style',
                domain: '*.dynamics.com',
                targetElement: '[data-id="form-header"]',
                cssProperty: 'background-color',
                cssValue: '#f0f0f0',
                isActive: true,
                publishedAt: new Date().toISOString(),
                publishedBy: 'admin@company.com'
            },
            {
                id: 'mock-2',
                name: 'Button Enhancement',
                domain: '*.dynamics.com',
                targetElement: '.primary-button',
                cssProperty: 'border-radius',
                cssValue: '8px',
                isActive: true,
                publishedAt: new Date().toISOString(),
                publishedBy: 'admin@company.com'
            }
        ];

        // In production, replace with actual API call:
        // const response = await fetch('https://your-api/customizations');
        // const customizations = await response.json();

        await chrome.storage.local.set({
            customizations: mockCustomizations,
            lastSync: new Date().toISOString()
        });

        return {
            success: true,
            customizations: mockCustomizations
        };
    } catch (error) {
        console.error('Sync failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Optional: Set up periodic sync
chrome.alarms.create('syncCustomizations', {
    periodInMinutes: 60 // Sync every hour
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'syncCustomizations') {
        performSync();
    }
});