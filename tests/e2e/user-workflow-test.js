// tests/e2e/user-workflow.test.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

describe('D365 DOM Style Injector - User Workflow Tests', () => {
    let browser;
    let page;
    let extensionId;

    // Extension paths
    const userExtensionPath = path.join(__dirname, '../../dist/user');
    const testD365Url = process.env.TEST_D365_URL || 'https://test.dynamics.com';

    beforeAll(async () => {
        // Launch browser with extension loaded
        browser = await puppeteer.launch({
            headless: process.env.CI === 'true', // Headless in CI
            args: [
                `--disable-extensions-except=${userExtensionPath}`,
                `--load-extension=${userExtensionPath}`,
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        // Get extension ID
        const extensionTarget = await browser.waitForTarget(
            target => target.type() === 'service_worker'
        );
        const extensionUrl = extensionTarget.url();
        [, , extensionId] = extensionUrl.split('/');

        page = await browser.newPage();
    }, 30000);

    afterAll(async () => {
        await browser.close();
    });

    beforeEach(async () => {
        await page.goto('about:blank');
    });

    describe('Extension Loading', () => {
        test('should load extension successfully', async () => {
            const extensionPopup = `chrome-extension://${extensionId}/popup.html`;
            await page.goto(extensionPopup);

            // Check if popup loads
            const title = await page.title();
            expect(title).toBe('DOM Style Injector - User');

            // Check for main UI elements
            const syncButton = await page.$('#sync-button');
            expect(syncButton).toBeTruthy();
        });

        test('should display read-only interface', async () => {
            const extensionPopup = `chrome-extension://${extensionId}/popup.html`;
            await page.goto(extensionPopup);

            // Check that create/edit buttons are not present
            const createButton = await page.$('#create-customization');
            const editButtons = await page.$$('.edit-button');

            expect(createButton).toBeFalsy();
            expect(editButtons.length).toBe(0);
        });
    });

    describe('Synchronization', () => {
        test('should sync customizations from SharePoint', async () => {
            const extensionPopup = `chrome-extension://${extensionId}/popup.html`;
            await page.goto(extensionPopup);

            // Mock successful sync response
            await page.evaluateOnNewDocument(() => {
                window.chrome = {
                    storage: {
                        local: {
                            get: (keys, callback) => callback({ customizations: [] }),
                            set: (items, callback) => callback && callback()
                        },
                        sync: {
                            get: (keys, callback) => callback({ lastSync: null }),
                            set: (items, callback) => callback && callback()
                        }
                    },
                    runtime: {
                        sendMessage: (message, callback) => {
                            if (message.action === 'sync') {
                                callback({
                                    success: true,
                                    customizations: [
                                        {
                                            id: 'test-1',
                                            name: 'Test Customization',
                                            domain: '*.dynamics.com',
                                            targetElement: '[data-id="form-header"]',
                                            cssProperty: 'background-color',
                                            cssValue: '#f0f0f0',
                                            isActive: true,
                                            publishedAt: new Date().toISOString(),
                                            publishedBy: 'admin@company.com'
                                        }
                                    ]
                                });
                            }
                        }
                    }
                };
            });

            await page.goto(extensionPopup);

            // Click sync button
            await page.click('#sync-button');

            // Wait for sync to complete
            await page.waitForSelector('.customization-item', { timeout: 5000 });

            // Verify customization appears
            const customizations = await page.$$('.customization-item');
            expect(customizations.length).toBe(1);

            const customizationName = await page.$eval(
                '.customization-item .customization-name',
                el => el.textContent
            );
            expect(customizationName).toBe('Test Customization');
        });

        test('should show sync status indicators', async () => {
            const extensionPopup = `chrome-extension://${extensionId}/popup.html`;
            await page.goto(extensionPopup);

            // Check initial sync status
            const syncStatus = await page.$eval('#sync-status', el => el.textContent);
            expect(syncStatus).toContain('Never synced');

            // Trigger sync
            await page.click('#sync-button');

            // Check syncing status
            await page.waitForSelector('#sync-status:not(:empty)');
            const syncingStatus = await page.$eval('#sync-status', el => el.textContent);
            expect(syncingStatus).toContain('Syncing');
        });
    });

    describe('Customization Application', () => {
        test('should apply active customizations to D365 pages', async () => {
            // Set up test customization
            await page.evaluateOnNewDocument(() => {
                window.chrome = {
                    storage: {
                        local: {
                            get: (keys, callback) => callback({
                                customizations: [{
                                    id: 'test-1',
                                    name: 'Header Color',
                                    domain: '*.dynamics.com',
                                    targetElement: '[data-id="form-header"]',
                                    cssProperty: 'background-color',
                                    cssValue: 'rgb(240, 240, 240)',
                                    isActive: true
                                }]
                            })
                        }
                    }
                };
            });

            // Navigate to test D365 page
            await page.goto(testD365Url);

            // Wait for content script to apply styles
            await page.waitForTimeout(2000);

            // Check if style was applied
            const headerBgColor = await page.$eval(
                '[data-id="form-header"]',
                el => window.getComputedStyle(el).backgroundColor
            );

            expect(headerBgColor).toBe('rgb(240, 240, 240)');
        });

        test('should not apply inactive customizations', async () => {
            // Set up test customization (inactive)
            await page.evaluateOnNewDocument(() => {
                window.chrome = {
                    storage: {
                        local: {
                            get: (keys, callback) => callback({
                                customizations: [{
                                    id: 'test-2',
                                    name: 'Inactive Style',
                                    domain: '*.dynamics.com',
                                    targetElement: '[data-id="form-footer"]',
                                    cssProperty: 'background-color',
                                    cssValue: 'rgb(255, 0, 0)',
                                    isActive: false
                                }]
                            })
                        }
                    }
                };
            });

            // Navigate to test D365 page
            await page.goto(testD365Url);

            // Wait for potential style application
            await page.waitForTimeout(2000);

            // Check that style was NOT applied
            const footerBgColor = await page.$eval(
                '[data-id="form-footer"]',
                el => window.getComputedStyle(el).backgroundColor
            );

            expect(footerBgColor).not.toBe('rgb(255, 0, 0)');
        });
    });

    describe('Toggle Functionality', () => {
        test('should toggle customizations on/off', async () => {
            const extensionPopup = `chrome-extension://${extensionId}/popup.html`;

            // Set up test data
            await page.evaluateOnNewDocument(() => {
                window.chrome = {
                    storage: {
                        local: {
                            get: (keys, callback) => callback({
                                customizations: [{
                                    id: 'test-3',
                                    name: 'Toggle Test',
                                    domain: '*.dynamics.com',
                                    targetElement: '[data-id="test-element"]',
                                    cssProperty: 'color',
                                    cssValue: 'blue',
                                    isActive: true
                                }]
                            }),
                            set: (items, callback) => callback && callback()
                        }
                    },
                    runtime: {
                        sendMessage: () => { }
                    }
                };
            });

            await page.goto(extensionPopup);

            // Wait for customization to load
            await page.waitForSelector('.customization-item');

            // Check initial toggle state
            const initialToggleState = await page.$eval(
                '.toggle-switch input',
                el => el.checked
            );
            expect(initialToggleState).toBe(true);

            // Click toggle
            await page.click('.toggle-switch input');

            // Check new toggle state
            const newToggleState = await page.$eval(
                '.toggle-switch input',
                el => el.checked
            );
            expect(newToggleState).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('should handle sync failures gracefully', async () => {
            const extensionPopup = `chrome-extension://${extensionId}/popup.html`;

            // Mock sync failure
            await page.evaluateOnNewDocument(() => {
                window.chrome = {
                    storage: {
                        local: {
                            get: (keys, callback) => callback({ customizations: [] })
                        },
                        sync: {
                            get: (keys, callback) => callback({ lastSync: null })
                        }
                    },
                    runtime: {
                        sendMessage: (message, callback) => {
                            if (message.action === 'sync') {
                                callback({
                                    success: false,
                                    error: 'Network error: Unable to reach SharePoint'
                                });
                            }
                        }
                    }
                };
            });

            await page.goto(extensionPopup);

            // Try to sync
            await page.click('#sync-button');

            // Check for error message
            await page.waitForSelector('.error-message', { timeout: 5000 });
            const errorText = await page.$eval('.error-message', el => el.textContent);
            expect(errorText).toContain('Network error');
        });

        test('should handle missing permissions', async () => {
            const extensionPopup = `chrome-extension://${extensionId}/popup.html`;

            // Mock permission denied
            await page.evaluateOnNewDocument(() => {
                window.chrome = {
                    storage: {
                        local: {
                            get: () => { throw new Error('Permission denied'); }
                        }
                    }
                };
            });

            await page.goto(extensionPopup);

            // Check for permission error
            await page.waitForSelector('.permission-error', { timeout: 5000 });
            const errorText = await page.$eval('.permission-error', el => el.textContent);
            expect(errorText).toContain('Permission');
        });
    });

    describe('Performance', () => {
        test('should load popup quickly', async () => {
            const startTime = Date.now();
            const extensionPopup = `chrome-extension://${extensionId}/popup.html`;

            await page.goto(extensionPopup);
            await page.waitForSelector('#sync-button');

            const loadTime = Date.now() - startTime;
            expect(loadTime).toBeLessThan(1000); // Should load in under 1 second
        });

        test('should handle large customization lists', async () => {
            // Create 100 test customizations
            const largeCustomizationList = Array.from({ length: 100 }, (_, i) => ({
                id: `test-${i}`,
                name: `Customization ${i}`,
                domain: '*.dynamics.com',
                targetElement: `[data-id="element-${i}"]`,
                cssProperty: 'color',
                cssValue: '#000000',
                isActive: i % 2 === 0
            }));

            await page.evaluateOnNewDocument((customizations) => {
                window.chrome = {
                    storage: {
                        local: {
                            get: (keys, callback) => callback({ customizations })
                        }
                    }
                };
            }, largeCustomizationList);

            const extensionPopup = `chrome-extension://${extensionId}/popup.html`;
            const startTime = Date.now();

            await page.goto(extensionPopup);
            await page.waitForSelector('.customization-item');

            const renderTime = Date.now() - startTime;
            expect(renderTime).toBeLessThan(2000); // Should render in under 2 seconds

            // Verify all items rendered
            const items = await page.$$('.customization-item');
            expect(items.length).toBe(100);
        });
    });
});