# Implementation Plan for Remaining Features

## Overview
This document outlines the implementation plan for the remaining features in the D365 DOM Style Injector Extension. Features are organized by priority and include technical details, dependencies, and estimated effort.

---

## HIGH PRIORITY FEATURES

### 3. Complete Settings/Options Page Configuration
**Status**: Partially Complete  
**Effort**: 2-3 hours  
**Dependencies**: None

**What's Done**:
- Basic options page structure
- Authentication settings
- Sync configuration and conflict resolution
- Cache management

**What's Needed**:
- Add remaining configuration sections:
  - License configuration (endpoint URL, validation interval)
  - Support contact settings (email/chat/webform)
  - Advanced debugging options
  - Performance tuning settings
- Add validation for all input fields
- Implement settings export/import

**Implementation Steps**:
1. Add new sections to options.html
2. Update options.js with new field handlers
3. Add validation logic
4. Implement settings backup/restore functionality

---

### 4. Implement Preview Changes Functionality
**Status**: Not Started  
**Effort**: 4-5 hours  
**Dependencies**: None

**Description**: Allow admins to preview CSS changes before saving them

**Implementation Steps**:
1. Add "Preview" button to customization form in popup.html
2. Create preview mode in content.js:
   ```javascript
   // Add temporary style element with preview class
   function previewCustomization(customization) {
     const previewId = 'preview-' + customization.id;
     removePreview(previewId);
     
     const styleEl = document.createElement('style');
     styleEl.id = previewId;
     styleEl.className = 'dom-injector-preview';
     styleEl.textContent = generateCSS(customization);
     document.head.appendChild(styleEl);
     
     // Auto-remove after 30 seconds
     setTimeout(() => removePreview(previewId), 30000);
   }
   ```
3. Add visual indicator for preview mode (border/overlay)
4. Add "Apply" and "Cancel" buttons during preview
5. Implement message passing between popup and content script

---

### 5. Add Role-Based Access Control (RBAC) Checks
**Status**: Partially Implemented  
**Effort**: 3-4 hours  
**Dependencies**: Authentication system

**What's Done**:
- Basic role checking in background.js
- Admin vs User view switching

**What's Needed**:
- Granular permission checks for each operation
- Role-based UI element visibility
- Audit logging for admin actions

**Implementation Steps**:
1. Create permissions configuration:
   ```javascript
   const PERMISSIONS = {
     CREATE_RULE: ['System Administrator', 'System Customizer'],
     EDIT_RULE: ['System Administrator', 'System Customizer'],
     DELETE_RULE: ['System Administrator'],
     SYNC_DATAVERSE: ['System Administrator', 'System Customizer'],
     MANAGE_SETTINGS: ['System Administrator'],
     EXPORT_DATA: ['System Administrator', 'System Customizer']
   };
   ```
2. Add permission check function:
   ```javascript
   async function checkPermission(action) {
     const { userRole } = await chrome.storage.local.get('userRole');
     const allowedRoles = PERMISSIONS[action] || [];
     return allowedRoles.some(role => userRole.roles.includes(role));
   }
   ```
3. Wrap all admin operations with permission checks
4. Update UI to show/hide elements based on permissions
5. Add audit log entries for all admin actions

---

## MEDIUM PRIORITY FEATURES

### 6. Implement KMSI (Keep Me Signed In)
**Status**: Not Started  
**Effort**: 2-3 hours  
**Dependencies**: MSAL authentication

**Implementation Steps**:
1. Add KMSI checkbox to authentication flow
2. Update MSAL configuration:
   ```javascript
   const msalConfig = {
     auth: {
       clientId: config.clientId,
       authority: config.authority,
       redirectUri: chrome.identity.getRedirectURL()
     },
     cache: {
       cacheLocation: 'localStorage',
       storeAuthStateInCookie: true
     },
     system: {
       tokenRenewalOffsetSeconds: 300,
       navigateFrameWait: 0
     }
   };
   ```
3. Implement token refresh logic with extended expiration
4. Store KMSI preference in chrome.storage.local
5. Update background.js to check KMSI on startup

---

### 7. Implement Tenant-Specific Licensing
**Status**: Not Started  
**Effort**: 8-10 hours  
**Dependencies**: Backend license server (not included)

