// Documentation Generator for DOM Style Injector Extension
// Combines AI and Visio integration for comprehensive documentation

import AIIntegrationManager from './ai-integration-manager.js';
import VisioIntegrationManager from './visio-integration-manager.js';

class DocumentationGenerator {
    constructor() {
        this.aiManager = null;
        this.visioManager = null;
        this.initialized = false;
        this.templates = {
            overview: this.getOverviewTemplate(),
            technical: this.getTechnicalTemplate(),
            user: this.getUserTemplate(),
            api: this.getApiTemplate()
        };
    }

    // Initialize the documentation generator
    async initialize() {
        try {
            // Check if AI and Visio managers are available
            if (typeof AIIntegrationManager !== 'undefined') {
                this.aiManager = new AIIntegrationManager();
                await this.aiManager.initialize();
            }
            
            if (typeof VisioIntegrationManager !== 'undefined') {
                this.visioManager = new VisioIntegrationManager();
                await this.visioManager.initialize();
            }
            
            this.initialized = true;
            console.log('Documentation Generator initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize Documentation Generator:', error);
            return false;
        }
    }

    // Generate complete documentation package
    async generateFullDocumentation(customizations, options = {}) {
        if (!this.initialized) {
            throw new Error('Documentation Generator not initialized');
        }

        const {
            includeOverview = true,
            includeTechnical = true,
            includeUserGuide = true,
            includeApiDocs = false,
            includeDiagrams = true,
            aiProvider = null,
            diagramTypes = ['architecture', 'flow']
        } = options;

        try {
            const documentation = {
                metadata: this.generateMetadata(),
                sections: []
            };

            // Generate overview section
            if (includeOverview) {
                const overview = await this.generateOverviewSection(customizations, aiProvider);
                documentation.sections.push(overview);
            }

            // Generate technical documentation
            if (includeTechnical) {
                const technical = await this.generateTechnicalSection(customizations, aiProvider);
                documentation.sections.push(technical);
            }

            // Generate user guide
            if (includeUserGuide) {
                const userGuide = await this.generateUserGuideSection(customizations, aiProvider);
                documentation.sections.push(userGuide);
            }

            // Generate API documentation
            if (includeApiDocs) {
                const apiDocs = await this.generateApiSection(customizations, aiProvider);
                documentation.sections.push(apiDocs);
            }

            // Generate diagrams
            if (includeDiagrams && this.visioManager) {
                const diagrams = await this.generateDiagrams(customizations, diagramTypes);
                documentation.diagrams = diagrams;
            }

            // Combine all sections into final document
            const finalDocument = this.combineDocumentation(documentation);
            
            return {
                success: true,
                documentation: finalDocument,
                format: 'markdown',
                metadata: documentation.metadata
            };

        } catch (error) {
            console.error('Documentation generation error:', error);
            throw error;
        }
    }

    // Generate metadata for the documentation
    generateMetadata() {
        return {
            title: 'DOM Style Injector Extension Documentation',
            version: chrome.runtime.getManifest().version,
            generated: new Date().toISOString(),
            generator: 'DOM Style Injector Documentation Generator v1.0',
            author: 'System Administrator'
        };
    }

    // Generate overview section
    async generateOverviewSection(customizations, aiProvider) {
        const section = {
            title: 'Overview',
            content: '',
            subsections: []
        };

        // Basic statistics
        const stats = this.generateStatistics(customizations);
        section.content = `## Overview

This document provides comprehensive documentation for the DOM Style Injector Extension customizations.

### Statistics
- Total Customizations: ${stats.total}
- Active Rules: ${stats.active}
- Disabled Rules: ${stats.disabled}
- Domains Covered: ${stats.domains}
- Selectors Used: ${stats.selectors}
- CSS Properties Modified: ${stats.properties}
`;

        // AI-enhanced summary if available
        if (this.aiManager && aiProvider) {
            try {
                const aiSummary = await this.aiManager.generateDocumentation(
                    customizations.slice(0, 5), // Sample for summary
                    aiProvider
                );
                section.subsections.push({
                    title: 'Executive Summary',
                    content: aiSummary.documentation
                });
            } catch (error) {
                console.warn('AI summary generation failed:', error);
            }
        }

        return section;
    }

    // Generate technical documentation section
    async generateTechnicalSection(customizations, aiProvider) {
        const section = {
            title: 'Technical Documentation',
            content: '',
            subsections: []
        };

        // Group customizations by domain
        const byDomain = this.groupByDomain(customizations);
        
        section.content = `## Technical Documentation

### Architecture Overview

The DOM Style Injector Extension uses a modular architecture to apply CSS customizations to web applications.

### Customizations by Domain
`;

        // Document each domain
        for (const [domain, rules] of Object.entries(byDomain)) {
            const domainSection = {
                title: domain,
                content: this.documentDomainRules(domain, rules)
            };
            
            // AI enhancement for complex rules
            if (this.aiManager && aiProvider && rules.length > 3) {
                try {
                    const analysis = await this.aiManager.analyzeCSSRules(rules, aiProvider);
                    domainSection.content += `\n\n#### AI Analysis\n${analysis}`;
                } catch (error) {
                    console.warn('AI analysis failed for domain:', domain, error);
                }
            }
            
            section.subsections.push(domainSection);
        }

        return section;
    }

