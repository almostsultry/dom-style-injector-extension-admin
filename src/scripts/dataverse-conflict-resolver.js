// src/scripts/dataverse-conflict-resolver.js
// Conflict resolution logic for Dataverse synchronization

// Conflict resolution strategies
const ConflictResolutionStrategy = {
  LOCAL_WINS: 'local_wins',
  REMOTE_WINS: 'remote_wins',
  NEWEST_WINS: 'newest_wins',
  MERGE: 'merge',
  MANUAL: 'manual'
};

// Resolve conflicts between local and remote customizations
async function resolveDataverseConflicts(localCustomizations, remoteCustomizations, options = {}) {
  const {
    strategy = ConflictResolutionStrategy.NEWEST_WINS,
    autoResolve = true,
    preserveLocalOnly = true
  } = options;

  const conflicts = [];
  const resolved = [];
  const errors = [];

  // Create maps for efficient lookup
  const localMap = new Map(localCustomizations.map(c => [c.id, c]));
  const remoteMap = new Map(remoteCustomizations.map(c => [c.id, c]));

  // Process all unique IDs
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    try {
      if (local && remote) {
        // Both exist - potential conflict
        const resolution = await resolveConflict(local, remote, strategy);
        
        if (resolution.hasConflict) {
          conflicts.push(resolution);
          
          if (autoResolve) {
            resolved.push(resolution.resolved);
          }
        } else {
          // No conflict - versions match
          resolved.push(remote);
        }
      } else if (local && !remote) {
        // Only exists locally
        if (preserveLocalOnly) {
          resolved.push({ ...local, source: 'local' });
        }
      } else if (!local && remote) {
        // Only exists remotely
        resolved.push({ ...remote, source: 'dataverse' });
      }
    } catch (error) {
      errors.push({
        id,
        error: error.message,
        local,
        remote
      });
    }
  }

  return {
    resolved,
    conflicts: autoResolve ? [] : conflicts,
    errors,
    stats: {
      total: allIds.size,
      localOnly: [...allIds].filter(id => localMap.has(id) && !remoteMap.has(id)).length,
      remoteOnly: [...allIds].filter(id => !localMap.has(id) && remoteMap.has(id)).length,
      conflicts: conflicts.length,
      resolved: resolved.length,
      errors: errors.length
    }
  };
}

// Resolve a single conflict between local and remote versions
async function resolveConflict(local, remote, strategy) {
  // Compare timestamps
  const localTime = new Date(local.modifiedOn || local.updated || 0).getTime();
  const remoteTime = new Date(remote.modifiedOn || remote.updated || 0).getTime();

  // Check if there's actually a conflict
  const hasConflict = !areCustomizationsEqual(local, remote);

  if (!hasConflict) {
    return {
      hasConflict: false,
      resolved: remote
    };
  }

  let resolved;
  let resolution;

  switch (strategy) {
    case ConflictResolutionStrategy.LOCAL_WINS:
      resolved = { ...local, conflictResolution: 'local_wins' };
      resolution = 'local_wins';
      break;

    case ConflictResolutionStrategy.REMOTE_WINS:
      resolved = { ...remote, conflictResolution: 'remote_wins' };
      resolution = 'remote_wins';
      break;

    case ConflictResolutionStrategy.NEWEST_WINS:
      if (localTime > remoteTime) {
        resolved = { ...local, conflictResolution: 'local_newer' };
        resolution = 'local_newer';
      } else {
        resolved = { ...remote, conflictResolution: 'remote_newer' };
        resolution = 'remote_newer';
      }
      break;

    case ConflictResolutionStrategy.MERGE:
      const merged = mergeCustomizations(local, remote);
      if (merged) {
        resolved = { ...merged, conflictResolution: 'merged' };
        resolution = 'merged';
      } else {
        // Merge failed, fall back to newest wins
        resolved = localTime > remoteTime ? 
          { ...local, conflictResolution: 'merge_failed_local' } : 
          { ...remote, conflictResolution: 'merge_failed_remote' };
        resolution = 'merge_failed';
      }
      break;

    case ConflictResolutionStrategy.MANUAL:
      // Return conflict info for manual resolution
      return {
        hasConflict: true,
        needsManualResolution: true,
        local,
        remote,
        differences: getCustomizationDifferences(local, remote),
        localTime,
        remoteTime
      };

    default:
      throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
  }

  return {
    hasConflict: true,
    resolved,
    resolution,
    local,
    remote,
    localTime,
    remoteTime,
    differences: getCustomizationDifferences(local, remote)
  };
}

// Check if two customizations are equal
function areCustomizationsEqual(custom1, custom2) {
  // Compare essential properties
  const props = ['name', 'selector', 'css', 'javascript', 'enabled', 'targetUrl', 'priority', 'category'];
  
  for (const prop of props) {
    if (custom1[prop] !== custom2[prop]) {
      return false;
    }
  }

  // Compare pseudo-classes
  const pseudo1 = custom1.pseudoClasses || {};
  const pseudo2 = custom2.pseudoClasses || {};
  
  if (Object.keys(pseudo1).length !== Object.keys(pseudo2).length) {
    return false;
  }

  for (const key in pseudo1) {
    if (JSON.stringify(pseudo1[key]) !== JSON.stringify(pseudo2[key])) {
      return false;
    }
  }

  return true;
}

