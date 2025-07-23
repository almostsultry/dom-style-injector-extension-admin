// src/scripts/license-validator.js - Microsoft 365 License Validation
// Validates licenses purchased through Microsoft 365 Admin Center

class LicenseValidator {
  constructor() {
    // Microsoft Graph endpoints for license validation
    this.graphEndpoint = 'https://graph.microsoft.com/v1.0';
    this.licenseServicePlanId = 'YOUR_SERVICE_PLAN_ID'; // Will be assigned by Microsoft when you publish to AppSource
    this.skuId = 'YOUR_SKU_ID'; // Will be assigned by Microsoft
    this.publisherId = 'YOUR_PUBLISHER_ID'; // Your Microsoft Partner Center Publisher ID
  }

  /**
   * Validate user has active license through Microsoft 365
   * @param {string} accessToken - Microsoft Graph access token
   * @returns {Object} License validation result
   */
  async validateUserLicense(accessToken) {
    try {
      console.log('Validating Microsoft 365 license...');

      // Get current user's assigned licenses
      const userLicenses = await this.getUserLicenses(accessToken);
      
      // Check if user has the specific license for this extension
      const hasValidLicense = this.checkForValidLicense(userLicenses);
      
      if (hasValidLicense) {
        // Get license details
        const licenseDetails = await this.getLicenseDetails(accessToken, hasValidLicense);
        
        // Verify license is active and not expired
        const isActive = this.verifyLicenseStatus(licenseDetails);
        
        return {
          valid: isActive,
          licensed: true,
          details: licenseDetails,
          expiresOn: licenseDetails.expiryDate,
          assignedOn: licenseDetails.assignedDate,
          licenseType: licenseDetails.skuPartNumber,
          tenantId: licenseDetails.tenantId
        };
      }
      
      // Check if tenant has available licenses
      const tenantLicenses = await this.getTenantLicenses(accessToken);
      const hasUnassignedLicenses = this.checkForUnassignedLicenses(tenantLicenses);
      
      return {
        valid: false,
        licensed: false,
        hasUnassignedLicenses: hasUnassignedLicenses,
        message: hasUnassignedLicenses 
          ? 'License available but not assigned. Contact your administrator.'
          : 'No valid license found. Purchase through Microsoft 365 Admin Center.'
      };
      
    } catch (error) {
      console.error('License validation error:', error);
      
      // Handle specific error cases
      if (error.status === 403) {
        return {
          valid: false,
          error: 'Insufficient permissions to validate license',
          requiresConsent: true
        };
      }
      
      return {
        valid: false,
        error: error.message,
        fallbackToCache: true
      };
    }
  }

  /**
   * Get user's assigned licenses from Microsoft Graph
   */
  async getUserLicenses(accessToken) {
    const response = await fetch(`${this.graphEndpoint}/me/licenseDetails`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user licenses: ${response.status}`);
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * Get tenant's purchased licenses
   */
  async getTenantLicenses(accessToken) {
    try {
      const response = await fetch(`${this.graphEndpoint}/subscribedSkus`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get tenant licenses: ${response.status}`);
      }

