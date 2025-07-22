// Search and Filter functionality for DOM Style Injector Extension

class SearchFilterManager {
    constructor() {
        this.customizations = [];
        this.filteredCustomizations = [];
        this.searchTerm = '';
        this.filters = {
            enabled: 'all', // all, enabled, disabled
            category: 'all',
            hasErrors: 'all', // all, yes, no
            dateRange: null,
            sortBy: 'modified', // name, created, modified, priority
            sortOrder: 'desc' // asc, desc
        };
    }

    // Initialize with customizations
    setCustomizations(customizations) {
        this.customizations = customizations || [];
        this.applyFilters();
    }

    // Apply search term
    search(searchTerm) {
        this.searchTerm = searchTerm.toLowerCase().trim();
        this.applyFilters();
        return this.filteredCustomizations;
    }

    // Update filter
    setFilter(filterName, value) {
        if (this.filters.hasOwnProperty(filterName)) {
            this.filters[filterName] = value;
            this.applyFilters();
        }
        return this.filteredCustomizations;
    }

    // Apply all filters and search
    applyFilters() {
        let results = [...this.customizations];

        // Apply search
        if (this.searchTerm) {
            results = results.filter(c => this.matchesSearch(c));
        }

        // Apply enabled filter
        if (this.filters.enabled !== 'all') {
            const shouldBeEnabled = this.filters.enabled === 'enabled';
            results = results.filter(c => (c.enabled !== false) === shouldBeEnabled);
        }

        // Apply category filter
        if (this.filters.category !== 'all') {
            results = results.filter(c => c.category === this.filters.category);
        }

        // Apply error filter
        if (this.filters.hasErrors !== 'all') {
            const shouldHaveErrors = this.filters.hasErrors === 'yes';
            results = results.filter(c => this.hasErrors(c) === shouldHaveErrors);
        }

        // Apply date range filter
        if (this.filters.dateRange) {
            results = results.filter(c => this.isInDateRange(c));
        }

        // Apply sorting
        results = this.sortResults(results);

        this.filteredCustomizations = results;
        return results;
    }

    // Check if customization matches search term
    matchesSearch(customization) {
        const searchableFields = [
            customization.name,
            customization.selector,
            customization.css,
            customization.category,
            customization.targetUrl
        ];

        // Also search in pseudo-class CSS
        if (customization.pseudoClasses) {
            Object.values(customization.pseudoClasses).forEach(pseudoClass => {
                if (pseudoClass.css) {
                    searchableFields.push(pseudoClass.css);
                }
            });
        }

        return searchableFields.some(field => 
            field && field.toLowerCase().includes(this.searchTerm)
        );
    }

    // Check if customization has errors
    hasErrors(customization) {
        // Check for invalid selector
        if (customization.selector) {
            try {
                document.querySelector(customization.selector);
            } catch (e) {
                return true;
            }
        }

        // Check for dangerous CSS patterns
        const dangerousPatterns = [
            'javascript:',
            'expression(',
            '<script',
            'onerror=',
            'onclick='
        ];

        const cssToCheck = [customization.css];
        if (customization.pseudoClasses) {
            Object.values(customization.pseudoClasses).forEach(pc => {
                if (pc.css) cssToCheck.push(pc.css);
            });
        }

        return cssToCheck.some(css => 
            css && dangerousPatterns.some(pattern => 
                css.toLowerCase().includes(pattern)
            )
        );
    }

    // Check if customization is in date range
    isInDateRange(customization) {
        if (!this.filters.dateRange) return true;

        const { startDate, endDate } = this.filters.dateRange;
        const customizationDate = new Date(customization.modified || customization.created);

        if (startDate && customizationDate < new Date(startDate)) {
            return false;
        }

        if (endDate && customizationDate > new Date(endDate)) {
            return false;
        }

        return true;
    }

    // Sort results
    sortResults(results) {
        const { sortBy, sortOrder } = this.filters;
        const multiplier = sortOrder === 'asc' ? 1 : -1;

        return results.sort((a, b) => {
            let aVal, bVal;

            switch (sortBy) {
                case 'name':
                    aVal = (a.name || '').toLowerCase();
                    bVal = (b.name || '').toLowerCase();
                    break;
                case 'created':
                    aVal = new Date(a.created || 0).getTime();
                    bVal = new Date(b.created || 0).getTime();
                    break;
                case 'modified':
                    aVal = new Date(a.modified || a.created || 0).getTime();
                    bVal = new Date(b.modified || b.created || 0).getTime();
                    break;
                case 'priority':
                    aVal = a.priority || 0;
                    bVal = b.priority || 0;
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return -1 * multiplier;
            if (aVal > bVal) return 1 * multiplier;
            return 0;
        });
    }

    // Get unique categories
    getCategories() {
        const categories = new Set();
        this.customizations.forEach(c => {
            if (c.category) {
                categories.add(c.category);
            }
        });
        return Array.from(categories).sort();
    }

    // Get statistics
    getStatistics() {
        const total = this.customizations.length;
        const filtered = this.filteredCustomizations.length;
        const enabled = this.customizations.filter(c => c.enabled !== false).length;
        const withErrors = this.customizations.filter(c => this.hasErrors(c)).length;
        const categories = this.getCategories().length;

        return {
            total,
            filtered,
            enabled,
            disabled: total - enabled,
            withErrors,
            categories
        };
    }

    // Get filter suggestions based on current data
    getFilterSuggestions() {
        return {
            categories: this.getCategories(),
            hasRules: this.customizations.length > 0,
            hasEnabledRules: this.customizations.some(c => c.enabled !== false),
            hasDisabledRules: this.customizations.some(c => c.enabled === false),
            hasErrors: this.customizations.some(c => this.hasErrors(c))
        };
    }

    // Export filtered results
    getFilteredResults() {
        return this.filteredCustomizations;
    }

    // Reset all filters
    resetFilters() {
        this.searchTerm = '';
        this.filters = {
            enabled: 'all',
            category: 'all',
            hasErrors: 'all',
            dateRange: null,
            sortBy: 'modified',
            sortOrder: 'desc'
        };
        this.applyFilters();
        return this.filteredCustomizations;
    }

    // Quick filter presets
    applyPreset(presetName) {
        switch (presetName) {
            case 'recent':
                // Show items modified in last 7 days
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                this.filters.dateRange = { startDate: weekAgo.toISOString() };
                this.filters.sortBy = 'modified';
                this.filters.sortOrder = 'desc';
                break;
                
            case 'errors':
                // Show only items with errors
                this.filters.hasErrors = 'yes';
                break;
                
            case 'disabled':
                // Show only disabled items
                this.filters.enabled = 'disabled';
                break;
                
            case 'active':
                // Show only enabled items sorted by priority
                this.filters.enabled = 'enabled';
                this.filters.sortBy = 'priority';
                this.filters.sortOrder = 'desc';
                break;
                
            default:
                this.resetFilters();
        }
        
        this.applyFilters();
        return this.filteredCustomizations;
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchFilterManager;
} else {
    window.SearchFilterManager = SearchFilterManager;
}