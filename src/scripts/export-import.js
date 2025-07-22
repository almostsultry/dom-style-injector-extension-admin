// Export/Import functionality for DOM Style Injector Extension

class ExportImportManager {
    constructor() {
        this.exportFormats = {
            JSON: 'json',
            CSV: 'csv',
            EXCEL: 'xlsx'
        };
    }

    // Export functionality
    async exportCustomizations(options = {}) {
        try {
            const {
                format = 'json',
                includeMetadata = true,
                filterBy = null,
                selectedIds = null
            } = options;

            // Get customizations from storage
            const { customizations = [] } = await chrome.storage.local.get('customizations');
            
            // Filter customizations if needed
            let dataToExport = customizations;
            
            if (selectedIds && selectedIds.length > 0) {
                dataToExport = customizations.filter(c => selectedIds.includes(c.id));
            } else if (filterBy) {
                dataToExport = this.applyFilters(customizations, filterBy);
            }

            // Add export metadata
            const exportData = {
                metadata: includeMetadata ? {
                    exportDate: new Date().toISOString(),
                    version: chrome.runtime.getManifest().version,
                    totalRules: dataToExport.length,
                    exportedBy: await this.getCurrentUser(),
                    tenantId: await this.getTenantId()
                } : undefined,
                customizations: dataToExport
            };

            // Format based on type
            switch (format) {
                case 'json':
                    return this.formatAsJSON(exportData);
                case 'csv':
                    return this.formatAsCSV(dataToExport);
                case 'xlsx':
                    return await this.formatAsExcel(dataToExport);
                default:
                    throw new Error('Unsupported export format');
            }
        } catch (error) {
            console.error('Export error:', error);
            throw error;
        }
    }

    // Import functionality
    async importCustomizations(fileContent, options = {}) {
        try {
            const {
                format = 'json',
                mergeStrategy = 'merge', // merge, replace, skip
                validateBeforeImport = true
            } = options;

            let importData;
            
            // Parse based on format
            switch (format) {
                case 'json':
                    importData = this.parseJSON(fileContent);
                    break;
                case 'csv':
                    importData = await this.parseCSV(fileContent);
                    break;
                case 'xlsx':
                    importData = await this.parseExcel(fileContent);
                    break;
                default:
                    throw new Error('Unsupported import format');
            }

            // Extract customizations
            const customizationsToImport = importData.customizations || importData;

            // Validate if requested
            if (validateBeforeImport) {
                const validation = this.validateCustomizations(customizationsToImport);
                if (!validation.valid) {
                    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
                }
            }

            // Get existing customizations
            const { customizations = [] } = await chrome.storage.local.get('customizations');

            // Apply merge strategy
            const mergedCustomizations = await this.mergeCustomizations(
                customizations,
                customizationsToImport,
                mergeStrategy
            );

            // Save merged customizations
            await chrome.storage.local.set({ customizations: mergedCustomizations });

            // Return import summary
            return {
                success: true,
                imported: customizationsToImport.length,
                total: mergedCustomizations.length,
                conflicts: mergedCustomizations.filter(c => c._importConflict).length,
                metadata: importData.metadata
            };

        } catch (error) {
            console.error('Import error:', error);
            throw error;
        }
    }

    // Format converters
    formatAsJSON(data) {
        return {
            content: JSON.stringify(data, null, 2),
            mimeType: 'application/json',
            filename: `dom-styles-export-${Date.now()}.json`
        };
    }

