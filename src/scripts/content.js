// src/scripts/content.js - Unified Content Script for D365 DOM Style Injector
// This script runs on D365 and SharePoint pages and applies customizations based on user role

(function () {
    'use strict';

    // Extension identifier for logging and style management
    const EXTENSION_PREFIX = 'dom-style-injector';
    const STYLE_PREFIX = `${EXTENSION_PREFIX}-style-`;

    // State management
    const appliedStyles = new Map(); // Track applied styles by ID
    let userRole = null; // Will be fetched from storage
    let isD365Page = false;
    let isSharePointPage = false;

    // Page detection patterns
    const D365_PATTERNS = [
        /\.dynamics\.com/,
        /\.crm\d*\.dynamics\.com/,
        /\/main\.aspx/,
        /\/form\.aspx/,
        /\/grid\.aspx/
    ];

    const SHAREPOINT_PATTERNS = [
        /\.sharepoint\.com/,
        /\/sites\//,
        /\/lists\//,
        /\/pages\//
    ];

    // Initialize the content script
    initializeContentScript();

    function initializeContentScript() {
        console.log(`[${EXTENSION_PREFIX}] Content script initializing...`);

        // Detect page type
        detectPageType();

        // Get user role and settings
        loadUserSettings().then(() => {
            console.log(`[${EXTENSION_PREFIX}] User role:`, userRole?.isAdmin ? 'Admin' : 'User');

            // Apply customizations when DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', handleDOMReady);
            } else {
                handleDOMReady();
            }

            // Watch for URL changes (SPA navigation)
            setupNavigationWatcher();

            // Watch for DOM mutations
            setupDOMObserver();

            // Listen for messages from popup/background
            setupMessageListener();

            console.log(`[${EXTENSION_PREFIX}] Content script initialized successfully`);
        }).catch(error => {
            console.error(`[${EXTENSION_PREFIX}] Failed to initialize:`, error);
        });
    }

    function detectPageType() {
        const url = window.location.href;
        isD365Page = D365_PATTERNS.some(pattern => pattern.test(url));
        isSharePointPage = SHAREPOINT_PATTERNS.some(pattern => pattern.test(url));

        console.log(`[${EXTENSION_PREFIX}] Page type detected:`, {
            isD365: isD365Page,
            isSharePoint: isSharePointPage,
            url: url
        });
    }

    async function loadUserSettings() {
        try {
            const result = await chrome.storage.local.get(['userRole', 'extensionSettings']);
            userRole = result.userRole || { isAdmin: false, timestamp: 0 };

            // Check if role data is stale (older than 8 hours)
            const isStale = Date.now() - userRole.timestamp > 8 * 60 * 60 * 1000;
            if (isStale) {
                console.log(`[${EXTENSION_PREFIX}] Role data is stale, requesting refresh...`);
                // Request role refresh from background script
                chrome.runtime.sendMessage({ action: 'checkUserRole' });
            }
        } catch (error) {
            console.error(`[${EXTENSION_PREFIX}] Error loading user settings:`, error);
        }
    }

    function handleDOMReady() {
        console.log(`[${EXTENSION_PREFIX}] DOM ready, waiting for dynamic content...`);

        // Wait for dynamic content to load before applying customizations
        waitForDynamicContent().then(() => {
            applyCustomizations();
        });
    }

    async function waitForDynamicContent() {
        const maxWaitTime = 10000; // 10 seconds max wait
        const checkInterval = 500; // Check every 500ms
        let waitTime = 0;

        return new Promise((resolve) => {
            const checkContent = () => {
                waitTime += checkInterval;

                // Check for common indicators that the page content is loaded
                const indicators = [
                    // D365 specific indicators
                    document.querySelector('[data-id]'),
                    document.querySelector('.ms-crm-Form-Selector'),
                    document.querySelector('#crmContentPanel'),
                    document.querySelector('.grid-container'),

                    // SharePoint specific indicators
                    document.querySelector('[data-sp-feature-tag]'),
                    document.querySelector('.ms-CommandBar'),
                    document.querySelector('#SPPageContent'),

                    // Generic indicators
                    document.querySelector('[class*="form"]'),
                    document.querySelector('[id*="form"]'),
                    document.querySelector('main'),
                    document.querySelector('[role="main"]'),
                    document.querySelector('.content-container')
                ];

                const hasContent = indicators.some(el => el !== null);

                if (hasContent || waitTime >= maxWaitTime) {
                    console.log(`[${EXTENSION_PREFIX}] Dynamic content ready (waited ${waitTime}ms)`);
                    resolve();
                } else {
                    setTimeout(checkContent, checkInterval);
                }
            };

            checkContent();
        });
    }

    async function applyCustomizations() {
        try {
            console.log(`[${EXTENSION_PREFIX}] Loading customizations...`);

            // Get customizations from storage
            const result = await chrome.storage.local.get('customizations');
            const allCustomizations = result.customizations || [];

            if (allCustomizations.length === 0) {
                console.log(`[${EXTENSION_PREFIX}] No customizations found`);
                return;
            }

            // Filter customizations based on current page
            const applicableCustomizations = filterCustomizationsForCurrentPage(allCustomizations);

            console.log(`[${EXTENSION_PREFIX}] Found ${applicableCustomizations.length} applicable customizations`);

            // Apply each customization
            let appliedCount = 0;
            for (const customization of applicableCustomizations) {
                if (await applyCustomization(customization)) {
                    appliedCount++;
                }
            }

            console.log(`[${EXTENSION_PREFIX}] Successfully applied ${appliedCount} customizations`);

        } catch (error) {
            console.error(`[${EXTENSION_PREFIX}] Error applying customizations:`, error);
        }
    }

    function filterCustomizationsForCurrentPage(customizations) {
        const currentUrl = window.location.href;
        const currentDomain = window.location.hostname;

        return customizations.filter(customization => {
            // Check if customization is enabled
            if (!customization.enabled) {
                return false;
            }

            // Check domain matching
            if (customization.domain && !currentDomain.includes(customization.domain)) {
                return false;
            }

            // Check URL pattern matching
            if (customization.urlPattern) {
                const pattern = new RegExp(customization.urlPattern);
                if (!pattern.test(currentUrl)) {
                    return false;
                }
            }

            // Check query string matching
            if (customization.queryParams) {
                const searchParams = new window.URLSearchParams(window.location.search);
                for (const [key, value] of Object.entries(customization.queryParams)) {
                    if (searchParams.get(key) !== value) {
                        return false;
                    }
                }
            }

            // Check page type restrictions
            if (customization.pageType) {
                if (customization.pageType === 'd365' && !isD365Page) {
                    return false;
                }
                if (customization.pageType === 'sharepoint' && !isSharePointPage) {
                    return false;
                }
            }

            return true;
        });
    }

    async function applyCustomization(customization) {
        try {
            const { selector, cssRules, jsCode, name } = customization;

            // Apply CSS rules
            if (selector && cssRules) {
                applyStyleRules(customization.id, selector, cssRules);
            }

            // Apply JavaScript code (admin only)
            if (jsCode && userRole?.isAdmin) {
                applyJavaScript(customization.id, jsCode);
            }

            console.log(`[${EXTENSION_PREFIX}] Applied customization: ${name || customization.id}`);
            return true;

        } catch (error) {
            console.error(`[${EXTENSION_PREFIX}] Error applying customization:`, error);
            return false;
        }
    }

    function applyStyleRules(id, selector, cssRules) {
        const styleId = `${STYLE_PREFIX}${id}`;

        // Remove existing style if it exists
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create new style element
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.setAttribute('data-extension', EXTENSION_PREFIX);

        // Build CSS content
        let cssContent = '';
        if (typeof cssRules === 'string') {
            // Handle simple CSS string
            cssContent = `${selector} { ${cssRules} }`;
        } else if (typeof cssRules === 'object') {
            // Handle CSS rules object
            const rules = Object.entries(cssRules)
                .map(([property, value]) => `${property}: ${value}`)
                .join('; ');
            cssContent = `${selector} { ${rules} }`;
        }

        styleElement.textContent = cssContent;
        document.head.appendChild(styleElement);

        // Track applied style
        appliedStyles.set(id, {
            element: styleElement,
            selector: selector,
            rules: cssRules,
            timestamp: Date.now()
        });

        console.log(`[${EXTENSION_PREFIX}] Applied CSS for ${selector}:`, cssRules);
    }

    function applyJavaScript(id, jsCode) {
        try {
            // Only allow JavaScript execution for admin users
            if (!userRole?.isAdmin) {
                console.warn(`[${EXTENSION_PREFIX}] JavaScript execution blocked for non-admin user`);
                return;
            }

            // Execute JavaScript in a controlled manner
            const script = document.createElement('script');
            script.textContent = `
                (function() {
                    try {
                        ${jsCode}
                    } catch (error) {
                        console.error('[${EXTENSION_PREFIX}] Error in custom JavaScript:', error);
                    }
                })();
            `;
            script.setAttribute('data-extension', EXTENSION_PREFIX);
            script.setAttribute('data-customization-id', id);

            document.head.appendChild(script);

            // Remove script element after execution
            setTimeout(() => {
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
            }, 100);

            console.log(`[${EXTENSION_PREFIX}] Executed JavaScript for customization ${id}`);

        } catch (error) {
            console.error(`[${EXTENSION_PREFIX}] Error executing JavaScript:`, error);
        }
    }

    function setupNavigationWatcher() {
        // Watch for URL changes (SPA navigation)
        let lastUrl = window.location.href;

        const checkUrlChange = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log(`[${EXTENSION_PREFIX}] URL changed:`, currentUrl);
                lastUrl = currentUrl;

                // Re-detect page type
                detectPageType();

                // Wait a bit for new content to load, then reapply customizations
                setTimeout(() => {
                    applyCustomizations();
                }, 1000);
            }
        };

        // Use both popstate and a polling approach for better compatibility
        window.addEventListener('popstate', checkUrlChange);
        setInterval(checkUrlChange, 2000); // Check every 2 seconds
    }

    function setupDOMObserver() {
        // Watch for DOM mutations that might require reapplying styles
        const observer = new window.MutationObserver((mutations) => {
            let shouldReapply = false;

            mutations.forEach((mutation) => {
                // Check if significant DOM changes occurred
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if any added nodes are significant containers
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === window.Node.ELEMENT_NODE) {
                            const tagName = node.tagName?.toLowerCase();
                            if (tagName === 'div' || tagName === 'section' || tagName === 'main') {
                                // Check if this looks like a major content container
                                const hasSignificantContent = node.children.length > 3 ||
                                    node.textContent.length > 100;
                                if (hasSignificantContent) {
                                    shouldReapply = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            });

            if (shouldReapply) {
                console.log(`[${EXTENSION_PREFIX}] Significant DOM changes detected, reapplying customizations...`);
                setTimeout(() => {
                    applyCustomizations();
                }, 500); // Small delay to let DOM settle
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false
        });
    }

    function setupMessageListener() {
        // Listen for messages from popup or background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log(`[${EXTENSION_PREFIX}] Received message:`, message);

            switch (message.action) {
                case 'reapplyCustomizations':
                    applyCustomizations().then(() => {
                        sendResponse({ success: true });
                    }).catch(error => {
                        sendResponse({ success: false, error: error.message });
                    });
                    return true; // Will respond asynchronously

                case 'removeCustomization':
                    removeCustomization(message.customizationId);
                    sendResponse({ success: true });
                    break;

                case 'getUserRole':
                    sendResponse({ userRole: userRole });
                    break;

                case 'updateUserRole':
                    userRole = message.userRole;
                    console.log(`[${EXTENSION_PREFIX}] User role updated:`, userRole);
                    sendResponse({ success: true });
                    break;

                case 'getAppliedStyles': {
                    const appliedStylesData = Array.from(appliedStyles.entries()).map(([customizationId, data]) => ({
                        id: customizationId,
                        selector: data.selector,
                        rules: data.rules,
                        timestamp: data.timestamp
                    }));
                    sendResponse({ appliedStyles: appliedStylesData });
                    break;
                }

                default:
                    console.log(`[${EXTENSION_PREFIX}] Unknown message action:`, message.action);
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        });
    }

    function removeCustomization(customizationId) {
        const styleId = `${STYLE_PREFIX}${customizationId}`;
        const styleElement = document.getElementById(styleId);

        if (styleElement) {
            styleElement.remove();
            appliedStyles.delete(customizationId);
            console.log(`[${EXTENSION_PREFIX}] Removed customization: ${customizationId}`);
        }
    }

    // Cleanup function
    function cleanup() {
        // Remove all applied styles
        appliedStyles.forEach((data) => {
            if (data.element && data.element.parentNode) {
                data.element.parentNode.removeChild(data.element);
            }
        });
        appliedStyles.clear();
        console.log(`[${EXTENSION_PREFIX}] Cleaned up all customizations`);
    }

    // Clean up on page unload
    window.addEventListener('beforeunload', cleanup);

    // Expose cleanup function for debugging
    window[`${EXTENSION_PREFIX}_cleanup`] = cleanup;

    console.log(`[${EXTENSION_PREFIX}] Content script loaded successfully`);

})();