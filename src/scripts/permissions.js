// src/scripts/permissions.js - Role-Based Access Control Configuration

// Permission definitions for various actions
export const PERMISSIONS = {
    // Rule Management
    CREATE_RULE: ['System Administrator', 'System Customizer'],
    EDIT_RULE: ['System Administrator', 'System Customizer'],
    DELETE_RULE: ['System Administrator', 'System Customizer'],
    PREVIEW_RULE: ['System Administrator', 'System Customizer'],
    
    // Synchronization
    SYNC_DATAVERSE: ['System Administrator', 'System Customizer'],
    SYNC_SHAREPOINT: ['System Administrator', 'System Customizer'],
    RESOLVE_CONFLICTS: ['System Administrator', 'System Customizer'],
    
    // Settings Management
    MANAGE_SETTINGS: ['System Administrator', 'System Customizer'],
    MANAGE_LICENSE: ['System Administrator', 'System Customizer'],
    CONFIGURE_SYNC: ['System Administrator', 'System Customizer'],
    
    // Data Operations
    EXPORT_DATA: ['System Administrator', 'System Customizer'],
    IMPORT_DATA: ['System Administrator', 'System Customizer'],
    EXPORT_SETTINGS: ['System Administrator', 'System Customizer'],
    IMPORT_SETTINGS: ['System Administrator', 'System Customizer'],
    
    // Advanced Features
    USE_SCREENSHOT: ['System Administrator', 'System Customizer'],
    USE_EYEDROPPER: ['System Administrator', 'System Customizer'],
    CONFIGURE_AI: ['System Administrator', 'System Customizer'],
    GENERATE_DOCS: ['System Administrator', 'System Customizer']
};

// Check if user has permission for a specific action
export async function checkPermission(action) {
    try {
        const { userRole } = await chrome.storage.local.get('userRole');
        
        if (!userRole || !userRole.roles) {
            console.warn('No user role information available');
            return false;
        }
        
        const allowedRoles = PERMISSIONS[action] || [];
        const hasPermission = allowedRoles.some(role => userRole.roles.includes(role));
        
        console.log(`Permission check for ${action}: ${hasPermission ? 'GRANTED' : 'DENIED'}`);
        
        // Audit log
        await logPermissionCheck(action, hasPermission, userRole);
        
        return hasPermission;
    } catch (error) {
        console.error('Permission check error:', error);
        return false;
    }
}

// Check multiple permissions at once
export async function checkPermissions(actions) {
    const results = {};
    
    for (const action of actions) {
        results[action] = await checkPermission(action);
    }
    
    return results;
}

// Get all permissions for current user
export async function getUserPermissions() {
    try {
        const { userRole } = await chrome.storage.local.get('userRole');
        
        if (!userRole || !userRole.roles) {
            return {};
        }
        
        const permissions = {};
        
        for (const [action, allowedRoles] of Object.entries(PERMISSIONS)) {
            permissions[action] = allowedRoles.some(role => userRole.roles.includes(role));
        }
        
        return permissions;
    } catch (error) {
        console.error('Error getting user permissions:', error);
        return {};
    }
}

// Audit logging for permission checks
async function logPermissionCheck(action, granted, userRole) {
    try {
        const { auditLog = [] } = await chrome.storage.local.get('auditLog');
        
        const logEntry = {
            timestamp: Date.now(),
            action,
            granted,
            userId: userRole.userId || 'unknown',
            roles: userRole.roles || [],
            url: window.location?.href || 'background'
        };
        
        // Keep only last 1000 entries
        const updatedLog = [...auditLog, logEntry].slice(-1000);
        
        await chrome.storage.local.set({ auditLog: updatedLog });
    } catch (error) {
        console.error('Audit logging error:', error);
    }
}

// Log admin actions
export async function logAdminAction(action, details = {}) {
    try {
        const { userRole } = await chrome.storage.local.get('userRole');
        const { adminActionLog = [] } = await chrome.storage.local.get('adminActionLog');
        
        const logEntry = {
            timestamp: Date.now(),
            action,
            details,
            userId: userRole?.userId || 'unknown',
            roles: userRole?.roles || [],
            success: true
        };
        
        // Keep only last 500 admin actions
        const updatedLog = [...adminActionLog, logEntry].slice(-500);
        
        await chrome.storage.local.set({ adminActionLog: updatedLog });
        
        console.log('Admin action logged:', action);
    } catch (error) {
        console.error('Admin action logging error:', error);
    }
}

// Get audit logs for specific time period
export async function getAuditLogs(startTime, endTime) {
    try {
        const { auditLog = [] } = await chrome.storage.local.get('auditLog');
        
        return auditLog.filter(entry => 
            entry.timestamp >= startTime && entry.timestamp <= endTime
        );
    } catch (error) {
        console.error('Error retrieving audit logs:', error);
        return [];
    }
}

// Get admin action logs
export async function getAdminActionLogs(startTime, endTime) {
    try {
        const { adminActionLog = [] } = await chrome.storage.local.get('adminActionLog');
        
        return adminActionLog.filter(entry => 
            entry.timestamp >= startTime && entry.timestamp <= endTime
        );
    } catch (error) {
        console.error('Error retrieving admin action logs:', error);
        return [];
    }
}

// Clear old audit logs
export async function cleanupAuditLogs(daysToKeep = 30) {
    try {
        const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        
        const { auditLog = [], adminActionLog = [] } = await chrome.storage.local.get(['auditLog', 'adminActionLog']);
        
        const cleanedAuditLog = auditLog.filter(entry => entry.timestamp > cutoffTime);
        const cleanedAdminLog = adminActionLog.filter(entry => entry.timestamp > cutoffTime);
        
        await chrome.storage.local.set({
            auditLog: cleanedAuditLog,
            adminActionLog: cleanedAdminLog
        });
        
        console.log(`Cleaned up audit logs older than ${daysToKeep} days`);
    } catch (error) {
        console.error('Audit log cleanup error:', error);
    }
}