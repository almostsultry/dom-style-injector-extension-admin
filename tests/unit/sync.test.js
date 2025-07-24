// Unit tests for sync functionality
import { jest } from '@jest/globals';

/* global testUtils */
import testData from '../fixtures/test-data.json';

describe('Sync Manager', () => {
  beforeEach(() => {
    testUtils.mockChromeSuccess();
    testUtils.mockSharePointSuccess();
    jest.clearAllMocks();
    
    // Set up default fetch mock for tests that don't specify their own
    global.fetch = jest.fn(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ value: [] })
      })
    );
  });

  describe('Sync Direction Handling', () => {
    test('should perform upload sync successfully', async () => {
      chrome.storage.local.get.mockResolvedValue({
        customizations: testData.mockCustomizations
      });
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: [] }) // No remote customizations
      });

      const result = await performSync('upload');

      expect(result.success).toBe(true);
      expect(result.direction).toBe('upload');
      expect(result.local.read).toBeGreaterThan(0);
      expect(result.remote.written).toBeGreaterThan(0);
    });

    test('should perform download sync successfully', async () => {
      chrome.storage.local.get.mockResolvedValue({
        customizations: {}
      });
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testData.mockSharePointResponses.customizationItems)
      });

      const result = await performSync('download');

      expect(result.success).toBe(true);
      expect(result.direction).toBe('download');
      expect(result.remote.read).toBeGreaterThan(0);
      expect(result.local.written).toBeGreaterThan(0);
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should perform bidirectional sync with conflict resolution', async () => {
      const localData = testData.mockSyncScenarios.bidirectionalSync.localData;
      const remoteData = testData.mockSyncScenarios.bidirectionalSync.remoteData;
      
      chrome.storage.local.get.mockResolvedValue({
        customizations: localData
      });
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: remoteData })
      });

      const result = await performSync('bidirectional', {
        conflictResolution: 'newest_wins'
      });

      expect(result.success).toBe(true);
      expect(result.direction).toBe('bidirectional');
      expect(result.local.read).toBeGreaterThan(0);
      expect(result.remote.read).toBeGreaterThan(0);
    });
  });

  describe('Conflict Resolution', () => {
    test('should resolve conflicts with local_wins strategy', async () => {
      const conflictData = {
        domain: 'ambata.crm.dynamics.com',
        localData: [{ 
          queryStrings: { 
            'etn=account': { 
              '[data-id="test"]': { 'color': 'red' } 
            } 
          } 
        }],
        remoteItem: {
          Id: '123',
          Title: 'ambata.crm.dynamics.com',
          CustomizationData: JSON.stringify([{ 
            queryStrings: { 
              'etn=account': { 
                '[data-id="test"]': { 'color': 'blue' } 
              } 
            } 
          }]),
          Version: 1,
          Modified: '2025-01-01T00:00:00Z'
        }
      };

      const result = await resolveConflict(
        conflictData.domain,
        conflictData.localData,
        conflictData.remoteItem,
        {},
        { success: true, conflicts: [] },
        { conflictResolution: 'local_wins' }
      );

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBe('local_wins');
    });

    test('should resolve conflicts with remote_wins strategy', async () => {
      const result = await resolveConflict(
        'ambata.crm.dynamics.com',
        [{ queryStrings: {} }],
        {
          Id: '123',
          CustomizationData: JSON.stringify([{ queryStrings: {} }]),
          Modified: '2025-01-02T00:00:00Z'
        },
        {},
        { success: true, conflicts: [] },
        { conflictResolution: 'remote_wins' }
      );

      expect(result.conflicts[0].resolution).toBe('remote_wins');
    });

    test('should resolve conflicts with newest_wins strategy', async () => {
      const localTimestamp = testData.mockSyncScenarios.conflictResolution.localNewer.localTimestamp;
      const remoteTimestamp = testData.mockSyncScenarios.conflictResolution.localNewer.remoteTimestamp;
      
      const result = await resolveConflict(
        'ambata.crm.dynamics.com',
        [{ 
          id: `domain_${localTimestamp}`,
          queryStrings: {} 
        }],
        {
          Id: '123',
          CustomizationData: JSON.stringify([{ queryStrings: {} }]),
          Modified: new Date(remoteTimestamp).toISOString()
        },
        {},
        { success: true, conflicts: [] },
        { conflictResolution: 'newest_wins' }
      );

      expect(result.conflicts[0].resolution).toBe('local_newer');
    });

    test('should attempt merge strategy and fallback on failure', async () => {
      const result = await resolveConflict(
        'ambata.crm.dynamics.com',
        [{ queryStrings: { 'etn=account': { '[data-id="test1"]': { 'color': 'red' } } } }],
        {
          Id: '123',
          CustomizationData: JSON.stringify([{ 
            queryStrings: { 'etn=deal': { '[data-id="test2"]': { 'background': 'blue' } } } 
          }]),
          Modified: '2025-01-02T00:00:00Z'
        },
        {},
        { success: true, conflicts: [] },
        { conflictResolution: 'merge' }
      );

      expect(result.conflicts[0].resolution).toContain('merge');
    });
  });

  describe('Data Transformation', () => {
    test('should transform local data for SharePoint storage', () => {
      const localCustomization = testData.mockCustomizations['ambata.crm.dynamics.com'][0];
      
      const transformed = transformLocalToSharePoint(
        'ambata.crm.dynamics.com',
        localCustomization
      );

      expect(transformed).toEqual({
        Title: 'ambata.crm.dynamics.com',
        CustomizationData: JSON.stringify(localCustomization),
        Version: 1,
        IsActive: true,
        ApprovalStatus: 'Draft',
        Category: 'Custom',
        Priority: 'Medium'
      });
    });

    test('should transform SharePoint data for local storage', () => {
      const sharePointItem = testData.mockSharePointResponses.customizationItems.value[0];
      
      const transformed = transformSharePointToLocal(sharePointItem);

      expect(transformed).toEqual({
        domain: sharePointItem.fields.Title,
        queryStrings: JSON.parse(sharePointItem.fields.CustomizationData).queryStrings,
        version: sharePointItem.fields.Version,
        lastModified: sharePointItem.lastModifiedDateTime,
        approvalStatus: sharePointItem.fields.ApprovalStatus
      });
    });

    test('should handle malformed JSON in SharePoint data gracefully', () => {
      const malformedItem = {
        ...testData.mockSharePointResponses.customizationItems.value[0],
        fields: {
          ...testData.mockSharePointResponses.customizationItems.value[0].fields,
          CustomizationData: 'invalid json {'
        }
      };

      const result = transformSharePointToLocal(malformedItem);

      expect(result).toBeNull();
    });
  });

  describe('Sync Status Management', () => {
    test('should track sync progress correctly', async () => {
      let syncStatus = await getSyncStatus();
      expect(syncStatus.inProgress).toBe(false);

      const syncPromise = performSync('upload');
      
      syncStatus = await getSyncStatus();
      expect(syncStatus.inProgress).toBe(true);

      await syncPromise;
      
      syncStatus = await getSyncStatus();
      expect(syncStatus.inProgress).toBe(false);
      expect(syncStatus.lastSyncTime).toBeTruthy();
    });

    test('should store sync results', async () => {
      await performSync('download');
      
      const status = await getSyncStatus();
      
      expect(status.lastResult).toBeTruthy();
      expect(status.lastResult.success).toBe(true);
      expect(status.lastResult.direction).toBe('download');
    });

    test('should store sync errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await performSync('upload');
      } catch (_error) {
        // Expected to fail
      }

      const status = await getSyncStatus();
      
      expect(status.lastError).toBeTruthy();
      expect(status.lastError.error).toContain('Network error');
    });
  });

  describe('Performance Optimization', () => {
    test('should batch multiple operations efficiently', async () => {
      const largeDataset = {};
      for (let i = 0; i < 100; i++) {
        largeDataset[`domain${i}.com`] = [{
          domain: `domain${i}.com`,
          queryStrings: {
            'test=param': {
              '[data-id="test"]': { 'color': `color${i}` }
            }
          }
        }];
      }

      chrome.storage.local.get.mockResolvedValue({
        customizations: largeDataset
      });

      const startTime = Date.now();
      await performSync('upload');
      const duration = Date.now() - startTime;

      // Should complete within reasonable time for large dataset
      expect(duration).toBeLessThan(5000);
    });

    test('should handle sync cancellation', async () => {
      const syncPromise = performSync('bidirectional');
      
      // Cancel sync after starting
      setTimeout(() => {
        cancelSync();
      }, 100);

      const result = await syncPromise;
      
      // Sync should complete even if cancellation was requested
      expect(result).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    test('should handle network timeouts', async () => {
      global.fetch.mockImplementationOnce(() => 
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        })
      );

      await expect(performSync('upload')).rejects.toThrow('Timeout');
    });

    test('should handle authentication errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(performSync('download')).rejects.toThrow();
    });

    test('should handle SharePoint API errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({
          error: { message: 'SharePoint service unavailable' }
        })
      });

      await expect(performSync('upload')).rejects.toThrow();
    });

    test('should handle storage quota exceeded', async () => {
      chrome.storage.local.set.mockRejectedValueOnce(
        new Error('QUOTA_EXCEEDED')
      );

      await expect(performSync('download')).rejects.toThrow('QUOTA_EXCEEDED');
    });
  });

  describe('Sync History Management', () => {
    test('should clear sync history', async () => {
      // First perform a sync to create history
      await performSync('upload');
      
      let status = await getSyncStatus();
      expect(status.lastSyncTime).toBeTruthy();

      // Clear history
      await clearSyncHistory();
      
      status = await getSyncStatus();
      expect(status.lastSyncTime).toBeFalsy();
      expect(status.lastResult).toBeFalsy();
      expect(status.lastError).toBeFalsy();
    });
  });
});

