// Branding Manager for DOM Style Injector Extension
// Manages custom logos, icons, colors, and themes for enterprise customization

class BrandingManager {
    constructor() {
        this.defaultBranding = {
            logoUrl: null,
            iconUrl: null,
            primaryColor: '#007acc',
            secondaryColor: '#0056b3',
            accentColor: '#28a745',
            backgroundColor: '#ffffff',
            textColor: '#333333',
            theme: 'light',
            customCSS: '',
            companyName: '',
            supportEmail: '',
            supportUrl: ''
        };
        
        this.currentBranding = { ...this.defaultBranding };
        this.themes = {
            light: {
                backgroundColor: '#ffffff',
                textColor: '#333333',
                borderColor: '#e9ecef',
                shadowColor: 'rgba(0, 0, 0, 0.1)'
            },
            dark: {
                backgroundColor: '#1e1e1e',
                textColor: '#ffffff',
                borderColor: '#383838',
                shadowColor: 'rgba(255, 255, 255, 0.1)'
            },
            highContrast: {
                backgroundColor: '#000000',
                textColor: '#ffffff',
                borderColor: '#ffffff',
                shadowColor: 'none'
            }
        };
    }

    // Initialize branding
    async initialize() {
        try {
            // Load saved branding from storage
            const saved = await this.loadBranding();
            if (saved) {
                this.currentBranding = { ...this.defaultBranding, ...saved };
            }
            
            // Apply branding immediately
            await this.applyBranding();
            
            console.log('Branding manager initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize branding manager:', error);
            return false;
        }
    }

    // Load branding from storage
    async loadBranding() {
        try {
            const result = await chrome.storage.sync.get('customBranding');
            return result.customBranding || null;
        } catch (error) {
            console.error('Failed to load branding:', error);
            return null;
        }
    }

    // Save branding to storage
    async saveBranding(branding) {
        try {
            // Validate branding data
            const validatedBranding = this.validateBranding(branding);
            
            // Save to storage
            await chrome.storage.sync.set({ customBranding: validatedBranding });
            
            // Update current branding
            this.currentBranding = validatedBranding;
            
            // Apply changes immediately
            await this.applyBranding();
            
            return { success: true, branding: validatedBranding };
        } catch (error) {
            console.error('Failed to save branding:', error);
            return { success: false, error: error.message };
        }
    }

    // Validate branding data
    validateBranding(branding) {
        const validated = { ...this.defaultBranding };
        
        // Validate logo URL
        if (branding.logoUrl) {
            if (this.isValidUrl(branding.logoUrl) || this.isDataUrl(branding.logoUrl)) {
                validated.logoUrl = branding.logoUrl;
            }
        }
        
        // Validate icon URL
        if (branding.iconUrl) {
            if (this.isValidUrl(branding.iconUrl) || this.isDataUrl(branding.iconUrl)) {
                validated.iconUrl = branding.iconUrl;
            }
        }
        
        // Validate colors
        const colorFields = ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor'];
        colorFields.forEach(field => {
            if (branding[field] && this.isValidColor(branding[field])) {
                validated[field] = branding[field];
            }
        });
        
        // Validate theme
        if (branding.theme && this.themes[branding.theme]) {
            validated.theme = branding.theme;
        }
        
        // Validate custom CSS (sanitize)
        if (branding.customCSS) {
            validated.customCSS = this.sanitizeCSS(branding.customCSS);
        }
        
        // Validate text fields
        const textFields = ['companyName', 'supportEmail', 'supportUrl'];
        textFields.forEach(field => {
            if (branding[field]) {
                validated[field] = this.sanitizeText(branding[field]);
            }
        });
        
        return validated;
    }

