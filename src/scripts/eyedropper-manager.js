// Eyedropper Manager for DOM Style Injector Extension
// Uses native EyeDropper API for color picking and element selection

class EyedropperManager {
    constructor() {
        this.isActive = false;
        this.selectedColor = null;
        this.selectedElement = null;
        this.onColorPicked = null;
        this.onElementSelected = null;
        this.colorHistory = [];
        this.elementInspectorEnabled = false;
        this.inspectorOverlay = null;
    }

    // Check if EyeDropper API is supported
    isSupported() {
        return 'EyeDropper' in window;
    }

    // Initialize eyedropper functionality
    async initialize() {
        try {
            if (!this.isSupported()) {
                throw new Error('EyeDropper API not supported in this browser');
            }

            // Load color history from storage
            await this.loadColorHistory();
            
            console.log('Eyedropper manager initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize eyedropper manager:', error);
            return false;
        }
    }

    // Open color picker
    async pickColor(_options = {}) {
        try {
            if (!this.isSupported()) {
                throw new Error('EyeDropper API not supported');
            }

            this.isActive = true;

            // Create EyeDropper instance
            const eyeDropper = new EyeDropper();
            
            // Show user feedback
            this.showPickerFeedback('Click anywhere to pick a color (ESC to cancel)');

            // Open the eyedropper
            const result = await eyeDropper.open();
            
            if (result && result.sRGBHex) {
                this.selectedColor = {
                    hex: result.sRGBHex,
                    timestamp: Date.now(),
                    source: 'eyedropper'
                };

                // Add to history
                await this.addToColorHistory(this.selectedColor);

                // Trigger callback if provided
                if (this.onColorPicked) {
                    this.onColorPicked(this.selectedColor);
                }

                this.showPickerFeedback(`Picked color: ${result.sRGBHex}`, 'success');
                
                return this.selectedColor;
            }

            return null;

        } catch (error) {
            if (error.name === 'AbortError') {
                this.showPickerFeedback('Color picking cancelled', 'info');
            } else {
                console.error('Color picking error:', error);
                this.showPickerFeedback('Failed to pick color: ' + error.message, 'error');
            }
            return null;
        } finally {
            this.isActive = false;
            this.hidePickerFeedback();
        }
    }

    // Enable element inspector mode
    enableElementInspector(_options = {}) {
        if (this.elementInspectorEnabled) {
            this.disableElementInspector();
        }

        this.elementInspectorEnabled = true;
        
        // Create inspector overlay
        this.createInspectorOverlay();
        
        // Add event listeners
        this.addInspectorListeners();
        
        // Show feedback
        this.showPickerFeedback('Click on any element to select it (ESC to cancel)', 'info');
        
        return true;
    }

    // Disable element inspector mode
    disableElementInspector() {
        this.elementInspectorEnabled = false;
        
        // Remove overlay
        if (this.inspectorOverlay) {
            this.inspectorOverlay.remove();
            this.inspectorOverlay = null;
        }
        
        // Remove event listeners
        this.removeInspectorListeners();
        
        // Hide feedback
        this.hidePickerFeedback();
        
        return true;
    }

