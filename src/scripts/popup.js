// src/popup/popup.js

const loaderView = document.getElementById('loader-view');
const adminView = document.getElementById('admin-view');
const userView = document.getElementById('user-view');
const errorView = document.getElementById('error-view');
const errorMessage = document.getElementById('error-message');

function renderView(viewName, msg = '') {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const viewToShow = document.getElementById(viewName);
    if (viewToShow) {
        viewToShow.style.display = 'block';
        if (viewName === 'error-view') {
            errorMessage.textContent = msg;
        }
    }
}

async function getAuthToken() {
    // This is where your actual MSAL.js or chrome.identity.getAuthToken logic will go.
    // You must implement this function to return a valid Bearer token for your D365 instance.
    // For now, it's a placeholder. Without a real token, this will fail.
    console.warn("Using placeholder getAuthToken function. You must implement real authentication.");
    // Example using chrome.identity:
    // return new Promise((resolve, reject) => {
    //   chrome.identity.getAuthToken({ interactive: true }, (token) => {
    //     if (chrome.runtime.lastError) {
    //       reject(chrome.runtime.lastError);
    //     } else {
    //       resolve(token);
    //     }
    //   });
    // });
    throw new Error("Authentication not implemented. Please configure getAuthToken() in popup.js");
}

async function initializePopup() {
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