# DOM Style Injector Extension - Directory Structure

```
📁 dom-style-injector-extension-admin/
│
├── 📁 .claude/                          # Claude Code configuration
│   └── 📄 settings.local.json           # Local Claude settings
│
├── 📁 .github/                          # GitHub configuration
│   ├── 📁 ISSUE_TEMPLATE/               # Issue templates
│   │   ├── 📄 bug_report.md            # Bug report template
│   │   ├── 📄 config.yml               # Issue template config
│   │   └── 📄 feature_request.md       # Feature request template
│   ├── 📁 workflows/                    # GitHub Actions workflows
│   │   ├── 📄 cd-chrome-store.yml      # Chrome Web Store deployment
│   │   ├── 📄 cd-edge-store.yml        # Edge Add-ons deployment
│   │   ├── 📄 ci.yml                   # CI pipeline (DISABLED)
│   │   ├── 📄 release.yml              # Release automation
│   │   └── 📄 security-scan.yml        # Security scanning
│   ├── 📄 CODEOWNERS                   # Code ownership rules
│   └── 📄 PULL_REQUEST_TEMPLATE.md     # PR template
│
├── 📁 .husky/                          # Git hooks configuration
│   └── 📁 _/                           # Husky internals
│
├── 📁 backend-template/                # Backend service template
│   ├── 📁 scripts/                     # Setup scripts
│   │   └── 📄 setup.sh                 # Initial setup script
│   ├── 📄 .dockerignore                # Docker ignore rules
│   ├── 📄 .env.development             # Dev environment variables
│   ├── 📄 .env.example                 # Example env configuration
│   ├── 📄 docker-compose.*.yml         # Docker compose configs
│   ├── 📄 Dockerfile                   # Container definition
│   ├── 📄 init.sql                     # Database initialization
│   ├── 📄 Makefile                     # Build automation
│   ├── 📄 nginx.conf                   # Nginx configuration
│   ├── 📄 package.json                 # Node.js dependencies
│   ├── 📄 README.md                    # Backend documentation
│   └── 📄 server.js                    # Express server
│
├── 📁 build/                           # Build scripts
│   ├── 📄 build.js                     # Main build script
│   ├── 📄 release.js                   # Release packaging
│   └── 📄 webpack.config.js            # Webpack configuration
│
├── 📁 config/                          # Configuration files
│   ├── 📁 environments/                # Environment configs
│   │   ├── 📄 development.json         # Dev settings
│   │   ├── 📄 production.json          # Prod settings
│   │   └── 📄 staging.json             # Staging settings
│   └── 📁 store-configs/               # Store submission configs
│       ├── 📄 chrome-store.json        # Chrome Web Store config
│       └── 📄 edge-store.json          # Edge Add-ons config
│
├── 📁 dist/                            # Built extension files (generated)
│   ├── 📁 assets/                      # Extension icons
│   ├── 📁 options/                     # Options page
│   ├── 📁 popup/                       # Popup UI
│   ├── 📁 scripts/                     # Content scripts
│   ├── 📁 styles/                      # CSS files
│   ├── 📄 background.js                # Service worker
│   ├── 📄 content.js                   # Content script
│   └── 📄 manifest.json                # Extension manifest
│
├── 📁 docs/                            # Documentation
│   ├── 📁 admin/                       # Administrator docs
│   │   ├── 📄 installation.md         # Installation guide
│   │   ├── 📄 permissions.md          # RBAC documentation
│   │   ├── 📄 sharepoint-setup.md     # SharePoint integration
│   │   └── 📄 usage.md                # Admin usage guide
│   ├── 📁 deployment/                  # Deployment docs
│   │   ├── 📄 ci-cd-setup.md          # CI/CD pipeline setup
│   │   ├── 📄 environment-config.md   # Environment configuration
│   │   └── 📄 store-submission.md     # Store submission guide
│   ├── 📁 development/                 # Developer docs
│   │   ├── 📄 architecture.md         # System architecture
│   │   ├── 📄 contributing.md         # Contribution guidelines
│   │   ├── 📄 css-migration-guide.md  # CSS migration guide
│   │   ├── 📄 dev-setup-guide.md      # Development setup
│   │   ├── 📄 package-json-guide.md   # Package.json guide
│   │   └── 📄 testing.md              # Testing documentation
│   ├── 📁 user/                        # End-user docs
│   │   ├── 📄 installation.md         # User installation
│   │   └── 📄 usage.md                # User guide
│   └── 📄 migration-to-unified.md      # Migration guide
│
├── 📁 scripts/                         # Build & utility scripts
│   ├── 📄 generate-manifest.js         # Manifest generation
│   ├── 📄 package-extension.js         # Extension packaging
│   └── 📄 version-bump.js              # Version management
│
├── 📁 security/                        # Security configuration
│   ├── 📄 content-security-policy.json # CSP rules
│   ├── 📄 permissions-audit.md         # Permissions audit
│   └── 📄 vulnerability-scan-config.yml # Security scan config
│
├── 📁 src/                             # Source code
│   ├── 📁 assets/                      # Extension icons
│   │   ├── 📄 icon128.png             # 128x128 icon
│   │   ├── 📄 icon16.png              # 16x16 icon
│   │   └── 📄 icon48.png              # 48x48 icon
│   ├── 📁 auth/                        # Authentication
│   │   ├── 📄 auth-service.js         # Auth service
│   │   └── 📄 msal-config.js          # MSAL configuration
│   ├── 📁 config/                      # App configuration
│   │   ├── 📄 api-config.js           # API endpoints
│   │   └── 📄 development.js          # Dev settings
│   ├── 📁 lib/                         # Third-party libraries
│   │   └── 📄 msal-browser.min.js     # MSAL library
│   ├── 📁 options/                     # Options page
│   │   ├── 📄 options.html            # Options UI
│   │   └── 📄 options.js              # Options logic
│   ├── 📁 popup/                       # Popup interface
│   │   ├── 📄 popup.html              # Popup UI
│   │   └── 📄 popup.js                # Popup logic
│   ├── 📁 scripts/                     # Core scripts
│   │   ├── 📄 ai-integration-manager.js        # AI providers integration
│   │   ├── 📄 background.js                    # Service worker
│   │   ├── 📄 branding-manager.js              # Custom branding
│   │   ├── 📄 content.js                       # Content script
│   │   ├── 📄 dataverse-conflict-resolver.js   # Conflict resolution
│   │   ├── 📄 dev-mode-indicator.js            # Dev mode UI
│   │   ├── 📄 export-import.js                 # Export/import functionality
│   │   ├── 📄 eyedropper-manager.js            # Eyedropper tool
│   │   ├── 📄 kmsi-handler.js                  # Keep Me Signed In
│   │   ├── 📄 license-required.js              # License check
│   │   ├── 📄 license-validator.js             # License validation
│   │   ├── 📄 permissions.js                   # RBAC permissions
│   │   ├── 📄 screenshot-manager.js            # Screenshot capture
│   │   ├── 📄 search-filter.js                 # Search/filter functionality
│   │   ├── 📄 secure-backend-client.js         # Backend API client
│   │   └── 📄 visio-integration-manager.js     # Visio diagram integration
│   ├── 📁 styles/                      # Stylesheets
│   │   ├── 📄 admin-theme.css         # Admin theme
│   │   ├── 📄 common.css              # Common styles
│   │   ├── 📄 options.css             # Options page styles
│   │   ├── 📄 popup.css               # Popup styles
│   │   ├── 📄 pseudo-classes.css      # Pseudo-class styles
│   │   └── 📄 user-theme.css          # User theme
│   ├── 📁 sync/                        # Synchronization
│   │   ├── 📄 sharepoint-service.js   # SharePoint sync
│   │   └── 📄 sync-manager.js         # Sync orchestration
│   ├── 📄 content.js                   # Main content script
│   ├── 📄 license-required.html        # License required page
│   └── 📄 manifest.json                # Extension manifest
│
├── 📁 tests/                           # Test suite
│   ├── 📁 __mocks__/                   # Mock files
│   │   └── 📄 styleMock.js            # CSS mock
│   ├── 📁 e2e/                         # End-to-end tests
│   │   ├── 📄 admin-workflow.test.js  # Admin flow tests
│   │   └── 📄 user-workflow-test.js   # User flow tests
│   ├── 📁 fixtures/                    # Test data
│   │   └── 📄 test-data.json          # Test fixtures
│   ├── 📁 integration/                 # Integration tests
│   │   ├── 📄 auth.test.js            # Auth tests
│   │   └── 📄 sharepoint.test.js      # SharePoint tests
│   ├── 📁 unit/                        # Unit tests
│   │   ├── 📄 content.test.js         # Content script tests
│   │   ├── 📄 popup.test.js           # Popup tests
│   │   └── 📄 sync.test.js            # Sync tests
│   └── 📄 setup.js                     # Test setup
│
├── 📄 .gitignore                       # Git ignore rules
├── 📄 ARCHITECTURE.md                  # Architecture overview
├── 📄 Changelog.md                     # Version history
├── 📄 CLAUDE.md                        # Claude AI context
├── 📄 DEVELOPMENT.md                   # Development guide
├── 📄 DIRECTORY-STRUCTURE.md           # This file
├── 📄 eslint.config.js                 # ESLint configuration
├── 📄 IMPLEMENTATION_PLAN.md           # Implementation roadmap
├── 📄 LICENSE                          # MIT License
├── 📄 package.json                     # Node.js project config
├── 📄 package-lock.json                # Dependency lock file
├── 📄 README                           # Project overview
└── 📄 SECURITY.md                      # Security policy
```

