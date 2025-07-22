// src/scripts/kmsi-handler.js - Keep Me Signed In functionality

// Check if user has active KMSI session from Microsoft
export async function checkKMSIStatus() {
    try {
        // Check for persisted auth data in local storage
        const { kmsiToken, kmsiExpiration, kmsiEnabled } = await chrome.storage.local.get(['kmsiToken', 'kmsiExpiration', 'kmsiEnabled']);
        
        if (kmsiEnabled && kmsiToken && kmsiExpiration) {
            // Check if token is still valid
            const bufferTime = 5 * 60 * 1000; // 5 minute buffer
            if (kmsiExpiration - bufferTime > Date.now()) {
                console.log('Active KMSI session found, expires:', new Date(kmsiExpiration).toLocaleString());
                return {
                    active: true,
                    token: kmsiToken,
                    expiresAt: kmsiExpiration
                };
            }
        }
        
        return { active: false };
    } catch (error) {
        console.error('Error checking KMSI status:', error);
        return { active: false };
    }
}

// Store token with KMSI persistence
export async function persistTokenWithKMSI(token, expiresIn, isKMSI = false) {
    const expirationTime = Date.now() + (expiresIn * 1000);
    
    if (isKMSI) {
        // Use local storage for KMSI (persists across browser sessions)
        await chrome.storage.local.set({
            kmsiToken: token,
            kmsiExpiration: expirationTime,
            kmsiEnabled: true,
            kmsiTimestamp: Date.now()
        });
        
        console.log('Token persisted with KMSI, expires:', new Date(expirationTime).toLocaleString());
    }
    
    // Always store in session storage for current session
    await chrome.storage.session.set({
        authToken: token,
        tokenExpiration: expirationTime
    });
}

// Clear KMSI session
export async function clearKMSISession() {
    await chrome.storage.local.remove(['kmsiToken', 'kmsiExpiration', 'kmsiEnabled', 'kmsiTimestamp']);
    console.log('KMSI session cleared');
}

// Check if we should use KMSI based on token lifetime
export function shouldUseKMSI(expiresIn) {
    // If token expires in more than 8 hours, likely user selected "keep me signed in"
    const eightHoursInSeconds = 8 * 60 * 60;
    return expiresIn > eightHoursInSeconds;
}

// Get active token (KMSI or session)
export async function getActiveToken() {
    // First check KMSI token
    const kmsiStatus = await checkKMSIStatus();
    if (kmsiStatus.active) {
        return kmsiStatus.token;
    }
    
    // Fall back to session token
    const { authToken, tokenExpiration } = await chrome.storage.session.get(['authToken', 'tokenExpiration']);
    
    if (authToken && tokenExpiration) {
        const bufferTime = 5 * 60 * 1000; // 5 minutes
        if (tokenExpiration - bufferTime > Date.now()) {
            return authToken;
        }
    }
    
    return null;
}

// Monitor MSAL authentication for KMSI signals
export async function monitorMSALAuth(msalResult) {
    if (msalResult && msalResult.expiresOn) {
        const expiresIn = Math.floor((msalResult.expiresOn.getTime() - Date.now()) / 1000);
        const isKMSI = shouldUseKMSI(expiresIn);
        
        if (isKMSI) {
            console.log('KMSI detected from MSAL token lifetime');
            await persistTokenWithKMSI(msalResult.accessToken, expiresIn, true);
        }
        
        return isKMSI;
    }
    
    return false;
}