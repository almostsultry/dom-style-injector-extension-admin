# Security Architecture for DOM Style Injector Extension

## Overview

This document outlines the secure architecture for handling sensitive API keys and operations without exposing them to the client-side extension.

## Key Security Principles

1. **No sensitive keys on client** - API secrets never reach the browser extension
2. **Backend proxy pattern** - All sensitive operations go through your secure backend
3. **Token exchange** - Convert public tokens to backend tokens for secure operations
4. **Certificate pinning** - Optional extra security for backend communication
5. **Audit logging** - All operations logged server-side

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Chrome Extension│────▶│  Your Backend    │────▶│ Microsoft APIs  │
│  (Public only)  │◀────│ (Holds secrets)  │◀────│  (Graph, etc)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                         │
        │                        │                         │
     No secrets              All secrets              Protected APIs
     Public client ID        Private keys          License validation
     User tokens            Service principals     Tenant operations
```

## Implementation Guide

### 1. Extension Side (Public)

The extension only uses public authentication flow:

```javascript
// src/scripts/auth-service.js
class AuthService {
  constructor() {
    // Only public client ID - no secrets
    this.clientId = API_CONFIG.PUBLIC.OAUTH.CLIENT_ID;
    this.authority = `https://login.microsoftonline.com/common`;
  }
  
  async authenticate() {
    // Use Chrome identity API for OAuth2 implicit flow
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = `${this.authority}/oauth2/v2.0/authorize?` +
      `client_id=${this.clientId}` +
      `&response_type=token` +
      `&redirect_uri=${redirectUrl}` +
      `&scope=${API_CONFIG.PUBLIC.OAUTH.SCOPES.join(' ')}`;
    
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, (redirectUrl) => {
        // Extract token from redirect URL
        const token = this.extractToken(redirectUrl);
        resolve(token);
      });
    });
  }
}
```

### 2. Backend Service (Secure)

Your backend handles all sensitive operations:

```javascript
// backend/server.js
const express = require('express');
const msal = require('@azure/msal-node');

// Sensitive configuration - stored in environment variables
const config = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET, // NEVER expose this
    authority: process.env.AZURE_AUTHORITY
  }
};

const app = express();
const confidentialClient = new msal.ConfidentialClientApplication(config);

// Validate license through backend
app.post('/api/license/validate', authenticate, async (req, res) => {
  try {
    const { tenantId, userId } = req.body;
    
    // Use service principal to check licenses
    const token = await confidentialClient.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default']
    });
    
    // Call Microsoft Graph with service token
    const licenses = await checkUserLicenses(token.accessToken, userId);
    
    // Validate against your license database
    const isValid = await validateLicense(tenantId, userId, licenses);
    
    // Log for audit
    await auditLog({
      action: 'license_check',
      tenantId,
      userId,
      result: isValid,
      timestamp: new Date()
    });
    
    res.json({ valid: isValid, features: getFeatures(licenses) });
  } catch (error) {
    res.status(500).json({ error: 'License validation failed' });
  }
});
```

### 3. Environment Variables

Store all sensitive values in environment variables:

```bash
# .env file (NEVER commit this)
AZURE_CLIENT_ID=your-app-client-id
AZURE_CLIENT_SECRET=your-app-client-secret
AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id
DATABASE_CONNECTION_STRING=your-secure-db-connection
ENCRYPTION_KEY=your-256-bit-encryption-key
```

### 4. Secure Communication

Implement certificate pinning for extra security:

```javascript
// Extension side - pin your backend certificate
class SecureBackendClient {
  constructor() {
    this.baseUrl = API_CONFIG.BACKEND.BASE_URL;
    this.certificateFingerprint = 'sha256/YOUR_CERT_FINGERPRINT';
  }
  
  async secureRequest(endpoint, data) {
    // In production, implement certificate validation
    const response = await fetch(this.baseUrl + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Version': chrome.runtime.getManifest().version,
        'X-Request-ID': crypto.randomUUID()
      },
      body: JSON.stringify(data)
    });
    
    return response.json();
  }
}
```

## Deployment Options

### Option 1: Azure Functions (Recommended)

Deploy your backend as serverless functions:

```javascript
// azure-function/ValidateLicense/index.js
module.exports = async function (context, req) {
  const { tenantId, userId, token } = req.body;
  
  // Validate the user's token
  const isValidToken = await validateToken(token);
  if (!isValidToken) {
    context.res = { status: 401, body: 'Unauthorized' };
    return;
  }
  
  // Use managed identity to access Graph API
  const graphToken = await getManagedIdentityToken();
  const licenses = await checkLicenses(graphToken, userId);
  
  context.res = {
    body: { valid: licenses.hasValidLicense }
  };
};
```

### Option 2: Node.js Backend

Traditional backend service:

```javascript
// Use environment variables for all secrets
require('dotenv').config();

const app = express();

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// All other endpoints require authentication
app.use('/api', requireAuth);

// License endpoints
app.use('/api/license', licenseRouter);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Secure backend running on port ${PORT}`);
});
```

### Option 3: API Gateway + Lambda

Use AWS API Gateway with Lambda functions:

```yaml
# serverless.yml
service: dom-style-injector-backend

provider:
  name: aws
  runtime: nodejs14.x
  environment:
    CLIENT_SECRET: ${ssm:/dom-style-injector/client-secret~true}

functions:
  validateLicense:
    handler: handlers/license.validate
    events:
      - http:
          path: license/validate
          method: post
          cors: true
```

## Security Best Practices

### 1. Token Handling
- Use short-lived tokens (1 hour max)
- Implement token refresh logic
- Never store tokens in localStorage (use session storage)
- Clear tokens on logout

### 2. API Key Management
- Use Azure Key Vault or AWS Secrets Manager
- Rotate keys regularly
- Use different keys for dev/staging/prod
- Monitor key usage

### 3. Audit Logging
- Log all license checks
- Log all admin operations
- Store logs securely
- Implement log retention policies

### 4. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### 5. Input Validation
```javascript
const { body, validationResult } = require('express-validator');

app.post('/api/license/validate',
  body('tenantId').isUUID(),
  body('userId').isUUID(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Process request
  }
);
```

## Monitoring and Alerts

Set up monitoring for:
- Failed license validations
- Unusual traffic patterns
- Multiple failed auth attempts
- API errors and timeouts

```javascript
// Example monitoring
async function monitorLicenseCheck(tenantId, result) {
  if (!result.valid) {
    await alerting.send({
      type: 'LICENSE_VALIDATION_FAILED',
      tenantId,
      timestamp: new Date(),
      severity: 'warning'
    });
  }
}
```

## Emergency Procedures

### If Keys Are Compromised:
1. Immediately rotate all keys in Azure AD
2. Update backend environment variables
3. Monitor logs for unauthorized access
4. Notify affected customers
5. Implement additional monitoring

### Incident Response Plan:
1. Disable compromised keys
2. Deploy updated backend
3. Force extension update if needed
4. Review audit logs
5. Update security measures

## Testing Security

Regular security testing checklist:
- [ ] Penetration testing quarterly
- [ ] Dependency scanning (npm audit)
- [ ] OWASP top 10 review
- [ ] Certificate expiration monitoring
- [ ] Key rotation testing
- [ ] Backup and recovery testing

## Compliance

Ensure compliance with:
- GDPR (data protection)
- SOC 2 (security controls)
- Microsoft Partner requirements
- Industry-specific regulations

Remember: The extension is public code that users can inspect. Never put anything sensitive in the extension code, even encrypted.