    // Apply branding to the extension
    async applyBranding() {
        try {
            // Create or update style element
            let styleEl = document.getElementById('custom-branding-styles');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'custom-branding-styles';
                document.head.appendChild(styleEl);
            }
            
            // Generate CSS from branding
            const css = this.generateBrandingCSS();
            styleEl.textContent = css;
            
            // Apply logo if present
            if (this.currentBranding.logoUrl) {
                this.applyLogo();
            }
            
            // Apply theme class
            document.body.className = document.body.className.replace(/theme-\w+/g, '');
            document.body.classList.add(`theme-${this.currentBranding.theme}`);
            
            // Update company info
            this.updateCompanyInfo();
            
            return true;
        } catch (error) {
            console.error('Failed to apply branding:', error);
            return false;
        }
    }

    // Generate CSS from branding settings
    generateBrandingCSS() {
        const b = this.currentBranding;
        const theme = this.themes[b.theme] || this.themes.light;
        
        let css = `
            /* Custom Branding Styles */
            :root {
                --brand-primary: ${b.primaryColor};
                --brand-secondary: ${b.secondaryColor};
                --brand-accent: ${b.accentColor};
                --brand-bg: ${b.backgroundColor};
                --brand-text: ${b.textColor};
                --theme-bg: ${theme.backgroundColor};
                --theme-text: ${theme.textColor};
                --theme-border: ${theme.borderColor};
                --theme-shadow: ${theme.shadowColor};
            }
            
            /* Apply to common elements */
            body {
                background-color: var(--theme-bg);
                color: var(--theme-text);
            }
            
            .btn-primary {
                background-color: var(--brand-primary);
                border-color: var(--brand-primary);
            }
            
            .btn-primary:hover {
                background-color: var(--brand-secondary);
                border-color: var(--brand-secondary);
            }
            
            .btn-secondary {
                color: var(--brand-primary);
                border-color: var(--brand-primary);
            }
            
            .btn-secondary:hover {
                background-color: var(--brand-primary);
                color: white;
            }
            
            .header {
                background-color: var(--brand-primary);
                color: white;
            }
            
            .section {
                background-color: var(--theme-bg);
                border-color: var(--theme-border);
            }
            
            .form-input, .form-textarea, .form-select {
                background-color: var(--theme-bg);
                color: var(--theme-text);
                border-color: var(--theme-border);
            }
            
            .form-input:focus, .form-textarea:focus, .form-select:focus {
                border-color: var(--brand-primary);
                box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
            }
            
            /* Success/Error colors with brand accent */
            .message-success {
                background-color: var(--brand-accent);
            }
            
            .status-badge.active {
                background-color: var(--brand-accent);
            }
            
            /* Links */
            a {
                color: var(--brand-primary);
            }
            
            a:hover {
                color: var(--brand-secondary);
            }
        `;
        
        // Add custom CSS if provided
        if (b.customCSS) {
            css += '\n\n/* User Custom CSS */\n' + b.customCSS;
        }
        
        return css;
    }

    // Apply logo to UI
    applyLogo() {
        const logoElements = document.querySelectorAll('.brand-logo, .extension-logo');
        logoElements.forEach(el => {
            if (el.tagName === 'IMG') {
                el.src = this.currentBranding.logoUrl;
                el.alt = this.currentBranding.companyName || 'Company Logo';
            } else {
                el.style.backgroundImage = `url(${this.currentBranding.logoUrl})`;
            }
        });
    }

    // Update company information in UI
    updateCompanyInfo() {
        // Update company name
        if (this.currentBranding.companyName) {
            const nameElements = document.querySelectorAll('.company-name');
            nameElements.forEach(el => {
                el.textContent = this.currentBranding.companyName;
            });
        }
        
        // Update support email
        if (this.currentBranding.supportEmail) {
            const emailElements = document.querySelectorAll('.support-email');
            emailElements.forEach(el => {
                el.href = `mailto:${this.currentBranding.supportEmail}`;
                el.textContent = this.currentBranding.supportEmail;
            });
        }
        
        // Update support URL
        if (this.currentBranding.supportUrl) {
            const urlElements = document.querySelectorAll('.support-url');
            urlElements.forEach(el => {
                el.href = this.currentBranding.supportUrl;
                el.textContent = 'Support Portal';
            });
        }
    }

    // Upload and process logo
    async uploadLogo(file) {
        try {
            if (!file || !file.type.startsWith('image/')) {
                throw new Error('Invalid file type. Please upload an image.');
            }
            
            // Size limit: 500KB
            if (file.size > 500 * 1024) {
                throw new Error('File too large. Maximum size is 500KB.');
            }
            
            // Convert to data URL
            const dataUrl = await this.fileToDataUrl(file);
            
            // Optionally resize if too large
            const resizedUrl = await this.resizeImage(dataUrl, 200, 60);
            
            return resizedUrl;
        } catch (error) {
            console.error('Logo upload error:', error);
            throw error;
        }
    }

    // Upload and process icon
    async uploadIcon(file) {
        try {
            if (!file || !file.type.startsWith('image/')) {
                throw new Error('Invalid file type. Please upload an image.');
            }
            
            // Size limit: 100KB
            if (file.size > 100 * 1024) {
                throw new Error('File too large. Maximum size is 100KB.');
            }
            
            // Convert to data URL
            const dataUrl = await this.fileToDataUrl(file);
            
            // Resize to standard icon sizes
            const iconSizes = [16, 48, 128];
            const icons = {};
            
            for (const size of iconSizes) {
                icons[size] = await this.resizeImage(dataUrl, size, size);
            }
            
            return icons;
        } catch (error) {
            console.error('Icon upload error:', error);
            throw error;
        }
    }

    // Convert file to data URL
    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Resize image
    async resizeImage(dataUrl, maxWidth, maxHeight) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                let height = img.height;
                
                // Calculate new dimensions
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw resized image
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert back to data URL
                resolve(canvas.toDataURL('image/png'));
            };
            img.src = dataUrl;
        });
    }

    // Get current branding
    getCurrentBranding() {
        return { ...this.currentBranding };
    }

    // Reset to default branding
    async resetBranding() {
        try {
            await chrome.storage.sync.remove('customBranding');
            this.currentBranding = { ...this.defaultBranding };
            await this.applyBranding();
            return true;
        } catch (error) {
            console.error('Failed to reset branding:', error);
            return false;
        }
    }

    // Export branding configuration
    exportBranding() {
        const config = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            branding: this.currentBranding
        };
        
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `branding-config-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Import branding configuration
    async importBranding(fileContent) {
        try {
            const config = JSON.parse(fileContent);
            
            if (!config.branding) {
                throw new Error('Invalid branding configuration file');
            }
            
            const result = await this.saveBranding(config.branding);
            
            if (result.success) {
                return { success: true, message: 'Branding imported successfully' };
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Import branding error:', error);
            return { success: false, error: error.message };
        }
    }

    // Utility functions
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    isDataUrl(url) {
        return url && url.startsWith('data:');
    }

    isValidColor(color) {
        const s = new Option().style;
        s.color = color;
        return s.color !== '';
    }

    sanitizeCSS(css) {
        // Remove potentially dangerous CSS
        const dangerous = [
            'javascript:',
            'expression(',
            '<script',
            'onerror=',
            'onclick=',
            '@import'
        ];
        
        let sanitized = css;
        dangerous.forEach(pattern => {
            const regex = new RegExp(pattern, 'gi');
            sanitized = sanitized.replace(regex, '');
        });
        
        return sanitized;
    }

    sanitizeText(text) {
        // Basic text sanitization
        return text.replace(/[<>]/g, '').substring(0, 200);
    }

    // Generate theme preview
    generateThemePreview(theme) {
        const themeData = this.themes[theme] || this.themes.light;
        const preview = document.createElement('div');
        preview.className = 'theme-preview';
        preview.style.cssText = `
            width: 200px;
            height: 100px;
            border: 2px solid ${themeData.borderColor};
            background: ${themeData.backgroundColor};
            color: ${themeData.textColor};
            padding: 10px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        `;
        preview.textContent = `${theme.charAt(0).toUpperCase() + theme.slice(1)} Theme`;
        
        return preview;
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrandingManager;
} else {
    window.BrandingManager = BrandingManager;
}