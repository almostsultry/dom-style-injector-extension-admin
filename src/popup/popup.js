// src/popup/popup.js - Enhanced with unified field support
// Built upon existing role-based authentication system

// Import MSAL (ensure msal-browser is included in your build)
/* global PublicClientApplication */

// DOM Elements
const loaderView = document.getElementById('loader-view');
const adminView = document.getElementById('admin-view');
const userView = document.getElementById('user-view');
const errorView = document.getElementById('error-view');
const errorMessage = document.getElementById('error-message');

// Form elements (unified fields)
let form, targetsInput, stylesInput, clearBtn, saveBtn, status;
let queryStringSection, queryStringList, existingCustomizations;
let cssEditor, saveRuleBtn;

// Global variables
let currentTab;
let currentDomain;
let userRole = null;
let msalInstance = null;

// MSAL Configuration
const msalConfig = {
    auth: {
        clientId: 'YOUR_APP_CLIENT_ID', // Replace with your Azure AD app client ID
        authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID', // Replace with your tenant ID
        redirectUri: chrome.identity.getRedirectURL() // Chrome extension redirect URI
    },
    cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
    }
};

// Initialize MSAL
async function initializeMsal() {
    if (typeof PublicClientApplication !== 'undefined') {
        msalInstance = new PublicClientApplication(msalConfig);
        await msalInstance.initialize();
    }
}

// Main initialization
document.addEventListener('DOMContentLoaded', async function () {
    try {
        await initializeMsal();
        await determineUserRole();
        await initializeView();
    } catch (error) {
        console.error('Initialization failed:', error);
        renderView('error-view', 'Failed to initialize extension');
    }
});

// Determine user role and render appropriate view
async function determineUserRole() {
    try {
        // Get current tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tabs[0];

        if (!currentTab || !currentTab.url) {
            throw new Error('Cannot access this page');
        }

        const url = new URL(currentTab.url);
        currentDomain = url.hostname;

        // Check if this is a supported domain
        if (currentDomain !== 'ambata.crm.dynamics.com') {
            throw new Error('This extension only works on ambata.crm.dynamics.com');
        }

        // Determine user role (simplified for this example)
        // In real implementation, this would check Azure AD roles
        userRole = await getUserRole();

    } catch (error) {
        throw new Error(`Role determination failed: ${error.message}`);
    }
}

// Get user role (mock implementation)
async function getUserRole() {
    // This is a simplified mock. In real implementation:
    // 1. Get access token
    // 2. Call Microsoft Graph to get user's groups/roles
    // 3. Determine if user is admin or regular user

    try {
        const token = await getAuthToken();
        // Mock role check - replace with actual implementation
        return 'admin'; // or 'user' based on actual role check
    } catch (error) {
        console.warn('Authentication failed, defaulting to user role:', error);
        return 'user';
    }
}

// Get authentication token
async function getAuthToken() {
    try {
        const config = await chrome.storage.sync.get(['d365OrgUrl', 'clientId', 'tenantId']);

        if (!config.d365OrgUrl) {
            throw new Error('D365 organization URL not configured');
        }

        // Use chrome.identity API for token acquisition
        const token = await chrome.identity.getAuthToken({
            interactive: true,
            scopes: ['https://graph.microsoft.com/.default']
        });

        return token;
    } catch (error) {
        throw new Error(`Authentication failed: ${error.message}`);
    }
}

// Initialize the appropriate view based on user role
async function initializeView() {
    if (userRole === 'admin') {
        renderView('admin-view');
        await initializeAdminView();
    } else {
        renderView('user-view');
        await initializeUserView();
    }
}

