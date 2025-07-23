// Unit tests for popup functionality
import { jest } from '@jest/globals';

/* global testUtils */

describe('Popup Functionality', () => {
  let mockDocument;
  // let popupModule;

  beforeEach(() => {
    // Mock DOM elements
    mockDocument = {
      getElementById: jest.fn(),
      addEventListener: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn()
    };

    // Mock form elements
    const mockElements = {
      styleForm: { addEventListener: jest.fn() },
      elementProperty: { value: '', addEventListener: jest.fn() },
      propertyValue: { value: '', addEventListener: jest.fn() },
      cssProperty: { value: '', addEventListener: jest.fn() },
      cssValue: { value: '', addEventListener: jest.fn() },
      clearBtn: { addEventListener: jest.fn() },
      saveBtn: { addEventListener: jest.fn(), style: { display: 'none' } },
      status: { textContent: '', className: '', style: { display: 'none' } },
      queryStringSection: { style: { display: 'none' } },
      queryStringList: { innerHTML: '' },
      existingCustomizations: { innerHTML: '' }
    };

    mockDocument.getElementById.mockImplementation((id) => mockElements[id]);
    
    global.document = mockDocument;
    testUtils.mockChromeSuccess();
  });

  describe('Form Validation', () => {
    test('should validate required fields', () => {
      const formData = {
        elementProperty: '',
        propertyValue: 'test',
        cssProperty: 'color',
        cssValue: 'red'
      };

      const isValid = validateFormData(formData);
      expect(isValid).toBe(false);
    });

    test('should pass validation with all fields filled', () => {
      const formData = {
        elementProperty: 'data-id',
        propertyValue: 'test',
        cssProperty: 'color',
        cssValue: 'red'
      };

      const isValid = validateFormData(formData);
      expect(isValid).toBe(true);
    });

    test('should validate CSS property format', () => {
      const validProperties = ['color', 'background-color', 'margin-top', 'z-index'];
      const invalidProperties = ['invalid-', '-invalid', 'color!', '123invalid'];

      validProperties.forEach(prop => {
        expect(validateCSSProperty(prop)).toBe(true);
      });

      invalidProperties.forEach(prop => {
        expect(validateCSSProperty(prop)).toBe(false);
      });
    });
  });

  describe('Element Targeting', () => {
    test('should generate correct selector for data attributes', () => {
      const selector = generateSelector('data-id', 'editFormRoot');
      expect(selector).toBe('[data-id="editFormRoot"]');
    });

    test('should generate correct selector for class', () => {
      const selector = generateSelector('class', 'my-class');
      expect(selector).toBe('.my-class');
    });

    test('should generate correct selector for id', () => {
      const selector = generateSelector('id', 'my-id');
      expect(selector).toBe('#my-id');
    });

    test('should handle special characters in selectors', () => {
      const selector = generateSelector('data-test', 'value with spaces');
      expect(selector).toBe('[data-test="value with spaces"]');
    });
  });

  describe('Query Parameter Handling', () => {
    test('should parse URL query parameters correctly', () => {
      const url = 'https://ambata.crm.dynamics.com/test?etn=account&id=123&status=active';
      const params = parseQueryParameters(url);
      
      expect(params).toEqual({
        etn: 'account',
        id: '123',
        status: 'active'
      });
    });

    test('should generate query pattern from selected parameters', () => {
      const selectedParams = { etn: 'account', id: '123' };
      const pattern = generateQueryPattern(selectedParams);
      
      expect(pattern).toBe('etn=account&id=123');
    });

    test('should handle empty query parameters', () => {
      const url = 'https://ambata.crm.dynamics.com/test';
      const params = parseQueryParameters(url);
      
      expect(params).toEqual({});
    });
  });

  describe('Customization Storage', () => {
    test('should save customization to storage correctly', async () => {
      const customization = {
        queryPattern: 'etn=account',
        selector: '[data-id="test"]',
        property: 'color',
        value: 'red'
      };

      await saveCustomization('ambata.crm.dynamics.com', customization);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        customizations: expect.objectContaining({
          'ambata.crm.dynamics.com': expect.arrayContaining([
            expect.objectContaining({
              domain: 'ambata.crm.dynamics.com',
              queryStrings: expect.objectContaining({
                'etn=account': expect.objectContaining({
                  '[data-id="test"]': expect.objectContaining({
                    color: 'red'
                  })
                })
              })
            })
          ])
        })
      });
    });

    test('should load existing customizations correctly', async () => {
      const mockStorageData = {
        customizations: {
          'ambata.crm.dynamics.com': [{
            id: 'test-id',
            domain: 'ambata.crm.dynamics.com',
            queryStrings: {
              'etn=account': {
                '[data-id="test"]': {
                  'color': 'red'
                }
              }
            }
          }]
        }
      };

      chrome.storage.local.get.mockResolvedValue(mockStorageData);

      const customizations = await loadExistingCustomizations('ambata.crm.dynamics.com');
      
      expect(customizations).toHaveLength(1);
      expect(customizations[0]).toMatchObject({
        selector: '[data-id="test"]',
        property: 'color',
        value: 'red'
      });
    });
  });

  describe('Style Application', () => {
    test('should apply style to DOM elements successfully', async () => {
      chrome.scripting.executeScript.mockResolvedValue([{
        result: { success: true, count: 1 }
      }]);

      const result = await applyStyle('data-id', 'test', 'color', 'red');

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        func: expect.any(Function),
        args: ['data-id', 'test', 'color', 'red']
      });
    });

    test('should handle element not found error', async () => {
      chrome.scripting.executeScript.mockResolvedValue([{
        result: { success: false, message: 'No elements found' }
      }]);

      const result = await applyStyle('data-id', 'nonexistent', 'color', 'red');

      expect(result.success).toBe(false);
      expect(result.message).toContain('No elements found');
    });

    test('should handle script injection errors', async () => {
      chrome.scripting.executeScript.mockRejectedValue(new Error('Injection failed'));

      await expect(applyStyle('data-id', 'test', 'color', 'red'))
        .rejects.toThrow('Injection failed');
    });
  });

  describe('User Interface', () => {
    test('should show success status message', () => {
      showStatus('Test success message', false);

      const statusElement = mockDocument.getElementById('status');
      expect(statusElement.textContent).toBe('Test success message');
      expect(statusElement.className).toBe('status success');
      expect(statusElement.style.display).toBe('block');
    });

    test('should show error status message', () => {
      showStatus('Test error message', true);

      const statusElement = mockDocument.getElementById('status');
      expect(statusElement.textContent).toBe('Test error message');
      expect(statusElement.className).toBe('status error');
      expect(statusElement.style.display).toBe('block');
    });

    test('should clear form fields', () => {
      const elements = ['elementProperty', 'propertyValue', 'cssProperty', 'cssValue'];
      
      clearFormFields();

      elements.forEach(elementId => {
        const element = mockDocument.getElementById(elementId);
        expect(element.value).toBe('');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

      const result = await saveCustomization('test.com', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });

    test('should handle invalid domain errors', async () => {
      const result = await initializeExtension('invalid-domain.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('only works on ambata.crm.dynamics.com');
    });

    test('should handle network errors in style application', async () => {
      chrome.tabs.query.mockRejectedValue(new Error('Network error'));

      await expect(applyStyle('data-id', 'test', 'color', 'red'))
        .rejects.toThrow('Network error');
    });
  });
});

// Helper functions for testing
function validateFormData(formData) {
  const { elementProperty, propertyValue, cssProperty, cssValue } = formData;
  return !!(elementProperty?.trim() && propertyValue?.trim() && 
           cssProperty?.trim() && cssValue?.trim());
}

function validateCSSProperty(property) {
  // Basic CSS property validation
  const cssPropertyRegex = /^[a-z]+(-[a-z]+)*$/;
  return cssPropertyRegex.test(property);
}

function generateSelector(elementProperty, propertyValue) {
  if (elementProperty === 'id') {
    return `#${propertyValue}`;
  } else if (elementProperty === 'class') {
    return `.${propertyValue}`;
  } else {
    return `[${elementProperty}="${propertyValue}"]`;
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

function generateQueryPattern(selectedParams) {
  return Object.entries(selectedParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

async function saveCustomization(domain, customization) {
  try {
    const { queryPattern, selector, property, value } = customization;
    
    const result = await chrome.storage.local.get('customizations');
    const customizations = result.customizations || {};
    
    if (!customizations[domain]) {
      customizations[domain] = [{
        id: `${domain}_${Date.now()}`,
        domain: domain,
        queryStrings: {}
      }];
    }
    
    const domainData = customizations[domain][0];
    
    if (!domainData.queryStrings[queryPattern]) {
      domainData.queryStrings[queryPattern] = {};
    }
    
    if (!domainData.queryStrings[queryPattern][selector]) {
      domainData.queryStrings[queryPattern][selector] = {};
    }
    
    domainData.queryStrings[queryPattern][selector][property] = value;
    
    await chrome.storage.local.set({ customizations });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function loadExistingCustomizations(domain) {
  try {
    const result = await chrome.storage.local.get('customizations');
    const customizations = result.customizations || {};
    
    if (!customizations[domain]) {
      return [];
    }
    
    const domainData = customizations[domain][0];
    const found = [];
    
    Object.entries(domainData.queryStrings || {}).forEach(([queryPattern, selectors]) => {
      Object.entries(selectors).forEach(([selector, styles]) => {
        Object.entries(styles).forEach(([property, value]) => {
          found.push({
            queryPattern,
            selector,
            property,
            value,
            breadcrumb: queryPattern || 'All pages'
          });
        });
      });
    });
    
    return found;
  } catch (error) {
    console.error('Error loading customizations:', error);
    return [];
  }
}

async function applyStyle(elementProperty, propertyValue, cssProperty, cssValue) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectStyle,
    args: [elementProperty, propertyValue, cssProperty, cssValue]
  });
  
  return result[0].result;
}

function injectStyle(elementProperty, propertyValue, cssProperty, cssValue) {
  try {
    let elements = [];
    
    if (elementProperty === 'id') {
      const element = document.getElementById(propertyValue);
      if (element) elements = [element];
    } else if (elementProperty === 'class') {
      elements = Array.from(document.getElementsByClassName(propertyValue));
    } else {
      const selector = `[${elementProperty}="${propertyValue}"]`;
      elements = Array.from(document.querySelectorAll(selector));
    }
    
    if (elements.length === 0) {
      return {
        success: false,
        message: `No elements found with ${elementProperty}="${propertyValue}"`
      };
    }
    
    elements.forEach(element => {
      const jsPropertyName = cssProperty.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
      element.style[jsPropertyName] = cssValue;
    });
    
    return {
      success: true,
      count: elements.length,
      message: `Applied ${cssProperty}: ${cssValue} to ${elements.length} element(s)`
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

async function initializeExtension(domain) {
  if (domain !== 'ambata.crm.dynamics.com') {
    return {
      success: false,
      error: 'This extension only works on ambata.crm.dynamics.com'
    };
  }
  
  return { success: true };
}

function showStatus(message, isError = false) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${isError ? 'error' : 'success'}`;
  status.style.display = 'block';
}

function clearFormFields() {
  const fields = ['elementProperty', 'propertyValue', 'cssProperty', 'cssValue'];
  fields.forEach(fieldId => {
    const element = document.getElementById(fieldId);
    if (element) {
      element.value = '';
    }
  });
}