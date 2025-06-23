document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('styleForm');
    const clearBtn = document.getElementById('clearBtn');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');
    const queryStringSection = document.getElementById('queryStringSection');
    const queryStringList = document.getElementById('queryStringList');
    const existingCustomizations = document.getElementById('existingCustomizations');

    let currentTab = null;
    let currentDomain = null;
    let currentQueryParams = {};

    // Initialize the extension
    initializeExtension();

    async function initializeExtension() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            currentTab = tab;

            const url = new URL(tab.url);
            currentDomain = url.hostname;

            // Check if we're on the allowed domain
            if (currentDomain !== 'ambata.crm.dynamics.com') {
                showStatus('This extension only works on ambata.crm.dynamics.com', true);
                form.style.display = 'none';
                return;
            }

            // Parse query parameters
            currentQueryParams = {};
            url.searchParams.forEach((value, key) => {
                currentQueryParams[key] = value;
            });

            // Show query string selection if there are parameters
            if (Object.keys(currentQueryParams).length > 0) {
                populateQueryStringList();
                queryStringSection.style.display = 'block';
                saveBtn.style.display = 'inline-block';
            }

            // Load existing customizations
            await loadExistingCustomizations();

            // Load saved form values
            loadSavedFormValues();

        } catch (error) {
            console.error('Initialization error:', error);
            showStatus('Error initializing extension', true);
        }
    }

    function populateQueryStringList() {
        queryStringList.innerHTML = '';

        Object.entries(currentQueryParams).forEach(([key, value]) => {
            const item = document.createElement('div');
            item.className = 'query-string-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `qs_${key}`;
            checkbox.value = key;

            const label = document.createElement('label');
            label.htmlFor = `qs_${key}`;
            label.textContent = `${key}=${value}`;

            item.appendChild(checkbox);
            item.appendChild(label);
            queryStringList.appendChild(item);
        });
    }

    function getSelectedQueryParams() {
        const selected = {};
        const checkboxes = queryStringList.querySelectorAll('input[type="checkbox"]:checked');

        checkboxes.forEach(checkbox => {
            const key = checkbox.value;
            selected[key] = currentQueryParams[key];
        });

        return selected;
    }

    function generateQueryPattern(queryParams) {
        return Object.entries(queryParams)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('&');
    }

    async function loadExistingCustomizations() {
        if (!currentDomain) return;

        try {
            const result = await chrome.storage.local.get('customizations');
            const customizations = result.customizations || {};

            if (!customizations[currentDomain]) {
                existingCustomizations.innerHTML = '';
                return;
            }

            const domainData = customizations[currentDomain][0];
            if (!domainData || !domainData.queryStrings) {
                existingCustomizations.innerHTML = '';
                return;
            }

            // Find customizations that match current query parameters
            const matchingCustomizations = [];

            Object.entries(domainData.queryStrings).forEach(([queryPattern, selectors]) => {
                // Check if this query pattern matches any subset of current parameters
                const patternParams = {};
                if (queryPattern) {
                    queryPattern.split('&').forEach(pair => {
                        const [key, value] = pair.split('=');
                        patternParams[key] = value;
                    });
                }

                const matches = Object.entries(patternParams).every(([key, value]) =>
                    currentQueryParams[key] === value
                );

                if (matches || queryPattern === '') {
                    Object.entries(selectors).forEach(([selector, styles]) => {
                        Object.entries(styles).forEach(([property, value]) => {
                            matchingCustomizations.push({
                                queryPattern,
                                selector,
                                property,
                                value,
                                breadcrumb: queryPattern || 'All pages'
                            });
                        });
                    });
                }
            });

            renderCustomizationCards(matchingCustomizations);

        } catch (error) {
            console.error('Error loading customizations:', error);
        }
    }

    function renderCustomizationCards(customizations) {
        existingCustomizations.innerHTML = '';

        if (customizations.length === 0) {
            return;
        }

        customizations.forEach((customization, index) => {
            const card = document.createElement('div');
            card.className = 'customization-card';
            card.innerHTML = `
          <div class="card-breadcrumb">${customization.breadcrumb}</div>
          <div class="card-content">
            <input type="text" class="editable-style" value="${customization.property}: ${customization.value}" 
                   data-original="${customization.property}: ${customization.value}"
                   data-query-pattern="${customization.queryPattern}"
                   data-selector="${customization.selector}"
                   data-property="${customization.property}">
            <div class="card-actions">
              <button class="card-btn card-btn-save" disabled><span style="margin-right: 4px;">💾</span>Save</button>
              <button class="card-btn card-btn-delete"><span style="margin-right: 4px;">🗑️</span>Delete</button>
            </div>
          </div>
        `;

            // Add event listeners
            const input = card.querySelector('.editable-style');
            const saveBtn = card.querySelector('.card-btn-save');
            const deleteBtn = card.querySelector('.card-btn-delete');

            input.addEventListener('input', function () {
                const hasChanged = this.value !== this.dataset.original;
                saveBtn.disabled = !hasChanged;
            });

            saveBtn.addEventListener('click', async function () {
                console.log('Save button clicked for customization:', customization);

                const success = await saveCustomizationEdit(input, customization);
                if (success) {
                    // Apply the change immediately to the current page
                    const applied = await applyEditImmediately(input, customization);
                    if (applied) {
                        showStatus('Customization updated and applied successfully');
                    } else {
                        showStatus('Customization saved but could not apply immediately - try refreshing the page');
                    }

                    // Update the data-original attribute to reflect the new saved value
                    input.dataset.original = input.value;
                    this.disabled = true;

                    console.log('Save button disabled, original value updated to:', input.value);
                }
            });

            deleteBtn.addEventListener('click', async function () {
                await deleteCustomization(customization);
                await loadExistingCustomizations();
            });

            existingCustomizations.appendChild(card);
        });
    }

    async function saveCustomizationEdit(input, originalCustomization) {
        try {
            const newValue = input.value.trim();
            const [property, ...valueParts] = newValue.split(':');
            const value = valueParts.join(':').trim();

            if (!property || !value) {
                showStatus('Invalid format. Use "property: value"', true);
                return false;
            }

            const newProperty = property.trim();
            const newCssValue = value;

            // Get the storage data
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

            // Ensure the query pattern and selector exist
            if (!domainData.queryStrings[originalCustomization.queryPattern]) {
                domainData.queryStrings[originalCustomization.queryPattern] = {};
            }

            if (!domainData.queryStrings[originalCustomization.queryPattern][originalCustomization.selector]) {
                domainData.queryStrings[originalCustomization.queryPattern][originalCustomization.selector] = {};
            }

            const selectorObj = domainData.queryStrings[originalCustomization.queryPattern][originalCustomization.selector];

            // If property name changed, delete the old property first
            if (originalCustomization.property !== newProperty) {
                delete selectorObj[originalCustomization.property];
            }

            // Set the new property and value
            selectorObj[newProperty] = newCssValue;

            // Save back to storage
            await chrome.storage.local.set({ customizations });

            console.log('Saved customization edit:', {
                oldProperty: originalCustomization.property,
                newProperty: newProperty,
                newValue: newCssValue,
                selector: originalCustomization.selector
            });

            return true;

        } catch (error) {
            console.error('Error saving edit:', error);
            showStatus('Error saving customization', true);
            return false;
        }
    }

    async function deleteCustomizationSilently(customization) {
        try {
            const result = await chrome.storage.local.get('customizations');
            const customizations = result.customizations || {};

            if (!customizations[currentDomain] || !customizations[currentDomain][0]) {
                return;
            }

            const domainData = customizations[currentDomain][0];
            const queryStrings = domainData.queryStrings;

            if (queryStrings[customization.queryPattern] &&
                queryStrings[customization.queryPattern][customization.selector]) {
                delete queryStrings[customization.queryPattern][customization.selector][customization.property];

                // Clean up empty objects
                if (Object.keys(queryStrings[customization.queryPattern][customization.selector]).length === 0) {
                    delete queryStrings[customization.queryPattern][customization.selector];
                }

                if (Object.keys(queryStrings[customization.queryPattern]).length === 0) {
                    delete queryStrings[customization.queryPattern];
                }

                await chrome.storage.local.set({ customizations });
            }

        } catch (error) {
            console.error('Error deleting customization silently:', error);
        }
    }

    async function applyEditImmediately(input, originalCustomization) {
        try {
            const newValue = input.value.trim();
            const [property, ...valueParts] = newValue.split(':');
            const value = valueParts.join(':').trim();

            if (!property || !value) {
                return false;
            }

            // Extract element property and value from selector
            // Example: [data-id="editFormRoot"] -> data-id, editFormRoot
            const selectorMatch = originalCustomization.selector.match(/\[([^=]+)="([^"]+)"\]/);
            if (!selectorMatch) {
                console.log('Could not parse selector for immediate application:', originalCustomization.selector);
                return false;
            }

            const elementProperty = selectorMatch[1];
            const propertyValue = selectorMatch[2];

            console.log('Applying edit immediately:', {
                elementProperty,
                propertyValue,
                cssProperty: property.trim(),
                cssValue: value
            });

            // Get the current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('moz-extension://')) {
                console.log('Cannot apply to browser internal pages');
                return false;
            }

            // Apply the style to the current page
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: injectStyle,
                args: [elementProperty, propertyValue, property.trim(), value]
            });

            if (result && result[0] && result[0].result) {
                if (result[0].result.success) {
                    console.log(`Immediately applied change: ${property.trim()}: ${value} to ${result[0].result.count} element(s)`);
                    return true;
                } else {
                    console.log(`Failed to apply immediately: ${result[0].result.message}`);
                    return false;
                }
            }

            return false;

        } catch (error) {
            console.error('Error applying edit immediately:', error);
            return false;
        }
    }

    async function deleteCustomization(customization) {
        try {
            const result = await chrome.storage.local.get('customizations');
            const customizations = result.customizations || {};

            if (!customizations[currentDomain] || !customizations[currentDomain][0]) {
                return;
            }

            const domainData = customizations[currentDomain][0];
            const queryStrings = domainData.queryStrings;

            if (queryStrings[customization.queryPattern] &&
                queryStrings[customization.queryPattern][customization.selector]) {
                delete queryStrings[customization.queryPattern][customization.selector][customization.property];

                // Clean up empty objects
                if (Object.keys(queryStrings[customization.queryPattern][customization.selector]).length === 0) {
                    delete queryStrings[customization.queryPattern][customization.selector];
                }

                if (Object.keys(queryStrings[customization.queryPattern]).length === 0) {
                    delete queryStrings[customization.queryPattern];
                }

                await chrome.storage.local.set({ customizations });
                showStatus('Customization deleted');
            }

        } catch (error) {
            console.error('Error deleting customization:', error);
            showStatus('Error deleting customization', true);
        }
    }

    async function saveCustomization(queryPattern, selector, property, value) {
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

            if (!domainData.queryStrings[queryPattern][selector]) {
                domainData.queryStrings[queryPattern][selector] = {};
            }

            domainData.queryStrings[queryPattern][selector][property] = value;

            await chrome.storage.local.set({ customizations });

        } catch (error) {
            console.error('Error saving customization:', error);
            throw error;
        }
    }

    function loadSavedFormValues() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['elementProperty', 'propertyValue', 'cssProperty', 'cssValue'], function (result) {
                if (result.elementProperty) document.getElementById('elementProperty').value = result.elementProperty;
                if (result.propertyValue) document.getElementById('propertyValue').value = result.propertyValue;
                if (result.cssProperty) document.getElementById('cssProperty').value = result.cssProperty;
                if (result.cssValue) document.getElementById('cssValue').value = result.cssValue;
            });
        }
    }

    function showStatus(message, isError = false) {
        status.textContent = message;
        status.className = `status ${isError ? 'error' : 'success'}`;
        status.style.display = 'block';

        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }

    // Form submission for applying styles
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const elementProperty = document.getElementById('elementProperty').value.trim();
        const propertyValue = document.getElementById('propertyValue').value.trim();
        const cssProperty = document.getElementById('cssProperty').value.trim();
        const cssValue = document.getElementById('cssValue').value.trim();

        if (!elementProperty || !propertyValue || !cssProperty || !cssValue) {
            showStatus('Please fill in all fields', true);
            return;
        }

        try {
            if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('edge://') || currentTab.url.startsWith('moz-extension://')) {
                showStatus('Cannot access browser internal pages', true);
                return;
            }

            const result = await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                func: injectStyle,
                args: [elementProperty, propertyValue, cssProperty, cssValue]
            });

            if (result && result[0] && result[0].result) {
                if (result[0].result.success) {
                    showStatus(`Style applied successfully! Found ${result[0].result.count} element(s).`);
                } else {
                    showStatus(result[0].result.message, true);
                }
            } else {
                showStatus('Unexpected response from content script', true);
            }
        } catch (error) {
            console.error('Error:', error);
            showStatus(`Error: ${error.message}`, true);
        }
    });

    // Save customization button
    saveBtn.addEventListener('click', async function () {
        const elementProperty = document.getElementById('elementProperty').value.trim();
        const propertyValue = document.getElementById('propertyValue').value.trim();
        const cssProperty = document.getElementById('cssProperty').value.trim();
        const cssValue = document.getElementById('cssValue').value.trim();

        if (!elementProperty || !propertyValue || !cssProperty || !cssValue) {
            showStatus('Please fill in all fields', true);
            return;
        }

        const selectedQueryParams = getSelectedQueryParams();
        const queryPattern = generateQueryPattern(selectedQueryParams);
        const selector = `[${elementProperty}="${propertyValue}"]`;

        try {
            await saveCustomization(queryPattern, selector, cssProperty, cssValue);
            showStatus('Customization saved successfully!');
            await loadExistingCustomizations();
        } catch (error) {
            showStatus('Error saving customization', true);
        }
    });

    clearBtn.addEventListener('click', function () {
        document.getElementById('elementProperty').value = '';
        document.getElementById('propertyValue').value = '';
        document.getElementById('cssProperty').value = '';
        document.getElementById('cssValue').value = '';

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove(['elementProperty', 'propertyValue', 'cssProperty', 'cssValue']);
        }

        showStatus('Form cleared');
    });
});