    formatAsCSV(customizations) {
        const headers = [
            'ID', 'Name', 'Selector', 'CSS', 'Target URL', 
            'Enabled', 'Priority', 'Category', 'Created', 'Modified'
        ];

        const rows = customizations.map(c => [
            c.id || '',
            c.name || '',
            c.selector || '',
            this.escapeCSV(c.css || ''),
            c.targetUrl || '*',
            c.enabled !== false ? 'Yes' : 'No',
            c.priority || 0,
            c.category || '',
            c.created ? new Date(c.created).toLocaleString() : '',
            c.modified ? new Date(c.modified).toLocaleString() : ''
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return {
            content: csv,
            mimeType: 'text/csv',
            filename: `dom-styles-export-${Date.now()}.csv`
        };
    }

    async formatAsExcel(customizations) {
        // For Excel export, we'll create a CSV that Excel can open
        // In a real implementation, you'd use a library like SheetJS
        const csvData = this.formatAsCSV(customizations);
        return {
            ...csvData,
            filename: `dom-styles-export-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
    }

    // Parse functions
    parseJSON(content) {
        try {
            return JSON.parse(content);
        } catch (error) {
            throw new Error('Invalid JSON format');
        }
    }

    async parseCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV file is empty or invalid');
        }

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const customizations = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const customization = {};

            headers.forEach((header, index) => {
                const value = values[index] || '';
                switch (header.toLowerCase()) {
                    case 'id':
                        customization.id = value;
                        break;
                    case 'name':
                        customization.name = value;
                        break;
                    case 'selector':
                        customization.selector = value;
                        break;
                    case 'css':
                        customization.css = value;
                        break;
                    case 'target url':
                        customization.targetUrl = value || '*';
                        break;
                    case 'enabled':
                        customization.enabled = value.toLowerCase() === 'yes';
                        break;
                    case 'priority':
                        customization.priority = parseInt(value) || 0;
                        break;
                    case 'category':
                        customization.category = value;
                        break;
                }
            });

            if (customization.selector && customization.css) {
                customizations.push(customization);
            }
        }

        return { customizations };
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current.trim());
        return values.map(v => v.replace(/^"|"$/g, ''));
    }

    async parseExcel(content) {
        // For now, treat as CSV
        // In a real implementation, you'd use a library to parse Excel
        return this.parseCSV(content);
    }

    // Validation
    validateCustomizations(customizations) {
        const errors = [];
        const validatedCustomizations = [];

        customizations.forEach((customization, index) => {
            const itemErrors = [];

            // Required fields
            if (!customization.selector) {
                itemErrors.push(`Row ${index + 1}: Missing selector`);
            }
            if (!customization.css) {
                itemErrors.push(`Row ${index + 1}: Missing CSS`);
            }

            // Validate selector
            if (customization.selector) {
                try {
                    document.querySelector(customization.selector);
                } catch (e) {
                    itemErrors.push(`Row ${index + 1}: Invalid selector "${customization.selector}"`);
                }
            }

            // Validate CSS
            if (customization.css && !this.isValidCSS(customization.css)) {
                itemErrors.push(`Row ${index + 1}: Invalid CSS`);
            }

            if (itemErrors.length === 0) {
                validatedCustomizations.push(customization);
            } else {
                errors.push(...itemErrors);
            }
        });

        return {
            valid: errors.length === 0,
            errors,
            validCustomizations: validatedCustomizations
        };
    }

    isValidCSS(css) {
        // Basic CSS validation
        // Check for dangerous patterns
        const dangerous = [
            'javascript:',
            'expression(',
            '<script',
            'onerror=',
            'onclick='
        ];

        const lowerCSS = css.toLowerCase();
        return !dangerous.some(pattern => lowerCSS.includes(pattern));
    }

    // Merge strategies
    async mergeCustomizations(existing, importing, strategy) {
        switch (strategy) {
            case 'replace':
                // Complete replacement
                return importing.map(c => ({
                    ...c,
                    id: c.id || this.generateId(),
                    imported: Date.now()
                }));

            case 'skip':
                // Skip duplicates
                const existingSelectors = new Set(existing.map(c => c.selector));
                const newCustomizations = importing.filter(c => 
                    !existingSelectors.has(c.selector)
                );
                return [
                    ...existing,
                    ...newCustomizations.map(c => ({
                        ...c,
                        id: c.id || this.generateId(),
                        imported: Date.now()
                    }))
                ];

            case 'merge':
            default:
                // Merge with conflict detection
                const merged = [...existing];
                const selectorMap = new Map(existing.map(c => [c.selector, c]));

                importing.forEach(importedRule => {
                    const existingRule = selectorMap.get(importedRule.selector);
                    
                    if (existingRule) {
                        // Conflict detected
                        const mergedRule = {
                            ...existingRule,
                            ...importedRule,
                            id: existingRule.id, // Keep existing ID
                            _importConflict: true,
                            _originalCSS: existingRule.css,
                            modified: Date.now()
                        };
                        
                        const index = merged.findIndex(c => c.id === existingRule.id);
                        merged[index] = mergedRule;
                    } else {
                        // New rule
                        merged.push({
                            ...importedRule,
                            id: importedRule.id || this.generateId(),
                            imported: Date.now()
                        });
                    }
                });

                return merged;
        }
    }

    // Helper functions
    applyFilters(customizations, filters) {
        return customizations.filter(c => {
            if (filters.category && c.category !== filters.category) {
                return false;
            }
            if (filters.enabled !== undefined && c.enabled !== filters.enabled) {
                return false;
            }
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                return (
                    c.name?.toLowerCase().includes(searchLower) ||
                    c.selector?.toLowerCase().includes(searchLower) ||
                    c.css?.toLowerCase().includes(searchLower)
                );
            }
            return true;
        });
    }

    escapeCSV(str) {
        return str.replace(/"/g, '""').replace(/\n/g, ' ');
    }

    generateId() {
        return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async getCurrentUser() {
        const { userInfo } = await chrome.storage.local.get('userInfo');
        return userInfo?.displayName || userInfo?.userPrincipalName || 'Unknown';
    }

    async getTenantId() {
        const { d365OrgUrl } = await chrome.storage.sync.get('d365OrgUrl');
        if (d365OrgUrl) {
            const match = d365OrgUrl.match(/https:\/\/([\w-]+)\./);
            return match ? match[1] : null;
        }
        return null;
    }

    // Download helper
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    // Upload helper
    async uploadFile(acceptTypes = '.json,.csv,.xlsx') {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = acceptTypes;
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject(new Error('No file selected'));
                    return;
                }

                try {
                    const content = await this.readFile(file);
                    resolve({
                        content,
                        filename: file.name,
                        type: file.type,
                        format: this.detectFormat(file.name)
                    });
                } catch (error) {
                    reject(error);
                }
            };

            input.click();
        });
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    detectFormat(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        switch (ext) {
            case 'json':
                return 'json';
            case 'csv':
                return 'csv';
            case 'xlsx':
            case 'xls':
                return 'xlsx';
            default:
                return 'json';
        }
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportImportManager;
} else {
    window.ExportImportManager = ExportImportManager;
}