# Development Setup Guide

## Prerequisites

- **Node.js**: v16.0.0 or higher
- **npm**: v8.0.0 or higher
- **Git**: Latest version
- **Chrome/Edge**: Latest version for testing
- **VS Code** (recommended): With recommended extensions

## Initial Setup

### 1. Clone Repository
```bash
git clone https://github.com/almostsultry/dom-style-injector-extension-admin.git
cd dom-style-injector-extension-admin
```

### 2. Install Dependencies
```bash
npm install
```

If you see vulnerabilities, they should only be in devDependencies. Run:
```bash
npm audit
```

### 3. Environment Configuration
```bash
# Copy example environment files
cp config/environments/development.example.json config/environments/development.json

# Edit with your SharePoint/Azure AD details
```

### 4. VS Code Setup (Recommended)

Install recommended extensions:
- **ESLint**: JavaScript linting
- **Prettier**: Code formatting
- **CSS Peek**: CSS intelligence
- **Chrome Debugger**: Extension debugging

Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "css.validate": true,
  "files.associations": {
    "*.css": "css"
  }
}
```

## Development Workflow

### 1. Start Development Mode

For admin version:
```bash
npm run dev:admin
```

For user version:
```bash
npm run dev:user
```

### 2. Load Extension in Browser

1. Open Chrome/Edge
2. Navigate to `chrome://extensions` or `edge://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select appropriate directory:
   - Admin: `dist/admin`
   - User: `dist/user`

### 3. Making Changes

#### CSS Changes
1. Edit files in `src/styles/`
2. Build will auto-update (if using dev mode)
3. Reload extension in browser

#### JavaScript Changes
1. Edit `.js` files
2. Build updates automatically
3. Reload extension in browser

#### Manifest Changes
1. Edit `src/manifest.json`
2. Rebuild required
3. Reload extension

### 4. Testing Your Changes

Run tests:
```bash
# All tests
npm test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e
```

## Code Style Guidelines

### JavaScript
- ES6+ features
- Async/await over promises
- Meaningful variable names
- JSDoc comments for functions

### CSS
- Use CSS variables from `common.css`
- Follow BEM-like naming
- Mobile-first approach
- Avoid `!important` unless necessary

### Git Commits
Follow conventional commits:
```
feat: add new feature
fix: resolve bug
docs: update documentation
style: format code
refactor: restructure code
test: add tests
chore: update dependencies
```

## Debugging

### Extension Debugging

1. **Popup Debugging**
   - Right-click extension icon → "Inspect popup"
   - Opens DevTools for popup

2. **Content Script Debugging**
   - Open DevTools on target page
   - Look for console logs prefixed with `[DOM Style Injector]`

3. **Background Script Debugging**
   - Go to `chrome://extensions`
   - Click "Service Worker" link
   - Opens DevTools for background

### Common Issues

**Issue**: Changes not reflecting
```bash
# Solution: Force rebuild
npm run build:admin -- --force
```

**Issue**: Styles not applying
```bash
# Check CSS file paths
ls -la dist/admin/styles/
```

**Issue**: Extension not loading
```
# Check manifest.json syntax
# Verify all referenced files exist
```

## Build Optimization

### Development Builds
- Fast builds
- Source maps included
- Console logs preserved
- No minification

### Production Builds
```bash
NODE_ENV=production npm run build:all
```
- Minified code
- CSS concatenation
- Console logs removed (user version)
- Optimized for size

## Project Structure

```
src/
├── styles/           # CSS files (external)
│   ├── common.css   # Shared styles
│   ├── popup.css    # Popup layout
│   └── *.css        # Theme files
├── popup.html       # Uses external CSS
├── popup.js         # Popup logic
├── content.js       # DOM manipulation
└── background.js    # Service worker

dist/                # Build output
├── admin/          # Admin version build
│   └── styles/     # Processed CSS
└── user/           # User version build
    └── styles/     # Processed CSS
```

## Troubleshooting

### Clean Install
```bash
# Remove all dependencies and locks
rm -rf node_modules package-lock.json

# Fresh install
npm install
```

### Reset Builds
```bash
# Clean dist directory
npm run clean

# Rebuild everything
npm run build:all
```

### Check ESLint
```bash
# Run linter
npm run lint

# Auto-fix issues
npm run lint:fix
```

## Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Edge Extension Docs](https://docs.microsoft.com/en-us/microsoft-edge/extensions-chromium/)
- [CSS Variables Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Docs](https://playwright.dev/docs/intro)