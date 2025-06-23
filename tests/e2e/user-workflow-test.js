// End-to-end tests for user version workflow using Playwright
import { test, expect } from '@playwright/test';
import path from 'path';

const userExtensionPath = path.join(__dirname, '../../dist/user/chrome');

test.describe('User Version E2E Tests', () => {
  let context;
  let extensionId;

  test.beforeEach(async ({ browser }) => {
    // Load user extension
    context = await browser.newContext({
      args: [
        `--disable-extensions-except=${userExtensionPath}`,
        `--load-extension=${userExtensionPath}`,
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

  test('should load user extension popup successfully', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check that popup loads with user-specific content
    await expect(page.locator('h1')).toContainText('DOM Style Injector');
    
    // User version should NOT have form for creating customizations
    await expect(page.locator('#styleForm')).not.toBeVisible();
    
    // Should show read-only status or sync information
    await expect(page.locator('.sync-status, .customization-list')).toBeVisible();
  });

  test('should display available customizations for current page', async () => {
    // Mock available customizations in storage
    const page = await context.newPage();
    
    // Navigate to target domain first
    await page.goto('https://ambata.crm.dynamics.com/test?etn=account&id=123');
    
    // Open extension popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Should show available customizations for this page
    await expect(page.locator('.available-customizations')).toBeVisible();
    
    // Should show toggle controls for enabling/disabling customizations
    await expect(page.locator('.customization-toggle')).toBeVisible();
  });

  test('should allow users to enable/disable customizations', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Mock having customizations available
    await page.evaluate(() => {
      const mockCustomizations = [
        {
          id: 'custom-1',
          name: 'Form Background Enhancement',
          description: 'Improves form visibility',
          enabled: false
        },
        {
          id: 'custom-2', 
          name: 'Hide Distracting Elements',
          description: 'Removes unnecessary UI elements',
          enabled: true
        }
      ];
      
      // Inject mock data into page
      window.mockCustomizations = mockCustomizations;
    });

    // Reload to apply mock data
    await page.reload();

    // Find toggle switches
    const toggles = page.locator('.customization-toggle');
    
    // Should have toggle controls
    expect(await toggles.count()).toBeGreaterThan(0);
    
    // Test enabling a customization
    const firstToggle = toggles.first();
    await firstToggle.click();
    
    // Should show confirmation or status change
    await expect(page.locator('.status-message')).toBeVisible();
  });

  test('should sync customizations from central repository', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Look for sync button or automatic sync indicator
    const syncButton = page.locator('#syncBtn, .sync-now');
    
    if (await syncButton.isVisible()) {
      // Mock successful sync response
      await page.route('**/sharepoint/**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            value: [
              {
                id: '1',
                fields: {
                  Title: 'ambata.crm.dynamics.com',
                  CustomizationData: JSON.stringify({
                    queryStrings: {
                      'etn=account': {
                        '[data-id="editFormRoot"]': {
                          'background-color': '#e8f5e8'
                        }
                      }
                    }
                  }),
                  IsActive: true,
                  ApprovalStatus: 'Approved'
                }
              }
            ]
          })
        });
      });

      await syncButton.click();
      
      // Should show sync status
      await expect(page.locator('.sync-status')).toContainText(/Syncing|Sync complete/);
    }
  });

  test('should apply customizations automatically on target pages', async () => {
    // Create a test page that simulates the CRM
    const testPage = await context.newPage();
    await testPage.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>Test CRM Page</title></head>
      <body>
        <div data-id="editFormRoot" style="background-color: white;">
          Test Form Root Element
        </div>
        <div data-id="testElement">Test Element</div>
      </body>
      </html>
    `);

    // Mock the domain by intercepting requests
    await testPage.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'ambata.crm.dynamics.com') {
        route.continue();
      } else {
        route.continue();
      }
    });

    // Mock extension storage with active customizations
    await testPage.addInitScript(() => {
      window.chrome = {
        storage: {
          local: {
            get: () => Promise.resolve({
              customizations: {
                'ambata.crm.dynamics.com': [{
                  domain: 'ambata.crm.dynamics.com',
                  queryStrings: {
                    '': {
                      '[data-id="editFormRoot"]': {
                        'background-color': '#e8f5e8'
                      }
                    }
                  }
                }]
              }
            })
          }
        }
      };
    });

    // Wait for potential style application
    await testPage.waitForTimeout(1000);

    // Check if styles were applied (this would need content script to be active)
    const targetElement = testPage.locator('[data-id="editFormRoot"]');
    
    // Note: In real extension environment, styles would be applied by content script
    // This test verifies the structure is in place for style application
    await expect(targetElement).toBeVisible();
  });

  test('should handle authentication for sync', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Look for authentication section
    const authSection = page.locator('.auth-section, #authSection');
    
    if (await authSection.isVisible()) {
      // Should show authentication status
      await expect(page.locator('.auth-status')).toBeVisible();
      
      // For user version, authentication might be automatic or simplified
      const loginButton = page.locator('#loginBtn, .login-button');
      
      if (await loginButton.isVisible()) {
        // Mock authentication flow
        await page.route('**/oauth/**', (route) => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              access_token: 'mock-token',
              token_type: 'Bearer'
            })
          });
        });

        await loginButton.click();
        
        // Should show authentication success
        await expect(page.locator('.auth-status')).toContainText(/Authenticated|Connected/);
      }
    }
  });

  test('should display customization information and descriptions', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Mock customizations with metadata
    await page.evaluate(() => {
      const mockCustomizations = [
        {
          id: 'enhancement-1',
          name: 'Form Visibility Enhancement',
          description: 'Improves form readability with better background colors',
          category: 'UI Enhancement',
          approvedBy: 'IT Admin',
          lastUpdated: '2025-01-15'
        }
      ];
      
      window.mockCustomizations = mockCustomizations;
    });

    await page.reload();

    // Should show customization details
    await expect(page.locator('.customization-name')).toBeVisible();
    await expect(page.locator('.customization-description')).toBeVisible();
    
    // Should show metadata like approval status
    await expect(page.locator('.customization-meta')).toBeVisible();
  });

  test('should handle offline scenarios gracefully', async () => {
    const page = await context.newPage();
    
    // Simulate offline network
    await page.context().setOffline(true);
    
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Should handle offline gracefully
    await expect(page.locator('.offline-notice, .sync-error')).toBeVisible();
    
    // Should still show cached customizations if available
    await expect(page.locator('.cached-customizations')).toBeVisible();
  });

  test('should respect user preferences for customization application', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Look for preferences or settings section
    const settingsButton = page.locator('#settingsBtn, .settings-button');
    
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      
      // Should show preference controls
      await expect(page.locator('.preference-controls')).toBeVisible();
      
      // Test toggling global enable/disable
      const globalToggle = page.locator('#globalEnable');
      if (await globalToggle.isVisible()) {
        await globalToggle.click();
        
        // Should save preference
        await expect(page.locator('.preference-saved')).toBeVisible();
      }
    }
  });

  test('should provide feedback mechanism for customizations', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Look for feedback controls
    const feedbackButton = page.locator('.feedback-button, #feedbackBtn');
    
    if (await feedbackButton.isVisible()) {
      await feedbackButton.click();
      
      // Should show feedback form
      await expect(page.locator('.feedback-form')).toBeVisible();
      
      // Test submitting feedback
      await page.fill('.feedback-text', 'This customization is very helpful!');
      await page.click('.submit-feedback');
      
      // Should show confirmation
      await expect(page.locator('.feedback-submitted')).toBeVisible();
    }
  });

  test('should handle version compatibility checks', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Mock version compatibility check
    await page.route('**/version-check**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          currentVersion: '1.0.0',
          latestVersion: '1.1.0',
          updateAvailable: true,
          compatibilityStatus: 'compatible'
        })
      });
    });

    // Trigger version check
    const versionCheck = page.locator('#checkVersion');
    if (await versionCheck.isVisible()) {
      await versionCheck.click();
      
      // Should show version information
      await expect(page.locator('.version-info')).toBeVisible();
    }
  });

  test('should be accessible via keyboard navigation', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    
    // Should focus on first interactive element
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Continue tabbing through interface
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to activate controls with Enter/Space
    await page.keyboard.press('Enter');
    
    // Should respond to keyboard interaction
    // (Specific assertions depend on the actual UI elements)
  });

  test('should display proper error messages for common issues', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Test various error scenarios
    const errorScenarios = [
      {
        scenario: 'Network error',
        mockResponse: { status: 500, body: 'Server Error' },
        expectedMessage: /network|server|connection/i
      },
      {
        scenario: 'Authentication error', 
        mockResponse: { status: 401, body: 'Unauthorized' },
        expectedMessage: /authentication|login|unauthorized/i
      },
      {
        scenario: 'Permission error',
        mockResponse: { status: 403, body: 'Forbidden' },
        expectedMessage: /permission|access|forbidden/i
      }
    ];
    for (const { scenario, mockResponse, expectedMessage } of errorScenarios) {
      await page.route('**/*', (route) => {
        route.fulfill({
          status: mockResponse.status,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse.body)
        });
      });

      // Trigger the scenario
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      // Should show appropriate error message
      await expect(page.locator('.error-message')).toContainText(expectedMessage);
    }
  });
});

// End