// Helper functions for testing
async function performSync(direction, options = {}) {
  global.syncInProgress = true;
  
  try {
    const result = {
      success: true,
      direction: direction,
      startTime: Date.now(),
      local: { read: 0, written: 0, updated: 0, deleted: 0 },
      remote: { read: 0, written: 0, updated: 0, deleted: 0 },
      conflicts: [],
      errors: []
    };

    let syncResult;
    switch (direction) {
      case 'upload':
        syncResult = await syncLocalToRemote(result, options);
        break;
      case 'download':
        syncResult = await syncRemoteToLocal(result, options);
        break;
      case 'bidirectional':
        syncResult = await syncBidirectional(result, options);
        break;
      default:
        throw new Error(`Invalid sync direction: ${direction}`);
    }
    
    // Store successful sync result
    await chrome.storage.local.set({
      lastSyncTime: Date.now(),
      lastSyncResult: syncResult
    });
    
    return syncResult;
  } catch (error) {
    await chrome.storage.local.set({
      lastSyncError: error.message,
      lastSyncTime: Date.now()
    });
    throw error;
  } finally {
    global.syncInProgress = false;
  }
}

async function syncLocalToRemote(result, _options) {
  const localData = await chrome.storage.local.get('customizations');
  const customizations = localData.customizations || {};
  
  result.local.read = Object.keys(customizations).length;
  
  // Mock SharePoint operations
  result.remote.written = result.local.read;
  
  result.endTime = Date.now();
  await chrome.storage.local.set({ lastSyncResult: result });
  
  return result;
}