**Implementation Steps**:
1. Create license validation module:
   ```javascript
   // src/scripts/license-validator.js
   class LicenseValidator {
     constructor() {
       this.licenseEndpoint = 'https://your-license-server.com/api/validate';
       this.publicKey = 'YOUR_PUBLIC_KEY_HERE';
     }
     
     async validateLicense(tenantId, userId) {
       // Fetch license from server
       // Verify digital signature
       // Check expiration
       // Validate tenant/user match
     }
   }
   ```
2. Add license check on extension startup
3. Create license status UI in popup
4. Implement grace period for offline validation
5. Add license caching with encryption
6. Create admin interface for license management

---

### 8. Implement Export/Import Functionality
**Status**: Partially Complete  
**Effort**: 2-3 hours  
**Dependencies**: None

**What's Done**:
- Basic export/import in options.js

**What's Needed**:
- Export/import from popup interface
- Selective export (by category, date, etc.)
- Validation and conflict handling on import
- Support for different formats (JSON, CSV)

**Implementation Steps**:
1. Add export/import UI to popup.html
2. Create export options dialog:
   - Select customizations to export
   - Choose format (JSON/CSV)
   - Include/exclude metadata
3. Enhance import with:
   - Preview of changes
   - Conflict detection
   - Merge options
4. Add progress indicators for large imports

---

### 9. Implement Search/Filter Functionality
**Status**: Not Started  
**Effort**: 3-4 hours  
**Dependencies**: None

**Implementation Steps**:
1. Add search UI to popup.html:
   ```html
   <div class="search-section">
     <input type="text" id="search-input" placeholder="Search customizations...">
     <select id="filter-category">
       <option value="">All Categories</option>
       <option value="buttons">Buttons</option>
       <option value="forms">Forms</option>
       <!-- Dynamic categories -->
     </select>
     <select id="sort-by">
       <option value="name">Name</option>
       <option value="created">Created Date</option>
       <option value="modified">Modified Date</option>
     </select>
   </div>
   ```
2. Implement search algorithm:
   - Search in name, selector, description
   - Support for regex patterns
   - Real-time filtering
3. Add sort functionality
4. Store search preferences
5. Add search highlighting in results

---

### 10. Complete User Version of Extension
**Status**: Partially Complete  
**Effort**: 4-5 hours  
**Dependencies**: RBAC implementation

**What's Done**:
- Basic user view in popup.html
- Limited functionality display

**What's Needed**:
- Enhanced user interface
- Support request functionality
- Customization request form
- Read-only customization viewer

**Implementation Steps**:
1. Enhance user view in popup.html:
   - Display active customizations
   - Show last sync time
   - Add refresh button
2. Create support request form:
   ```html
   <div class="support-section">
     <h3>Request Support</h3>
     <textarea id="support-message"></textarea>
     <button id="send-support">Send to Admin</button>
   </div>
   ```
3. Implement customization request workflow
4. Add user-specific settings (theme preference, etc.)
5. Create user guide/help section

---

## LOW PRIORITY FEATURES

### 11. Screenshot Capture and Markup
**Status**: Not Started  
**Effort**: 6-8 hours  
**Dependencies**: Chrome tabs API

**Implementation Steps**:
1. Implement screenshot capture:
   ```javascript
   async function captureScreenshot() {
     const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
     const screenshot = await chrome.tabs.captureVisibleTab();
     return screenshot; // base64 data URL
   }
   ```
2. Create markup interface:
   - Canvas-based drawing tools
   - Text annotations
   - Shapes (rectangles, arrows)
   - Blur tool for sensitive data
3. Implement save/share functionality
4. Add to support request workflow

---

### 12. Custom Branding Settings
**Status**: Not Started  
**Effort**: 4-5 hours  
**Dependencies**: Settings system

**Implementation Steps**:
1. Add branding section to options:
   - Logo upload
   - Color scheme picker
   - Font selection
   - Custom CSS injection
2. Create theme system:
   ```javascript
   const themes = {
     default: { primary: '#667eea', secondary: '#764ba2' },
     corporate: { primary: '#0078d4', secondary: '#106ebe' },
     custom: { /* User defined */ }
   };
   ```
3. Implement theme switching
4. Store branding in sync storage
5. Apply branding to all extension UI

---

