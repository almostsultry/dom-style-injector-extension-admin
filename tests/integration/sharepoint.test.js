// Integration tests for SharePoint service
import { jest } from '@jest/globals';
import { sharePointService } from '../../src/sync/sharepoint-service.js';
import { authenticateUser } from '../../src/auth/auth-service.js';
import testData from '../fixtures/test-data.json';

/* global testUtils */

describe('SharePoint Service Integration', () => {
  beforeEach(async () => {
    testUtils.mockChromeSuccess();
    testUtils.mockAuthSuccess();
    jest.clearAllMocks();
    
    // Reset SharePoint service state
    sharePointService.siteId = null;
    sharePointService.listId = null;
    
    // Authenticate first to ensure auth service is initialized
    await authenticateUser();
    
    // Mock token acquisition for SharePoint API calls
    const msalInstance = new global.msal.PublicClientApplication();
    msalInstance.acquireTokenSilent = jest.fn(() => Promise.resolve({
      accessToken: 'test-sharepoint-token',
      expiresOn: new Date(Date.now() + 3600000)
    }));
  });

  describe('Service Initialization', () => {
    test('should initialize SharePoint service successfully', async () => {
      // Mock successful site ID retrieval
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(testData.mockSharePointResponses.siteInfo)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            value: [testData.mockSharePointResponses.listInfo]
          })
        });

      const result = await sharePointService.initialize();

      expect(result).toBe(true);
      expect(sharePointService.siteId).toBe(testData.mockSharePointResponses.siteInfo.id);
      expect(sharePointService.listId).toBe(testData.mockSharePointResponses.listInfo.id);
    });

    test('should create SharePoint list if it does not exist', async () => {
      // Mock site exists but list does not
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(testData.mockSharePointResponses.siteInfo)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ value: [] }) // No existing list
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(testData.mockSharePointResponses.listInfo)
        });
      
      // Mock column creation calls (7 columns)
      for (let i = 0; i < 7; i++) {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ name: `column${i}` })
        });
      }

      const result = await sharePointService.initialize();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/lists'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    test('should handle SharePoint site access errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      await expect(sharePointService.initialize()).rejects.toThrow('Failed to get site ID: 403 Forbidden');
    });
  });

  describe('CRUD Operations', () => {
    beforeEach(async () => {
      // Initialize service before each test
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(testData.mockSharePointResponses.siteInfo)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            value: [testData.mockSharePointResponses.listInfo]
          })
        });

      await sharePointService.initialize();
      jest.clearAllMocks();
    });

    test('should create customization successfully', async () => {
      const customizationData = {
        Title: 'test.domain.com',
        CustomizationData: JSON.stringify({
          domain: 'test.domain.com',
          queryStrings: {
            'test=param': {
              '[data-id="test"]': { 'color': 'red' }
            }
          }
        }),
        Version: 1,
        IsActive: true,
        ApprovalStatus: 'Draft',
        Category: 'UI Enhancement',
        Priority: 'Medium',
        Description: 'Test customization'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'new-item-id',
          fields: customizationData
        })
      });

      const result = await sharePointService.createCustomization(customizationData);

      expect(result.Id).toBe('new-item-id');
      expect(result.Title).toBe('test.domain.com');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/items'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining(customizationData.Title)
        })
      );
    });

    test('should retrieve customizations with filtering', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testData.mockSharePointResponses.customizationItems)
      });

      const customizations = await sharePointService.getCustomizations();

      expect(customizations).toHaveLength(2);
      expect(customizations[0].Title).toBe('ambata.crm.dynamics.com');
      expect(customizations[0].ApprovalStatus).toBe('Approved');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('$expand=fields'),
        expect.any(Object)
      );
    });

    test('should update existing customization', async () => {
      const itemId = '123';
      const updates = {
        CustomizationData: JSON.stringify({ updated: true }),
        Version: 2,
        ApprovalStatus: 'Approved'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: itemId,
          fields: updates
        })
      });

      const result = await sharePointService.updateCustomization(itemId, updates);

      expect(result.id).toBe(itemId);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/items/${itemId}`),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"Version":2')
        })
      );
    });

    test('should soft delete customization by default', async () => {
      const itemId = '123';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await sharePointService.deleteCustomization(itemId);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/items/${itemId}`),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"IsActive":false')
        })
      );
    });

    test('should hard delete customization when requested', async () => {
      const itemId = '123';

      global.fetch.mockResolvedValueOnce({
        ok: true
      });

      const result = await sharePointService.deleteCustomization(itemId, true);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/items/${itemId}`),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(async () => {
      // Initialize service
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(testData.mockSharePointResponses.siteInfo)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            value: [testData.mockSharePointResponses.listInfo]
          })
        });

      await sharePointService.initialize();
      jest.clearAllMocks();
    });

    test('should search customizations by term', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          value: [testData.mockSharePointResponses.customizationItems.value[0]]
        })
      });

      const results = await sharePointService.searchCustomizations('background');

      expect(results).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("substringof('background'"),
        expect.any(Object)
      );
    });

    test('should filter customizations by approval status', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          value: [testData.mockSharePointResponses.customizationItems.value[0]]
        })
      });

      const results = await sharePointService.getCustomizationsByStatus('Approved');

      expect(results).toHaveLength(1);
      expect(results[0].ApprovalStatus).toBe('Approved');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ApprovalStatus%20eq%20'Approved'"),
        expect.any(Object)
      );
    });

    test('should get statistics for customizations', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testData.mockSharePointResponses.customizationItems)
      });

      const stats = await sharePointService.getStatistics();

      expect(stats.total).toBe(2);
      expect(stats.byStatus['Approved']).toBe(1);
      expect(stats.byStatus['Pending Review']).toBe(1);
      expect(stats.byCategory['UI Enhancement']).toBe(1);
      expect(stats.byPriority['Medium']).toBe(1);
    });
  });

  describe('Approval Workflow', () => {
    beforeEach(async () => {
      // Initialize service
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(testData.mockSharePointResponses.siteInfo)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            value: [testData.mockSharePointResponses.listInfo]
          })
        });

      await sharePointService.initialize();
      jest.clearAllMocks();
    });

    test('should approve customization', async () => {
      const itemId = '123';
      const comments = 'Approved for production use';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: itemId,
          fields: { ApprovalStatus: 'Approved' }
        })
      });

      const result = await sharePointService.approveCustomization(itemId, comments);

      expect(result.id).toBe(itemId);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/items/${itemId}`),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"ApprovalStatus":"Approved"')
        })
      );
    });

    test('should reject customization with reason', async () => {
      const itemId = '123';
      const reason = 'Conflicts with security policy';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: itemId,
          fields: { ApprovalStatus: 'Rejected' }
        })
      });

      const result = await sharePointService.rejectCustomization(itemId, reason);

      expect(result.id).toBe(itemId);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/items/${itemId}`),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"ApprovalStatus":"Rejected"')
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle network timeouts', async () => {
      global.fetch.mockImplementationOnce(() => 
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100);
        })
      );

      await expect(sharePointService.initialize()).rejects.toThrow('Network timeout');
    });

    test('should handle invalid JSON responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(sharePointService.initialize()).rejects.toThrow('Invalid JSON');
    });

    test('should handle SharePoint API rate limiting', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['Retry-After', '60']])
      });

      await expect(sharePointService.getCustomizations()).rejects.toThrow('Too Many Requests');
    });

    test('should handle permission denied errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      await expect(sharePointService.createCustomization({})).rejects.toThrow('Forbidden');
    });
  });

  describe('Connection Testing', () => {
    test('should test connection successfully', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(testData.mockSharePointResponses.siteInfo)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            value: [testData.mockSharePointResponses.listInfo]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(testData.mockSharePointResponses.siteInfo)
        });

      const result = await sharePointService.testConnection();

      expect(result.success).toBe(true);
      expect(result.siteTitle).toBe('DOM Style Customizations');
      expect(result.siteUrl).toBe('https://company.sharepoint.com/sites/customizations');
    });

    test('should handle connection test failures', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await sharePointService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get site ID: 500 Internal Server Error');
    });
  });

  describe('Performance and Caching', () => {
    test('should handle large datasets efficiently', async () => {
      // Create mock data with 100 items
      const largeDataset = {
        value: Array.from({ length: 100 }, (_, i) => ({
          ...testData.mockSharePointResponses.customizationItems.value[0],
          id: `item-${i}`,
          fields: {
            ...testData.mockSharePointResponses.customizationItems.value[0].fields,
            Title: `domain-${i}.com`
          }
        }))
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testData.mockSharePointResponses.siteInfo)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          value: [testData.mockSharePointResponses.listInfo]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(largeDataset)
      });

      await sharePointService.initialize();
      
      const startTime = Date.now();
      const results = await sharePointService.getCustomizations();
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should batch operations for efficiency', async () => {
      // Mock multiple create operations
      const customizations = Array.from({ length: 10 }, (_, i) => ({
        Title: `domain-${i}.com`,
        CustomizationData: JSON.stringify({ test: i }),
        Version: 1
      }));

      // Mock responses for initialization and batch operations
      global.fetch
        .mockResolvedValueOnce({ // First call - get site ID
          ok: true,
          json: () => Promise.resolve({ id: 'mock-site-id-12345' })
        })
        .mockResolvedValueOnce({ // Second call - get list ID
          ok: true,
          json: () => Promise.resolve({
            value: [{ id: 'mock-list-id-67890', displayName: 'CustomizationRules' }]
          })
        })
        .mockResolvedValue({ // All subsequent calls - create customization
          ok: true,
          json: () => Promise.resolve({ 
            id: 'batch-result',
            fields: {
              Title: 'Test Domain',
              CustomizationData: '{}',
              Version: 1
            }
          })
        });

      await sharePointService.initialize();

      const promises = customizations.map(custom => 
        sharePointService.createCustomization(custom)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(global.fetch).toHaveBeenCalledTimes(12); // 2 for init + 10 for creates
    });
  });
});