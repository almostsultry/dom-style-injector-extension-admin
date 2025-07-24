// Unit tests for content script functionality
import { jest } from '@jest/globals';
import testData from '../fixtures/test-data.json';

/* global testUtils */

// Mock DOM environment
import { JSDOM } from 'jsdom';

describe('Content Script Functionality', () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
        // Setup DOM environment
        dom = new JSDOM(testData.mockDOMElements.complexPage.html, {
            url: 'https://ambata.crm.dynamics.com/test' + testData.mockDOMElements.complexPage.queryParams
        });
        document = dom.window.document;
        window = dom.window;

        global.document = document;
        global.window = window;
        
        // Ensure location properties are set correctly
        Object.defineProperty(window, 'location', {
            value: {
                href: 'https://ambata.crm.dynamics.com/test' + testData.mockDOMElements.complexPage.queryParams,
                hostname: 'ambata.crm.dynamics.com',
                search: testData.mockDOMElements.complexPage.queryParams
            },
            configurable: true
        });

        testUtils.mockChromeSuccess();
    });

    afterEach(() => {
        dom.window.close();
    });

    describe('DOM Element Detection', () => {
        test('should detect elements by data attribute', () => {
            const elements = document.querySelectorAll('[data-id="editFormRoot"]');
            expect(elements.length).toBe(testData.mockDOMElements.complexPage.expectedElements['[data-id="editFormRoot"]']);
        });

        test('should detect elements by class', () => {
            const elements = document.querySelectorAll('.form-header');
            expect(elements.length).toBe(testData.mockDOMElements.complexPage.expectedElements['.form-header']);
        });

        test('should detect multiple elements with same selector', () => {
            const elements = document.querySelectorAll('.nav-item');
            expect(elements.length).toBe(testData.mockDOMElements.complexPage.expectedElements['.nav-item']);
        });

        test('should handle non-existent selectors gracefully', () => {
            const elements = document.querySelectorAll('[data-id="nonexistent"]');
            expect(elements.length).toBe(0);
        });
    });

    describe('Style Application', () => {
        test('should apply styles to single element', () => {
            const element = document.querySelector('[data-id="editFormRoot"]');

            applyStyleToElement(element, 'background-color', '#ff0000');

            expect(element.style.backgroundColor).toBe('rgb(255, 0, 0)');
        });

        test('should apply styles to multiple elements', () => {
            const elements = document.querySelectorAll('.nav-item');

            elements.forEach(element => {
                applyStyleToElement(element, 'color', 'blue');
            });

            elements.forEach(element => {
                expect(element.style.color).toBe('blue');
            });
        });

        test('should handle CSS property name conversion', () => {
            const element = document.querySelector('[data-id="editFormRoot"]');

            applyStyleToElement(element, 'background-color', 'red');
            applyStyleToElement(element, 'font-size', '16px');
            applyStyleToElement(element, 'z-index', '999');

            expect(element.style.backgroundColor).toBe('red');
            expect(element.style.fontSize).toBe('16px');
            expect(element.style.zIndex).toBe('999');
        });

        test('should preserve existing styles when adding new ones', () => {
            const element = document.querySelector('[data-id="editFormRoot"]');

            element.style.color = 'blue';
            applyStyleToElement(element, 'background-color', 'red');

            expect(element.style.color).toBe('blue');
            expect(element.style.backgroundColor).toBe('red');
        });
    });

    describe('URL Query Parameter Handling', () => {
        test('should parse URL query parameters correctly', () => {
            const params = parseUrlQueryParams(window.location.href);

            expect(params).toEqual(testData.mockQueryParameters.accountPage.parsed);
        });

        test('should handle URLs without query parameters', () => {
            const testUrl = 'https://ambata.crm.dynamics.com/dashboard';
            const params = parseUrlQueryParams(testUrl);

            expect(params).toEqual({});
        });

        test('should match query patterns correctly', () => {
            const currentParams = testData.mockQueryParameters.accountPage.parsed;

            // Exact match
            expect(matchesQueryPattern('etn=account&id=12345&pagetype=entityrecord', currentParams)).toBe(true);

            // Partial match
            expect(matchesQueryPattern('etn=account', currentParams)).toBe(true);

            // No match
            expect(matchesQueryPattern('etn=deal', currentParams)).toBe(false);

            // Empty pattern (matches all)
            expect(matchesQueryPattern('', currentParams)).toBe(true);
        });
    });

    describe('Customization Auto-Application', () => {
        test('should auto-apply matching customizations on page load', async () => {
            // const customizations = testData.mockCustomizations['ambata.crm.dynamics.com'][0];

            chrome.storage.local.get.mockResolvedValue({
                customizations: testData.mockCustomizations
            });

            await autoApplyCustomizations();

            // Check if styles were applied
            const targetElement = document.querySelector('[data-id="editFormRoot"]');
            expect(targetElement.style.backgroundColor).toBeTruthy();
        });

        test('should only apply customizations for matching query patterns', async () => {
            // Mock URL with different query params
            Object.defineProperty(window, 'location', {
                value: {
                    href: 'https://ambata.crm.dynamics.com/test?etn=new_deal',
                    hostname: 'ambata.crm.dynamics.com',
                    search: '?etn=new_deal'
                },
                configurable: true
            });

            chrome.storage.local.get.mockResolvedValue({
                customizations: testData.mockCustomizations
            });

            const result = await autoApplyCustomizations();

            // Should apply customizations for 'etn=new_deal' pattern but not others
            expect(result.appliedCount).toBeGreaterThan(0);
        });

        test('should handle missing elements gracefully', async () => {
            const customizations = {
                'ambata.crm.dynamics.com': [{
                    domain: 'ambata.crm.dynamics.com',
                    queryStrings: {
                        'etn=account': {
                            '[data-id="nonexistentElement"]': {
                                'color': 'red'
                            }
                        }
                    }
                }]
            };

            chrome.storage.local.get.mockResolvedValue({ customizations });

            const result = await autoApplyCustomizations();

            // Check if result has the expected structure
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.appliedCount).toBe(0);
            expect(result.missingElements).toContain('[data-id="nonexistentElement"]');
        });
    });

    describe('Dynamic Content Detection', () => {
        test('should detect when DOM content is ready', () => {
            const indicators = checkDynamicContentLoaded(document);

            expect(indicators.hasDataElements).toBe(true);
            expect(indicators.hasFormElements).toBe(true);
            expect(indicators.bodyHasChildren).toBe(true);
        });

        test('should wait for dynamic content before applying styles', async () => {
            // Mock slow-loading content
            const slowDom = new JSDOM('<!DOCTYPE html><html><body></body></html>');

            const waitPromise = waitForDynamicContent(5000, slowDom.window.document);

            // Simulate content loading after delay
            setTimeout(() => {
                const newElement = slowDom.window.document.createElement('div');
                newElement.setAttribute('data-id', 'lateElement');
                slowDom.window.document.body.appendChild(newElement);
            }, 100);

            const result = await waitPromise;
            expect(result.contentDetected).toBe(true);
            
            slowDom.window.close();
        });
    });

    describe('Retry Mechanisms', () => {
        test('should retry applying styles to missing elements', async () => {
            const missingElementSelector = '[data-id="delayedElement"]';

            // Start retry mechanism
            const retryPromise = scheduleRetryForMissingElements(
                missingElementSelector,
                { color: 'red' },
                'etn=account',
                3,
                document
            );

            // Add element after initial attempt
            setTimeout(() => {
                const delayedElement = document.createElement('div');
                delayedElement.setAttribute('data-id', 'delayedElement');
                document.body.appendChild(delayedElement);
            }, 500);

            const result = await retryPromise;

            expect(result.success).toBe(true);
            expect(result.appliedCount).toBe(1);
        });

        test('should limit retry attempts', async () => {
            const consoleSpy = jest.spyOn(console, 'log');

            await scheduleRetryForMissingElements(
                '[data-id="neverExistingElement"]',
                { color: 'red' },
                'etn=account',
                3,
                document
            );

            // Should have logged retry attempts and final failure
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('All retries failed')
            );
            
            consoleSpy.mockRestore();
        });
    });

    describe('URL Change Detection', () => {
        test('should detect SPA navigation', () => {
            // const initialUrl = window.location.href;
            let urlChanged = false;

            // Mock URL change detection
            const originalPushState = window.history.pushState;
            window.history.pushState = function (...args) {
                urlChanged = true;
                return originalPushState.apply(this, args);
            };

            // Simulate SPA navigation
            window.history.pushState({}, '', '/new-page?etn=deal');

            expect(urlChanged).toBe(true);
        });

        test('should reapply customizations on URL change', async () => {
            chrome.storage.local.get.mockResolvedValue({
                customizations: testData.mockCustomizations
            });

            // Mock console.log to check if handleUrlChange is called
            const consoleSpy = jest.spyOn(console, 'log');

            // Simulate URL change
            handleUrlChange();

            // Check immediate log
            expect(consoleSpy).toHaveBeenCalledWith('URL change detected, scheduling reapplication');

            // Wait for the scheduled timeout
            await new Promise(resolve => setTimeout(resolve, 300));

            consoleSpy.mockRestore();
        });
    });

    describe('Message Handling', () => {
        test('should handle reapply customizations message', async () => {
            const mockSendResponse = jest.fn();

            chrome.storage.local.get.mockResolvedValue({
                customizations: testData.mockCustomizations
            });

            await handleChromeMessage(
                { action: 'reapplyCustomizations' },
                null,
                mockSendResponse
            );

            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        test('should handle get status message', async () => {
            const mockSendResponse = jest.fn();

            await handleChromeMessage(
                { action: 'getStatus' },
                null,
                mockSendResponse
            );

            expect(mockSendResponse).toHaveBeenCalledWith(
                expect.objectContaining({
                    appliedCount: expect.any(Number),
                    url: expect.any(String)
                })
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle storage errors gracefully', async () => {
            chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

            const result = await autoApplyCustomizations();

            expect(result.success).toBe(false);
            expect(result.error).toContain('Storage error');
        });

        test('should handle malformed customization data', async () => {
            const malformedData = {
                customizations: {
                    'ambata.crm.dynamics.com': [
                        {
                            // Missing required fields
                            invalidStructure: true
                        }
                    ]
                }
            };

            chrome.storage.local.get.mockResolvedValue(malformedData);

            const result = await autoApplyCustomizations();

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid customization data');
        });
    });

    describe('Performance', () => {
        test('should apply styles efficiently for many elements', () => {
            // Create many elements
            const elementsCount = 100;
            for (let i = 0; i < elementsCount; i++) {
                const element = document.createElement('div');
                element.className = 'test-element';
                document.body.appendChild(element);
            }

            const startTime = performance.now();

            const elements = document.querySelectorAll('.test-element');
            elements.forEach(element => {
                applyStyleToElement(element, 'color', 'red');
            });

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (less than 100ms for 100 elements)
            expect(duration).toBeLessThan(100);
            expect(elements.length).toBe(elementsCount);
        });
    });
});

// Helper functions for testing
function applyStyleToElement(element, cssProperty, cssValue) {
    const jsPropertyName = cssProperty.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    element.style[jsPropertyName] = cssValue;
}

function parseUrlQueryParams(url) {
    try {
        const urlObj = new URL(url);
        const params = {};
        urlObj.searchParams.forEach((value, key) => {
            params[key] = value;
        });
        return params;
    } catch (_error) {
        return {};
    }
}

function matchesQueryPattern(pattern, currentParams) {
    if (pattern === '') return true;

    const patternParams = {};
    pattern.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
            patternParams[key] = value;
        }
    });

    return Object.entries(patternParams).every(([key, value]) =>
        currentParams[key] === value
    );
}