// View rendering function
function renderView(viewName, msg = '') {
    // Hide all views first
    loaderView.style.display = 'none';
    adminView.style.display = 'none';
    userView.style.display = 'none';
    errorView.style.display = 'none';

    // Show the correct view
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

// Initialize admin view with unified fields
async function initializeAdminView() {
    try {
        // Initialize DOM elements after view is shown
        initializeFormElements();

        // Load saved field values
        await loadSavedValues();

        // Setup query string section
        await setupQueryStringSection(new URL(currentTab.url));

        // Load existing customizations
        await loadExistingCustomizations();

        // Setup event listeners
        setupAdminEventListeners();

        // Initialize enhanced features
        initializeEnhancedFeatures();

    } catch (error) {
        console.error('Admin view initialization failed:', error);
        showStatus('Failed to initialize admin view', true);
    }
}

// Initialize form DOM elements
function initializeFormElements() {
    form = document.getElementById('styleForm');
    targetsInput = document.getElementById('targets');
    stylesInput = document.getElementById('styles');
    clearBtn = document.getElementById('clearBtn');
    saveBtn = document.getElementById('saveBtn');
    status = document.getElementById('status');
    queryStringSection = document.getElementById('queryStringSection');
    queryStringList = document.getElementById('queryStringList');
    existingCustomizations = document.getElementById('existingCustomizations');
    cssEditor = document.getElementById('css-editor');
    saveRuleBtn = document.getElementById('save-rule');
}

// Initialize user view (read-only)
async function initializeUserView() {
    try {
        // Load and display active customizations for current page
        await loadUserCustomizations();
    } catch (error) {
        console.error('User view initialization failed:', error);
    }
}

// Setup admin event listeners for unified fields
function setupAdminEventListeners() {
    if (!form) return;

    // Form submission
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        try {
            const { targets, styles } = validateForm();
            const result = await applyStylesToPage(targets, styles);

            if (result.success) {
                showStatus(`Style applied successfully! Found ${result.count} element(s).`);
                await saveFieldValues();
            } else {
                showStatus(result.message, true);
            }

        } catch (error) {
            handleError(error, 'form submission');
        }
    });

    // Save customization
    if (saveBtn) {
        saveBtn.addEventListener('click', async function () {
            try {
                const { targets, styles } = validateForm();
                await saveCustomization(targets, styles);
                showStatus('Customization saved successfully!');
                await loadExistingCustomizations();
            } catch (error) {
                handleError(error, 'save customization');
            }
        });
    }

    // Clear form
    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            if (targetsInput) targetsInput.value = '';
            if (stylesInput) stylesInput.value = '';

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.remove(['targets', 'styles']);
            }

            showStatus('Form cleared');
        });
    }

    // Advanced CSS editor
    if (saveRuleBtn) {
        saveRuleBtn.addEventListener('click', async function () {
            try {
                const cssContent = cssEditor.value.trim();
                if (!cssContent) {
                    showStatus('Please enter CSS content', true);
                    return;
                }

                await saveAdvancedCSSRule(cssContent);
                showStatus('Advanced CSS rule saved successfully!');
                cssEditor.value = '';
            } catch (error) {
                handleError(error, 'save advanced CSS rule');
            }
        });
    }

    // Auto-save field values on input
    if (targetsInput) targetsInput.addEventListener('input', saveFieldValues);
    if (stylesInput) stylesInput.addEventListener('input', saveFieldValues);
}

// Unified field parsing functions
function parseTargets(targetsString) {
    if (!targetsString?.trim()) return [];

    const targets = [];
    const parts = targetsString.split(';').map(s => s.trim()).filter(s => s);

    for (const part of parts) {
        const match = part.match(/^([^=]+)="([^"]*)"$/);
        if (match) {
            const property = match[1].trim();
            const value = match[2];
            targets.push({ property, value });
        } else {
            throw new Error(`Invalid target format: "${part}". Expected format: property="value"`);
        }
    }

    return targets;
}

function parseStyles(stylesString) {
    if (!stylesString?.trim()) return [];

    const styles = [];
    const parts = stylesString.split(';').map(s => s.trim()).filter(s => s);

    for (const part of parts) {
        const colonIndex = part.indexOf(':');
        if (colonIndex === -1) {
            throw new Error(`Invalid style format: "${part}". Expected format: property: value`);
        }

        const property = part.substring(0, colonIndex).trim();
        const value = part.substring(colonIndex + 1).trim();

        if (!property || !value) {
            throw new Error(`Invalid style format: "${part}". Property and value cannot be empty`);
        }

        if (!validateCSSProperty(property)) {
            throw new Error(`Invalid CSS property: "${property}"`);
        }

        styles.push({ property, value });
    }

    return styles;
}