// This function will be injected into the page
function injectStyle(elementProperty, propertyValue, cssProperty, cssValue) {
    console.log('Injecting style:', { elementProperty, propertyValue, cssProperty, cssValue });

    try {
        let elements = [];

        if (elementProperty === 'id') {
            const element = document.getElementById(propertyValue);
            if (element) elements = [element];
        } else if (elementProperty === 'class') {
            elements = Array.from(document.getElementsByClassName(propertyValue));
        } else {
            const selector = `[${elementProperty}="${propertyValue}"]`;
            console.log('Using selector:', selector);
            elements = Array.from(document.querySelectorAll(selector));
        }

        console.log('Found elements:', elements);

        if (elements.length === 0) {
            return {
                success: false,
                message: `No elements found with ${elementProperty}="${propertyValue}"`
            };
        }

        elements.forEach((element, index) => {
            const jsPropertyName = cssProperty.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
            console.log(`Applying style to element ${index}:`, jsPropertyName, '=', cssValue);
            element.style[jsPropertyName] = cssValue;
        });

        return {
            success: true,
            count: elements.length,
            message: `Applied ${cssProperty}: ${cssValue} to ${elements.length} element(s)`
        };

    } catch (error) {
        console.error('Error in injectStyle:', error);
        return {
            success: false,
            message: `Error: ${error.message}`
        };
    }
  }