// Get differences between two customizations
function getCustomizationDifferences(custom1, custom2) {
  const differences = [];
  const props = ['name', 'selector', 'css', 'javascript', 'enabled', 'targetUrl', 'priority', 'category', 'description'];

  for (const prop of props) {
    if (custom1[prop] !== custom2[prop]) {
      differences.push({
        property: prop,
        local: custom1[prop],
        remote: custom2[prop]
      });
    }
  }

  // Compare pseudo-classes
  const pseudo1 = custom1.pseudoClasses || {};
  const pseudo2 = custom2.pseudoClasses || {};
  const allPseudoKeys = new Set([...Object.keys(pseudo1), ...Object.keys(pseudo2)]);

  for (const key of allPseudoKeys) {
    if (JSON.stringify(pseudo1[key]) !== JSON.stringify(pseudo2[key])) {
      differences.push({
        property: `pseudoClasses.${key}`,
        local: pseudo1[key],
        remote: pseudo2[key]
      });
    }
  }

  return differences;
}

// Merge two customizations
function mergeCustomizations(local, remote) {
  try {
    // Start with remote as base (assuming it's the authoritative source)
    const merged = { ...remote };

    // Merge specific fields based on rules
    // Keep the newest name and description
    const localTime = new Date(local.modifiedOn || local.updated || 0).getTime();
    const remoteTime = new Date(remote.modifiedOn || remote.updated || 0).getTime();

    if (localTime > remoteTime) {
      merged.name = local.name;
      merged.description = local.description;
    }

    // Merge CSS - combine if different
    if (local.css !== remote.css) {
      merged.css = mergeCss(local.css, remote.css);
    }

    // Merge JavaScript - keep newest
    if (local.javascript !== remote.javascript) {
      merged.javascript = localTime > remoteTime ? local.javascript : remote.javascript;
    }

    // Merge pseudo-classes - combine all
    merged.pseudoClasses = mergePseudoClasses(local.pseudoClasses, remote.pseudoClasses);

    // Use most restrictive enabled state
    merged.enabled = local.enabled && remote.enabled;

    // Use highest priority
    merged.priority = Math.max(local.priority || 1, remote.priority || 1);

    // Add merge metadata
    merged.mergedAt = new Date().toISOString();
    merged.mergedFrom = {
      local: { id: local.id, modifiedOn: local.modifiedOn },
      remote: { id: remote.id, modifiedOn: remote.modifiedOn }
    };

    return merged;

  } catch (error) {
    console.error('Error merging customizations:', error);
    return null;
  }
}

// Merge CSS strings
function mergeCss(css1, css2) {
  if (!css1) return css2;
  if (!css2) return css1;
  if (css1 === css2) return css1;

  // Simple merge - combine both with a comment separator
  return `/* === Local CSS === */\n${css1}\n\n/* === Remote CSS === */\n${css2}`;
}

// Merge pseudo-class objects
function mergePseudoClasses(pseudo1 = {}, pseudo2 = {}) {
  const merged = { ...pseudo2 };

  // Add any pseudo-classes from local that aren't in remote
  for (const [key, value] of Object.entries(pseudo1)) {
    if (!merged[key]) {
      merged[key] = value;
    } else if (typeof value === 'object' && typeof merged[key] === 'object') {
      // Merge objects
      merged[key] = { ...merged[key], ...value };
    }
  }

  return merged;
}

// Handle manual conflict resolution
async function handleManualConflictResolution(conflicts, userChoices) {
  const resolved = [];

  for (const conflict of conflicts) {
    const choice = userChoices.find(c => c.id === conflict.local.id);
    
    if (!choice) {
      throw new Error(`No resolution choice provided for conflict: ${conflict.local.id}`);
    }

    switch (choice.resolution) {
      case 'keep_local':
        resolved.push({ ...conflict.local, conflictResolution: 'manual_local' });
        break;
      
      case 'keep_remote':
        resolved.push({ ...conflict.remote, conflictResolution: 'manual_remote' });
        break;
      
      case 'keep_both':
        // Create a new ID for the local version
        const localCopy = {
          ...conflict.local,
          id: generateId(),
          name: `${conflict.local.name} (Local)`,
          conflictResolution: 'manual_both_local'
        };
        resolved.push(localCopy);
        resolved.push({ ...conflict.remote, conflictResolution: 'manual_both_remote' });
        break;
      
      case 'custom':
        // Use the custom resolution provided by the user
        if (!choice.customResolution) {
          throw new Error(`Custom resolution data missing for conflict: ${conflict.local.id}`);
        }
        resolved.push({
          ...choice.customResolution,
          conflictResolution: 'manual_custom'
        });
        break;
      
      default:
        throw new Error(`Unknown resolution choice: ${choice.resolution}`);
    }
  }

  return resolved;
}

// Generate a unique ID
function generateId() {
  return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export functions for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    resolveDataverseConflicts,
    resolveConflict,
    handleManualConflictResolution,
    ConflictResolutionStrategy,
    areCustomizationsEqual,
    getCustomizationDifferences
  };
}