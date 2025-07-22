# Development Mode Guide

This guide explains how to use the development mode features in the DOM Style Injector Extension to develop and test without requiring actual Microsoft 365 licenses or API keys.

## Enabling Development Mode

Development mode is automatically enabled when:

1. **Extension is unpacked** - Loading the extension unpacked in Chrome automatically enables dev mode
2. **Version contains 'dev' or 'beta'** - Update manifest.json version to include these keywords
3. **LocalStorage flag** - Set `DEV_MODE` to `true` in browser console:
   ```javascript
   localStorage.setItem('DEV_MODE', 'true');
   ```

## Development Features

### 1. Mock License Validation
- Returns valid license without calling Microsoft Graph API
- Configurable license type (Basic, Standard, Premium)
- No need for actual Microsoft 365 subscription

### 2. Mock Authentication
- Bypasses Microsoft authentication
- Returns mock user profile:
  - Display Name: "Development User"
  - Email: "devuser@devtenant.onmicrosoft.com"
  - Roles: System Administrator, System Customizer

### 3. Mock API Responses
All external APIs return mock data in development mode:

#### Microsoft Graph API
- `/me` - Returns mock user profile
- `/me/licenseDetails` - Returns mock license assignments
- `/subscribedSkus` - Returns mock tenant licenses
- `/organization` - Returns mock tenant information

#### Dataverse API
- Mock organization URL: `https://devorg.crm.dynamics.com`
- Returns sample customizations for testing
- No actual Dynamics 365 environment needed

#### SharePoint API
- Mock site URL: `https://devtenant.sharepoint.com/sites/DOMStyleInjector`
- Simulates document library operations
- No SharePoint site required

### 4. Visual Dev Mode Indicator
- Yellow badge appears in bottom-right corner
- Shows "🔧 DEV MODE" with "Mock APIs Active"
- Click to open dev mode settings panel

### 5. Dev Mode Settings Panel
Configure development behavior:
- **Mock Valid License** - Toggle license validation
- **Mock Admin Role** - Toggle admin permissions
- **Verbose Logging** - Enable detailed console output
- **Mock Tenant ID** - Set custom tenant identifier

## Development Workflow

### Initial Setup
1. Clone the repository
2. Load extension unpacked in Chrome
3. Dev mode automatically activates
4. All features work without external dependencies

### Testing License States

#### Test Licensed User
```javascript
// Default behavior - user has valid license
```

#### Test Unlicensed User
1. Click dev mode indicator
2. Uncheck "Mock Valid License"
3. Save and reload
4. Extension redirects to license-required page

### Testing User Roles

#### Test Admin User
```javascript
// Default behavior - user has admin role
```

#### Test Regular User
1. Click dev mode indicator
2. Uncheck "Mock Admin Role"
3. Save and reload
4. Limited UI features displayed

### Testing API Failures
To test error handling:
```javascript
// In console, disable specific mocks
localStorage.setItem('DEV_MODE_FAIL_LICENSE', 'true');
localStorage.setItem('DEV_MODE_FAIL_AUTH', 'true');
```

## Configuration Files

### `/src/config/development.js`
Main configuration file containing:
- Mock API responses
- Development API keys
- Feature flags
- Mock endpoints

### Environment Variables
Set these in your development environment:
```bash
export LICENSE_SERVICE_PLAN_ID="your-dev-plan-id"
export LICENSE_SKU_ID="your-dev-sku-id"
export PUBLISHER_ID="your-dev-publisher-id"
```

## Production Transition

### Disable Dev Mode
1. Package extension for production
2. Set proper version without 'dev' or 'beta'
3. Add production manifest key
4. Clear localStorage flags

### Required Production Values
Replace these development placeholders:
- `DEV_SERVICE_PLAN_ID` → Actual Microsoft service plan ID
- `DEV_SKU_ID` → Actual Microsoft SKU ID
- `DEV_PUBLISHER_ID` → Your Microsoft Partner Center ID

### API Keys and Endpoints
1. Register app in Azure AD
2. Get production client ID and secret
3. Configure redirect URIs
4. Set up license validation endpoint

## Troubleshooting

### Dev Mode Not Activating
1. Check Chrome extension ID (should be random for unpacked)
2. Verify manifest.json version
3. Check console for errors
4. Clear extension storage and reload

### Mock Data Not Loading
1. Open console and check for errors
2. Verify `isDevelopment` returns true:
   ```javascript
   const validator = new LicenseValidator();
   console.log(validator.isDevelopment); // Should be true
   ```

### License Check Failing in Dev Mode
1. Ensure dev mode is properly enabled
2. Check dev mode settings panel
3. Clear cache and reload extension

## Best Practices

1. **Always test both licensed and unlicensed states**
2. **Test with different user roles** (admin vs regular user)
3. **Simulate API failures** to test error handling
4. **Use verbose logging** during development
5. **Test with mock data** that matches production schema
6. **Document any dev-specific code** for easy removal

## Security Notes

- Development mode should NEVER be enabled in production
- Mock API keys are for development only
- Don't commit real API keys to repository
- Use environment variables for sensitive data
- Remove all dev mode code before production release