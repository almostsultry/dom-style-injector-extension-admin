// user-version/content.js
(function() {
    'use strict';

    // Constants
    const STYLE_ID_PREFIX = 'dom-style-injector-';
    const RETRY_DELAY = 500;
    const MAX_RETRIES = 10;
    const OBSERVER_TIMEOUT = 30000; // 30 seconds

    // State
    let customizations = [];
    let appliedStyles = new Map();
    let observers = new Map();
    let retryTimers = new Map();

    // Initialize
    init();

    async function init() {
        try {
            // Load customizations from storage
            await loadCustomizations();
            
            // Apply initial styles
            applyAllCustomizations();
            
            // Set up listeners
            setupListeners();
            
            // Start observing for dynamic content
            startGlobalObserver();
        } catch (error) {
            console.error('[DOM Style Injector] Initialization error:', error);
        }
    }

    async function loadCustomizations() {
        try {
            const result = await chrome.storage.local.get('customizations');
            customizations = result.customizations || [];
            console.log('[DOM Style Injector] Loaded customizations:', customizations.length);
        } catch (error) {
            console.error('[DOM Style Injector] Error loading customizations:', error);
            customizations = [];
        }
    }

    function setupListeners() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'toggleCustomization':
                    handleToggleCustomization(message.customizationId, message.isActive);
                    break;
                case 'reloadCustomizations':
                    reloadAndApplyCustomizations();
                    break;
            }
            return true;
        });

        // Listen for storage changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.customizations) {
                customizations = changes.customizations.newValue || [];
                reapplyAllStyles();
            }
        });
    }

    function applyAllCustomizations() {
        const currentDomain = window.location.hostname;
        
        customizations.forEach(customization => {
            if (customization.isActive && isDomainMatch(currentDomain, customization.domain)) {
                applyCustomization(customization);
            }
        });
    }

    function isDomainMatch(currentDomain, pattern) {
        // Convert wildcard pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(currentDomain);
    }

    function applyCustomization(customization, retryCount = 0) {
        const elements = document.querySelectorAll(customization.targetElement);
        
        if (elements.length > 0) {
            // Elements found, apply style
            const styleId = STYLE_ID_PREFIX + customization.id;
            let styleElement = document.getElementById(styleId);
            
            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = styleId;
                styleElement.setAttribute('data-injector', 'user');
                document.head.appendChild(styleElement);
            }
            
            // Generate CSS rule
            const cssRule = `${customization.targetElement} { ${customization.cssProperty}: ${customization.cssValue} !important; }`;
            styleElement.textContent = cssRule;
            
            appliedStyles.set(customization.id, styleElement);
            console.log(`[DOM Style Injector] Applied customization: ${customization.name} to ${elements.length} elements`);
            
            // Clear any retry timer
            if (retryTimers.has(customization.id)) {
                clearTimeout(retryTimers.get(customization.id));
                retryTimers.delete(customization.id);
            }
            
            // Start observing these elements for changes
            elements.forEach(element => {
                observeElement(element, customization);
            });
        } else if (retryCount < MAX_RETRIES) {
            // Elements not found, retry later
            console.log(`[DOM Style Injector] Elements not found for ${customization.name}, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
            
            const timerId = setTimeout(() => {
                applyCustomization(customization, retryCount + 1);
            }, RETRY_DELAY * (retryCount + 1));
            
            retryTimers.set(customization.id, timerId);
        } else {
            console.warn(`[DOM Style Injector] Failed to find elements for customization: ${customization.name}`);
        }
    }

    function removeCustomization(customizationId) {
        const styleElement = appliedStyles.get(customizationId);
        if (styleElement) {
            styleElement.remove();
            appliedStyles.delete(customizationId);
        }
        
        // Clear retry timer if exists
        if (retryTimers.has(customizationId)) {
            clearTimeout(retryTimers.get(customizationId));
            retryTimers.delete(customizationId);
        }
        
        // Stop observing
        if (observers.has(customizationId)) {
            observers.get(customizationId).disconnect();
            observers.delete(customizationId);
        }
    }

    function handleToggleCustomization(customizationId, isActive) {
        const customization = customizations.find(c => c.id === customizationId);
        if (!customization) return;
        
        customization.isActive = isActive;
        
        if (isActive && isDomainMatch(window.location.hostname, customization.domain)) {
            applyCustomization(customization);
        } else {
            removeCustomization(customizationId);
        }
    }

    async function reloadAndApplyCustomizations() {
        await loadCustomizations();
        reapplyAllStyles();
    }

    function reapplyAllStyles() {
        // Remove all existing styles
        appliedStyles.forEach((styleElement, id) => {
            removeCustomization(id);
        });
        
        // Reapply all active customizations
        applyAllCustomizations();
    }

    function startGlobalObserver() {
        // Create a mutation observer to watch for DOM changes
        const observer = new MutationObserver(mutations => {
            // Debounce to avoid excessive processing
            clearTimeout(observer.debounceTimer);
            observer.debounceTimer = setTimeout(() => {
                handleDOMChanges(mutations);
            }, 100);
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'id', 'data-id', 'data-type']
        });
        
        // Store reference
        observers.set('global', observer);
        
        // Clean up after timeout
        setTimeout(() => {
            if (observers.has('global')) {
                console.log('[DOM Style Injector] Stopping global observer after timeout');
                observers.get('global').disconnect();
                observers.delete('global');
            }
        }, OBSERVER_TIMEOUT);
    }

    function handleDOMChanges(mutations) {
        const currentDomain = window.location.hostname;
        let shouldReapply = false;
        
        // Check if any mutations affect our targeted elements
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldReapply = true;
                break;
            }
        }
        
        if (shouldReapply) {
            // Check each customization to see if it should be applied
            customizations.forEach(customization => {
                if (customization.isActive && 
                    isDomainMatch(currentDomain, customization.domain) &&
                    !appliedStyles.has(customization.id)) {
                    applyCustomization(customization);
                }
            });
        }
    }

    function observeElement(element, customization) {
        // Create observer for specific element
        const observer = new MutationObserver(mutations => {
            // Check if the element still matches the selector
            if (!element.matches(customization.targetElement)) {
                console.log(`[DOM Style Injector] Element no longer matches selector for ${customization.name}`);
                removeCustomization(customization.id);
                // Try to reapply to find new matching elements
                applyCustomization(customization);
            }
        });
        
        // Observe attribute changes
        observer.observe(element, {
            attributes: true,
            attributeFilter: ['class', 'id', 'data-id', 'data-type']
        });
        
        // Store observer reference
        if (!observers.has(customization.id)) {
            observers.set(customization.id, observer);
        }
    }

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // Page became visible, recheck customizations
            reapplyAllStyles();
        }
    });

    // Handle navigation (for SPAs)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('[DOM Style Injector] URL changed, reapplying customizations');
            setTimeout(() => {
                reapplyAllStyles();
                startGlobalObserver();
            }, 500);
        }
    }).observe(document, { subtree: true, childList: true });

    // Log initialization complete
    console.log('[DOM Style Injector] User version content script initialized');
})();