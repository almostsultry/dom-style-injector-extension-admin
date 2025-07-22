// src/scripts/license-required.js - License validation and purchase flow

document.addEventListener('DOMContentLoaded', async () => {
    const licenseStatusEl = document.getElementById('licenseStatus');
    const errorMessageEl = document.getElementById('errorMessage');
    const purchaseBtn = document.getElementById('purchaseLicense');
    const checkBtn = document.getElementById('checkLicense');
    const tenantInfoEl = document.getElementById('tenantInfo');
    const userInfoEl = document.getElementById('userInfo');
    
    // Check license status on load
    await checkLicenseStatus();
    
    // Event listeners
    purchaseBtn.addEventListener('click', handlePurchase);
    checkBtn.addEventListener('click', checkLicenseStatus);
    
    async function checkLicenseStatus() {
        try {
            // Show loading state
            licenseStatusEl.innerHTML = `
                <h3>Checking License Status...</h3>
                <div class="loading active">
                    <span>Validating your Microsoft 365 subscription...</span>
                </div>
            `;
            licenseStatusEl.className = 'license-status';
            errorMessageEl.className = 'error-message';
            
            // Request license check from background script
            const response = await chrome.runtime.sendMessage({ 
                action: 'checkLicense' 
            });
            
            if (response.success && response.licensed) {
                // Valid license found
                licenseStatusEl.className = 'license-status valid';
                licenseStatusEl.innerHTML = `
                    <h3>✓ Valid License Found</h3>
                    <div class="license-info">
                        <p>Your organization has an active license for DOM Style Injector Extension.</p>
                        ${response.details.expiresOn ? 
                            `<p>Expires: ${new Date(response.details.expiresOn).toLocaleDateString()}</p>` : 
                            '<p>Subscription: Active</p>'
                        }
                        ${response.details.licenseType ? 
                            `<p>License Type: ${response.details.licenseType}</p>` : ''
                        }
                    </div>
                `;
                
                // Redirect to main extension after 3 seconds
                setTimeout(() => {
                    window.location.href = chrome.runtime.getURL('popup/popup.html');
                }, 3000);
                
            } else if (response.details && response.details.hasUnassignedLicenses) {
                // Licenses available but not assigned
                licenseStatusEl.innerHTML = `
                    <h3>⚠️ License Not Assigned</h3>
                    <div class="license-info">
                        <p>${response.details.message}</p>
                        <p>Your organization has purchased licenses, but one hasn't been assigned to your account.</p>
                        <p>Please contact your Microsoft 365 administrator to assign a license.</p>
                    </div>
                `;
                
            } else {
                // No license found
                licenseStatusEl.innerHTML = `
                    <h3>❌ No License Found</h3>
                    <div class="license-info">
                        <p>No valid license was found for your account.</p>
                        <p>Purchase a license through Microsoft 365 Admin Center to activate the extension.</p>
                    </div>
                `;
            }
            
            // Display tenant and user info
            await displayAccountInfo();
            
        } catch (error) {
            console.error('License check error:', error);
            
            errorMessageEl.className = 'error-message active';
            errorMessageEl.textContent = `Error checking license: ${error.message}`;
            
            licenseStatusEl.innerHTML = `
                <h3>⚠️ License Check Failed</h3>
                <div class="license-info">
                    <p>Unable to verify license status. Please check your internet connection and try again.</p>
                </div>
            `;
        }
    }
    
    async function handlePurchase() {
        try {
            // Open Microsoft 365 Admin Center licenses page
            await chrome.tabs.create({ 
                url: 'https://admin.microsoft.com/Adminportal/Home#/catalog/offer-details/dom-style-injector-extension' 
            });
            
            // Note: The actual offer ID will be provided by Microsoft when you publish to AppSource
            // For now, opening the general licenses page
            await chrome.tabs.create({ 
                url: 'https://admin.microsoft.com/Adminportal/Home#/licenses' 
            });
            
        } catch (error) {
            console.error('Error opening admin center:', error);
            errorMessageEl.className = 'error-message active';
            errorMessageEl.textContent = 'Failed to open Microsoft 365 Admin Center';
        }
    }
    
    async function displayAccountInfo() {
        try {
            // Get stored user info
            const { userInfo, licenseStatus } = await chrome.storage.local.get(['userInfo', 'licenseStatus']);
            
            if (userInfo) {
                userInfoEl.innerHTML = `
                    <strong>User:</strong> ${userInfo.displayName || userInfo.userPrincipalName || 'Unknown'}
                `;
            }
            
            if (licenseStatus && licenseStatus.tenantId) {
                tenantInfoEl.innerHTML = `
                    <strong>Tenant ID:</strong> ${licenseStatus.tenantId}
                `;
            } else {
                // Try to get tenant from D365 URL
                const { d365OrgUrl } = await chrome.storage.sync.get('d365OrgUrl');
                if (d365OrgUrl) {
                    const urlMatch = d365OrgUrl.match(/https:\/\/([\w-]+)\./);
                    if (urlMatch) {
                        tenantInfoEl.innerHTML = `
                            <strong>Organization:</strong> ${urlMatch[1]}
                        `;
                    }
                }
            }
            
        } catch (error) {
            console.error('Error displaying account info:', error);
        }
    }
    
    // Refresh license status every 30 seconds while on this page
    setInterval(checkLicenseStatus, 30000);
});