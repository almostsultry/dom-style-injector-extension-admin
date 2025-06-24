# DOM Style Injector Extension - Admin Version

⚠️ **Admin Version**: This is the administrative version with full CRUD capabilities for creating, editing, and managing customizations. A separate user version (read-only) is available for end users to consume published customizations.

## 🚀 Recent Updates

### Version 2.0.0 Changes

- **Hybrid CSS Architecture**: Migrated from inline styles to external CSS files for better maintainability
- **Improved Build System**: Enhanced CSS processing with minification and concatenation
- **Updated Dependencies**: Removed security vulnerabilities, updated to latest package versions
- **ESLint v9**: Migrated to the new flat config format
- **Removed Puppeteer**: Using Playwright exclusively for E2E testing (no security vulnerabilities)

## 📁 Project Structure

```dom-style-injector-extension-admin/
├── src/                        # Admin extension source
│   ├── styles/                 # CSS files (NEW)
│   │   ├── common.css         # Shared styles
│   │   ├── popup.css          # Popup layout
│   │   └── admin-theme.css    # Admin-specific theme
│   ├── popup.html             # Now uses external CSS
│   ├── popup.js
│   ├── content.js
│   └── background.js
├── user-version/              # User extension source
│   ├── popup.html            # References admin CSS
│   ├── popup.js
│   ├── content.js
│   └── background.js         # Simple sync worker
├── dist/                     # Build output
│   ├── admin/
│   │   └── styles/          # Processed CSS
│   └── user/
│       └── styles/          # Copied CSS
└── eslint.config.js         # ESLint v9 flat config (NEW)
```

## 🛠️ Development Setup

### Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Chrome or Edge browser

### Installation

```bash
# Clone the repository
git clone https://github.com/almostsultry/dom-style-injector-extension-admin.git
cd dom-style-injector-extension-admin

# Install dependencies
npm install

# Build both versions
npm run build:all
```

### CSS Architecture

We use a **hybrid CSS approach**:

- **External CSS files** for popup/options pages (better maintainability)
- **Programmatic injection** for content scripts (CSP compatibility)
- **CSS variables** for theming support
- **Minification** in production builds

### Available Scripts

```bash
# Development
npm run dev:admin          # Watch mode for admin version
npm run dev:user           # Watch mode for user version

# Building
npm run build:admin        # Build admin version
npm run build:user         # Build user version
npm run build:all          # Build both versions
npm run build:prod         # Production build (minified)

# Testing
npm test                   # Run unit tests
npm run test:e2e          # Run Playwright E2E tests
npm run test:coverage     # Generate coverage report

# Code Quality
npm run lint              # Run ESLint
npm run lint:fix          # Fix ESLint issues
npm run format            # Run Prettier
npm run format:check      # Check formatting

# Release
npm run version:bump      # Bump version number
npm run release          # Create release package
```

## 🎨 Styling Guidelines

### CSS File Organization

- `common.css` - Shared components, variables, utilities
- `popup.css` - Popup-specific layout and components
- `admin-theme.css` - Admin color scheme and overrides
- `user-theme.css` - User version theme

### CSS Variables

```css
/* Available CSS variables for theming */
--primary-color: #667eea;
--primary-dark: #764ba2;
--success-color: #4CAF50;
--error-color: #cc3333;
/* See src/styles/common.css for full list */
```

## 🔧 Build Process

The build process now includes:

1. **CSS Processing**
   - Development: Copies CSS files as-is
   - Production: Minifies and optionally combines CSS files
   - Updates HTML references appropriately

2. **JavaScript Processing**
   - Minification with Terser
   - Console log removal in production (user version only)
   - Source map generation (development)

3. **Asset Management**
   - Icon copying and optimization
   - Manifest version updates
   - ZIP archive creation

## 📦 Extension Loading

### Development Mode

```bash
# Build in development mode
NODE_ENV=development npm run build:all

# Load in Chrome/Edge:
1. Navigate to chrome://extensions or edge://extensions
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select dist/admin for admin version
5. Select dist/user for user version
```

### Production Build

```bash
# Build for production
npm run build:prod

# Creates minified, optimized builds in dist/
# Also generates ZIP files for store submission
```

## 🧪 Testing

### Unit Tests

- Jest with web extension mocks
- Minimum 80% code coverage requirement
- Run with: `npm test`

### E2E Tests

- Playwright for browser automation
- Tests both admin and user workflows
- Run with: `npm run test:e2e`

## 📝 Code Style

- **ESLint**: v9 with flat config
- **Prettier**: Automatic formatting
- **Husky**: Pre-commit hooks (if enabled)

### ESLint Configuration

Now using the new flat config format in `eslint.config.js`:

- ES modules syntax
- Explicit globals definition
- Plugin configuration per file pattern

## 🚀 Deployment

### Chrome Web Store

```bash
npm run package:chrome
# Upload dist/dom-style-injector-admin-v{version}.zip
```

### Edge Add-ons

```bash
npm run package:edge
# Upload dist/dom-style-injector-admin-v{version}.zip
```

## 🔒 Security

- No high-severity vulnerabilities
- Removed Puppeteer to eliminate tar-fs and ws vulnerabilities
- Regular dependency updates
- CSP-compliant implementation

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Check linting (`npm run lint`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: <admin-support@yourcompany.com>
- 📱 Teams: Internal support channel
- 🐛 Issues: [GitHub Issues](https://github.com/almostsultry/dom-style-injector-extension-admin/issues)
- 💡 Discussions: [GitHub Discussions](https://github.com/almostsultry/dom-style-injector-extension-admin/discussions)

---

**Note**: This is the administrative version designed for IT administrators and power users. End users should use the lightweight user version once available.
