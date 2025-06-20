# DOM Style Injector Extension - Admin Version

> **⚠️ Admin Version**: This is the administrative version with full CRUD capabilities for creating, editing, and managing customizations. A separate user version (read-only) will be available for end users to consume published customizations.

A powerful Chrome/Edge extension that allows administrators to create, manage, and distribute CSS customizations across an organization with Microsoft Graph/SharePoint synchronization.

## 🔑 Admin vs User Versions

### Admin Version (This Repository)
- **Full CRUD operations** for customizations
- **SharePoint/Dataverse integration** for centralized storage
- **Microsoft Graph authentication** with elevated permissions
- **Publishing capabilities** to distribute customizations
- **Advanced management features** and audit controls

### User Version (Planned)
- **Read-only consumption** of published customizations
- **Automatic synchronization** from central repository
- **No local editing capabilities** - security focused
- **Lightweight installation** for end users
- **Simple interface** for applying/removing customizations

## 🚀 Features

### Core Functionality
- **🎯 Precise Element Targeting** - Target elements by any attribute (data-*, id, class, etc.)
- **🎨 Dynamic Style Injection** - Apply any CSS property and value in real-time
- **💾 Persistent Storage** - Save customizations with intelligent JSON storage
- **🔄 Enterprise Synchronization** - Multi-user sync with Microsoft Graph/SharePoint

### Admin-Specific Features
- **👥 User Management** - Control who can view/edit customizations
- **📊 Usage Analytics** - Track customization deployment and usage
- **🔐 Permission Controls** - Granular access management
- **📝 Approval Workflows** - Review and approve customization changes
- **🗂️ Centralized Management** - SharePoint List integration for enterprise storage

### Technical Features
- **⚡ Intelligent Loading** - Dynamic content detection with retry mechanisms
- **📱 Modern UI** - Clean, responsive admin interface
- **🔒 Security First** - Domain-restricted with Microsoft authentication
- **📝 Live Editing** - Edit saved customizations with immediate DOM application
- **🔄 CI/CD Integration** - Automated testing, building, and deployment

## 🛡️ Security & Compliance

### Enterprise Security
- **Domain restriction** to approved corporate domains
- **Microsoft Azure AD integration** for authentication
- **Role-based access control** (RBAC) for admin operations
- **Audit logging** for compliance requirements
- **Data sovereignty** - all data stays within your Microsoft 365 tenant

### Admin Privileges
- **Create/Edit/Delete** customizations
- **Publish to user base** with approval workflows
- **Monitor usage** and performance metrics
- **Manage user permissions** and access levels
- **Export/Import** customizations for backup/migration

## 📋 Prerequisites

### Admin Version Requirements
- Chrome or Edge browser (Manifest V3 compatible)
- Microsoft 365 Enterprise account with admin privileges
- SharePoint site with appropriate permissions
- Azure AD app registration (for Graph API access)
- Admin access to target domains

### Permissions Needed
- **SharePoint**: `Sites.ReadWrite.All` or `Sites.Selected`
- **Microsoft Graph**: `User.Read`, `Sites.ReadWrite.All`
- **Azure AD**: Application registration with appropriate scopes

## 🔧 Installation

### Quick Start (Admin)
```bash
# Clone the admin repository
git clone https://github.com/your-org/dom-style-injector-extension-admin.git
cd dom-style-injector-extension-admin

# Install dependencies
npm install

# Build the admin version
npm run build:admin

# Load in browser (development)
npm run dev:admin
```

### Production Deployment
```bash
# Build for production
npm run build:prod

# Package for Chrome Web Store
npm run package:chrome

# Package for Edge Add-ons
npm run package:edge
```

## 📖 Documentation

### Admin Documentation
- [📥 Admin Installation Guide](docs/admin/installation.md)
- [📖 Admin Usage Guide](docs/admin/usage.md)
- [🔗 SharePoint Setup](docs/admin/sharepoint-setup.md)
- [🔐 Permissions Management](docs/admin/permissions.md)

### Development
- [🤝 Contributing Guide](docs/development/contributing.md)
- [🏗️ Architecture Overview](docs/development/architecture.md)
- [🧪 Testing Guide](docs/development/testing.md)

