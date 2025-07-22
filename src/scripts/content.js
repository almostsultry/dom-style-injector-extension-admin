// src/scripts/content.js - Complete enhanced version with pseudo-class support
// Preserves ALL existing functionality while adding pseudo-class capabilities

(function () {
    'use strict';

    // ==================== EXISTING FUNCTIONALITY ====================
    let isInitialized = false;
    let currentUrl = window.location.href;
    let customizationAppliedCount = 0;
    const pendingRetries = new Map(); // Track pending retries
    const retryDelays = [1000, 2000, 4000, 8000]; // Exponential backoff delays

    // ==================== NEW PSEUDO-CLASS FUNCTIONALITY ====================
    // Unique prefix for injected styles
    const STYLE_PREFIX = 'd365-style-injector-';
    const appliedStyles = new Map(); // Track base styles
    const pseudoClassStyles = new Map(); // Track pseudo-class styles separately

    // Supported pseudo-classes and pseudo-elements
    const SUPPORTED_PSEUDO_CLASSES = [
        'hover', 'active', 'focus', 'focus-within', 'focus-visible',
        'target', 'valid', 'invalid', 'read-write', 'read-only',
        'checked', 'disabled', 'enabled', 'required', 'optional',
        'visited', 'link', 'first-child', 'last-child', 'nth-child',
        'first-of-type', 'last-of-type', 'nth-of-type', 'only-child',
        'only-of-type', 'empty', 'not', 'before', 'after'
    ];

    // ==================== INITIALIZATION ====================
    // Initialize the content script
    initializeContentScript();

    function initializeContentScript() {
        console.log('DOM Style Injector: Content script initialized with pseudo-class support');

        // Apply customizations when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', handleDOMReady);
        } else {
            handleDOMReady();
        }

        // Watch for URL changes (SPA navigation)
        setupURLChangeDetection();

        // Watch for DOM mutations that might indicate page refresh/reload
        setupDOMObserver();

        // Handle page visibility changes (tab switching, window focus)
        setupVisibilityHandling();

        // Listen for messages from the popup
        setupMessageHandling();

        isInitialized = true;
    }

    function handleDOMReady() {
        console.log('DOM Style Injector: DOM Content Loaded detected');
        customizationAppliedCount = 0;

        // Wait for dynamic content to load before applying customizations
        waitForDynamicContent().then(() => {
            autoApplyCustomizations();
        });
    }

    // ==================== DYNAMIC CONTENT WAITING ====================
    async function waitForDynamicContent() {
        console.log('DOM Style Injector: Waiting for dynamic content to load...');

        const maxWaitTime = 10000; // 10 seconds max wait
        const checkInterval = 500; // Check every 500ms
        let waitTime = 0;

        return new Promise((resolve) => {
            const checkContent = () => {
                waitTime += checkInterval;

                // Check for common indicators that the page content is loaded
                const indicators = [
                    // Look for form elements that are commonly loaded dynamically
                    document.querySelector('[data-id]'),
                    document.querySelector('[class*="form"]'),
                    document.querySelector('[id*="form"]'),
                    // Look for any content areas
                    document.querySelector('main'),
                    document.querySelector('[role="main"]'),
                    document.querySelector('.page-content'),
                    // Look for common D365 UI elements
                    document.querySelector('[data-control-name]'),
                    document.querySelector('.ms-CommandBar'),
                    document.querySelector('[data-automation-id]')
                ];

                const hasContent = indicators.some(element => element !== null);

                if (hasContent || waitTime >= maxWaitTime) {
                    console.log(`DOM Style Injector: Dynamic content check completed after ${waitTime}ms`);
                    resolve({ contentDetected: hasContent, waitTime });
                } else {
                    setTimeout(checkContent, checkInterval);
                }
            };

            checkContent();
        });
    }

    // ==================== URL CHANGE DETECTION ====================
    function setupURLChangeDetection() {
        let lastUrl = window.location.href;

        // Listen for history changes
        window.addEventListener('popstate', handleURLChange);

        // Override pushState and replaceState to catch programmatic navigation
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function (...args) {
            originalPushState.apply(history, args);
            handleURLChange();
        };

        history.replaceState = function (...args) {
            originalReplaceState.apply(history, args);
            handleURLChange();
        };

        // Fallback: periodically check for URL changes
        setInterval(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                handleURLChange();
            }
        }, 1000);
    }

    function handleURLChange() {
        if (currentUrl !== window.location.href) {
            console.log('DOM Style Injector: URL change detected');
            currentUrl = window.location.href;

            // Clear applied count and retry pending items
            customizationAppliedCount = 0;
            pendingRetries.clear();

            // Delay to allow page to render
            setTimeout(() => {
                waitForDynamicContent().then(() => {
                    autoApplyCustomizations();
                });
            }, 750);
        }
    }

    // ==================== DOM OBSERVER ====================
    function setupDOMObserver() {
        // Watch for significant DOM changes that might indicate a page refresh
        const observer = new MutationObserver((mutations) => {
            let significantChange = false;

            mutations.forEach((mutation) => {
                // Check for added nodes that might indicate a page refresh
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        // Look for significant structural changes
                        if (node.nodeType === Node.ELEMENT_NODE &&
                            (node.tagName === 'MAIN' || node.tagName === 'SECTION' ||
                                node.classList?.contains('page') || node.classList?.contains('content'))) {
                            significantChange = true;
                        }
                    });
                }
            });

            if (significantChange) {
                console.log('DOM Style Injector: Significant DOM change detected');
                // Delay to ensure DOM is stable, then wait for content
                setTimeout(() => {
                    customizationAppliedCount = 0;
                    waitForDynamicContent().then(() => {
                        autoApplyCustomizations();
                    });
                }, 1000);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ==================== VISIBILITY HANDLING ====================
    function setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Page became visible, check if we need to reapply customizations
                setTimeout(() => {
                    if (customizationAppliedCount === 0) {
                        console.log('DOM Style Injector: Page visible, reapplying customizations');
                        waitForDynamicContent().then(() => {
                            autoApplyCustomizations();
                        });
                    }
                }, 100);
            }
        });
    }

    // ==================== MESSAGE HANDLING ====================
    function setupMessageHandling() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('DOM Style Injector: Received message:', request.action);

            switch (request.action) {
                case 'reapplyCustomizations':
                    console.log('DOM Style Injector: Manual reapply requested');
                    customizationAppliedCount = 0;
                    pendingRetries.clear();
                    waitForDynamicContent().then(() => {
                        autoApplyCustomizations();
                    });
                    sendResponse({ success: true });
                    break;

                case 'getStatus':
                    sendResponse({
                        appliedCount: customizationAppliedCount,
                        url: currentUrl,
                        isInitialized: isInitialized,
                        pendingRetries: pendingRetries.size
                    });
                    break;

                case 'updateCustomization':
                    if (request.customization) {
                        if (request.customization.enabled) {
                            applyNewFormatCustomization(request.customization);
                        } else {
                            removeNewFormatCustomization(request.customization.id);
                        }
                    }
                    sendResponse({ success: true });
                    break;

                case 'testSelector':
                    try {
                        const elements = document.querySelectorAll(request.selector);
                        sendResponse({
                            success: true,
                            count: elements.length,
                            message: `Found ${elements.length} elements`
                        });
                    } catch (error) {
                        sendResponse({
                            success: false,
                            message: `Invalid selector: ${error.message}`
                        });
                    }
                    break;

                case 'testPseudoClass':
                    sendResponse(testPseudoClassSupport(request.selector, request.pseudoClass));
                    break;

                case 'ping':
                    sendResponse({
                        status: 'active',
                        features: ['base-styles', 'pseudo-classes', 'legacy-support'],
                        supportedPseudoClasses: SUPPORTED_PSEUDO_CLASSES
                    });
                    break;
                
                case 'previewCustomization':
                    try {
                        const previewResult = applyPreviewCustomization(request.customization);
                        sendResponse({ success: true, ...previewResult });
                    } catch (error) {
                        sendResponse({ success: false, message: error.message });
                    }
                    break;
                
                case 'stopPreview':
                    try {
                        removePreviewCustomization(request.customizationId);
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, message: error.message });
                    }
                    break;

                default:
                    sendResponse({ success: false, message: 'Unknown action' });
            }
        });
    }

    // ==================== MAIN CUSTOMIZATION APPLICATION ====================
    async function autoApplyCustomizations() {
        try {
            const currentDomain = window.location.hostname;

            // Only apply on allowed domain (preserving existing logic)
            if (currentDomain !== 'ambata.crm.dynamics.com') {
                return;
            }

            console.log('DOM Style Injector: Applying customizations for', currentDomain);

            // Get current query parameters
            const currentQueryParams = {};
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.forEach((value, key) => {
                currentQueryParams[key] = value;
            });

            // Get saved customizations (legacy format)
            const result = await chrome.storage.local.get('customizations');
            const customizations = result.customizations || {};

            // Apply legacy format customizations
            await applyLegacyCustomizations(customizations, currentDomain, currentQueryParams);

            // Also check for new format customizations
            await applyNewFormatCustomizations();

            // Send update to popup
            try {
                chrome.runtime.sendMessage({
                    action: 'customizationsApplied',
                    count: customizationAppliedCount,
                    url: currentUrl,
                    isRetry: false
                });
            } catch (error) {
                // Popup might not be open, ignore error
            }

        } catch (error) {
            console.error('DOM Style Injector: Error applying customizations:', error);
        }
    }

    // ==================== LEGACY FORMAT SUPPORT ====================
    async function applyLegacyCustomizations(customizations, currentDomain, currentQueryParams) {
        if (!customizations[currentDomain] || !customizations[currentDomain][0]) {
            console.log('DOM Style Injector: No legacy customizations found for domain');
            return;
        }

        const domainData = customizations[currentDomain][0];
        const queryStrings = domainData.queryStrings;

        let appliedCount = 0;

        // Apply matching customizations
        Object.entries(queryStrings).forEach(([queryPattern, selectors]) => {
            const shouldApply = checkQueryPatternMatch(queryPattern, currentQueryParams);

            if (shouldApply) {
                console.log('DOM Style Injector: Applying customizations for pattern:', queryPattern || 'all pages');

                Object.entries(selectors).forEach(([selector, styles]) => {
                    const elements = document.querySelectorAll(selector);

                    if (elements.length > 0) {
                        console.log(`DOM Style Injector: Found ${elements.length} elements for selector: ${selector}`);

                        elements.forEach((element, index) => {
                            Object.entries(styles).forEach(([property, value]) => {
                                const jsPropertyName = property.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
                                element.style[jsPropertyName] = value;
                                appliedCount++;

                                console.log(`DOM Style Injector: Applied ${property}: ${value} to element ${index + 1}/${elements.length}`);
                            });
                        });
                    } else {
                        console.log(`DOM Style Injector: No elements found for selector: ${selector} (will retry later if needed)`);

                        // Schedule retry for missing elements
                        scheduleRetryForMissingElements(selector, styles, queryPattern, currentQueryParams);
                    }
                });
            }
        });

        customizationAppliedCount += appliedCount;
        console.log(`DOM Style Injector: Applied ${appliedCount} legacy customizations total`);
    }

    // ==================== NEW FORMAT SUPPORT ====================
    async function applyNewFormatCustomizations() {
        try {
            const { customizations = [] } = await chrome.storage.local.get('customizations');

            // Filter for new format customizations (array format)
            if (Array.isArray(customizations)) {
                customizations.forEach(customization => {
                    if (customization.enabled) {
                        applyNewFormatCustomization(customization);
                    }
                });
            }
        } catch (error) {
            console.error('DOM Style Injector: Error applying new format customizations:', error);
        }
    }

    // ==================== ENHANCED CUSTOMIZATION APPLICATION ====================
    function applyNewFormatCustomization(customization) {
        try {
            const { id, selector, css, pseudoClasses } = customization;

            if (!selector) {
                console.warn('DOM Style Injector: Invalid customization - no selector:', customization);
                return;
            }

            // Apply base styles
            if (css) {
                applyBaseStyle(customization);
            }

            // Apply pseudo-class styles if present
            if (pseudoClasses && Object.keys(pseudoClasses).length > 0) {
                applyPseudoClassStyles(customization);
            }

        } catch (error) {
            console.error('DOM Style Injector: Error applying new format customization:', error);
        }
    }

    // Apply base style (new format)
    function applyBaseStyle(customization) {
        const { id, selector, css } = customization;
        const styleId = `${STYLE_PREFIX}${id}`;

        // Remove existing style if present
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create style element
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = `${selector} { ${css} }`;

        // Add to document head
        document.head.appendChild(styleEl);
        appliedStyles.set(id, styleEl);

        console.log(`DOM Style Injector: Applied base style: ${customization.name || id}`);
    }

    // Apply pseudo-class styles
    function applyPseudoClassStyles(customization) {
        const { id, selector, pseudoClasses } = customization;
        const pseudoStyleId = `${STYLE_PREFIX}${id}-pseudo`;

        // Remove existing pseudo-class styles if present
        const existingPseudoStyle = document.getElementById(pseudoStyleId);
        if (existingPseudoStyle) {
            existingPseudoStyle.remove();
        }

        // Build CSS for all pseudo-classes
        const pseudoCssRules = [];

        Object.entries(pseudoClasses).forEach(([pseudoClass, styles]) => {
            if (SUPPORTED_PSEUDO_CLASSES.includes(pseudoClass)) {
                const pseudoSelector = `${selector}:${pseudoClass}`;
                const cssProperties = Object.entries(styles)
                    .map(([property, value]) => `${property}: ${value}`)
                    .join('; ');

                pseudoCssRules.push(`${pseudoSelector} { ${cssProperties} }`);
            }
        });

        if (pseudoCssRules.length > 0) {
            // Create style element for pseudo-classes
            const pseudoStyleEl = document.createElement('style');
            pseudoStyleEl.id = pseudoStyleId;
            pseudoStyleEl.textContent = pseudoCssRules.join('\n');

            // Add to document head
            document.head.appendChild(pseudoStyleEl);
            pseudoClassStyles.set(id, pseudoStyleEl);

            console.log(`DOM Style Injector: Applied ${pseudoCssRules.length} pseudo-class styles for: ${customization.name || id}`);
        }
    }

    // Remove new format customization
    function removeNewFormatCustomization(customizationId) {
        // Remove base style
        const styleEl = appliedStyles.get(customizationId);
        if (styleEl) {
            styleEl.remove();
            appliedStyles.delete(customizationId);
        }

        // Remove pseudo-class styles
        const pseudoStyleEl = pseudoClassStyles.get(customizationId);
        if (pseudoStyleEl) {
            pseudoStyleEl.remove();
            pseudoClassStyles.delete(customizationId);
        }

        console.log(`DOM Style Injector: Removed customization: ${customizationId}`);
    }

    // ==================== UTILITY FUNCTIONS ====================
    function checkQueryPatternMatch(queryPattern, currentQueryParams) {
        // Empty pattern matches all pages
        if (!queryPattern) {
            return true;
        }

        // Parse pattern into individual parameter matches
        const patternParams = {};
        const pairs = queryPattern.split('&');

        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value) {
                patternParams[key] = value;
            }
        });

        // Check if current params match the pattern
        return Object.entries(patternParams).every(([key, value]) => {
            const currentValue = currentQueryParams[key];

            // Support wildcards
            if (value === '*') {
                return currentValue !== undefined;
            }

            return currentValue === value;
        });
    }

    function scheduleRetryForMissingElements(selector, styles, queryPattern, currentQueryParams) {
        const retryKey = `${selector}-${queryPattern}`;

        // Avoid duplicate retries
        if (pendingRetries.has(retryKey)) {
            return;
        }

        pendingRetries.set(retryKey, true);

        retryDelays.forEach((delay, index) => {
            setTimeout(() => {
                const elements = document.querySelectorAll(selector);

                if (elements.length > 0) {
                    console.log(`DOM Style Injector: Retry ${index + 1} found ${elements.length} elements for: ${selector}`);

                    let appliedCount = 0;
                    elements.forEach((element, elementIndex) => {
                        Object.entries(styles).forEach(([property, value]) => {
                            const jsPropertyName = property.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
                            element.style[jsPropertyName] = value;
                            appliedCount++;

                            console.log(`DOM Style Injector: Retry applied ${property}: ${value} to element ${elementIndex + 1}/${elements.length}`);
                        });
                    });

                    // Remove from pending retries since we succeeded
                    pendingRetries.delete(retryKey);

                    // Update global count
                    customizationAppliedCount += appliedCount;

                    // Send update to popup
                    try {
                        chrome.runtime.sendMessage({
                            action: 'customizationsApplied',
                            count: customizationAppliedCount,
                            url: currentUrl,
                            isRetry: true,
                            retryAttempt: index + 1
                        });
                    } catch (error) {
                        // Popup might not be open, ignore error
                    }
                } else if (index === retryDelays.length - 1) {
                    // Final retry failed, remove from pending
                    console.log(`DOM Style Injector: All retries failed for selector: ${selector}`);
                    pendingRetries.delete(retryKey);
                }
            }, delay);
        });
    }

    // ==================== PSEUDO-CLASS TESTING ====================
    function testPseudoClassSupport(selector, pseudoClass) {
        try {
            const elements = document.querySelectorAll(selector);
            const testStyleId = `${STYLE_PREFIX}test-${Date.now()}`;

            // Create test style
            const testStyle = document.createElement('style');
            testStyle.id = testStyleId;
            testStyle.textContent = `${selector}:${pseudoClass} { border: 2px solid red !important; }`;

            document.head.appendChild(testStyle);

            // Remove test style after a short delay
            setTimeout(() => {
                const testEl = document.getElementById(testStyleId);
                if (testEl) testEl.remove();
            }, 3000);

            return {
                success: true,
                elementsFound: elements.length,
                message: `Test applied to ${elements.length} elements with ${pseudoClass} pseudo-class`
            };
        } catch (error) {
            return {
                success: false,
                message: `Error testing pseudo-class: ${error.message}`
            };
        }
    }

    // ==================== UTILITY FUNCTIONS ====================
    function isValidPseudoClass(pseudoClass) {
        return SUPPORTED_PSEUDO_CLASSES.includes(pseudoClass);
    }

    function parsePseudoClassSelector(selector) {
        const pseudoClassRegex = /:([a-z-]+)(?:\(([^)]*)\))?/g;
        const matches = [];
        let match;

        while ((match = pseudoClassRegex.exec(selector)) !== null) {
            matches.push({
                pseudoClass: match[1],
                parameter: match[2] || null,
                isSupported: isValidPseudoClass(match[1])
            });
        }

        return matches;
    }

    function parseCSSProperties(cssText) {
        const properties = {};
        const declarations = cssText.split(';');

        declarations.forEach(declaration => {
            const [property, value] = declaration.split(':').map(s => s.trim());
            if (property && value) {
                properties[property] = value;
            }
        });

        return properties;
    }

    // ==================== PREVIEW FUNCTIONALITY ====================
    const previewStyles = new Map(); // Track preview styles separately
    
    function applyPreviewCustomization(customization) {
        try {
            const elements = document.querySelectorAll(customization.selector);
            
            if (elements.length === 0) {
                return { 
                    elementsFound: 0, 
                    message: 'No elements found matching the selector' 
                };
            }
            
            // Create preview style element with visual indicator
            const styleId = STYLE_PREFIX + customization.id;
            const existingStyle = document.getElementById(styleId);
            
            if (existingStyle) {
                existingStyle.remove();
            }
            
            const styleEl = document.createElement('style');
            styleEl.id = styleId;
            styleEl.dataset.preview = 'true';
            
            // Build CSS with preview indicator
            let cssContent = '';
            
            // Add base styles with preview indicator (dashed outline)
            if (customization.css) {
                cssContent += `${customization.selector} {
                    ${customization.css}
                    outline: 2px dashed #ff6b6b !important;
                    outline-offset: 2px !important;
                }\n`;
            }
            
            // Add pseudo-class styles
            if (customization.pseudoClasses) {
                Object.entries(customization.pseudoClasses).forEach(([pseudoClass, config]) => {
                    if (config.enabled && config.css) {
                        cssContent += `${customization.selector}:${pseudoClass} {
                            ${config.css}
                        }\n`;
                    }
                });
            }
            
            styleEl.textContent = cssContent;
            document.head.appendChild(styleEl);
            
            // Track preview style
            previewStyles.set(customization.id, {
                styleElement: styleEl,
                customization: customization,
                timestamp: Date.now()
            });
            
            // Add visual feedback to matched elements
            elements.forEach(el => {
                el.dataset.domInjectorPreview = customization.id;
            });
            
            return {
                elementsFound: elements.length,
                message: `Preview applied to ${elements.length} element(s)`
            };
            
        } catch (error) {
            console.error('Preview application error:', error);
            throw error;
        }
    }
    
    function removePreviewCustomization(customizationId) {
        const preview = previewStyles.get(customizationId);
        
        if (preview) {
            // Remove style element
            if (preview.styleElement && preview.styleElement.parentNode) {
                preview.styleElement.remove();
            }
            
            // Remove data attributes from elements
            const elements = document.querySelectorAll(`[data-dom-injector-preview="${customizationId}"]`);
            elements.forEach(el => {
                delete el.dataset.domInjectorPreview;
            });
            
            // Remove from tracking
            previewStyles.delete(customizationId);
            
            console.log(`Preview removed: ${customizationId}`);
        }
    }
    
    // Note: Previews persist until manually stopped by the user

    // ==================== DEBUGGING AND UTILITIES ====================
    // Expose utilities for testing/debugging
    window.d365StyleInjector = {
        // Legacy debugging functions
        getStatus: () => ({
            appliedCount: customizationAppliedCount,
            url: currentUrl,
            isInitialized: isInitialized,
            pendingRetries: pendingRetries.size
        }),

        // New pseudo-class debugging functions
        getSupportedPseudoClasses: () => SUPPORTED_PSEUDO_CLASSES,
        testPseudoClass: testPseudoClassSupport,
        reapplyStyles: autoApplyCustomizations,
        getAppliedStyles: () => ({
            legacyStyles: customizationAppliedCount,
            baseStyles: appliedStyles.size,
            pseudoClassStyles: pseudoClassStyles.size,
            totalNewStyles: appliedStyles.size + pseudoClassStyles.size
        }),

        // Enhanced debugging
        getPseudoClassRules: () => Array.from(pseudoClassStyles.entries()),
        validatePseudoClass: isValidPseudoClass,
        parsePseudoSelector: parsePseudoClassSelector,

        // Legacy support
        clearRetries: () => pendingRetries.clear(),
        forceReapply: () => {
            customizationAppliedCount = 0;
            pendingRetries.clear();
            autoApplyCustomizations();
        }
    };

})();