    // Create visual inspector overlay
    createInspectorOverlay() {
        this.inspectorOverlay = document.createElement('div');
        this.inspectorOverlay.id = 'eyedropper-inspector-overlay';
        this.inspectorOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 999998;
            border: 2px solid #007acc;
            box-sizing: border-box;
            background: rgba(0, 122, 204, 0.1);
            display: none;
        `;
        
        document.body.appendChild(this.inspectorOverlay);
    }

    // Add inspector event listeners
    addInspectorListeners() {
        this.mouseOverHandler = (e) => this.handleInspectorMouseOver(e);
        this.clickHandler = (e) => this.handleInspectorClick(e);
        this.keyHandler = (e) => this.handleInspectorKeyboard(e);
        
        document.addEventListener('mouseover', this.mouseOverHandler);
        document.addEventListener('click', this.clickHandler);
        document.addEventListener('keydown', this.keyHandler);
        
        // Prevent default context menu
        document.addEventListener('contextmenu', this.preventContext);
    }

    // Remove inspector event listeners
    removeInspectorListeners() {
        if (this.mouseOverHandler) {
            document.removeEventListener('mouseover', this.mouseOverHandler);
        }
        if (this.clickHandler) {
            document.removeEventListener('click', this.clickHandler);
        }
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
        }
        
        document.removeEventListener('contextmenu', this.preventContext);
    }

    // Handle inspector mouse over
    handleInspectorMouseOver(e) {
        if (!this.elementInspectorEnabled) return;
        
        const element = e.target;
        
        // Skip our own overlay
        if (element === this.inspectorOverlay || element.closest('.eyedropper-feedback')) {
            return;
        }
        
        // Update overlay position
        this.updateOverlayPosition(element);
        
        // Show element info
        this.showElementInfo(element);
    }

    // Handle inspector click
    handleInspectorClick(e) {
        if (!this.elementInspectorEnabled) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const element = e.target;
        
        // Skip our own elements
        if (element === this.inspectorOverlay || element.closest('.eyedropper-feedback')) {
            return;
        }
        
        this.selectedElement = {
            element: element,
            selector: this.generateSelector(element),
            tagName: element.tagName.toLowerCase(),
            className: element.className,
            id: element.id,
            computedStyle: window.getComputedStyle(element),
            rect: element.getBoundingClientRect(),
            timestamp: Date.now()
        };
        
        // Trigger callback
        if (this.onElementSelected) {
            this.onElementSelected(this.selectedElement);
        }
        
        this.showPickerFeedback(`Selected: ${this.selectedElement.selector}`, 'success');
        
        // Auto-disable inspector after selection
        setTimeout(() => {
            this.disableElementInspector();
        }, 1500);
    }

    // Handle keyboard events
    handleInspectorKeyboard(e) {
        if (e.key === 'Escape') {
            this.disableElementInspector();
        }
    }

    // Prevent context menu during inspection
    preventContext(e) {
        e.preventDefault();
    }

    // Update overlay position to highlight element
    updateOverlayPosition(element) {
        if (!this.inspectorOverlay) return;
        
        const rect = element.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        this.inspectorOverlay.style.display = 'block';
        this.inspectorOverlay.style.left = (rect.left + scrollX) + 'px';
        this.inspectorOverlay.style.top = (rect.top + scrollY) + 'px';
        this.inspectorOverlay.style.width = rect.width + 'px';
        this.inspectorOverlay.style.height = rect.height + 'px';
    }

    // Show element information
    showElementInfo(element) {
        const selector = this.generateSelector(element);
        const computedStyle = window.getComputedStyle(element);
        
        let info = `${selector}`;
        
        // Add useful style information
        if (computedStyle.backgroundColor && computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            info += ` | bg: ${computedStyle.backgroundColor}`;
        }
        if (computedStyle.color) {
            info += ` | color: ${computedStyle.color}`;
        }
        
        this.showPickerFeedback(info, 'info');
    }

    // Generate CSS selector for element
    generateSelector(element) {
        // Try ID first
        if (element.id) {
            return `#${element.id}`;
        }
        
        // Try unique class combinations
        if (element.className) {
            const classes = element.className.trim().split(/\s+/);
            if (classes.length > 0) {
                const classSelector = '.' + classes.join('.');
                if (document.querySelectorAll(classSelector).length === 1) {
                    return classSelector;
                }
            }
        }
        
        // Generate path-based selector
        const path = [];
        let currentElement = element;
        