function validateCSSProperty(property) {
    const cssPropertyRegex = /^[a-z]+(-[a-z]+)*$/;
    return cssPropertyRegex.test(property);
}

function validateForm() {
    if (!targetsInput || !stylesInput) {
        throw new Error('Form elements not found');
    }

    const targetsValue = targetsInput.value.trim();
    const stylesValue = stylesInput.value.trim();

    if (!targetsValue) {
        throw new Error('Target(s) field is required');
    }

    if (!stylesValue) {
        throw new Error('Style(s) field is required');
    }

    const targets = parseTargets(targetsValue);
    const styles = parseStyles(stylesValue);

    if (targets.length === 0) {
        throw new Error('At least one valid target is required');
    }

    if (styles.length === 0) {
        throw new Error('At least one valid style is required');
    }

    return { targets, styles };
}

// Generate CSS selector from target specification
function generateSelector(target) {
    const { property, value } = target;

    if (property === 'id') {
        return `#${value}`;
    } else if (property === 'class') {
        return `.${value}`;
    } else {
        return `[${property}="${value}"]`;
    }
}

// Apply styles to page using the injection function
async function applyStylesToPage(targets, styles) {
    try {
        if (currentTab.url.startsWith('chrome://') ||
            currentTab.url.startsWith('edge://') ||
            currentTab.url.startsWith('moz-extension://')) {
            throw new Error('Cannot access browser internal pages');
        }

        const result = await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            func: injectUnifiedStyles,
            args: [targets, styles]
        });

        if (result && result[0] && result[0].result) {
            return result[0].result;
        } else {
            throw new Error('Unexpected response from content script');
        }
    } catch (error) {
        throw new Error(`Script injection failed: ${error.message}`);
    }
}

// Save customization with unified fields
async function saveCustomization(targets, styles) {
    const selectedQueryParams = getSelectedQueryParams();
    const queryPattern = generateQueryPattern(selectedQueryParams);

    try {
        const result = await chrome.storage.local.get('customizations');
        const customizations = result.customizations || {};

        if (!customizations[currentDomain]) {
            customizations[currentDomain] = [{
                id: `${currentDomain}_${Date.now()}`,
                domain: currentDomain,
                queryStrings: {}
            }];
        }

        const domainData = customizations[currentDomain][0];

        if (!domainData.queryStrings[queryPattern]) {
            domainData.queryStrings[queryPattern] = {};
        }

        // For each target, create a selector and store all styles
        targets.forEach(target => {
            const selector = generateSelector(target);

            if (!domainData.queryStrings[queryPattern][selector]) {
                domainData.queryStrings[queryPattern][selector] = {};
            }

            // Add all styles to this selector
            styles.forEach(style => {
                domainData.queryStrings[queryPattern][selector][style.property] = style.value;
            });
        });

        await chrome.storage.local.set({ customizations });

    } catch (error) {
        throw new Error(`Failed to save customization: ${error.message}`);
    }
}

// Save advanced CSS rule
async function saveAdvancedCSSRule(cssContent) {
    try {
        const result = await chrome.storage.local.get('advancedRules');
        const advancedRules = result.advancedRules || {};

        if (!advancedRules[currentDomain]) {
            advancedRules[currentDomain] = [];
        }

        advancedRules[currentDomain].push({
            id: `advanced_${Date.now()}`,
            css: cssContent,
            created: new Date().toISOString()
        });

        await chrome.storage.local.set({ advancedRules });

    } catch (error) {
        throw new Error(`Failed to save advanced CSS rule: ${error.message}`);
    }
}