      const data = await response.json();
      return data.value || [];
    } catch (error) {
      console.warn('Could not fetch tenant licenses:', error);
      return [];
    }
  }

  /**
   * Check if user has valid license for this extension
   */
  checkForValidLicense(userLicenses) {
    return userLicenses.find(license => {
      // Check if license contains our service plan
      const hasServicePlan = license.servicePlans?.some(plan => 
        plan.servicePlanId === this.licenseServicePlanId &&
        plan.provisioningStatus === 'Success'
      );
      
      return hasServicePlan || license.skuId === this.skuId;
    });
  }

  /**
   * Check for unassigned licenses in tenant
   */
  checkForUnassignedLicenses(tenantLicenses) {
    const extensionSku = tenantLicenses.find(sku => 
      sku.skuId === this.skuId || 
      sku.servicePlans?.some(plan => plan.servicePlanId === this.licenseServicePlanId)
    );
    
    if (extensionSku) {
      const available = extensionSku.prepaidUnits.enabled - extensionSku.consumedUnits;
      return available > 0;
    }
    
    return false;
  }

  /**
   * Get detailed license information
   */
  async getLicenseDetails(accessToken, license) {
    try {
      // Get additional details about the license
      const response = await fetch(`${this.graphEndpoint}/me/licenseDetails/${license.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get license details');
      }

      const details = await response.json();
      
      // Get tenant information
      const tenantInfo = await this.getTenantInfo(accessToken);
      
      return {
        ...details,
        tenantId: tenantInfo.id,
        tenantName: tenantInfo.displayName,
        assignedDate: license.assignedDateTime,
        expiryDate: this.calculateExpiryDate(license),
        features: this.getEnabledFeatures(license.servicePlans)
      };
    } catch (error) {
      console.warn('Could not fetch detailed license info:', error);
      return license;
    }
  }

  /**
   * Get tenant information
   */
  async getTenantInfo(accessToken) {
    try {
      const response = await fetch(`${this.graphEndpoint}/organization`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get tenant info');
      }

      const data = await response.json();
      return data.value[0] || {};
    } catch (error) {
      console.warn('Could not fetch tenant info:', error);
      return {};
    }
  }

  /**
   * Verify license is active and not expired
   */
  verifyLicenseStatus(licenseDetails) {
    // Check if license has expiry date
    if (licenseDetails.expiryDate) {
      const expiryDate = new Date(licenseDetails.expiryDate);
      if (expiryDate < new Date()) {
        return false;
      }
    }
    
    // Check service plan status
    const activePlans = licenseDetails.servicePlans?.filter(plan => 
      plan.provisioningStatus === 'Success' &&
      plan.servicePlanId === this.licenseServicePlanId
    );
    
    return activePlans && activePlans.length > 0;
  }

  /**
   * Calculate license expiry date
   */
  calculateExpiryDate(_license) {
    // Microsoft 365 licenses typically don't have explicit expiry in the API
    // They're subscription-based and renew monthly/annually
    // You might need to implement custom logic based on your agreement with Microsoft
    
    // For now, we'll assume license is valid as long as it's assigned
    return null;
  }

  /**
   * Get enabled features based on service plans
   */
  getEnabledFeatures(servicePlans) {
    const features = {
      maxCustomizations: 1000, // Default limits
      syncEnabled: true,
      advancedFeatures: false,
      supportLevel: 'standard'
    };
    
    // Map service plans to features
    // This would be customized based on your license tiers
    servicePlans?.forEach(plan => {
      if (plan.servicePlanName?.includes('PREMIUM')) {
        features.maxCustomizations = -1; // Unlimited
        features.advancedFeatures = true;
        features.supportLevel = 'premium';
      }
    });
    
    return features;
  }

  /**
   * Cache license validation result
   */
  async cacheLicenseResult(result) {
    const cacheData = {
      ...result,
      cachedAt: Date.now(),
      cacheExpiry: Date.now() + (4 * 60 * 60 * 1000) // Cache for 4 hours
    };
    
    await chrome.storage.local.set({ 
      licenseCache: cacheData,
      lastLicenseCheck: Date.now()
    });
  }

  /**
   * Get cached license if still valid
   */
  async getCachedLicense() {
    const { licenseCache } = await chrome.storage.local.get('licenseCache');
    
    if (licenseCache && licenseCache.cacheExpiry > Date.now()) {
      console.log('Using cached license validation');
      return {
        ...licenseCache,
        fromCache: true
      };
    }
    
    return null;
  }

  /**
   * Request license assignment (opens Microsoft 365 admin center)
   */
  async requestLicenseAssignment(_tenantId) {
    const adminUrl = `https://admin.microsoft.com/Adminportal/Home#/licenses`;
    
    // Open admin center for license assignment
    chrome.tabs.create({ url: adminUrl });
    
    return {
      action: 'opened_admin_center',
      message: 'Please ask your administrator to assign a license for DOM Style Injector Extension'
    };
  }

  /**
   * Validate license on extension startup
   */
  async validateOnStartup(accessToken) {
    try {
      // Check cache first
      const cached = await this.getCachedLicense();
      if (cached) {
        return cached;
      }
      
      // Perform fresh validation
      const result = await this.validateUserLicense(accessToken);
      
      // Cache successful validation
      if (result.valid) {
        await this.cacheLicenseResult(result);
      }
      
      return result;
    } catch (error) {
      console.error('Startup license validation failed:', error);
      
      // Try to use cached license as fallback
      const cached = await this.getCachedLicense();
      if (cached) {
        return { ...cached, fallbackUsed: true };
      }
      
      return {
        valid: false,
        error: error.message,
        requiresOnlineValidation: true
      };
    }
  }

  /**
   * Monitor license changes via Microsoft Graph subscriptions
   */
  async setupLicenseChangeMonitoring(_accessToken) {
    try {
      // Create a subscription to monitor license changes
      // const subscription = {
      //   changeType: 'updated',
      //   notificationUrl: `${chrome.runtime.getURL('webhook')}`, // Would need server component
      //   resource: '/users/{user-id}/licenseDetails',
      //   expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      //   clientState: crypto.randomUUID()
      // };
      
      // Note: This would require a server component to receive webhooks
      // For now, we'll rely on periodic checks
      
      console.log('License monitoring would require webhook endpoint');
      
    } catch (error) {
      console.error('Could not setup license monitoring:', error);
    }
  }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LicenseValidator;
}