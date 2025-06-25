// src/scripts/content.js - Fixed ESLint issues

(function () {
    'use strict';

    // Unique prefix for injected styles
    const STYLE_PREFIX = 'd365-style-injector-';
    const appliedStyles = new Map(); // Using const since we're not reassigning the Map itself

    // Initialize content script
    async function init() {
        console.log('[D365 Style Injector] Content script initialized');

        // Load and apply customizations
        await applyCustomizations();

        // Listen for updates from popup/background
        chrome.runtime.onMessage.addListener(handleMessage);

        // Watch for DOM changes to reapply styles if needed
        observeDOMChanges();
    }

    // Apply all active customizations
    async function applyCustomizations() {
        try {
            const { customizations = [] } = await chrome.storage.local.get('customizations');

            // Remove all existing injected styles
            removeAllStyles();

            // Apply each active customization
            customizations.forEach(customization => {
                if (customization.enabled) {
                    applyStyle(customization);
                }
            });

            console.log(`[D365 Style Injector] Applied ${customizations.filter(c => c.enabled).length} customizations`);
        } catch (error) {
            console.error('[D365 Style Injector] Error applying customizations:', error);
        }
    }

    // Apply a single style customization
    function applyStyle(customization) {
        try {
            const { id, selector, css } = customization;

            if (!selector || !css) {
                console.warn('[D365 Style Injector] Invalid customization:', customization);
                return;
            }

            // Create style element
            const styleEl = document.createElement('style');
            styleEl.id = STYLE_PREFIX + id;
            styleEl.textContent = `${selector} { ${css} }`;

            // Add to document head
            document.head.appendChild(styleEl);
            appliedStyles.set(id, styleEl);

            console.log(`[D365 Style Injector] Applied style: ${customization.name || id}`);
        } catch (error) {
            console.error('[D365 Style Injector] Error applying style:', error);
        }
    }

    // Remove a single style
    function removeStyle(customizationId) {
        const styleEl = appliedStyles.get(customizationId);
        if (styleEl) {
            styleEl.remove();
            appliedStyles.delete(customizationId);
            console.log(`[D365 Style Injector] Removed style: ${customizationId}`);
        }
    }

    // Remove all injected styles
    function removeAllStyles() {
        appliedStyles.forEach((styleEl) => {
            styleEl.remove();
        });
        appliedStyles.clear();
    }

    // Handle messages from extension
    function handleMessage(request) {
        console.log('[D365 Style Injector] Received message:', request.action);

        switch (request.action) {
            case 'updateCustomization':
                if (request.customization) {
                    if (request.customization.enabled) {
                        applyStyle(request.customization);
                    } else {
                        removeStyle(request.customization.id);
                    }
                }
                break;

            case 'reloadCustomizations':
                applyCustomizations();
                break;

            case 'ping':
                // Return true to indicate we're active
                return Promise.resolve({ status: 'active' });
        }
    }

    // Observe DOM changes and reapply styles if needed
    function observeDOMChanges() {
        let reapplyTimeout;

        const observer = new window.MutationObserver((mutations) => {
            // Check if any of our styles were removed
            let needsReapply = false;

            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.id && node.id.startsWith(STYLE_PREFIX)) {
                            needsReapply = true;
                        }
                    });
                }
            });

            if (needsReapply) {
                // Debounce reapplication
                clearTimeout(reapplyTimeout);
                reapplyTimeout = setTimeout(() => {
                    console.log('[D365 Style Injector] Reapplying styles after DOM change');
                    applyCustomizations();
                }, 500);
            }
        });

        // Start observing
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // Handle dynamic navigation (for SPAs like D365)
    let lastUrl = window.location.href;
    new window.MutationObserver(() => {
        const url = window.location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('[D365 Style Injector] URL changed, reapplying customizations');
            setTimeout(applyCustomizations, 1000); // Delay to let page load
        }
    }).observe(document, { subtree: true, childList: true });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();