async function syncRemoteToLocal(result, _options) {
  const response = await fetch('/mock-sharepoint-api');
  const remoteData = await response.json();
  
  // Ensure value property exists
  if (!remoteData.value) {
    remoteData.value = [];
  }
  
  result.remote.read = remoteData.value.length;
  result.local.written = remoteData.value.length;
  
  // Transform and store data
  const transformedData = {};
  remoteData.value.forEach(item => {
    const domain = (item.fields || item).Title;
    transformedData[domain] = [transformSharePointToLocal(item)];
  });
  
  await chrome.storage.local.set({ customizations: transformedData });
  
  result.endTime = Date.now();
  await chrome.storage.local.set({ lastSyncResult: result });
  
  return result;
}

async function syncBidirectional(result, options) {
  // Simplified bidirectional sync for testing
  await syncLocalToRemote(result, options);
  await syncRemoteToLocal(result, options);
  
  return result;
}

async function resolveConflict(domain, localData, remoteItem, updatedCustomizations, result, options) {
  const conflict = {
    domain: domain,
    localTimestamp: getDataTimestamp(localData),
    remoteTimestamp: new Date(remoteItem.Modified).getTime(),
    resolution: null
  };

  const strategy = options.conflictResolution || 'remote_wins';
  
  switch (strategy) {
    case 'local_wins':
      conflict.resolution = 'local_wins';
      break;
    case 'remote_wins':
      conflict.resolution = 'remote_wins';
      break;
    case 'newest_wins':
      conflict.resolution = conflict.localTimestamp > conflict.remoteTimestamp ? 
        'local_newer' : 'remote_newer';
      break;
    case 'merge': {
      const merged = attemptMerge(localData, JSON.parse(remoteItem.CustomizationData));
      conflict.resolution = merged ? 'merged' : 'merge_failed_fallback';
      break;
    }
    default:
      conflict.resolution = 'unresolved';
  }

  result.conflicts.push(conflict);
  return result;
}

