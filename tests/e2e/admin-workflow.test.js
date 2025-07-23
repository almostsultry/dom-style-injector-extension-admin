// End-to-end tests for admin workflow using Playwright
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extension setup
const extensionPath = path.join(__dirname, '../../dist/admin/chrome');

test.describe('Admin Workflow E2E Tests', () => {
    let context;
    let extensionId;

    test.beforeEach(async ({ browser }) => {
        // Load extension
        context = await browser.newContext({
            args: [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`,
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        // Get extension ID
        const extensionPage = await context.newPage();
        await extensionPage.goto('chrome://extensions/');

        const extensionCard = await extensionPage.locator('[id*="DOM Style Injector"]').first();
        extensionId = await extensionCard.getAttribute('id');
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('should load extension popup successfully', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Check that popup loads
        await expect(page.locator('h1')).toContainText('DOM Style Injector');

        // Check that all form fields are present
        await expect(page.locator('#elementProperty')).toBeVisible();
        await expect(page.locator('#propertyValue')).toBeVisible();
        await expect(page.locator('#cssProperty')).toBeVisible();
        await expect(page.locator('#cssValue')).toBeVisible();

        // Check buttons are present
        await expect(page.locator('#clearBtn')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should show domain restriction message on wrong domain', async () => {
        const page = await context.newPage();
        await page.goto('https://example.com');

        // Open extension popup
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Should show domain restriction message
        await expect(page.locator('#status')).toContainText('only works on ambata.crm.dynamics.com');

        // Form should be hidden or disabled
        const form = page.locator('#styleForm');
        await expect(form).toHaveCSS('display', 'none');
    });

    test('should complete full customization workflow', async () => {
        // Create a test page that simulates the target domain
        const testPage = await context.newPage();
        await testPage.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>Test CRM Page</title></head>
      <body>
        <div data-id="editFormRoot" style="background-color: white;">
          Test Form Root Element
        </div>
        <div data-id="otherElement">Other Element</div>
      </body>
      </html>
    `);

        // Mock the domain check by intercepting requests
        await testPage.route('**/*', (route) => {
            const url = route.request().url();
            if (url.includes('ambata.crm.dynamics.com')) {
                route.continue();
            } else {
                route.continue();
            }
        });

        // Open extension popup
        const popupPage = await context.newPage();
        await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

        // Fill out the form
        await popupPage.fill('#elementProperty', 'data-id');
        await popupPage.fill('#propertyValue', 'editFormRoot');
        await popupPage.fill('#cssProperty', 'background-color');
        await popupPage.fill('#cssValue', '#ff0000');

        // Submit the form
        await popupPage.click('button[type="submit"]');

        // Check for success message
        await expect(popupPage.locator('#status')).toContainText('Style applied successfully');
    });

    test('should handle form validation correctly', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Try to submit empty form
        await page.click('button[type="submit"]');

        // Should show validation error
        await expect(page.locator('#status')).toContainText('Please fill in all fields');

        // Fill partial form
        await page.fill('#elementProperty', 'data-id');
        await page.fill('#propertyValue', 'test');

        // Submit partial form
        await page.click('button[type="submit"]');

        // Should still show validation error
        await expect(page.locator('#status')).toContainText('Please fill in all fields');

        // Fill complete form
        await page.fill('#cssProperty', 'color');
        await page.fill('#cssValue', 'red');

        // Now submission should work (may show different error about domain)
        await page.click('button[type="submit"]');

        // Should not show validation error
        const statusText = await page.locator('#status').textContent();
        expect(statusText).not.toContain('Please fill in all fields');
    });

    test('should clear form fields when clear button is clicked', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Fill form fields
        await page.fill('#elementProperty', 'data-id');
        await page.fill('#propertyValue', 'test');
        await page.fill('#cssProperty', 'color');
        await page.fill('#cssValue', 'red');

        // Verify fields are filled
        await expect(page.locator('#elementProperty')).toHaveValue('data-id');
        await expect(page.locator('#propertyValue')).toHaveValue('test');

        // Click clear button
        await page.click('#clearBtn');

        // Verify fields are cleared
        await expect(page.locator('#elementProperty')).toHaveValue('');
        await expect(page.locator('#propertyValue')).toHaveValue('');
        await expect(page.locator('#cssProperty')).toHaveValue('');
        await expect(page.locator('#cssValue')).toHaveValue('');

        // Should show clear message
        await expect(page.locator('#status')).toContainText('Form cleared');
    });

    test('should show and hide query string section based on URL parameters', async () => {
        const page = await context.newPage();

        // Navigate to URL with query parameters
        await page.goto('https://ambata.crm.dynamics.com/test?etn=account&id=123');

        // Open extension popup
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Query string section should be visible
        await expect(page.locator('#queryStringSection')).toBeVisible();

        // Should show checkboxes for query parameters
        await expect(page.locator('label')).toContainText('etn=account');
        await expect(page.locator('label')).toContainText('id=123');

        // Save button should be visible
        await expect(page.locator('#saveBtn')).toBeVisible();
    });

    test('should persist form values across popup sessions', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Fill form
        await page.fill('#elementProperty', 'data-test');
        await page.fill('#propertyValue', 'persist-test');
        await page.fill('#cssProperty', 'font-size');
        await page.fill('#cssValue', '16px');

        // Close and reopen popup
        await page.close();

        const newPage = await context.newPage();
        await newPage.goto(`chrome-extension://${extensionId}/popup.html`);

        // Values should be restored (if persistence is working)
        // Note: This depends on the extension actually implementing persistence
        await expect(newPage.locator('#elementProperty')).toHaveValue('data-test');
        await expect(newPage.locator('#propertyValue')).toHaveValue('persist-test');
        await expect(newPage.locator('#cssProperty')).toHaveValue('font-size');
        await expect(newPage.locator('#cssValue')).toHaveValue('16px');
    });

    test('should handle customization cards workflow', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Mock having existing customizations by injecting storage data
        await page.evaluate(() => {
            const mockData = {
                customizations: {
                    'ambata.crm.dynamics.com': [{
                        id: 'test-id',
                        domain: 'ambata.crm.dynamics.com',
                        queryStrings: {
                            'etn=account': {
                                '[data-id="testElement"]': {
                                    'color': 'blue'
                                }
                            }
                        }
                    }]
                }
            };

            // Mock chrome.storage.local.get to return this data
            chrome.storage.local.get = jest.fn(() => Promise.resolve(mockData));
        });

        // Reload page to trigger loading of customizations
        await page.reload();

        // Should show customization cards
        await expect(page.locator('.customization-card')).toBeVisible();

        // Card should show the customization
        await expect(page.locator('.editable-style')).toHaveValue('color: blue');

        // Card should have breadcrumb
        await expect(page.locator('.card-breadcrumb')).toContainText('etn=account');

        // Card should have save and delete buttons
        await expect(page.locator('.card-btn-save')).toBeVisible();
        await expect(page.locator('.card-btn-delete')).toBeVisible();
    });

    test('should handle authentication flow', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Look for authentication UI elements (admin version)
        const authSection = page.locator('#authSection');

        if (await authSection.isVisible()) {
            // If auth section exists, test the login flow
            const loginButton = page.locator('#loginBtn');
            await expect(loginButton).toBeVisible();

            // Mock successful authentication
            await page.evaluate(() => {
                // Mock MSAL authentication success
                window.mockAuthResult = {
                    success: true,
                    user: {
                        username: 'admin@company.com',
                        name: 'Admin User'
                    }
                };
            });

            // Click login button
            await loginButton.click();

            // Should show authentication in progress or success
            await expect(page.locator('#authStatus')).toContainText(/Authenticating|Authenticated/);
        }
    });

    test('should handle sync functionality', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Look for sync UI elements (admin version)
        const syncButton = page.locator('#syncBtn');

        if (await syncButton.isVisible()) {
            // Mock successful sync
            await page.evaluate(() => {
                // Mock sync success
                chrome.runtime.sendMessage = jest.fn((message, callback) => {
                    if (message.action === 'sync-customizations') {
                        callback({ success: true, updated: 3 });
                    }
                });
            });

            // Click sync button
            await syncButton.click();

            // Should show sync status
            await expect(page.locator('#syncStatus')).toContainText(/Syncing|Sync complete/);
        }
    });

    test('should handle error states gracefully', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Mock network error
        await page.route('**/*', (route) => {
            route.abort('failed');
        });

        // Fill and submit form
        await page.fill('#elementProperty', 'data-id');
        await page.fill('#propertyValue', 'test');
        await page.fill('#cssProperty', 'color');
        await page.fill('#cssValue', 'red');

        await page.click('button[type="submit"]');

        // Should show error message
        const statusElement = page.locator('#status');
        await expect(statusElement).toHaveClass(/error/);

        const statusText = await statusElement.textContent();
        expect(statusText).toMatch(/error|failed|could not/i);
    });

    test('should be responsive on different screen sizes', async () => {
        const page = await context.newPage();

        // Test different viewport sizes
        const viewports = [
            { width: 400, height: 600 },  // Normal popup size
            { width: 300, height: 500 },  // Smaller
            { width: 500, height: 700 }   // Larger
        ];

        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            await page.goto(`chrome-extension://${extensionId}/popup.html`);

            // Check that all elements are still visible and properly laid out
            await expect(page.locator('h1')).toBeVisible();
            await expect(page.locator('#elementProperty')).toBeVisible();
            await expect(page.locator('button[type="submit"]')).toBeVisible();

            // Check that text is not cut off
            const formElement = page.locator('#styleForm');
            const boundingBox = await formElement.boundingBox();

            expect(boundingBox.width).toBeLessThanOrEqual(viewport.width);
            expect(boundingBox.height).toBeLessThanOrEqual(viewport.height);
        }
    });

    test('should handle keyboard navigation', async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Test tab navigation through form fields
        await page.keyboard.press('Tab');
        await expect(page.locator('#elementProperty')).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(page.locator('#propertyValue')).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(page.locator('#cssProperty')).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(page.locator('#cssValue')).toBeFocused();

        // Test form submission with Enter key
        await page.fill('#elementProperty', 'data-id');
        await page.fill('#propertyValue', 'test');
        await page.fill('#cssProperty', 'color');
        await page.fill('#cssValue', 'red');

        await page.keyboard.press('Enter');

        // Should trigger form submission
        await expect(page.locator('#status')).toBeVisible();
    });
});

test.describe('Performance Tests', () => {
    test('popup should load within acceptable time', async ({ browser }) => {
        const context = await browser.newContext({
            args: [`--load-extension=${extensionPath}`]
        });

        const page = await context.newPage();

        const startTime = Date.now();
        await page.goto(`chrome-extension://test-id/popup.html`);
        await page.waitForSelector('h1');
        const loadTime = Date.now() - startTime;

        // Popup should load within 2 seconds
        expect(loadTime).toBeLessThan(2000);

        await context.close();
    });

    test('form interaction should be responsive', async ({ browser }) => {
        const context = await browser.newContext({
            args: [`--load-extension=${extensionPath}`]
        });

        const page = await context.newPage();
        await page.goto(`chrome-extension://test-id/popup.html`);

        // Measure typing response time
        const startTime = Date.now();
        await page.fill('#elementProperty', 'data-test-performance');
        const typingTime = Date.now() - startTime;

        // Typing should be responsive (under 100ms for short text)
        expect(typingTime).toBeLessThan(100);

        await context.close();
    });
});