// Utility functions
async function loadSavedValues() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(['targets', 'styles']);
        if (result.targets && targetsInput) targetsInput.value = result.targets;
        if (result.styles && stylesInput) stylesInput.value = result.styles;
    }
}

async function saveFieldValues() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && targetsInput && stylesInput) {
        await chrome.storage.local.set({
            targets: targetsInput.value,
            styles: stylesInput.value
        });
    }
}

function showStatus(message, isError = false) {
    if (!status) return;

    status.textContent = message;
    status.className = `status ${isError ? 'error' : 'success'}`;
    status.style.display = 'block';

    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

async function setupQueryStringSection(url) {
    if (!queryStringSection || !queryStringList) return;

    const params = parseQueryParameters(url.href);

    if (Object.keys(params).length > 0) {
        queryStringSection.style.display = 'block';

        queryStringList.innerHTML = '';

        Object.entries(params).forEach(([key, value]) => {
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '8px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = `${key}=${value}`;
            checkbox.style.marginRight = '8px';

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(`${key}=${value}`));

            queryStringList.appendChild(label);
        });

        if (saveBtn) saveBtn.style.display = 'inline-block';
    }
}

function parseQueryParameters(url) {
    try {
        const urlObj = new URL(url);
        const params = {};
        urlObj.searchParams.forEach((value, key) => {
            params[key] = value;
        });
        return params;
    } catch {
        return {};
    }
}

function getSelectedQueryParams() {
    if (!queryStringList) return {};

    const checkboxes = queryStringList.querySelectorAll('input[type="checkbox"]:checked');
    const selectedParams = {};

    checkboxes.forEach(checkbox => {
        const [key, value] = checkbox.value.split('=');
        selectedParams[key] = value;
    });

    return selectedParams;
}