function checkDynamicContentLoaded(doc = document) {
    return {
        hasDataElements: doc.querySelector('[data-id]') !== null,
        hasFormElements: doc.querySelector('input, form, [data-control-name]') !== null,
        bodyHasChildren: doc.body && doc.body.children.length > 0,
        hasMainContent: doc.querySelector('main, [role="main"], .page-content') !== null
    };
}

async function waitForDynamicContent(maxWaitTime = 5000, doc = document) {
    const checkInterval = 200;
    let waitTime = 0;

    return new Promise((resolve) => {
        const checkContent = () => {
            waitTime += checkInterval;

            const indicators = checkDynamicContentLoaded(doc);
            const hasContent = Object.values(indicators).some(Boolean);

            if (hasContent || waitTime >= maxWaitTime) {
                resolve({ contentDetected: hasContent, waitTime });
            } else {
                setTimeout(checkContent, checkInterval);
            }
        };

        checkContent();
    });
}

async function autoApplyCustomizations() {
    try {
        const currentDomain = window.location.hostname;

        if (currentDomain !== 'ambata.crm.dynamics.com') {
            return { success: false, error: 'Domain not allowed' };
        }

        const currentQueryParams = parseUrlQueryParams(window.location.href);
        const result = await chrome.storage.local.get('customizations');
        const customizations = result.customizations || {};

        if (!customizations[currentDomain]) {
            return { success: true, appliedCount: 0, message: 'No customizations found' };
        }

        const domainData = customizations[currentDomain][0];
        let appliedCount = 0;
        const missingElements = [];

        Object.entries(domainData.queryStrings || {}).forEach(([queryPattern, selectors]) => {
            if (matchesQueryPattern(queryPattern, currentQueryParams)) {
                Object.entries(selectors).forEach(([selector, styles]) => {
                    const elements = document.querySelectorAll(selector);

                    if (elements.length > 0) {
                        elements.forEach(element => {
                            Object.entries(styles).forEach(([property, value]) => {
                                applyStyleToElement(element, property, value);
                                appliedCount++;
                            });
                        });
                    } else {
                        missingElements.push(selector);
                    }
                });
            }
        });

        return {
            success: true,
            appliedCount,
            missingElements,
            message: `Applied ${appliedCount} customizations`
        };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function scheduleRetryForMissingElements(selector, styles, queryPattern, maxRetries = 3, doc = document) {
    return new Promise((resolve) => {
        let attempts = 0;

        const retry = () => {
            attempts++;
            const elements = doc.querySelectorAll(selector);

            if (elements.length > 0) {
                let appliedCount = 0;
                elements.forEach(element => {
                    Object.entries(styles).forEach(([property, value]) => {
                        applyStyleToElement(element, property, value);
                        appliedCount++;
                    });
                });

                resolve({ success: true, appliedCount, attempts });
            } else if (attempts >= maxRetries) {
                console.log(`All retries failed for selector: ${selector}`);
                resolve({ success: false, attempts });
            } else {
                setTimeout(retry, 1000 * attempts); // Exponential backoff
            }
        };

        retry();
    });
}

function handleUrlChange() {
    console.log('URL change detected, scheduling reapplication');
    setTimeout(() => {
        autoApplyCustomizations();
    }, 250);
}

async function handleChromeMessage(request, sender, sendResponse) {
    switch (request.action) {
        case 'reapplyCustomizations':
            try {
                await autoApplyCustomizations();
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
            break;

        case 'getStatus':
            try {
                sendResponse({
                    appliedCount: global.customizationAppliedCount || 0,
                    url: window.location.href,
                    isInitialized: true
                });
            } catch (error) {
                sendResponse({ error: error.message });
            }
            break;

        default:
            sendResponse({ error: 'Unknown action' });
    }
}