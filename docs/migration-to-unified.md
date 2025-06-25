# Migration Guide: From Dual Extensions to Unified Architecture

## Overview

Version 2.0.0 introduces a unified extension architecture that replaces the separate admin and user versions with a single, role-aware extension.

## Key Changes

### Architecture Changes

| Feature | Old (v1.x) | New (v2.0) |
|---------|------------|------------|
| Extensions | 2 separate (admin + user) | 1 unified |
| Role Detection | Build-time separation | Runtime detection |
| Authentication | Optional | Required |
| UI | Static per version | Dynamic based on role |
| Build Output | 2 packages | 1 package |

### Benefits of Unified Architecture

1. **Simplified Deployment** - One extension to manage
2. **Dynamic Permissions** - Automatically adjusts to role changes
3. **Better Security** - Role verification through Dataverse
4. **Easier Maintenance** - Single codebase
5. **Consistent Experience** - Same extension for all users

## Migration Steps

### For Developers

1. **Update Repository**
   ```bash
   git pull origin main
   npm install
   ```

2. **Update Build Scripts**
   - Remove `npm run build:admin` and `npm run build:user`
   - Use `npm run build` for unified output

3. **Configure Authentication**
   - Set up Azure AD app registration
   - Update `config/development.json` with credentials

4. **Test Role Detection**
   - Test with System Customizer account
   - Test with standard user account
   - Verify UI changes appropriately

### For IT Administrators

1. **Uninstall Old Extensions**
   - Remove "DOM Style Injector - Admin"
   - Remove "DOM Style Injector - User"

2. **Deploy Unified Extension**
   - Distribute single `.crx` or `.zip` file
   - Use group policy or manual installation

3. **Configure Azure AD**
   ```json
   {
     "clientId": "your-app-id",
     "tenantId": "your-tenant-id",
     "redirectUri": "https://your-ext-id.chromiumapp.org/"
   }
   ```

4. **Update SharePoint Integration**
   - Ensure SharePoint list permissions
   - Update API endpoints if needed

### For End Users

1. **Remove Old Extensions**
   - Uninstall both admin and user versions
   
2. **Install New Extension**
   - Install single unified extension
   - Sign in when prompted
   
3. **First Use**
   - Click extension icon
   - Sign in with Microsoft account
   - Interface will adapt to your role

## Authentication Setup

### Azure AD Configuration

1. **Register Application**
   - Go to Azure Portal → App registrations
   - New registration
   - Set redirect URI: `https://{extension-id}.chromiumapp.org/`

2. **Configure Permissions**
   ```
   Microsoft Graph:
   - User.Read
   - openid
   - profile
   
   Dynamics 365:
   - user_impersonation
   ```

3. **Update Extension**
   - Add client ID to options
   - Configure tenant ID

### Troubleshooting Auth Issues

| Issue | Solution |
|-------|----------|
| "Not configured" error | Set D365 URL in extension options |
| Token expired | Clear cache in extension options |
| Role not detected | Verify D365 user has correct security role |
| Sign-in loops | Check redirect URI configuration |

## Data Migration

### Customizations
Existing customizations are preserved:
```javascript
// Old storage structure
{
  "customizations": [...],
  "settings": {...}
}

// New storage structure (compatible)
{
  "customizations": [...],
  "settings": {...},
  "userRole": {
    "isAdmin": boolean,
    "timestamp": number
  }
}
```

### Settings Migration
Settings automatically migrate on first run:
- D365 URL → Stored in sync storage
- Customizations → Preserved as-is
- User preferences → Maintained

## Breaking Changes

### API Changes

1. **Message Format**
   ```javascript
   // Old
   chrome.runtime.sendMessage({ 
     action: "saveCustomization",
     data: {...} 
   });
   
   // New (with auth)
   chrome.runtime.sendMessage({ 
     action: "saveCustomization",
     token: authToken,
     data: {...} 
   });
   ```

2. **Storage Keys**
   - Added: `userRole`, `d365OrgUrl`
   - Deprecated: `isAdminVersion`

### Build Configuration

Update `webpack.config.js`:
```javascript
// Remove
entry: {
  admin: './src/admin/index.js',
  user: './src/user/index.js'
}

// Add
entry: {
  popup: './src/popup/popup.js',
  background: './src/scripts/service-worker.js',
  content: './src/scripts/content.js'
}
```

## Rollback Plan

If issues arise:

1. **Revert to Dual Extensions**
   ```bash
   git checkout v1.5.0
   npm install
   npm run build:all
   ```

2. **Preserve User Data**
   - Export customizations before migration
   - Import after rollback if needed

## FAQ

**Q: Do users need to re-authenticate often?**
A: No, authentication tokens are cached for 8 hours.

**Q: Can we still restrict features by role?**
A: Yes, role-based UI ensures only authorized users see admin features.

**Q: What if authentication fails?**
A: The extension falls back to read-only mode for safety.

**Q: Is the old build process still available?**
A: No, but the git history preserves the old structure if needed.

## Support

For migration assistance:
- Review [GitHub Issues](https://github.com/almostsultry/dom-style-injector-extension-admin/issues)
- Contact IT support team
- Check logs in browser DevTools

---

**Timeline**: Plan for 2-week migration window to ensure smooth transition for all users.