function generateQueryPattern(selectedParams) {
    return Object.entries(selectedParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
}

// Load existing customizations for admin view
async function loadExistingCustomizations() {
    if (!existingCustomizations) return;

    try {
        const result = await chrome.storage.local.get('customizations');
        const customizations = result.customizations || {};

        if (!customizations[currentDomain] || !customizations[currentDomain][0]) {
            existingCustomizations.innerHTML = `
                <div class="empty-state">
                    <p>No customizations found</p>
                    <small>Create your first style rule above</small>
                </div>
            `;
            return;
        }

        const domainData = customizations[currentDomain][0];
        const queryStrings = domainData.queryStrings;

        let html = '';
        let count = 0;

        Object.entries(queryStrings).forEach(([queryPattern, selectors]) => {
            Object.entries(selectors).forEach(([selector, styles]) => {
                Object.entries(styles).forEach(([property, value]) => {
                    count++;
                    html += `
                        <div class="customization-item">
                            <div class="customization-info">
                                <div class="customization-name">${selector}</div>
                                <div class="customization-details">${property}: ${value}</div>
                                <div class="customization-details">Query: ${queryPattern || 'All pages'}</div>
                            </div>
                            <div class="customization-actions">
                                <button class="btn-icon" onclick="editCustomization('${selector}', '${property}', '${value}', '${queryPattern}')" title="Edit">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button class="btn-icon" onclick="deleteCustomization('${selector}', '${property}', '${queryPattern}')" title="Delete">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `;
                });
            });
        });

        if (count === 0) {
            existingCustomizations.innerHTML = `
                <div class="empty-state">
                    <p>No customizations found</p>
                    <small>Create your first style rule above</small>
                </div>
            `;
        } else {
            existingCustomizations.innerHTML = html;
        }

    } catch (error) {
        console.error('Error loading customizations:', error);
    }
}

// Load customizations for user view
async function loadUserCustomizations() {
    try {
        const userCustomizationsDiv = document.getElementById('user-customizations');
        if (!userCustomizationsDiv) return;

        const result = await chrome.storage.local.get('customizations');
        const customizations = result.customizations || {};

        if (!customizations[currentDomain]) {
            userCustomizationsDiv.innerHTML = `
                <div class="empty-state">
                    <p>No customizations active on this page</p>
                </div>
            `;
            return;
        }

        // Show read-only view of active customizations
        const domainData = customizations[currentDomain][0];
        const queryStrings = domainData.queryStrings;

        let html = '';
        let count = 0;

        // Get current page query parameters to show relevant customizations
        const currentUrl = new URL(currentTab.url);
        const currentParams = parseQueryParameters(currentUrl.href);

        Object.entries(queryStrings).forEach(([queryPattern, selectors]) => {
            // Check if this customization applies to current page
            const patternParams = {};
            if (queryPattern) {
                queryPattern.split('&').forEach(pair => {
                    const [key, value] = pair.split('=');
                    patternParams[key] = value;
                });
            }

            const matches = Object.entries(patternParams).every(([key, value]) =>
                currentParams[key] === value
            );

            if (matches || queryPattern === '') {
                Object.entries(selectors).forEach(([selector, styles]) => {
                    Object.entries(styles).forEach(([property, value]) => {
                        count++;
                        html += `
                            <div class="customization-item">
                                <div class="customization-info">
                                    <div class="customization-name">${selector}</div>
                                    <div class="customization-details">${property}: ${value}</div>
                                </div>
                            </div>
                        `;
                    });
                });
            }
        });

        if (count === 0) {
            userCustomizationsDiv.innerHTML = `
                <div class="empty-state">
                    <p>No customizations active on this page</p>
                </div>
            `;
        } else {
            userCustomizationsDiv.innerHTML = html;
        }

    } catch (error) {
        console.error('Error loading user customizations:', error);
    }
}

// Content script injection function for unified styles
function injectUnifiedStyles(targets, styles) {
    console.log('Injecting unified styles:', { targets, styles });

    try {
        let totalElementsFound = 0;
        const results = [];

        targets.forEach((target, targetIndex) => {
            let elements = [];
            const { property, value } = target;

            if (property === 'id') {
                const element = document.getElementById(value);
                if (element) elements = [element];
            } else if (property === 'class') {
                elements = Array.from(document.getElementsByClassName(value));
            } else {
                const selector = `[${property}="${value}"]`;
                console.log(`Using selector for target ${targetIndex}:`, selector);
                elements = Array.from(document.querySelectorAll(selector));
            }

            console.log(`Found ${elements.length} elements for target ${targetIndex} (${property}="${value}")`);

            if (elements.length > 0) {
                totalElementsFound += elements.length;

                elements.forEach((element, elementIndex) => {
                    styles.forEach((style, styleIndex) => {
                        const jsPropertyName = style.property.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
                        console.log(`Applying style ${styleIndex} to element ${elementIndex} of target ${targetIndex}:`, jsPropertyName, '=', style.value);
                        element.style[jsPropertyName] = style.value;
                    });
                });

                results.push({
                    target: `${property}="${value}"`,
                    elementsFound: elements.length,
                    stylesApplied: styles.length
                });
            } else {
                results.push({
                    target: `${property}="${value}"`,
                    elementsFound: 0,
                    stylesApplied: 0
                });
            }
        });

        if (totalElementsFound === 0) {
            return {
                success: false,
                message: `No elements found for any of the specified targets`,
                details: results
            };
        }

        const styleCount = styles.length;
        const targetCount = targets.length;

        return {
            success: true,
            count: totalElementsFound,
            message: `Applied ${styleCount} style(s) to ${totalElementsFound} element(s) across ${targetCount} target(s)`,
            details: results
        };

    } catch (error) {
        console.error('Error in injectUnifiedStyles:', error);
        return {
            success: false,
            message: `Error: ${error.message}`
        };
    }
}

// Global functions for customization management (admin only)
window.editCustomization = function (selector, property, value, queryPattern) {
    if (userRole !== 'admin') return;

    // Convert selector back to target format
    let targetString = '';
    if (selector.startsWith('#')) {
        targetString = `id="${selector.substring(1)}"`;
    } else if (selector.startsWith('.')) {
        targetString = `class="${selector.substring(1)}"`;
    } else {
        // Extract from attribute selector [property="value"]
        const match = selector.match(/\[([^=]+)="([^"]*)"\]/);
        if (match) {
            targetString = `${match[1]}="${match[2]}"`;
        }
    }

    if (targetsInput) targetsInput.value = targetString;
    if (stylesInput) stylesInput.value = `${property}: ${value}`;

    // Scroll to form
    if (adminView) adminView.scrollTop = 0;
};

window.deleteCustomization = async function (selector, property, queryPattern) {
    if (userRole !== 'admin') return;

    if (!confirm('Are you sure you want to delete this customization?')) {
        return;
    }

    try {
        const result = await chrome.storage.local.get('customizations');
        const customizations = result.customizations || {};

        if (customizations[currentDomain] && customizations[currentDomain][0]) {
            const domainData = customizations[currentDomain][0];

            if (domainData.queryStrings[queryPattern] &&
                domainData.queryStrings[queryPattern][selector] &&
                domainData.queryStrings[queryPattern][selector][property]) {

                delete domainData.queryStrings[queryPattern][selector][property];

                // Clean up empty objects
                if (Object.keys(domainData.queryStrings[queryPattern][selector]).length === 0) {
                    delete domainData.queryStrings[queryPattern][selector];
                }

                if (Object.keys(domainData.queryStrings[queryPattern]).length === 0) {
                    delete domainData.queryStrings[queryPattern];
                }

                await chrome.storage.local.set({ customizations });

                // Reload the customizations list
                await loadExistingCustomizations();

                showStatus('Customization deleted successfully');
            }
        }
    } catch (error) {
        showStatus('Error deleting customization', true);
        console.error('Delete customization error:', error);
    }
};

// Enhanced error handling with user-friendly messages
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);

    let userMessage = 'An unexpected error occurred';

    if (error.message.includes('Invalid target format')) {
        userMessage = 'Invalid target format. Use: property="value"';
    } else if (error.message.includes('Invalid style format')) {
        userMessage = 'Invalid style format. Use: property: value';
    } else if (error.message.includes('Invalid CSS property')) {
        userMessage = 'Invalid CSS property name';
    } else if (error.message.includes('Cannot access')) {
        userMessage = 'Cannot access this page type';
    } else if (error.message.includes('Authentication')) {
        userMessage = 'Authentication required';
    }

    showStatus(userMessage, true);

    // Shake the form for validation errors
    if (error.message.includes('Invalid') && form) {
        form.classList.add('shake');
        setTimeout(() => form.classList.remove('shake'), 500);
    }
}

