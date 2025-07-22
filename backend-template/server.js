/**
 * DOM Style Injector Extension - Secure Backend Service
 * This service handles all sensitive operations that require API secrets
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ConfidentialClientApplication } = require('@azure/msal-node');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());
app.use(express.json());

// CORS configuration - restrict to your extension only
const corsOptions = {
  origin: [
    `chrome-extension://${process.env.EXTENSION_ID}`,
    'http://localhost:3000' // Development only
  ],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Extension-Version']
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// MSAL configuration for server-side Graph API calls
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET, // Server-side only!
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`
  }
};

const msalClient = new ConfidentialClientApplication(msalConfig);

// Middleware to validate extension requests
async function validateExtensionRequest(req, res, next) {
  const extensionVersion = req.headers['x-extension-version'];
  const authToken = req.headers['authorization']?.replace('Bearer ', '');
  
  if (!extensionVersion || !authToken) {
    return res.status(401).json({ error: 'Invalid request' });
  }
  
  try {
    // Validate the user's token
    const tokenClaims = await validateUserToken(authToken);
    req.user = tokenClaims;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Helper to validate user tokens
async function validateUserToken(token) {
  // In production, properly validate the JWT token
  // For now, decode and verify basic claims
  try {
    const base64Payload = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    
    // Verify token hasn't expired
    if (payload.exp * 1000 < Date.now()) {
      throw new Error('Token expired');
    }
    
    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Get service token for Graph API calls
async function getServiceToken() {
  try {
    const result = await msalClient.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default']
    });
    return result.accessToken;
  } catch (error) {
    console.error('Failed to acquire service token:', error);
    throw error;
  }
}

// ===== API ENDPOINTS =====

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// License validation endpoint
app.post('/api/license/validate', validateExtensionRequest, async (req, res) => {
  try {
    const { tenantId } = req.body;
    const userId = req.user.oid; // Object ID from token
    
    console.log(`License check for user ${userId} in tenant ${tenantId}`);
    
    // Get service token to call Graph API
    const serviceToken = await getServiceToken();
    
    // Check user's licenses via Graph API
    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/licenseDetails`,
      {
        headers: {
          'Authorization': `Bearer ${serviceToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!graphResponse.ok) {
      throw new Error('Failed to fetch license details');
    }
    
    const licenseData = await graphResponse.json();
    
    // Check for your specific SKU/Service Plan
    const hasValidLicense = licenseData.value.some(license => 
      license.skuId === process.env.LICENSE_SKU_ID ||
      license.servicePlans?.some(plan => 
        plan.servicePlanId === process.env.LICENSE_SERVICE_PLAN_ID &&
        plan.provisioningStatus === 'Success'
      )
    );
    
    // Log for audit
    await logAuditEvent({
      action: 'license_validation',
      userId,
      tenantId,
      result: hasValidLicense,
      timestamp: new Date()
    });
    
    res.json({
      valid: hasValidLicense,
      licensed: hasValidLicense,
      features: hasValidLicense ? getFeaturesByLicense(licenseData.value) : {},
      message: hasValidLicense ? 'Valid license found' : 'No valid license'
    });
    
  } catch (error) {
    console.error('License validation error:', error);
    res.status(500).json({ 
      error: 'License validation failed',
      message: error.message 
    });
  }
});

// Token exchange endpoint (exchange user token for app token)
app.post('/api/auth/exchange', validateExtensionRequest, async (req, res) => {
  try {
    const { resource } = req.body;
    
    // Use on-behalf-of flow to get token for the requested resource
    const result = await msalClient.acquireTokenOnBehalfOf({
      oboAssertion: req.headers.authorization.replace('Bearer ', ''),
      scopes: [`${resource}/.default`]
    });
    
    res.json({
      accessToken: result.accessToken,
      expiresIn: Math.floor((result.expiresOn - Date.now()) / 1000)
    });
    
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// Sync customizations (with server-side validation)
app.post('/api/sync/customizations', validateExtensionRequest, async (req, res) => {
  try {
    const { customizations, tenantId } = req.body;
    const userId = req.user.oid;
    
    // Validate user has permission to sync
    const hasPermission = await checkUserPermission(userId, tenantId, 'sync');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Validate customizations
    const validatedCustomizations = validateCustomizations(customizations);
    
    // Store in your database
    await storeCustomizations(tenantId, userId, validatedCustomizations);
    
    // Log the operation
    await logAuditEvent({
      action: 'sync_customizations',
      userId,
      tenantId,
      count: validatedCustomizations.length,
      timestamp: new Date()
    });
    
    res.json({ 
      success: true, 
      count: validatedCustomizations.length 
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Audit log endpoint
app.post('/api/audit/log', validateExtensionRequest, async (req, res) => {
  try {
    const { action, details } = req.body;
    const userId = req.user.oid;
    
    await logAuditEvent({
      action,
      userId,
      details,
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Audit log error:', error);
    res.status(500).json({ error: 'Audit logging failed' });
  }
});

// ===== HELPER FUNCTIONS =====

function getFeaturesByLicense(licenses) {
  // Determine features based on license type
  const features = {
    maxCustomizations: 100,
    syncEnabled: true,
    advancedFeatures: false,
    supportLevel: 'standard'
  };
  
  // Check for premium license
  if (licenses.some(l => l.skuPartNumber?.includes('PREMIUM'))) {
    features.maxCustomizations = -1; // Unlimited
    features.advancedFeatures = true;
    features.supportLevel = 'premium';
  }
  
  return features;
}

async function checkUserPermission(userId, tenantId, action) {
  // Check user permissions in your database
  // This is a placeholder - implement your permission logic
  return true;
}

function validateCustomizations(customizations) {
  // Validate and sanitize customizations
  return customizations.filter(c => {
    // Ensure required fields
    if (!c.selector || !c.css || !c.targetUrl) {
      return false;
    }
    
    // Sanitize CSS to prevent XSS
    c.css = sanitizeCSS(c.css);
    
    // Validate selector
    if (!isValidSelector(c.selector)) {
      return false;
    }
    
    return true;
  });
}

function sanitizeCSS(css) {
  // Remove potentially dangerous CSS
  // This is a basic example - use a proper CSS sanitizer in production
  return css
    .replace(/javascript:/gi, '')
    .replace(/expression\(/gi, '')
    .replace(/<script/gi, '');
}

function isValidSelector(selector) {
  try {
    // Test if selector is valid
    document.createElement('div').querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

async function storeCustomizations(tenantId, userId, customizations) {
  // Store in your database
  // This is a placeholder - implement your storage logic
  console.log(`Storing ${customizations.length} customizations for tenant ${tenantId}`);
}

async function logAuditEvent(event) {
  // Store audit logs in your database
  // This is a placeholder - implement your audit logging
  console.log('Audit event:', event);
}

// ===== ERROR HANDLING =====

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ===== START SERVER =====

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DOM Style Injector Backend running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  // Verify required environment variables
  const required = [
    'AZURE_CLIENT_ID',
    'AZURE_CLIENT_SECRET',
    'AZURE_TENANT_ID',
    'LICENSE_SKU_ID',
    'LICENSE_SERVICE_PLAN_ID',
    'EXTENSION_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    process.exit(1);
  }
});