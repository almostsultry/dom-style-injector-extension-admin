# Package.json Updates Guide

## Recent Changes (v2.0.0)

### Security Updates
- **Removed**: `puppeteer` (had tar-fs and ws vulnerabilities)
- **Added**: Using Playwright exclusively for E2E testing
- **Updated**: All dependencies to latest secure versions

### Development Dependencies

#### Removed
```json
"jest-chrome": "^0.8.0",      // Incompatible with Jest 29
"puppeteer": "^21.6.1",       // Security vulnerabilities
```

#### Added/Updated
```json
"@eslint/js": "^9.5.0",              // ESLint v9 support
"eslint": "^9.5.0",                  // Updated to v9
"eslint-plugin-jest": "^28.6.0",     // Compatible with ESLint v9
"jest-webextension-mock": "^3.8.9",  // Modern Chrome API mocks
"sinon": "^18.0.0",                  // Latest version
"sinon-chrome": "^3.0.1",            // Chrome-specific mocks
```

### Configuration Changes

#### ESLint Configuration
- Moved from inline `eslintConfig` to external `eslint.config.js`
- Using new flat config format for ESLint v9

#### Scripts Added/Modified
```json
"manifest:generate": "node scripts/generate-manifest.js",
"package:extension": "node scripts/package-extension.js",
"package:chrome": "BROWSER=chrome npm run package:extension",
"package:edge": "BROWSER=edge npm run package:extension",
```

## Dependency Management

### Core Dependencies
```json
{
  "dependencies": {
    "@microsoft/microsoft-graph-client": "^3.0.7",
    "@azure/msal-browser": "^3.6.0"
  }
}
```
These are the only runtime dependencies needed.

### Key Dev Dependencies

#### Build Tools
- `webpack`: Module bundler
- `terser`: JavaScript minifier
- `clean-css`: CSS minifier
- `archiver`: ZIP creation

#### Testing
- `jest`: Unit testing
- `@playwright/test`: E2E testing
- `jest-webextension-mock`: Browser API mocks

#### Code Quality
- `eslint`: Linting
- `prettier`: Formatting
- `husky`: Git hooks
- `lint-staged`: Pre-commit checks

## Version Management

### Semantic Versioning
```
MAJOR.MINOR.PATCH
2.0.0
│ │ └── Patch: Bug fixes
│ └──── Minor: New features (backward compatible)
└────── Major: Breaking changes
```

### Version Bumping
```bash
# Bump patch version (2.0.0 → 2.0.1)
npm run version:bump -- --patch

# Bump minor version (2.0.0 → 2.1.0)
npm run version:bump -- --minor

# Bump major version (2.0.0 → 3.0.0)
npm run version:bump -- --major
```

## Scripts Reference

### Development
```bash
npm run dev:admin    # Watch mode for admin
npm run dev:user     # Watch mode for user
```

### Building
```bash
npm run build:admin  # Build admin version
npm run build:user   # Build user version
npm run build:all    # Build both
npm run build:prod   # Production build
```

### Testing
```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
npm run test:e2e     # E2E tests
```

### Code Quality
```bash
npm run lint         # Check code
npm run lint:fix     # Fix issues
npm run format       # Format code
npm run format:check # Check formatting
```

### Release
```bash
npm run version:bump # Update version
npm run release      # Create release
npm run deploy:chrome # Deploy to Chrome
npm run deploy:edge  # Deploy to Edge
```

## Adding New Dependencies

### Before Adding
1. Check for security vulnerabilities
2. Verify license compatibility
3. Consider bundle size impact
4. Look for alternatives

### Adding Process
```bash
# Production dependency
npm install package-name

# Development dependency
npm install --save-dev package-name

# Check for vulnerabilities
npm audit
```

### Post-Installation
1. Update documentation
2. Add to build process if needed
3. Test thoroughly
4. Commit both package.json and package-lock.json

## Troubleshooting

### Dependency Conflicts
```bash
# Show dependency tree
npm ls

# Find specific package
npm ls package-name

# Clear cache
npm cache clean --force
```

### Lock File Issues
```bash
# Regenerate lock file
rm package-lock.json
npm install
```

### Audit Fixes
```bash
# Show vulnerabilities
npm audit

# Auto-fix (careful with breaking changes)
npm audit fix

# Force fixes (may break things)
npm audit fix --force
```

## Best Practices

1. **Always commit package-lock.json**
2. **Use exact versions in dependencies**
3. **Regular updates** (monthly)
4. **Security first** - no high vulnerabilities
5. **Test after updates**
6. **Document breaking changes**

## Maintenance Schedule

### Weekly
- Run `npm audit`
- Check for deprecation warnings

### Monthly
- Update patch versions
- Review outdated packages

### Quarterly
- Major version updates
- Security review
- Performance audit