// Real-time validation for unified fields
function setupFieldValidation() {
    if (!targetsInput || !stylesInput) return;

    // Debounce function for performance
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Validate targets field
    const validateTargets = debounce(() => {
        try {
            const targets = parseTargets(targetsInput.value);
            targetsInput.classList.remove('invalid');
            targetsInput.classList.add('valid');
            if (targetsInput.parentElement) {
                targetsInput.parentElement.classList.remove('field-error');
                targetsInput.parentElement.classList.add('field-success');
            }
        } catch (error) {
            if (targetsInput.value.trim()) {
                targetsInput.classList.remove('valid');
                targetsInput.classList.add('invalid');
                if (targetsInput.parentElement) {
                    targetsInput.parentElement.classList.remove('field-success');
                    targetsInput.parentElement.classList.add('field-error');
                }
            } else {
                // Clear validation classes for empty field
                targetsInput.classList.remove('valid', 'invalid');
                if (targetsInput.parentElement) {
                    targetsInput.parentElement.classList.remove('field-success', 'field-error');
                }
            }
        }
    }, 500);

    // Validate styles field
    const validateStyles = debounce(() => {
        try {
            const styles = parseStyles(stylesInput.value);
            stylesInput.classList.remove('invalid');
            stylesInput.classList.add('valid');
            if (stylesInput.parentElement) {
                stylesInput.parentElement.classList.remove('field-error');
                stylesInput.parentElement.classList.add('field-success');
            }
        } catch (error) {
            if (stylesInput.value.trim()) {
                stylesInput.classList.remove('valid');
                stylesInput.classList.add('invalid');
                if (stylesInput.parentElement) {
                    stylesInput.parentElement.classList.remove('field-success');
                    stylesInput.parentElement.classList.add('field-error');
                }
            } else {
                // Clear validation classes for empty field
                stylesInput.classList.remove('valid', 'invalid');
                if (stylesInput.parentElement) {
                    stylesInput.parentElement.classList.remove('field-success', 'field-error');
                }
            }
        }
    }, 500);

    // Add event listeners
    targetsInput.addEventListener('input', validateTargets);
    stylesInput.addEventListener('input', validateStyles);
}