    // Generate user guide section
    async generateUserGuideSection(customizations, _aiProvider) {
        const section = {
            title: 'User Guide',
            content: '',
            subsections: []
        };

        section.content = `## User Guide

### How Customizations Work

The DOM Style Injector Extension automatically applies your configured CSS customizations when you visit supported domains.

### Active Customizations
`;

        // Create user-friendly documentation
        const userRules = this.formatForUsers(customizations);
        section.content += userRules;

        // Add troubleshooting guide
        section.subsections.push({
            title: 'Troubleshooting',
            content: this.generateTroubleshootingGuide()
        });

        return section;
    }

    // Generate API documentation section
    async generateApiSection(customizations, _aiProvider) {
        const section = {
            title: 'API Documentation',
            content: '',
            subsections: []
        };

        section.content = `## API Documentation

### CSS Rule Structure

Each customization follows this structure:

\`\`\`json
{
    "id": "unique-identifier",
    "name": "Rule Name",
    "selector": "CSS Selector",
    "styles": {
        "property": "value"
    },
    "enabled": true,
    "domain": "example.com"
}
\`\`\`

### Supported CSS Properties
`;

        // Document all used CSS properties
        const properties = this.extractAllProperties(customizations);
        section.content += this.documentProperties(properties);

        return section;
    }

    // Generate diagrams using Visio integration
    async generateDiagrams(customizations, diagramTypes) {
        if (!this.visioManager) {
            return [];
        }

        const diagrams = [];

        for (const type of diagramTypes) {
            try {
                const result = await this.visioManager.createDiagram(customizations, type);
                if (result.success) {
                    diagrams.push({
                        type,
                        name: result.diagram.name,
                        url: result.diagram.webUrl,
                        editUrl: result.editUrl
                    });
                }
            } catch (error) {
                console.error(`Failed to create ${type} diagram:`, error);
            }
        }

        return diagrams;
    }

    // Combine all documentation sections
    combineDocumentation(documentation) {
        let markdown = `# ${documentation.metadata.title}

**Version:** ${documentation.metadata.version}  
**Generated:** ${new Date(documentation.metadata.generated).toLocaleString()}  
**Generator:** ${documentation.metadata.generator}  

---

`;

        // Add table of contents
        markdown += '## Table of Contents\n\n';
        documentation.sections.forEach((section, index) => {
            markdown += `${index + 1}. [${section.title}](#${section.title.toLowerCase().replace(/\s+/g, '-')})\n`;
            if (section.subsections) {
                section.subsections.forEach((subsection, subIndex) => {
                    markdown += `   ${index + 1}.${subIndex + 1}. [${subsection.title}](#${subsection.title.toLowerCase().replace(/\s+/g, '-')})\n`;
                });
            }
        });
        markdown += '\n---\n\n';

        // Add sections
        documentation.sections.forEach(section => {
            markdown += section.content + '\n\n';
            if (section.subsections) {
                section.subsections.forEach(subsection => {
                    markdown += `### ${subsection.title}\n\n${subsection.content}\n\n`;
                });
            }
        });

        // Add diagrams section if available
        if (documentation.diagrams && documentation.diagrams.length > 0) {
            markdown += '## Diagrams\n\n';
            documentation.diagrams.forEach(diagram => {
                markdown += `- **${diagram.type.charAt(0).toUpperCase() + diagram.type.slice(1)} Diagram**: [View](${diagram.url}) | [Edit](${diagram.editUrl})\n`;
            });
        }

        return markdown;
    }

    // Helper: Generate statistics
    generateStatistics(customizations) {
        const domains = new Set();
        const selectors = new Set();
        const properties = new Set();
        let active = 0;
        let disabled = 0;

        customizations.forEach(rule => {
            if (rule.domain) domains.add(rule.domain);
            if (rule.selector) selectors.add(rule.selector);
            if (rule.enabled) active++; else disabled++;
            
            if (rule.styles) {
                Object.keys(rule.styles).forEach(prop => properties.add(prop));
            }
        });

        return {
            total: customizations.length,
            active,
            disabled,
            domains: domains.size,
            selectors: selectors.size,
            properties: properties.size
        };
    }

    // Helper: Group customizations by domain
    groupByDomain(customizations) {
        const grouped = {};
        customizations.forEach(rule => {
            const domain = rule.domain || 'global';
            if (!grouped[domain]) grouped[domain] = [];
            grouped[domain].push(rule);
        });
        return grouped;
    }