        while (currentElement && currentElement !== document.body) {
            let selector = currentElement.tagName.toLowerCase();
            
            // Add class if available
            if (currentElement.className) {
                const classes = currentElement.className.trim().split(/\s+/);
                if (classes.length > 0) {
                    selector += '.' + classes.join('.');
                }
            }
            
            // Add nth-child if needed for uniqueness
            const siblings = Array.from(currentElement.parentElement?.children || []);
            const sameTagSiblings = siblings.filter(s => s.tagName === currentElement.tagName);
            if (sameTagSiblings.length > 1) {
                const index = sameTagSiblings.indexOf(currentElement) + 1;
                selector += `:nth-child(${index})`;
            }
            
            path.unshift(selector);
            currentElement = currentElement.parentElement;
        }
        
        return path.join(' > ');
    }

    // Show picker feedback
    showPickerFeedback(message, type = 'info') {
        // Remove existing feedback
        this.hidePickerFeedback();
        
        const feedback = document.createElement('div');
        feedback.className = 'eyedropper-feedback';
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007acc'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            z-index: 999999;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            pointer-events: none;
            max-width: 80vw;
            text-align: center;
            word-break: break-word;
        `;
        feedback.textContent = message;
        
        document.body.appendChild(feedback);
        
        // Auto-hide info messages after 3 seconds
        if (type === 'info') {
            setTimeout(() => {
                feedback.remove();
            }, 3000);
        }
    }

    // Hide picker feedback
    hidePickerFeedback() {
        const existing = document.querySelector('.eyedropper-feedback');
        if (existing) {
            existing.remove();
        }
    }

    // Convert color formats
    convertColor(color, format) {
        const hex = color.hex || color;
        
        switch (format) {
            case 'rgb':
                return this.hexToRgb(hex);
            case 'hsl':
                return this.hexToHsl(hex);
            case 'hex':
            default:
                return hex;
        }
    }

    // Convert hex to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    // Convert hex to HSL
    hexToHsl(hex) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return null;
        
        let { r, g, b } = rgb;
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s;
        const l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    // Load color history from storage
    async loadColorHistory() {
        try {
            const result = await chrome.storage.local.get('colorHistory');
            this.colorHistory = result.colorHistory || [];
        } catch (error) {
            console.error('Failed to load color history:', error);
            this.colorHistory = [];
        }
    }

    // Add color to history
    async addToColorHistory(color) {
        try {
            // Avoid duplicates
            const existingIndex = this.colorHistory.findIndex(c => c.hex === color.hex);
            if (existingIndex > -1) {
                this.colorHistory.splice(existingIndex, 1);
            }
            
            // Add to beginning
            this.colorHistory.unshift(color);
            
            // Keep only last 50 colors
            this.colorHistory = this.colorHistory.slice(0, 50);
            
            // Save to storage
            await chrome.storage.local.set({ colorHistory: this.colorHistory });
            
        } catch (error) {
            console.error('Failed to save color to history:', error);
        }
    }

    // Get color history
    getColorHistory() {
        return this.colorHistory;
    }

    // Clear color history
    async clearColorHistory() {
        try {
            this.colorHistory = [];
            await chrome.storage.local.remove('colorHistory');
        } catch (error) {
            console.error('Failed to clear color history:', error);
        }
    }

    // Get selected color
    getSelectedColor() {
        return this.selectedColor;
    }

    // Get selected element
    getSelectedElement() {
        return this.selectedElement;
    }

    // Set callbacks
    setCallbacks({ onColorPicked, onElementSelected }) {
        this.onColorPicked = onColorPicked;
        this.onElementSelected = onElementSelected;
    }

    // Get element styles for CSS generation
    getElementStyles(element) {
        const computedStyle = window.getComputedStyle(element);
        
        // Common CSS properties that are often customized
        const relevantProperties = [
            'background-color', 'color', 'border-color', 'border-width', 'border-style',
            'font-size', 'font-family', 'font-weight', 'padding', 'margin',
            'width', 'height', 'border-radius', 'box-shadow', 'text-align'
        ];
        
        const styles = {};
        relevantProperties.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'initial' && value !== 'inherit') {
                styles[prop] = value;
            }
        });
        
        return styles;
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EyedropperManager;
} else {
    window.EyedropperManager = EyedropperManager;
}