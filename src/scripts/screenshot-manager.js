// Screenshot Capture Manager for DOM Style Injector Extension
// Uses Chrome's captureVisibleTab API and html2canvas for advanced capture

class ScreenshotManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isCapturing = false;
        this.markup = {
            enabled: false,
            annotations: [],
            currentTool: 'arrow', // arrow, rectangle, circle, text, highlighter
            currentColor: '#ff0000',
            currentStroke: 2
        };
        this.html2canvasLoaded = false;
    }

    // Initialize screenshot functionality
    async initialize() {
        try {
            // Load html2canvas if not already loaded
            await this.loadHtml2Canvas();
            console.log('Screenshot manager initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize screenshot manager:', error);
            return false;
        }
    }

    // Load html2canvas library dynamically
    async loadHtml2Canvas() {
        if (this.html2canvasLoaded || window.html2canvas) {
            this.html2canvasLoaded = true;
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
            script.onload = () => {
                this.html2canvasLoaded = true;
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load html2canvas'));
            document.head.appendChild(script);
        });
    }

    // Capture visible tab using Chrome API
    async captureVisibleTab() {
        try {
            if (!chrome.tabs) {
                throw new Error('Chrome tabs API not available');
            }

            // Get active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];

            if (!activeTab) {
                throw new Error('No active tab found');
            }

            // Capture screenshot
            const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
                format: 'png',
                quality: 100
            });

            return {
                dataUrl,
                timestamp: Date.now(),
                url: activeTab.url,
                title: activeTab.title,
                type: 'visible-tab'
            };

        } catch (error) {
            console.error('Failed to capture visible tab:', error);
            throw error;
        }
    }

    // Capture full page using html2canvas
    async captureFullPage(options = {}) {
        try {
            if (!this.html2canvasLoaded) {
                await this.loadHtml2Canvas();
            }

            const defaultOptions = {
                height: window.innerHeight,
                width: window.innerWidth,
                useCORS: true,
                allowTaint: true,
                scale: 1,
                logging: false,
                ignoreElements: (element) => {
                    // Ignore extension elements
                    return element.classList.contains('extension-overlay') ||
                           element.id.startsWith('extension-') ||
                           element.getAttribute('data-extension') === 'dom-style-injector';
                }
            };

            const canvas = await window.html2canvas(document.body, {
                ...defaultOptions,
                ...options
            });

            const dataUrl = canvas.toDataURL('image/png');

            return {
                dataUrl,
                timestamp: Date.now(),
                url: window.location.href,
                title: document.title,
                type: 'full-page',
                dimensions: {
                    width: canvas.width,
                    height: canvas.height
                }
            };

        } catch (error) {
            console.error('Failed to capture full page:', error);
            throw error;
        }
    }

    // Capture specific element
    async captureElement(selector, options = {}) {
        try {
            if (!this.html2canvasLoaded) {
                await this.loadHtml2Canvas();
            }

            const element = typeof selector === 'string' ? 
                document.querySelector(selector) : selector;

            if (!element) {
                throw new Error('Element not found');
            }

            const canvas = await window.html2canvas(element, {
                useCORS: true,
                allowTaint: true,
                scale: 1,
                logging: false,
                ...options
            });

            const dataUrl = canvas.toDataURL('image/png');

            return {
                dataUrl,
                timestamp: Date.now(),
                url: window.location.href,
                title: document.title,
                type: 'element',
                selector: typeof selector === 'string' ? selector : element.tagName,
                dimensions: {
                    width: canvas.width,
                    height: canvas.height
                }
            };

        } catch (error) {
            console.error('Failed to capture element:', error);
            throw error;
        }
    }

    // Initialize markup canvas
    initializeMarkup(screenshot) {
        const container = document.createElement('div');
        container.className = 'screenshot-markup-container';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;

        const toolbar = this.createMarkupToolbar();
        const canvas = this.createMarkupCanvas(screenshot);

        container.appendChild(toolbar);
        container.appendChild(canvas);

        document.body.appendChild(container);
        
        this.markup.enabled = true;
        this.markup.container = container;
        
        return container;
    }

    // Create markup toolbar
    createMarkupToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'screenshot-markup-toolbar';
        toolbar.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
            display: flex;
            gap: 8px;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        const tools = [
            { name: 'arrow', icon: '↗', title: 'Arrow' },
            { name: 'rectangle', icon: '□', title: 'Rectangle' },
            { name: 'circle', icon: '○', title: 'Circle' },
            { name: 'text', icon: 'T', title: 'Text' },
            { name: 'highlighter', icon: '✏', title: 'Highlighter' }
        ];

        tools.forEach(tool => {
            const btn = document.createElement('button');
            btn.textContent = tool.icon;
            btn.title = tool.title;
            btn.style.cssText = `
                width: 32px;
                height: 32px;
                border: 1px solid #ddd;
                background: ${this.markup.currentTool === tool.name ? '#007acc' : 'white'};
                color: ${this.markup.currentTool === tool.name ? 'white' : '#333'};
                border-radius: 4px;
                cursor: pointer;
            `;
            btn.addEventListener('click', () => this.selectTool(tool.name));
            toolbar.appendChild(btn);
        });

        // Color picker
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = this.markup.currentColor;
        colorInput.style.cssText = 'width: 32px; height: 32px; border: none; cursor: pointer;';
        colorInput.addEventListener('change', (e) => {
            this.markup.currentColor = e.target.value;
        });
        toolbar.appendChild(colorInput);

        // Action buttons
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = `
            padding: 8px 16px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-left: 16px;
        `;
        saveBtn.addEventListener('click', () => this.saveScreenshot());
        toolbar.appendChild(saveBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding: 8px 16px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-left: 8px;
        `;
        cancelBtn.addEventListener('click', () => this.cancelMarkup());
        toolbar.appendChild(cancelBtn);

        return toolbar;
    }

    // Create markup canvas
    createMarkupCanvas(screenshot) {
        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = `
            position: relative;
            max-width: 90vw;
            max-height: 80vh;
            overflow: auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        const img = document.createElement('img');
        img.src = screenshot.dataUrl;
        img.style.cssText = 'display: block; max-width: 100%; height: auto;';

        const canvas = document.createElement('canvas');
        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            cursor: crosshair;
        `;

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.setupCanvasEvents();
        };

        canvasContainer.appendChild(img);
        canvasContainer.appendChild(canvas);

        return canvasContainer;
    }

    // Setup canvas drawing events
    setupCanvasEvents() {
        let isDrawing = false;
        let startX, startY;

        this.canvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            const rect = this.canvas.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;

            const rect = this.canvas.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;

            this.drawShape(startX, startY, currentX, currentY);
        });

        this.canvas.addEventListener('mouseup', () => {
            isDrawing = false;
        });
    }

    // Draw shape based on current tool
    drawShape(startX, startY, currentX, currentY) {
        if (!this.ctx) return;

        this.ctx.strokeStyle = this.markup.currentColor;
        this.ctx.lineWidth = this.markup.currentStroke;
        this.ctx.beginPath();

        switch (this.markup.currentTool) {
            case 'rectangle':
                this.ctx.rect(startX, startY, currentX - startX, currentY - startY);
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
                this.ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                break;
            case 'arrow':
                this.drawArrow(startX, startY, currentX, currentY);
                break;
            default:
                this.ctx.moveTo(startX, startY);
                this.ctx.lineTo(currentX, currentY);
        }

        this.ctx.stroke();
    }

    // Draw arrow
    drawArrow(fromX, fromY, toX, toY) {
        const headLength = 10;
        const angle = Math.atan2(toY - fromY, toX - fromX);

        // Draw line
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(toX, toY);

        // Draw arrowhead
        this.ctx.lineTo(
            toX - headLength * Math.cos(angle - Math.PI / 6),
            toY - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.moveTo(toX, toY);
        this.ctx.lineTo(
            toX - headLength * Math.cos(angle + Math.PI / 6),
            toY - headLength * Math.sin(angle + Math.PI / 6)
        );
    }

    // Select markup tool
    selectTool(toolName) {
        this.markup.currentTool = toolName;
        // Update toolbar appearance
        const toolbar = document.querySelector('.screenshot-markup-toolbar');
        if (toolbar) {
            const buttons = toolbar.querySelectorAll('button');
            buttons.forEach((btn, index) => {
                if (index < 5) { // Only tool buttons
                    btn.style.background = index === ['arrow', 'rectangle', 'circle', 'text', 'highlighter'].indexOf(toolName) ? '#007acc' : 'white';
                    btn.style.color = index === ['arrow', 'rectangle', 'circle', 'text', 'highlighter'].indexOf(toolName) ? 'white' : '#333';
                }
            });
        }
    }

    // Save screenshot with markup
    async saveScreenshot() {
        try {
            if (this.canvas && this.ctx) {
                // Get the final image data with markup
                const dataUrl = this.canvas.toDataURL('image/png');
                
                // Create download
                const filename = `screenshot-${Date.now()}.png`;
                this.downloadImage(dataUrl, filename);
                
                // Close markup interface
                this.cancelMarkup();
                
                return { success: true, filename, dataUrl };
            }
        } catch (error) {
            console.error('Failed to save screenshot:', error);
            throw error;
        }
    }

    // Cancel markup and close interface
    cancelMarkup() {
        if (this.markup.container) {
            this.markup.container.remove();
        }
        this.markup.enabled = false;
        this.markup.annotations = [];
        this.canvas = null;
        this.ctx = null;
    }

    // Download image
    downloadImage(dataUrl, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Get screenshot history from storage
    async getScreenshotHistory() {
        try {
            const result = await chrome.storage.local.get('screenshotHistory');
            return result.screenshotHistory || [];
        } catch (error) {
            console.error('Failed to get screenshot history:', error);
            return [];
        }
    }

    // Save screenshot to history
    async saveToHistory(screenshot) {
        try {
            const history = await this.getScreenshotHistory();
            
            // Add metadata
            const historyItem = {
                ...screenshot,
                id: 'screenshot_' + Date.now(),
                saved: new Date().toISOString()
            };

            // Keep only last 50 screenshots
            history.unshift(historyItem);
            const trimmedHistory = history.slice(0, 50);

            await chrome.storage.local.set({ screenshotHistory: trimmedHistory });
            return historyItem;
        } catch (error) {
            console.error('Failed to save screenshot to history:', error);
            throw error;
        }
    }

    // Clear screenshot history
    async clearHistory() {
        try {
            await chrome.storage.local.remove('screenshotHistory');
        } catch (error) {
            console.error('Failed to clear screenshot history:', error);
            throw error;
        }
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScreenshotManager;
} else {
    window.ScreenshotManager = ScreenshotManager;
}