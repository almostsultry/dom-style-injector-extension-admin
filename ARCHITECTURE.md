# Secure Architecture Overview

## Key Security Principle

**No API secrets or sensitive keys are stored in the browser extension.** All sensitive operations requiring API secrets are handled by a secure backend service.

## Architecture Diagram

```
┌─────────────────────────┐          ┌──────────────────────────┐          ┌─────────────────────┐
│   Chrome Extension      │          │   Your Backend Server    │          │  Microsoft APIs     │
│                         │          │                          │          │                     │
│ • Public Client ID only │ ──────—> │ • Holds all secrets      │ ──────—> │ • Graph API         │
│ • User authentication   │ <──────— │ • Service principal auth │ <──────— │ • License API       │
│ • No secrets!           │          │ • Validates licenses     │          │ • Dataverse         │
│                         │          │ • Audit logging          │          │ • SharePoint        │
└─────────────────────────┘          └──────────────────────────┘          └─────────────────────┘
        Browser                          Your Infrastructure                      Microsoft
```

## What Lives Where

### Extension (Public Code)
- ✅ Public OAuth Client ID
- ✅ Backend API URL (public endpoint)
- ✅ User's auth tokens (session only)
- ✅ Extension metadata
- ❌ NO client secrets
- ❌ NO API keys
- ❌ NO private certificates

### Backend Server (Private)
- ✅ Client Secret for OAuth
- ✅ Service Principal credentials
- ✅ Database connection strings
- ✅ Encryption keys
- ✅ Third-party API keys
- ✅ Certificate private keys

## Authentication Flow

### 1. User Authentication (Public Flow)
```javascript
// Extension uses public client flow - no secret needed
const config = {
  auth: {
    clientId: 'public-client-id', // Safe to be in code
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: chrome.identity.getRedirectURL()
  }
};

// User logs in via browser
const token = await chrome.identity.launchWebAuthFlow({
  url: authUrl,
  interactive: true
});
```

### 2. Backend Authentication (Confidential Flow)
```javascript
// Backend uses confidential client - has secret
const config = {
  auth: {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET, // Never in extension!
    authority: process.env.AUTHORITY
  }
};

// Backend gets app-only token
const token = await confidentialClient.acquireTokenByClientCredential({
  scopes: ['https://graph.microsoft.com/.default']
});
```

## License Validation Flow

### Extension Side
```javascript
// Extension just asks backend to validate
const response = await fetch('https://api.yourdomain.com/api/license/validate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`, // User's token
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ tenantId })
});
```

### Backend Side
```javascript
// Backend does the actual validation
app.post('/api/license/validate', authenticate, async (req, res) => {
  // 1. Verify user's token
  const userClaims = await verifyToken(req.headers.authorization);
  
  // 2. Use service principal to check licenses
  const serviceToken = await getServiceToken(); // Uses client secret
  
  // 3. Call Microsoft Graph
  const licenses = await checkLicenses(serviceToken, userClaims.oid);
  
  // 4. Return result (no secrets!)
  res.json({ valid: licenses.includes(requiredSku) });
});
```

## File Structure

```
dom-style-injector-extension/
├── src/
│   ├── config/
│   │   ├── api-config.js      # Public config only
│   │   └── development.js     # Dev mode settings
│   ├── scripts/
│   │   ├── background.js      # No secrets here
│   │   ├── secure-backend-client.js  # Backend communication
│   │   └── license-validator.js      # Calls backend, not APIs
│   └── manifest.json          # Public extension config
│
├── backend-template/          # Separate backend service
│   ├── server.js             # Holds all secrets
│   ├── .env.example          # Template for secrets
│   └── package.json          # Backend dependencies
│
├── SECURITY.md               # Security documentation
└── ARCHITECTURE.md           # This file
```

## Development vs Production

### Development Mode
- Uses mock responses
- No real API calls needed
- Backend can run locally
- Dummy keys for testing

### Production Mode
- Real backend required
- All secrets in backend environment
- Proper SSL/TLS required
- Audit logging enabled

## Security Checklist

### Extension Security
- [ ] No secrets in code
- [ ] No API keys in storage
- [ ] Use session storage for tokens
- [ ] Clear tokens on logout
- [ ] Validate all inputs

### Backend Security
- [ ] Store secrets in environment variables
- [ ] Use HTTPS only
- [ ] Implement rate limiting
- [ ] Add request authentication
- [ ] Log all operations
- [ ] Regular key rotation

### Communication Security
- [ ] Use HTTPS for backend
- [ ] Add request signing
- [ ] Implement CORS properly
- [ ] Use short-lived tokens
- [ ] Add request IDs for tracking

## Deployment Options

### 1. Azure Functions (Serverless)
- Minimal infrastructure
- Automatic scaling
- Built-in key management
- Easy integration with Microsoft services

### 2. Traditional Server
- Full control
- Can run anywhere
- Need to manage secrets
- Handle scaling yourself

### 3. Container (Docker/Kubernetes)
- Portable deployment
- Secret management via K8s
- Good for microservices
- Cloud-agnostic

## FAQs

### Q: Why not just use the extension with secrets?
A: Browser extensions are public code. Users can inspect the source, extract any secrets, and use them maliciously.

### Q: What if my backend goes down?
A: Implement caching for license status (e.g., 24-hour cache). The extension can work offline temporarily.

### Q: How do I handle different environments?
A: Use different backend URLs for dev/staging/prod. The extension detects which to use based on its version.

### Q: What about performance?
A: Cache validation results. Only check licenses on startup and periodically (e.g., every 12 hours).

### Q: How do I test without a backend?
A: Use development mode with mock responses. No backend needed for development.