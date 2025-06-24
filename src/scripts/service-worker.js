// src/scripts/service-worker.js

// Helper function to safely decode a Base64Url-encoded string, replacing atob()
function decodeBase64Url(base64Url) {
    base64Url = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64Url.length % 4;
    if (pad) {
        if (pad === 2) base64Url += '==';
        else if (pad === 3) base64Url += '=';
    }
    const decoded = Buffer.from(base64Url, 'base64').toString('utf8');
    return decoded;
}


async function checkAndCacheUserRole(authToken) {
    // IMPORTANT: This URL must be the base URL for the user's D365 API endpoint.
    const d365OrgUrl = 'https://yourorg.api.crm.dynamics.com';

    try {
        const payload = JSON.parse(decodeBase64Url(authToken.split('.')[1]));
        const userAadObjectId = payload.oid;

        if (!userAadObjectId) {
            throw new Error("Azure AD Object ID (oid) not found in token.");
        }

        const userQueryUrl = `${d365OrgUrl}/api/data/v9.2/systemusers?$filter=azureactivedirectoryobjectid eq ${userAadObjectId}&$select=systemuserid`;
        const userResponse = await fetch(userQueryUrl, {
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
        });

        if (!userResponse.ok) throw new Error(`Failed to fetch system user: ${userResponse.statusText}`);

        const userData = await userResponse.json();
        if (!userData.value || userData.value.length === 0) {
            throw new Error("D365 user not found for this Azure AD account.");
        }
        const systemUserId = userData.value[0].systemuserid; // This line was correct

        // CORRECTED: Use the systemUserId variable we just retrieved
        const roleQueryUrl = `${d365OrgUrl}/api/data/v9.2/systemusers(${systemUserId})?$expand=systemuserroles_association($select=name)`;
        const roleResponse = await fetch(roleQueryUrl, {
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
        });

        if (!roleResponse.ok) throw new Error(`Failed to fetch roles: ${roleResponse.statusText}`);

        const roleData = await roleResponse.json();
        const roles = roleData.systemuserroles_association.map(r => r.name);

        const isAdmin = roles.includes('System Customizer');

        await chrome.storage.local.set({
            userRole: { isAdmin: isAdmin, timestamp: Date.now() }
        });

        return { isAdmin: isAdmin };

    } catch (error) {
        console.error("Error checking user role:", error);
        return { error: error.message };
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkUserRole") {
        checkAndCacheUserRole(request.token).then(sendResponse);
        return true; // Required for async sendResponse
    }
});