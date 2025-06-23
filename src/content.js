// Content script for DOM Style Injector extension
// This script runs on every page and automatically applies saved customizations

let isInitialized = false;
let currentUrl = window.location.href;
let customizationAppliedCount = 0;

// Initialize the content script
initializeContentScript();

function initializeContentScript() {
    console.log('DOM Style Injector: Content script initialized');

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

async function waitForDynamicContent() {
    console.log('DOM Style Injector: Waiting for dynamic content to load...');

    // Strategy 1: Wait for common indicators that the page is fully loaded
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
                document.querySelector('#content'),
                // Look for common CRM indicators
                document.querySelector('[data-control-name]'),
                document.querySelector('[data-lp-id]')
            ];

            const hasContent = indicators.some(indicator => indicator !== null);
            const bodyHasChildren = document.body.children.length > 3; // More than just basic structure

            if (hasContent && bodyHasChildren) {
                console.log(`DOM Style Injector: Dynamic content detected after ${waitTime}ms`);
                resolve();
            } else if (waitTime >= maxWaitTime) {
                console.log(`DOM Style Injector: Max wait time reached (${maxWaitTime}ms), proceeding anyway`);
                resolve();
            } else {
                console.log(`DOM Style Injector: Still waiting for content... (${waitTime}ms)`);
                setTimeout(checkContent, checkInterval);
            }
        };

        // Start checking immediately, then at intervals
        checkContent();
    });
}

function setupURLChangeDetection() {
    // Override pushState and replaceState to detect SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
        originalPushState.apply(this, args);
        handleURLChange();
    };

    history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        handleURLChange();
    };

    // Listen for popstate events (back/forward button)
    window.addEventListener('popstate', handleURLChange);

    // Listen for hashchange events
    window.addEventListener('hashchange', handleURLChange);
}

function handleURLChange() {
    const newUrl = window.location.href;
    if (newUrl !== currentUrl) {
        console.log('DOM Style Injector: URL change detected', { from: currentUrl, to: newUrl });
        currentUrl = newUrl;

        // Wait longer for SPA navigation to complete
        setTimeout(() => {
            customizationAppliedCount = 0;
            waitForDynamicContent().then(() => {
                autoApplyCustomizations();
            });
        }, 750);
    }
}

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

async function autoApplyCustomizations() {
    try {
        const currentDomain = window.location.hostname;

        // Only apply on allowed domain
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

        // Get saved customizations
        const result = await chrome.storage.local.get('customizations');
        const customizations = result.customizations || {};

        if (!customizations[currentDomain] || !customizations[currentDomain][0]) {
            console.log('DOM Style Injector: No customizations found for domain');
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

                        // Schedule a retry for missing elements
                        scheduleRetryForMissingElements(selector, styles, queryPattern);
                    }
                });
            }
        });

        customizationAppliedCount = appliedCount;
        console.log(`DOM Style Injector: Applied ${appliedCount} customizations total`);

        // Send message to popup if it's open
        try {
            chrome.runtime.sendMessage({
                action: 'customizationsApplied',
                count: appliedCount,
                url: currentUrl
            });
        } catch (error) {
            // Popup might not be open, ignore error
        }

    } catch (error) {
        console.error('DOM Style Injector: Error auto-applying customizations:', error);
    }
}

function checkQueryPatternMatch(queryPattern, currentQueryParams) {
    if (queryPattern === '') {
        return true; // Empty pattern matches all pages
    }

    const patternParams = {};
    queryPattern.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
            patternParams[key] = value;
        }
    });

    // Check if all pattern parameters match current parameters
    return Object.entries(patternParams).every(([key, value]) =>
        currentQueryParams[key] === value
    );
}

let pendingRetries = new Set();

function scheduleRetryForMissingElements(selector, styles, queryPattern) {
    const retryKey = `${selector}-${queryPattern}`;

    // Avoid duplicate retries
    if (pendingRetries.has(retryKey)) {
        return;
    }

    pendingRetries.add(retryKey);
    console.log(`DOM Style Injector: Scheduling retry for selector: ${selector}`);

    // Retry after 2 seconds, then 5 seconds, then 10 seconds
    const retryDelays = [2000, 5000, 10000];

    retryDelays.forEach((delay, index) => {
        setTimeout(() => {
            const elements = document.querySelectorAll(selector);

            if (elements.length > 0) {
                console.log(`DOM Style Injector: Retry ${index + 1} successful! Found ${elements.length} elements for: ${selector}`);

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

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'reapplyCustomizations') {
        console.log('DOM Style Injector: Manual reapply requested');
        customizationAppliedCount = 0;
        pendingRetries.clear(); // Clear any pending retries
        waitForDynamicContent().then(() => {
            autoApplyCustomizations();
        });
        sendResponse({ success: true });
    } else if (request.action === 'getStatus') {
        sendResponse({
            appliedCount: customizationAppliedCount,
            url: currentUrl,
            isInitialized: isInitialized,
            pendingRetries: pendingRetries.size
        });
    }
});

// Handle page visibility changes (tab switching, window focus)
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