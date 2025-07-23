// Synchronization manager for SharePoint integration
import { getAccessToken } from '../auth/auth-service.js';
import { sharePointService } from './sharepoint-service.js';
// getCurrentEnvironment import removed - not available in msal-config.js

let syncInProgress = false;
let lastSyncTime = null;

// Main sync function
export async function performSync(direction = 'bidirectional', options = {}) {
  if (syncInProgress) {
    throw new Error('Sync already in progress');
  }
  
  syncInProgress = true;
  const startTime = Date.now();
  
  try {
    console.log(`Starting ${direction} sync...`);
    
    // Validate authentication
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Authentication required for sync');
    }
    
    let result = {
      success: true,
      direction: direction,
      startTime: startTime,
      local: { read: 0, written: 0, updated: 0, deleted: 0 },
      remote: { read: 0, written: 0, updated: 0, deleted: 0 },
      conflicts: [],
      errors: []
    };
    
    switch (direction) {
      case 'upload':
        result = await syncLocalToRemote(result, options);
        break;
        
      case 'download':
        result = await syncRemoteToLocal(result, options);
        break;
        
      case 'bidirectional':
        result = await syncBidirectional(result, options);
        break;
        
      default:
        throw new Error(`Invalid sync direction: ${direction}`);
    }
    
    // Update sync metadata
    result.endTime = Date.now();
    result.duration = result.endTime - result.startTime;
    lastSyncTime = result.endTime;
    
    // Store sync result
    await chrome.storage.local.set({
      lastSyncTime: lastSyncTime,
      lastSyncResult: result
    });
    
    console.log('Sync completed successfully:', result);
    return result;
    
  } catch (error) {
    console.error('Sync failed:', error);
    
    const errorResult = {
      success: false,
      error: error.message,
      startTime: startTime,
      endTime: Date.now(),
      direction: direction
    };
    
    // Store error result
    await chrome.storage.local.set({
      lastSyncError: errorResult
    });
    
    throw error;
    
  } finally {
    syncInProgress = false;
  }
}

// Upload local customizations to SharePoint
async function syncLocalToRemote(result, options) {
  console.log('Syncing local customizations to SharePoint...');
  
  try {
    // Get local customizations
    const localData = await chrome.storage.local.get('customizations');
    const localCustomizations = localData.customizations || {};
    
    result.local.read = Object.keys(localCustomizations).length;
    
    if (result.local.read === 0) {
      console.log('No local customizations to sync');
      return result;
    }
    
    // Get remote customizations for comparison
    const remoteCustomizations = await sharePointService.getCustomizations();
    result.remote.read = remoteCustomizations.length;
    
    // Process each domain's customizations
    for (const [domain, domainData] of Object.entries(localCustomizations)) {
      await syncDomainToRemote(domain, domainData, remoteCustomizations, result, options);
    }
    
    return result;
    
  } catch (error) {
    result.errors.push({
      type: 'upload',
      message: error.message,
      timestamp: Date.now()
    });
    throw error;
  }
}

// Download remote customizations from SharePoint
async function syncRemoteToLocal(result, options) {
  console.log('Syncing SharePoint customizations to local...');
  
  try {
    // Get remote customizations
    const remoteCustomizations = await sharePointService.getCustomizations();
    result.remote.read = remoteCustomizations.length;
    
    if (result.remote.read === 0) {
      console.log('No remote customizations to sync');
      return result;
    }
    
    // Get current local customizations
    const localData = await chrome.storage.local.get('customizations');
    const localCustomizations = localData.customizations || {};
    result.local.read = Object.keys(localCustomizations).length;
    
    // Process remote customizations
    const updatedCustomizations = { ...localCustomizations };
    
    for (const remoteItem of remoteCustomizations) {
      await syncRemoteItemToLocal(remoteItem, updatedCustomizations, result, options);
    }
    
    // Save updated customizations
    await chrome.storage.local.set({ customizations: updatedCustomizations });
    
    return result;
    
  } catch (error) {
    result.errors.push({
      type: 'download',
      message: error.message,
      timestamp: Date.now()
    });
    throw error;
  }
}