    // Helper: Document domain rules
    documentDomainRules(domain, rules) {
        let content = `#### ${domain}\n\n`;
        content += `Total Rules: ${rules.length}\n\n`;
        
        rules.forEach(rule => {
            content += `**${rule.name || 'Unnamed Rule'}**\n`;
            content += `- Selector: \`${rule.selector}\`\n`;
            content += `- Enabled: ${rule.enabled ? 'Yes' : 'No'}\n`;
            if (rule.styles && Object.keys(rule.styles).length > 0) {
                content += `- Styles:\n`;
                Object.entries(rule.styles).forEach(([prop, value]) => {
                    content += `  - \`${prop}: ${value}\`\n`;
                });
            }
            content += '\n';
        });
        
        return content;
    }

    // Helper: Format rules for users
    formatForUsers(customizations) {
        let content = '';
        const enabledRules = customizations.filter(rule => rule.enabled);
        
        content += `You have ${enabledRules.length} active customization${enabledRules.length !== 1 ? 's' : ''}.\n\n`;
        
        enabledRules.forEach((rule, index) => {
            content += `${index + 1}. **${rule.name || 'Custom Style'}**\n`;
            content += `   - Applied to: ${rule.domain || 'All domains'}\n`;
            content += `   - Target: ${rule.selector}\n`;
            if (rule.description) {
                content += `   - Description: ${rule.description}\n`;
            }
            content += '\n';
        });
        
        return content;
    }

    // Helper: Extract all CSS properties
    extractAllProperties(customizations) {
        const properties = new Map();
        
        customizations.forEach(rule => {
            if (rule.styles) {
                Object.entries(rule.styles).forEach(([prop, value]) => {
                    if (!properties.has(prop)) {
                        properties.set(prop, []);
                    }
                    properties.get(prop).push(value);
                });
            }
        });
        
        return properties;
    }

    // Helper: Document CSS properties
    documentProperties(properties) {
        let content = '\n';
        const sortedProps = Array.from(properties.keys()).sort();
        
        sortedProps.forEach(prop => {
            const values = properties.get(prop);
            const uniqueValues = [...new Set(values)];
            content += `- **${prop}**: Used ${values.length} time${values.length !== 1 ? 's' : ''}\n`;
            if (uniqueValues.length <= 5) {
                content += `  - Values: ${uniqueValues.join(', ')}\n`;
            }
        });
        
        return content;
    }

    // Helper: Generate troubleshooting guide
    generateTroubleshootingGuide() {
        return `
If your customizations are not appearing:

1. **Check if the extension is enabled**
   - Look for the extension icon in your browser toolbar
   - Ensure it shows as "Active" for the current domain

2. **Verify the domain matches**
   - Customizations are domain-specific
   - Check that you're on the correct domain

3. **Inspect the CSS selector**
   - Open Developer Tools (F12)
   - Use the element inspector to verify your selector matches elements

4. **Clear browser cache**
   - Sometimes cached styles can interfere
   - Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

5. **Check for conflicts**
   - Other extensions or scripts might override styles
   - Try disabling other extensions temporarily

For more help, contact your System Administrator.
`;
    }

    // Template: Overview
    getOverviewTemplate() {
        return {
            sections: ['summary', 'statistics', 'key-features'],
            format: 'markdown'
        };
    }

    // Template: Technical
    getTechnicalTemplate() {
        return {
            sections: ['architecture', 'implementation', 'api', 'security'],
            format: 'markdown'
        };
    }

    // Template: User
    getUserTemplate() {
        return {
            sections: ['getting-started', 'features', 'troubleshooting', 'faq'],
            format: 'markdown'
        };
    }

    // Template: API
    getApiTemplate() {
        return {
            sections: ['endpoints', 'models', 'examples', 'errors'],
            format: 'markdown'
        };
    }

    // Export documentation in different formats
    async exportDocumentation(documentation, format = 'markdown') {
        switch (format) {
            case 'markdown':
                return documentation;
            case 'html':
                return this.convertToHTML(documentation);
            case 'pdf':
                return this.convertToPDF(documentation);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }

    // Convert markdown to HTML
    convertToHTML(markdown) {
        // Basic markdown to HTML conversion
        const html = markdown
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        return `<!DOCTYPE html>
<html>
<head>
    <title>DOM Style Injector Documentation</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #007acc; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <p>${html}</p>
</body>
</html>`;
    }

    // Convert to PDF (requires external library in real implementation)
    async convertToPDF(documentation) {
        console.warn('PDF conversion not implemented. Returning markdown.');
        return documentation;
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DocumentationGenerator;
} else {
    window.DocumentationGenerator = DocumentationGenerator;
}