// Development Mode Indicator
// Shows a visual indicator when running in development mode

function initializeDevModeIndicator() {
  // Check if we're in development mode
  const manifest = chrome.runtime.getManifest();
  const isDev = manifest.version.includes('dev') || 
                manifest.version.includes('beta') || 
                !chrome.runtime.id || 
                chrome.runtime.id.length !== 32 ||
                localStorage.getItem('DEV_MODE') === 'true';
  
  if (!isDev) {
    return; // Not in dev mode, don't show indicator
  }
  
  // Create dev mode indicator
  const indicator = document.createElement('div');
  indicator.id = 'dev-mode-indicator';
  indicator.innerHTML = `
    <span class="dev-badge">🔧 DEV MODE</span>
    <span class="dev-info">Mock APIs Active</span>
  `;
  
  // Style the indicator
  const style = document.createElement('style');
  style.textContent = `
    #dev-mode-indicator {
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: #fbbf24;
      color: #78350f;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; }
    }
    
    #dev-mode-indicator .dev-badge {
      background: #f59e0b;
      color: #451a03;
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    #dev-mode-indicator .dev-info {
      font-size: 11px;
      opacity: 0.9;
    }
    
    /* For popup and options pages */
    body.extension-popup #dev-mode-indicator,
    body.extension-options #dev-mode-indicator {
      position: absolute;
      bottom: 5px;
      right: 5px;
      font-size: 10px;
      padding: 4px 8px;
    }
  `;
  
  // Add to page
  document.head.appendChild(style);
  document.body.appendChild(indicator);
  
  // Click to toggle dev mode settings
  indicator.addEventListener('click', () => {
    showDevModeSettings();
  });
}

function showDevModeSettings() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      max-width: 400px;
    ">
      <h3 style="margin: 0 0 15px;">Development Mode Settings</h3>
      
      <div style="margin-bottom: 10px;">
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="mock-valid-license" checked>
          Mock Valid License
        </label>
      </div>
      
      <div style="margin-bottom: 10px;">
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="mock-admin-role" checked>
          Mock Admin Role
        </label>
      </div>
      
      <div style="margin-bottom: 10px;">
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="verbose-logging" checked>
          Verbose Logging
        </label>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label>Mock Tenant ID:</label>
        <input type="text" id="mock-tenant-id" value="dev-tenant-12345" style="
          width: 100%;
          padding: 4px 8px;
          margin-top: 4px;
          border: 1px solid #ddd;
          border-radius: 4px;
        ">
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="this.closest('div').parentElement.remove()" style="
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
        ">Cancel</button>
        <button onclick="saveDevModeSettings()" style="
          padding: 6px 12px;
          border: none;
          background: #667eea;
          color: white;
          border-radius: 4px;
          cursor: pointer;
        ">Save</button>
      </div>
    </div>
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9999;
    " onclick="this.parentElement.remove()"></div>
  `;
  
  document.body.appendChild(modal);
  
  // Load current settings
  const settings = JSON.parse(localStorage.getItem('DEV_MODE_SETTINGS') || '{}');
  if (settings.mockValidLicense !== undefined) {
    document.getElementById('mock-valid-license').checked = settings.mockValidLicense;
  }
  if (settings.mockAdminRole !== undefined) {
    document.getElementById('mock-admin-role').checked = settings.mockAdminRole;
  }
  if (settings.verboseLogging !== undefined) {
    document.getElementById('verbose-logging').checked = settings.verboseLogging;
  }
  if (settings.mockTenantId) {
    document.getElementById('mock-tenant-id').value = settings.mockTenantId;
  }
}

function saveDevModeSettings() {
  const settings = {
    mockValidLicense: document.getElementById('mock-valid-license').checked,
    mockAdminRole: document.getElementById('mock-admin-role').checked,
    verboseLogging: document.getElementById('verbose-logging').checked,
    mockTenantId: document.getElementById('mock-tenant-id').value
  };
  
  localStorage.setItem('DEV_MODE_SETTINGS', JSON.stringify(settings));
  
  // Close modal
  document.querySelector('[style*="z-index: 10000"]').parentElement.remove();
  
  // Show notification
  const notification = document.createElement('div');
  notification.textContent = 'Dev settings saved! Reload to apply changes.';
  notification.style = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDevModeIndicator);
} else {
  initializeDevModeIndicator();
}

// Make save function globally available
window.saveDevModeSettings = saveDevModeSettings;