// Bidirectional sync with conflict resolution
async function syncBidirectional(result, options) {
  console.log('Performing bidirectional sync...');
  
  try {
    // Get both local and remote data
    const localData = await chrome.storage.local.get('customizations');
    const localCustomizations = localData.customizations || {};
    const remoteCustomizations = await sharePointService.getCustomizations();
    
    result.local.read = Object.keys(localCustomizations).length;
    result.remote.read = remoteCustomizations.length;
    
    // Create lookup maps
    const remoteMap = new Map();
    remoteCustomizations.forEach(item => {
      remoteMap.set(item.Title, item); // Title = domain name
    });
    
    const updatedCustomizations = { ...localCustomizations };
    
    // Process local items (upload new/changed)
    for (const [domain, domainData] of Object.entries(localCustomizations)) {
      const remoteItem = remoteMap.get(domain);
      
      if (!remoteItem) {
        // Local item doesn't exist remotely - upload it
        await createRemoteCustomization(domain, domainData, result);
      } else {
        // Compare and resolve conflicts
        await resolveConflict(domain, domainData, remoteItem, updatedCustomizations, result, options);
      }
    }
    
    // Process remote items not in local (download new)
    for (const [domain, remoteItem] of remoteMap) {
      if (!localCustomizations[domain]) {
        await syncRemoteItemToLocal(remoteItem, updatedCustomizations, result, options);
      }
    }
    
    // Save updated customizations
    await chrome.storage.local.set({ customizations: updatedCustomizations });
    
    return result;
    
  } catch (error) {
    result.errors.push({
      type: 'bidirectional',
      message: error.message,
      timestamp: Date.now()
    });
    throw error;
  }
}

// Sync a domain's customizations to remote
async function syncDomainToRemote(domain, domainData, remoteCustomizations, result, _options) {
  try {
    // Find existing remote item for this domain
    const existingRemote = remoteCustomizations.find(item => item.Title === domain);
    
    if (existingRemote) {
      // Update existing item
      const updated = await sharePointService.updateCustomization(existingRemote.Id, {
        CustomizationData: JSON.stringify(domainData),
        Version: (existingRemote.Version || 0) + 1,
        Modified: new Date().toISOString()
      });
      
      if (updated) {
        result.remote.updated++;
        console.log(`Updated remote customization for domain: ${domain}`);
      }
    } else {
      // Create new item
      const created = await sharePointService.createCustomization({
        Title: domain,
        CustomizationData: JSON.stringify(domainData),
        Version: 1,
        IsActive: true,
        ApprovalStatus: 'Draft',
        Category: 'Custom',
        Priority: 'Medium'
      });
      
      if (created) {
        result.remote.written++;
        console.log(`Created remote customization for domain: ${domain}`);
      }
    }
    
  } catch (error) {
    result.errors.push({
      type: 'domain_upload',
      domain: domain,
      message: error.message,
      timestamp: Date.now()
    });
    console.error(`Error syncing domain ${domain} to remote:`, error);
  }
}