// Import/Export functionality for admin users
async function exportCustomizations() {
    if (userRole !== 'admin') return;

    try {
        const result = await chrome.storage.local.get('customizations');
        const customizations = result.customizations || {};

        const exportData = {
            version: '2.0.0',
            domain: currentDomain,
            exported: new Date().toISOString(),
            customizations: customizations[currentDomain] || []
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dom-style-injector-${currentDomain}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
        showStatus('Customizations exported successfully');

    } catch (error) {
        handleError(error, 'export customizations');
    }
}

async function importCustomizations(fileInput) {
    if (userRole !== 'admin') return;

    try {
        const file = fileInput.files[0];
        if (!file) return;

        const text = await file.text();
        const importData = JSON.parse(text);

        // Validate import data
        if (!importData.customizations || !Array.isArray(importData.customizations)) {
            throw new Error('Invalid file format');
        }

        // Merge with existing customizations
        const result = await chrome.storage.local.get('customizations');
        const customizations = result.customizations || {};

        if (!customizations[currentDomain]) {
            customizations[currentDomain] = [];
        }

        // Add imported customizations
        customizations[currentDomain] = [
            ...customizations[currentDomain],
            ...importData.customizations
        ];

        await chrome.storage.local.set({ customizations });
        await loadExistingCustomizations();

        showStatus(`Imported ${importData.customizations.length} customization(s)`);

    } catch (error) {
        handleError(error, 'import customizations');
    }
}

// Bulk operations for admin users
async function clearAllCustomizations() {
    if (userRole !== 'admin') return;

    if (!confirm('Are you sure you want to delete ALL customizations for this domain? This action cannot be undone.')) {
        return;
    }

    try {
        const result = await chrome.storage.local.get('customizations');
        const customizations = result.customizations || {};

        delete customizations[currentDomain];

        await chrome.storage.local.set({ customizations });
        await loadExistingCustomizations();

        showStatus('All customizations cleared');

    } catch (error) {
        handleError(error, 'clear all customizations');
    }
}

// Advanced search functionality
function filterCustomizations(searchTerm) {
    const items = document.querySelectorAll('.customization-item');
    const term = searchTerm.toLowerCase();

    items.forEach(item => {
        const name = item.querySelector('.customization-name')?.textContent || '';
        const details = item.querySelector('.customization-details')?.textContent || '';
        const text = (name + ' ' + details).toLowerCase();

        if (text.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Initialize enhanced features after admin view is loaded
function initializeEnhancedFeatures() {
    if (userRole === 'admin') {
        setupFieldValidation();

        // Add search functionality if needed
        const searchInput = document.getElementById('customization-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterCustomizations(e.target.value);
            });
        }

        // Add export/import buttons if they exist
        const exportBtn = document.getElementById('export-customizations');
        const importBtn = document.getElementById('import-customizations');
        const clearBtn = document.getElementById('clear-all-customizations');

        if (exportBtn) {
            exportBtn.addEventListener('click', exportCustomizations);
        }

        if (importBtn) {
            const fileInput = document.getElementById('import-file');
            importBtn.addEventListener('click', () => fileInput?.click());
            fileInput?.addEventListener('change', (e) => importCustomizations(e.target));
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', clearAllCustomizations);
        }
    }
}