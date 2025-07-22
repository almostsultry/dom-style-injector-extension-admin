# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the D365 Model App Customizer Extension (formerly called the D365 DOM Style Injector Extension) - a browser extension for CSS injection and DOM manipulation in Microsoft Dynamics 365 environments. The extension targets Manifest V3, supports both Chrome and Edge browsers, and includes all the necessary files for a Microsoft tenant administrator to import the Power Platform managed solution (with Dataverse tables and customizations) and distribute the extension binaries manually or via Group Policy. 

**Key Features:**
- **Admin version with full CRUD capabilities for managing style injections:**
  - **Core Customization Management**
    * **Create Customizations** - Define CSS rules and DOM manipulations for D365/SharePoint elements
    * **Edit Existing Customizations** - Modify saved customization rules
    * **Delete Customizations** - Remove unwanted customization rules
    * **Enable/Disable Customizations** - Toggle customizations on/off without deleting them
    * **Save Customizations** - Store customization rules locally
  * **Targeting & Rules**
    * **Unified Field System** - Single interface for targets and styles
    * **Multiple Target Support** - Apply styles to multiple elements with different selectors (ID, class, attributes)
    * **Complete Pseudo-class Support** - Allow Admin to add one or more pseudo-classes or element states from the complete list of those supported in Chrome and/or Edge to customizations (e.g., 'hover', 'active', 'focus', 'focus-within', 'focus-visible', 'target', 'valid', 'invalid', 'read-write', 'read-only', 'checked', 'disabled', 'enabled', 'required', 'optional’, etc.)
    * **URL/Domain Matching** - Target specific D365/SharePoint domains or pages
    * **Advanced CSS Editor** - Write complex CSS rules with syntax support
    * **Query String Detection** - Detect and use query string parameters for targeting
  * **Bulk Operations**
    * **Export Customizations** - Export all or a selectable subset of customizations to JSON file
    * **Import Customizations** - Import customizations from JSON file
    * **Clear All Customizations** - Delete all or a selectable subset of customizations for a domain at once
    * **Search/Filter Customizations** - Search through existing customizations
    * **Save to SharePoint** - optionally save files to a local directory or the tenant’s SharePoint/OneDrive
  * **Dataverse Integration**
    * **Sync to Dataverse** - Publish customizations to Dataverse table for organization-wide deployment
    * **Download from Dataverse** - Retrieve customizations from Dataverse
    * **Bidirectional Sync** - Two-way synchronization between local and Dataverse storage
    * **Conflict Resolution** - Handle conflicts during synchronization
  * **Tools Integration**
    * **AI** - Integrate with common generative AI providers (Microsoft Copilot {if licensed as determined by an asynchronous API query after successful Microsoft Graph authentication}, ChatGPT, Claude, Grok, and Gemini) via Admin-provided API keys
    * **Visio** - Integrate with Visio online as an optional documentation diagraming tool
    * **SharePoint/OneDrive** - Integrate with SharePoint and OneDrive for Business to as optional file saving destinations (if opted into by the Admin in the Settings interface)
  * **Authentication & Security**
    * **Entra External ID Authentication** - Sign in with the user’s Microsoft account to my Azure app for licensing authorization and Copilot licensing query and also to access their tenant for Dataverse role, membership, and customizations queries
    * **Role-Based Access Control** - Full CRUD operations for System Customizer/Administrator roles
    * **Token Management** - Secure authentication token handling with 30-day cache
    * **Logout Functionality** - Sign out and clear authentication
    * **Tenant-specific Licensing** - a digitally-signed license file to ensure the logged-in user is accessing a properly-licensed D365 tenant’s site from the current device, and they have an active license for the applicaiton in that tenant as assigned by their company’s M365 administrator in the M365 Admin Center (I don’t want the extension to be usable unless the tenant and user are specifically-licensed by a customer to use my application)
  * **Advanced Features**
    * **Field Validation** - Validate targets and styles before applying
    * **Preview Changes** - Test customizations before saving
    * **Status Notifications** - Real-time feedback on operations
    * **Error Handling** - Comprehensive error messages and recovery options
    * **Eyedropper Tool** - Intelligent tool to aid Admins in finding the specific DOM element to customize based on the pixel over which the eyedropper pointer is hovering (e.g., if the eyedropper is hovering over a background-color area, find and display the element {as both a tooltip next to the eyedropper and by highlighting the element row in the browser’s inspect tool (if it’s open)}; or if the eyedropper is on a text element, show a list of the text properties that element is comprised of {i.e., font, color, size, etc.} in the tooltip while also highlighting the element row in the browser’s inspect tool {if it’s open}, etc.)
    * **Documentation Generation** - Use an AI tool (as selected by the Admin in the Settings interface) to create a markdown document and Mermaid or Visio diagram(s) (as selected by the Admin in the Settings interface) the customizations and settings arranged heirarchically by Environment, Organization, Business Unit, Team, and Queue to help them maintain proper systems and business continuity documentation.
  * **User Interface Elements**
    * **Admin Badge** - Visual indicator showing "ADMIN" status
    * **Form Controls** - Input fields for targets and styles
    * **Customization List View** - Display all saved customizations with details
    * **Action Buttons** - Apply, Save, Clear, Edit, Delete controls
    * **Advanced Options Toggle** - Show/hide advanced features
    * **Publishing Controls** - Manage Dataverse synchronization
    * **Custom Branding** - Admin-set custom logos, icons, and colors (individually or in a theme)
  * **Additional Capabilities**
    * **Local Storage Management** - Store customizations and settings locally
    * **Cache Management** - Clear authentication and data cache
    * **Settings Configuration** - Configure D365 URL, Dataverse Environment, and interface options as specified
    * **Multiple Browser Support** - Works in both Chrome and Edge
- **User version with basic extension information and features:**
  - extension name
  - extension version
  - link to the user’s Dynamics 365 environment
  - link to email/chat/webform (based on Admin’s specified settings) for support
  - screenshot file upload feature (with optional screenshot capture and markup functions) to send to the customer’s admin point of contact for support requests and customization suggestions (OPTIONAL based on Admin’s specified settings)
- **Integration with Microsoft Graph and Entra External ID authentication using MSAL for the extension that allows my Azure application to:**
  - get the Dataverse security role of the authenticated user to deterimine if the user has System Customizer or System Administrator roles to see if the Admin interface should be presented to them
  - get the Tenant, Environment, Organization, Business Unit, Team, and/or Queue memberships of the authenticated user so that the subset (if applicable) of customizations can be synchronized to their extension from Dataverse
  - provide the user the option to leverage the KMSI functions to reduce necessary signins
- **Content script injection for DOM manipulation on Dynamics 365 pages**

## Development Commands

### Core Development
```bash
# Development with watch mode
npm run dev

# Production build
npm run build
npm run build:prod

# Clean dist folder
npm run clean
```

### Testing
```bash
# Run all tests
npm test

# Watch mode for testing
npm test:watch

# Test coverage
npm test:coverage

# End-to-end tests
npm test:e2e
```

### Code Quality
```bash
# Lint code
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check
```

### Extension Management
```bash
# Generate manifest.json
npm run manifest:generate

# Bump version
npm run version:bump

# Package extension
npm run package:extension
npm run package:chrome
npm run package:edge

# Deploy to stores
npm run deploy:chrome
npm run deploy:edge
```

### Build Process
The build system uses Webpack with specific entry points:
- `src/popup/popup.js` → `dist/popup/popup.js`
- `src/scripts/background.js` → `dist/scripts/background.js`
- `src/scripts/content.js` → `dist/scripts/content.js`

## Architecture

### Core Components
- **Popup UI** (`src/popup/`): Extension interface for managing CSS/JS injection rules
- **Background Service Worker** (`src/scripts/background.js`): Handles Entra External ID auth and Dataverse and SharePoint sync (admin version only)
- **Content Scripts** (`src/scripts/content.js`): Injects styles into target pages
- **Authentication** (`src/auth/`): MSAL integration for Microsoft Graph API access
- **Sync Services** (`src/sync/`): SharePoint integration for rule synchronization

### Key Directories
- `src/auth/`: Entra External ID authentication using MSAL
- `src/sync/`: SharePoint service and sync manager for cloud synchronization
- `src/popup/`: Extension popup interface
- `src/scripts/`: Content scripts for DOM manipulation
- `src/styles/`: CSS files for extension UI and themes
- `tests/`: Jest unit tests, Playwright e2e tests, and test fixtures
- `build/`: Webpack configuration and build scripts
- `config/`: Environment-specific configurations
- `docs/`: Comprehensive documentation including architecture, development guides, and deployment instructions

### Manifest Configuration
The extension uses Manifest V3 with:
- Host permissions for `*.dynamics.com`, `*.sharepoint.com`, and Microsoft Graph
- Content scripts targeting Dynamics 365 domains
- Background service worker for admin functionality
- Entra External ID identity permissions for authentication

## Testing Framework

- **Unit Tests**: Jest with jsdom environment
- **E2E Tests**: Playwright
- **Coverage Threshold**: 80% for branches, functions, lines, and statements
- **Test Setup**: `tests/setup.js` with chrome extension mocks

## Environment Requirements

- Node.js >=16.0.0
- npm >=8.0.0
- Chrome/Edge for extension testing

## Code Style

- ESLint with recommended rules and Jest plugin
- Prettier formatting with 2-space tabs, single quotes, 100 character line width
- Pre-commit hooks with lint-staged for automated formatting
- ES modules with modern JavaScript features

## Security Considerations

- Manifest V3 compliance with strict CSP
- Minimal required permissions
- MSAL for secure Entra External ID token management and Microsoft Graph access
- Content script isolation from host page context
- No remote code execution - all code bundled with extension
\ No newline at end of file