// Sync a remote item to local storage
async function syncRemoteItemToLocal(remoteItem, localCustomizations, result, options) {
  try {
    // Only sync active and approved items for user version
    if (!remoteItem.IsActive || (options.userVersion && remoteItem.ApprovalStatus !== 'Approved')) {
      return;
    }
    
    const domain = remoteItem.Title;
    let customizationData;
    
    try {
      customizationData = JSON.parse(remoteItem.CustomizationData);
    } catch (parseError) {
      console.error(`Invalid JSON in remote customization for ${domain}:`, parseError);
      result.errors.push({
        type: 'parse_error',
        domain: domain,
        message: 'Invalid JSON format',
        timestamp: Date.now()
      });
      return;
    }
    
    // Check if local version exists and compare
    const existingLocal = localCustomizations[domain];
    
    if (!existingLocal) {
      // New remote item
      localCustomizations[domain] = customizationData;
      result.local.written++;
      console.log(`Downloaded new customization for domain: ${domain}`);
    } else {
      // Compare versions/timestamps to determine if update is needed
      const shouldUpdate = shouldUpdateLocal(existingLocal, customizationData, remoteItem);
      
      if (shouldUpdate) {
        localCustomizations[domain] = customizationData;
        result.local.updated++;
        console.log(`Updated local customization for domain: ${domain}`);
      }
    }
    
  } catch (error) {
    result.errors.push({
      type: 'item_download',
      item: remoteItem.Title,
      message: error.message,
      timestamp: Date.now()
    });
    console.error(`Error syncing remote item ${remoteItem.Title} to local:`, error);
  }
}

// Resolve conflicts between local and remote versions
async function resolveConflict(domain, localData, remoteItem, updatedCustomizations, result, options) {
  try {
    let remoteData;
    
    try {
      remoteData = JSON.parse(remoteItem.CustomizationData);
    } catch (_parseError) {
      // Remote data is invalid, keep local
      console.warn(`Remote data for ${domain} is invalid, keeping local version`);
      return;
    }
    
    // Get timestamps for comparison
    const localTimestamp = getDataTimestamp(localData);
    const remoteTimestamp = new Date(remoteItem.Modified).getTime();
    
    const conflict = {
      domain: domain,
      localTimestamp: localTimestamp,
      remoteTimestamp: remoteTimestamp,
      resolution: null
    };
    
    // Conflict resolution strategy
    const strategy = options.conflictResolution || 'remote_wins';
    
    switch (strategy) {
      case 'local_wins':
        // Keep local, update remote
        await sharePointService.updateCustomization(remoteItem.Id, {
          CustomizationData: JSON.stringify(localData),
          Version: (remoteItem.Version || 0) + 1
        });
        conflict.resolution = 'local_wins';
        result.remote.updated++;
        break;
        
      case 'remote_wins':
        // Keep remote, update local
        updatedCustomizations[domain] = remoteData;
        conflict.resolution = 'remote_wins';
        result.local.updated++;
        break;
        
      case 'newest_wins':
        if (localTimestamp > remoteTimestamp) {
          // Local is newer
          await sharePointService.updateCustomization(remoteItem.Id, {
            CustomizationData: JSON.stringify(localData),
            Version: (remoteItem.Version || 0) + 1
          });
          conflict.resolution = 'local_newer';
          result.remote.updated++;
        } else {
          // Remote is newer or same
          updatedCustomizations[domain] = remoteData;
          conflict.resolution = 'remote_newer';
          result.local.updated++;
        }
        break;
        
      case 'merge': {
        // Attempt to merge (complex logic)
        const merged = attemptMerge(localData, remoteData);
        if (merged) {
          updatedCustomizations[domain] = merged;
          await sharePointService.updateCustomization(remoteItem.Id, {
            CustomizationData: JSON.stringify(merged),
            Version: (remoteItem.Version || 0) + 1
          });
          conflict.resolution = 'merged';
          result.local.updated++;
          result.remote.updated++;
        } else {
          // Merge failed, fall back to newest_wins
          conflict.resolution = 'merge_failed_fallback';
          await resolveConflict(domain, localData, remoteItem, updatedCustomizations, result, 
            { ...options, conflictResolution: 'newest_wins' });
        }
        break;
      }
        
      default:
        console.warn(`Unknown conflict resolution strategy: ${strategy}`);
        conflict.resolution = 'unresolved';
    }
    
    result.conflicts.push(conflict);
    console.log(`Resolved conflict for ${domain}:`, conflict.resolution);
    
  } catch (error) {
    result.errors.push({
      type: 'conflict_resolution',
      domain: domain,
      message: error.message,
      timestamp: Date.now()
    });
    console.error(`Error resolving conflict for ${domain}:`, error);
  }
}