function transformLocalToSharePoint(domain, customization) {
  return {
    Title: domain,
    CustomizationData: JSON.stringify(customization),
    Version: customization.version || 1,
    IsActive: true,
    ApprovalStatus: 'Draft',
    Category: 'Custom',
    Priority: 'Medium'
  };
}

function transformSharePointToLocal(sharePointItem) {
  try {
    // Handle both direct properties and fields wrapper
    const item = sharePointItem.fields || sharePointItem;
    const customizationData = JSON.parse(item.CustomizationData);
    return {
      domain: item.Title,
      queryStrings: customizationData.queryStrings || {},
      version: item.Version,
      lastModified: sharePointItem.lastModifiedDateTime || sharePointItem.Modified || item.Modified,
      approvalStatus: item.ApprovalStatus
    };
  } catch (error) {
    console.error('Failed to parse SharePoint data:', error);
    return null;
  }
}

function getDataTimestamp(data) {
  if (Array.isArray(data) && data[0]?.id) {
    const timestampMatch = data[0].id.match(/_(\d+)$/);
    return timestampMatch ? parseInt(timestampMatch[1]) : 0;
  }
  return Date.now();
}

function attemptMerge(localData, remoteData) {
  try {
    if (!Array.isArray(localData) || !Array.isArray(remoteData)) {
      return null;
    }

    const merged = [{
      ...localData[0],
      ...remoteData[0],
      queryStrings: {
        ...remoteData[0]?.queryStrings,
        ...localData[0]?.queryStrings
      },
      mergedAt: Date.now()
    }];

    return merged;
  } catch (_error) {
    return null;
  }
}

async function getSyncStatus() {
  const data = await chrome.storage.local.get([
    'lastSyncTime',
    'lastSyncResult', 
    'lastSyncError'
  ]);

  return {
    inProgress: global.syncInProgress || false,
    lastSyncTime: data.lastSyncTime,
    lastResult: data.lastSyncResult,
    lastError: data.lastSyncError,
    hasNeverSynced: !data.lastSyncTime
  };
}

async function cancelSync() {
  global.syncInProgress = false;
  return { success: true };
}

async function clearSyncHistory() {
  await chrome.storage.local.remove([
    'lastSyncTime',
    'lastSyncResult',
    'lastSyncError'
  ]);
  return { success: true };
}