## Key Directories

### `/src`
The main source code directory containing all the extension's functionality:
- **auth/**: MSAL-based authentication for Microsoft 365
- **scripts/**: Core functionality modules (AI, Visio, branding, etc.)
- **styles/**: CSS files for theming and UI
- **sync/**: SharePoint and Dataverse synchronization

### `/backend-template`
Docker-based backend service template for secure API key management and enterprise deployment.

### `/docs`
Comprehensive documentation organized by audience:
- **admin/**: System administrator guides
- **development/**: Developer documentation
- **deployment/**: CI/CD and deployment guides
- **user/**: End-user documentation

### `/tests`
Test suite with unit, integration, and e2e tests following Jest conventions.

### `/config`
Environment-specific configurations and store submission settings.

## Recent Additions

1. **AI Integration** (`ai-integration-manager.js`)
   - Support for ChatGPT, Claude, Copilot, Gemini, and Grok
   - Natural language CSS generation
   - Rule optimization suggestions

2. **Visio Integration** (`visio-integration-manager.js`)
   - Architecture, flow, hierarchy, and network diagrams
   - Microsoft Graph API integration
   - Automatic diagram generation from CSS rules

3. **Branding System** (`branding-manager.js`)
   - Custom logos and icons
   - Theme customization
   - Enterprise white-labeling

4. **Advanced Features**
   - Screenshot capture with markup
   - Eyedropper tool for element selection
   - Export/import functionality
   - Search and filter capabilities