// Create a new remote customization
async function createRemoteCustomization(domain, domainData, result) {
  try {
    const created = await sharePointService.createCustomization({
      Title: domain,
      CustomizationData: JSON.stringify(domainData),
      Version: 1,
      IsActive: true,
      ApprovalStatus: 'Draft',
      Category: 'Custom',
      Priority: 'Medium',
      Description: `Customizations for ${domain}`
    });
    
    if (created) {
      result.remote.written++;
      console.log(`Created new remote customization for domain: ${domain}`);
    }
    
  } catch (error) {
    result.errors.push({
      type: 'create_remote',
      domain: domain,
      message: error.message,
      timestamp: Date.now()
    });
    console.error(`Error creating remote customization for ${domain}:`, error);
  }
}

// Determine if local data should be updated
function shouldUpdateLocal(localData, remoteData, remoteItem) {
  // Compare based on version number if available
  if (remoteItem.Version && localData[0]?.version) {
    return remoteItem.Version > localData[0].version;
  }
  
  // Fall back to timestamp comparison
  const localTimestamp = getDataTimestamp(localData);
  const remoteTimestamp = new Date(remoteItem.Modified).getTime();
  
  return remoteTimestamp > localTimestamp;
}

// Get timestamp from customization data
function getDataTimestamp(data) {
  if (Array.isArray(data) && data[0]) {
    return new Date(data[0].id?.split('_')[1] || 0).getTime();
  }
  return 0;
}

// Attempt to merge local and remote customization data
function attemptMerge(localData, remoteData) {
  try {
    // Simple merge strategy: combine query strings from both
    if (!Array.isArray(localData) || !Array.isArray(remoteData)) {
      return null;
    }
    
    const localItem = localData[0];
    const remoteItem = remoteData[0];
    
    if (!localItem || !remoteItem) {
      return null;
    }
    
    // Merge query strings
    const mergedQueryStrings = {
      ...remoteItem.queryStrings,
      ...localItem.queryStrings
    };
    
    // Create merged result
    const merged = [{
      ...remoteItem,
      ...localItem,
      queryStrings: mergedQueryStrings,
      id: `${localItem.domain}_${Date.now()}`,
      mergedAt: Date.now()
    }];
    
    console.log('Successfully merged customization data');
    return merged;
    
  } catch (error) {
    console.error('Merge attempt failed:', error);
    return null;
  }
}

// Get sync status
export async function getSyncStatus() {
  try {
    const data = await chrome.storage.local.get([
      'lastSyncTime',
      'lastSyncResult',
      'lastSyncError'
    ]);
    
    return {
      inProgress: syncInProgress,
      lastSyncTime: data.lastSyncTime,
      lastResult: data.lastSyncResult,
      lastError: data.lastSyncError,
      hasNeverSynced: !data.lastSyncTime
    };
    
  } catch (error) {
    console.error('Error getting sync status:', error);
    return {
      inProgress: false,
      error: error.message
    };
  }
}

// Cancel ongoing sync (if possible)
export async function cancelSync() {
  if (!syncInProgress) {
    return { success: false, reason: 'No sync in progress' };
  }
  
  // Note: This is a simple flag - actual cancellation depends on implementation
  syncInProgress = false;
  
  console.log('Sync cancellation requested');
  return { success: true };
}

// Clear sync history
export async function clearSyncHistory() {
  try {
    await chrome.storage.local.remove([
      'lastSyncTime',
      'lastSyncResult', 
      'lastSyncError'
    ]);
    
    console.log('Sync history cleared');
    return { success: true };
    
  } catch (error) {
    console.error('Error clearing sync history:', error);
    return { success: false, error: error.message };
  }
}