### Deployment
- [🚀 CI/CD Setup](docs/deployment/ci-cd-setup.md)
- [🏪 Store Submission](docs/deployment/store-submission.md)
- [⚙️ Environment Configuration](docs/deployment/environment-config.md)

## 🏗️ Architecture

### Admin Version Components
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin UI      │    │  Authentication  │    │   SharePoint    │
│   (popup.html)  │◄──►│   Service        │◄──►│   Integration   │
│                 │    │   (MSAL.js)      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Content       │    │   Background     │    │   Sync          │
│   Script        │    │   Service        │    │   Manager       │
│                 │    │   Worker         │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Data Flow
1. **Admin creates customization** → Local validation
2. **Authentication check** → Microsoft Graph token
3. **Save to SharePoint** → Centralized storage
4. **Distribute to users** → Automatic sync
5. **Apply to target pages** → DOM manipulation

## 🚀 Development

### Build System
- **Webpack** for bundling and optimization
- **ESLint** for code quality
- **Prettier** for code formatting
- **Jest** for unit testing
- **Playwright** for E2E testing

### Scripts
```bash
# Development
npm run dev:admin          # Start admin development server
npm run dev:user           # Start user development server
npm run test               # Run all tests
npm run test:watch         # Run tests in watch mode
npm run lint               # Lint code
npm run format             # Format code

# Building
npm run build:admin        # Build admin version
npm run build:user         # Build user version
npm run build:all          # Build both versions

# Deployment
npm run release            # Create new release
npm run deploy:chrome      # Deploy to Chrome Web Store
npm run deploy:edge        # Deploy to Edge Add-ons
```

## 🔄 CI/CD Pipeline

### Automated Workflows
- **✅ Continuous Integration** - Automated testing on PR/push
- **📦 Build & Package** - Automated extension packaging
- **🔒 Security Scanning** - Vulnerability detection
- **🚀 Automated Deployment** - Store submission automation
- **📋 Release Management** - GitHub releases with changelogs

### Quality Gates
- Unit test coverage > 80%
- Integration tests passing
- Security scan clear
- Code quality checks passed
- Manual approval for production deployment

## 🤝 Contributing

### For Administrators
1. **Report issues** with customizations or sync problems
2. **Request features** for better admin workflow
3. **Share feedback** on user adoption and usage patterns

### For Developers
1. **Fork the repository**
2. **Create feature branch** (`git checkout -b feature/amazing-feature`)
3. **Follow coding standards** (ESLint + Prettier)
4. **Add tests** for new functionality
5. **Submit Pull Request** with detailed description

### Development Setup
```bash
# Clone and setup
git clone https://github.com/your-org/dom-style-injector-extension-admin.git
cd dom-style-injector-extension-admin
npm install

# Setup environment
cp config/environments/development.example.json config/environments/development.json
# Edit with your SharePoint/Azure AD details

# Start development
npm run dev:admin
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Enterprise Support
- **📧 Email**: admin-support@yourcompany.com
- **📱 Teams**: Internal support channel
- **📋 ServiceNow**: Enterprise ticket system

### Community Support
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/your-org/dom-style-injector-extension-admin/issues)
- **💡 Feature Requests**: [GitHub Discussions](https://github.com/your-org/dom-style-injector-extension-admin/discussions)
- **📖 Documentation**: [Wiki](https://github.com/your-org/dom-style-injector-extension-admin/wiki)

## 🔮 Roadmap

### Version 2.0 (Q3 2025)
- [x] Admin version with full CRUD capabilities
- [ ] Microsoft Graph/SharePoint integration
- [ ] User version (read-only)
- [ ] Advanced permission management

### Version 2.1 (Q4 2025)
- [ ] Approval workflows for customizations
- [ ] Usage analytics and reporting
- [ ] Advanced CSS selector support
- [ ] Multi-domain configuration

### Version 3.0 (Q1 2026)
- [ ] AI-powered customization suggestions
- [ ] Advanced collaboration features
- [ ] Performance monitoring and optimization
- [ ] Mobile extension support

## 👥 Team

- **Platform Team** - *Architecture and infrastructure*
- **Frontend Team** - *User interface and experience*
- **Security Team** - *Authentication and compliance*
- **DevOps Team** - *CI/CD and deployment automation*

---

> **Note**: This is the administrative version designed for IT administrators and power users. End users should use the lightweight user version once available.