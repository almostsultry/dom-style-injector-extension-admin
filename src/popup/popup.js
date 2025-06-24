// src/popup/popup.js

const loaderView = document.getElementById('loader-view');
const adminView = document.getElementById('admin-view');
const userView = document.getElementById('user-view');
const errorView = document.getElementById('error-view');
const errorMessage = document.getElementById('error-message');

// CORRECTED: This function now uses the constants defined above.
function renderView(viewName, msg = '') {
    // Hide all views first
    loaderView.style.display = 'none';
    adminView.style.display = 'none';
    userView.style.display = 'none';
    errorView.style.display = 'none';

    // Show the correct view based on the viewName parameter
    switch (viewName) {
        case 'loader-view':
            loaderView.style.display = 'block';
            break;
        case 'admin-view':
            adminView.style.display = 'block';
            break;
        case 'user-view':
            userView.style.display = 'block';
            break;
        case 'error-view':
            errorMessage.textContent = msg;
            errorView.style.display = 'block';
            break;
    }
}

async function getAuthToken() {
    // This is where your actual MSAL.js or chrome.identity.getAuthToken logic will go.
    console.warn("Using placeholder getAuthToken function. You must implement real authentication.");
    throw new Error("Authentication not implemented. Please configure getAuthToken() in popup.js");
}

async function initializePopup() {
    // Show loader view immediately
    renderView('loader-view');

    try {
        const { userRole } = await chrome.storage.local.get('userRole');
        const eightHours = 8 * 60 * 60 * 1000;
        const cacheIsFresh = userRole && (Date.now() - userRole.timestamp < eightHours);

        if (cacheIsFresh) {
            renderView(userRole.isAdmin ? 'admin-view' : 'user-view');
            return;
        }

        const authToken = await getAuthToken();
        const result = await chrome.runtime.sendMessage({
            action: "checkUserRole",
            token: authToken
        });

        if (result.error) {
            throw new Error(result.error);
        }

        renderView(result.isAdmin ? 'admin-view' : 'user-view');

    } catch (error) {
        console.error("Initialization failed:", error);
        renderView('error-view', error.message);
    }
}

initializePopup();