### 13. Eyedropper Tool
**Status**: Not Started  
**Effort**: 8-10 hours  
**Dependencies**: Content script enhancements

**Implementation Steps**:
1. Create eyedropper mode in content script:
   ```javascript
   class EyedropperTool {
     constructor() {
       this.active = false;
       this.overlay = null;
       this.tooltip = null;
     }
     
     activate() {
       this.createOverlay();
       document.addEventListener('mousemove', this.handleMouseMove);
       document.addEventListener('click', this.handleClick);
     }
     
     handleMouseMove(e) {
       const element = document.elementFromPoint(e.clientX, e.clientY);
       this.highlightElement(element);
       this.showTooltip(element, e);
     }
   }
   ```
2. Implement element detection and highlighting
3. Create property inspector tooltip
4. Add DevTools integration
5. Generate selector suggestions

---

### 14. Documentation Generation
**Status**: Not Started  
**Effort**: 10-12 hours  
**Dependencies**: AI integration

**Implementation Steps**:
1. Create documentation template system
2. Implement customization analyzer:
   - Group by category
   - Detect patterns
   - Generate descriptions
3. Add Mermaid diagram generation:
   ```javascript
   function generateMermaidDiagram(customizations) {
     let diagram = 'graph TD\n';
     // Generate hierarchy
     return diagram;
   }
   ```
4. Integrate with AI for descriptions
5. Add export to Markdown/PDF

---

### 15. AI Integration
**Status**: Not Started  
**Effort**: 12-15 hours  
**Dependencies**: API keys, settings system

**Implementation Steps**:
1. Create AI service abstraction:
   ```javascript
   class AIService {
     constructor(provider, apiKey) {
       this.provider = provider;
       this.apiKey = apiKey;
     }
     
     async generateDescription(customization) {
       // Provider-specific implementation
     }
     
     async suggestSelectors(element) {
       // AI-powered selector generation
     }
   }
   ```
2. Implement provider adapters:
   - OpenAI/ChatGPT
   - Anthropic/Claude
   - Google/Gemini
   - Microsoft/Copilot
3. Add API key management UI
4. Create AI-powered features:
   - CSS generation
   - Selector suggestions
   - Documentation writing
   - Code review

---

### 16. Visio Online Integration
**Status**: Not Started  
**Effort**: 8-10 hours  
**Dependencies**: Microsoft Graph API

**Implementation Steps**:
1. Add Visio permissions to manifest
2. Implement Visio API client:
   ```javascript
   class VisioClient {
     async createDiagram(customizations) {
       const accessToken = await getAccessToken(['Files.ReadWrite']);
       // Create Visio document via Graph API
       // Generate shapes for customizations
       // Apply layout algorithm
     }
   }
   ```
3. Create diagram templates
4. Add to documentation workflow
5. Implement save to SharePoint/OneDrive

---

## Implementation Schedule

### Week 1-2: High Priority
- Complete settings/options page
- Implement preview functionality
- Add RBAC checks

### Week 3-4: Medium Priority (Part 1)
- KMSI implementation
- Begin licensing system
- Complete export/import

### Week 5-6: Medium Priority (Part 2)
- Complete licensing system
- Search/filter functionality
- Finish user version

### Week 7-8: Low Priority (Essential)
- Screenshot capture
- Custom branding
- Eyedropper tool (partial)

### Week 9-10: Low Priority (Advanced)
- Complete eyedropper tool
- Documentation generation
- Begin AI integration

### Week 11-12: Low Priority (Integration)
- Complete AI integration
- Visio integration
- Final testing and polish

---

## Technical Considerations

1. **Performance**: Implement lazy loading for large customization lists
2. **Security**: All API keys should be encrypted in storage
3. **Offline Support**: Cache critical data for offline use
4. **Backward Compatibility**: Maintain support for existing customizations
5. **Testing**: Add unit tests for new features
6. **Documentation**: Update user guide with each feature

---

## Risk Mitigation

1. **Licensing Server**: Can be mocked initially for development
2. **AI APIs**: Start with one provider, add others incrementally
3. **Complex Features**: Break down into smaller, testable components
4. **User Feedback**: Release features in beta to subset of users

---

## Success Metrics

- All high priority features completed and tested
- 80% of medium priority features implemented
- At least 50% of low priority features started
- No regression in existing functionality
- Positive user feedback on new features