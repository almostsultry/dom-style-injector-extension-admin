// Visio Integration Manager for DOM Style Injector Extension
// Enables diagram creation and editing for documentation using Visio Online

class VisioIntegrationManager {
    constructor() {
        this.visioApiUrl = 'https://graph.microsoft.com/v1.0';
        this.embedUrl = 'https://products.office.com/office-online/visio';
        this.accessToken = null;
        this.currentDiagram = null;
        this.diagramTypes = {
            architecture: {
                name: 'Architecture Diagram',
                template: 'BasicDiagram',
                description: 'System architecture and component relationships'
            },
            flow: {
                name: 'Flow Diagram',
                template: 'BasicFlowchart',
                description: 'CSS rule application flow'
            },
            hierarchy: {
                name: 'Hierarchy Diagram',
                template: 'OrganizationChart',
                description: 'DOM element hierarchy visualization'
            },
            network: {
                name: 'Network Diagram',
                template: 'BasicNetwork',
                description: 'CSS selector relationships'
            }
        };
    }

    // Initialize Visio integration
    async initialize() {
        try {
            // Check if user has valid Microsoft Graph access
            this.accessToken = await this.getAccessToken();
            
            console.log('Visio Integration Manager initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize Visio integration:', error);
            return false;
        }
    }

    // Get Microsoft Graph access token
    async getAccessToken() {
        try {
            // Try to get token from existing MSAL instance
            const authToken = await chrome.storage.session.get('authToken');
            if (authToken && authToken.authToken) {
                return authToken.authToken;
            }
            
            // If no token, user needs to authenticate
            return null;
        } catch (error) {
            console.error('Failed to get access token:', error);
            return null;
        }
    }

    // Check if Visio is available
    async checkVisioAvailability() {
        if (!this.accessToken) {
            return { available: false, reason: 'Not authenticated' };
        }
        
        try {
            // Check user's Office 365 subscription
            const response = await fetch(`${this.visioApiUrl}/me/licenseDetails`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            
            if (response.ok) {
                const licenses = await response.json();
                const hasVisio = licenses.value.some(license => 
                    license.servicePlans.some(plan => 
                        plan.servicePlanName.includes('VISIO')
                    )
                );
                
                return { 
                    available: hasVisio, 
                    reason: hasVisio ? 'Visio license found' : 'No Visio license' 
                };
            }
            
            return { available: false, reason: 'Unable to check license' };
        } catch (error) {
            console.error('Error checking Visio availability:', error);
            return { available: false, reason: error.message };
        }
    }

    // Create a new diagram from customizations
    async createDiagram(customizations, diagramType = 'architecture') {
        if (!this.accessToken) {
            throw new Error('Not authenticated with Microsoft');
        }
        
        const template = this.diagramTypes[diagramType];
        if (!template) {
            throw new Error(`Unknown diagram type: ${diagramType}`);
        }
        
        try {
            // Generate diagram data from customizations
            const diagramData = this.generateDiagramData(customizations, diagramType);
            
            // Create a new Visio file in OneDrive
            const fileResponse = await fetch(`${this.visioApiUrl}/me/drive/root/children`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: `DOM-Styles-${diagramType}-${Date.now()}.vsdx`,
                    file: {},
                    '@microsoft.graph.conflictBehavior': 'rename'
                })
            });
            
            if (!fileResponse.ok) {
                throw new Error('Failed to create Visio file');
            }
            
            const file = await fileResponse.json();
            
            // Store diagram info
            this.currentDiagram = {
                id: file.id,
                name: file.name,
                webUrl: file.webUrl,
                type: diagramType,
                data: diagramData
            };
            
            return {
                success: true,
                diagram: this.currentDiagram,
                editUrl: this.getEditUrl(file.id)
            };
            
        } catch (error) {
            console.error('Failed to create diagram:', error);
            throw error;
        }
    }

    // Generate diagram data from customizations
    generateDiagramData(customizations, diagramType) {
        switch (diagramType) {
            case 'architecture':
                return this.generateArchitectureDiagram(customizations);
            case 'flow':
                return this.generateFlowDiagram(customizations);
            case 'hierarchy':
                return this.generateHierarchyDiagram(customizations);
            case 'network':
                return this.generateNetworkDiagram(customizations);
            default:
                return this.generateBasicDiagram(customizations);
        }
    }

    // Generate architecture diagram data
    generateArchitectureDiagram(customizations) {
        const shapes = [];
        const connectors = [];
        
        // Group customizations by category
        const categories = {};
        customizations.forEach(rule => {
            const category = rule.category || 'Uncategorized';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(rule);
        });
        
        // Create shapes for categories
        let yPos = 100;
        Object.entries(categories).forEach(([category, rules], index) => {
            // Category container
            shapes.push({
                id: `category-${index}`,
                type: 'Container',
                text: category,
                x: 100,
                y: yPos,
                width: 600,
                height: 150 + (rules.length * 30),
                style: {
                    fill: '#f0f0f0',
                    stroke: '#007acc',
                    strokeWidth: 2
                }
            });
            
            // Rule shapes within category
            rules.forEach((rule, ruleIndex) => {
                shapes.push({
                    id: `rule-${index}-${ruleIndex}`,
                    type: 'Rectangle',
                    text: rule.name,
                    x: 150 + (ruleIndex % 3) * 150,
                    y: yPos + 50 + Math.floor(ruleIndex / 3) * 40,
                    width: 140,
                    height: 30,
                    style: {
                        fill: '#e3f2fd',
                        stroke: '#1976d2',
                        strokeWidth: 1
                    }
                });
            });
            
            yPos += 200 + (rules.length * 30);
        });
        
        return { shapes, connectors };
    }

    // Generate flow diagram data
    generateFlowDiagram(customizations) {
        const shapes = [];
        const connectors = [];
        
        // Start shape
        shapes.push({
            id: 'start',
            type: 'Ellipse',
            text: 'Page Load',
            x: 300,
            y: 50,
            width: 100,
            height: 50,
            style: {
                fill: '#4caf50',
                stroke: '#2e7d32',
                strokeWidth: 2
            }
        });
        
        // Process each customization
        customizations.forEach((rule, index) => {
            const yPos = 150 + (index * 100);
            
            // Decision shape
            shapes.push({
                id: `check-${index}`,
                type: 'Diamond',
                text: `Match ${rule.selector}?`,
                x: 250,
                y: yPos,
                width: 200,
                height: 80,
                style: {
                    fill: '#fff3e0',
                    stroke: '#ef6c00',
                    strokeWidth: 2
                }
            });
            
            // Apply shape
            shapes.push({
                id: `apply-${index}`,
                type: 'Rectangle',
                text: `Apply: ${rule.name}`,
                x: 500,
                y: yPos + 15,
                width: 150,
                height: 50,
                style: {
                    fill: '#e8f5e9',
                    stroke: '#388e3c',
                    strokeWidth: 1
                }
            });
            
            // Connectors
            if (index === 0) {
                connectors.push({
                    from: 'start',
                    to: `check-${index}`,
                    label: ''
                });
            } else {
                connectors.push({
                    from: `check-${index-1}`,
                    to: `check-${index}`,
                    label: 'No'
                });
            }
            
            connectors.push({
                from: `check-${index}`,
                to: `apply-${index}`,
                label: 'Yes'
            });
        });
        
        return { shapes, connectors };
    }

    // Generate hierarchy diagram data
    generateHierarchyDiagram(customizations) {
        const shapes = [];
        const connectors = [];
        
        // Parse selectors to build DOM hierarchy
        const hierarchy = this.buildSelectorHierarchy(customizations);
        
        // Create shapes for hierarchy
        this.createHierarchyShapes(hierarchy, shapes, connectors, 400, 50, null);
        
        return { shapes, connectors };
    }

    // Build selector hierarchy from customizations
    buildSelectorHierarchy(customizations) {
        const root = { name: 'DOM', children: {} };
        
        customizations.forEach(rule => {
            const selector = rule.selector;
            const parts = this.parseSelector(selector);
            
            let current = root;
            parts.forEach(part => {
                if (!current.children[part]) {
                    current.children[part] = { 
                        name: part, 
                        children: {},
                        rules: []
                    };
                }
                current = current.children[part];
                current.rules.push(rule.name);
            });
        });
        
        return root;
    }

    // Parse CSS selector into hierarchy parts
    parseSelector(selector) {
        // Simplified parser - in production, use a proper CSS selector parser
        return selector
            .replace(/[>+~]/g, ' ')
            .split(/\s+/)
            .filter(part => part.length > 0);
    }

    // Create shapes for hierarchy diagram
    createHierarchyShapes(node, shapes, connectors, x, y, parentId) {
        const nodeId = `node-${shapes.length}`;
        
        // Create shape for node
        shapes.push({
            id: nodeId,
            type: 'Rectangle',
            text: node.name,
            x: x,
            y: y,
            width: 120,
            height: 40,
            style: {
                fill: node.rules && node.rules.length > 0 ? '#bbdefb' : '#e1f5fe',
                stroke: '#0277bd',
                strokeWidth: 1
            }
        });
        
        // Create connector to parent
        if (parentId) {
            connectors.push({
                from: parentId,
                to: nodeId,
                style: 'orthogonal'
            });
        }
        
        // Process children
        const children = Object.values(node.children);
        if (children.length > 0) {
            const childWidth = 150;
            const startX = x - (children.length - 1) * childWidth / 2;
            
            children.forEach((child, index) => {
                this.createHierarchyShapes(
                    child,
                    shapes,
                    connectors,
                    startX + index * childWidth,
                    y + 100,
                    nodeId
                );
            });
        }
    }

    // Generate network diagram data
    generateNetworkDiagram(customizations) {
        const shapes = [];
        const connectors = [];
        
        // Create nodes for each customization
        const angleStep = (2 * Math.PI) / customizations.length;
        const radius = 200;
        const centerX = 400;
        const centerY = 300;
        
        customizations.forEach((rule, index) => {
            const angle = index * angleStep;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            shapes.push({
                id: `node-${index}`,
                type: 'Ellipse',
                text: rule.name,
                x: x - 60,
                y: y - 30,
                width: 120,
                height: 60,
                style: {
                    fill: '#e1bee7',
                    stroke: '#6a1b9a',
                    strokeWidth: 2
                }
            });
        });
        
        // Create connections based on selector similarity
        for (let i = 0; i < customizations.length; i++) {
            for (let j = i + 1; j < customizations.length; j++) {
                const similarity = this.calculateSelectorSimilarity(
                    customizations[i].selector,
                    customizations[j].selector
                );
                
                if (similarity > 0.5) {
                    connectors.push({
                        from: `node-${i}`,
                        to: `node-${j}`,
                        style: 'curved',
                        label: `${Math.round(similarity * 100)}%`
                    });
                }
            }
        }
        
        return { shapes, connectors };
    }

    // Calculate similarity between two selectors
    calculateSelectorSimilarity(selector1, selector2) {
        const parts1 = new Set(this.parseSelector(selector1));
        const parts2 = new Set(this.parseSelector(selector2));
        
        const intersection = new Set([...parts1].filter(x => parts2.has(x)));
        const union = new Set([...parts1, ...parts2]);
        
        return intersection.size / union.size;
    }

    // Generate basic diagram
    generateBasicDiagram(customizations) {
        const shapes = [];
        
        customizations.forEach((rule, index) => {
            shapes.push({
                id: `shape-${index}`,
                type: 'Rectangle',
                text: `${rule.name}\n${rule.selector}`,
                x: 100 + (index % 4) * 150,
                y: 100 + Math.floor(index / 4) * 100,
                width: 140,
                height: 80,
                style: {
                    fill: '#f5f5f5',
                    stroke: '#757575',
                    strokeWidth: 1
                }
            });
        });
        
        return { shapes, connectors: [] };
    }

    // Get Visio edit URL
    getEditUrl(fileId) {
        return `https://www.office.com/launch/visio?auth=2&id=${fileId}`;
    }

    // Open diagram in Visio Online
    async openInVisio(diagramId) {
        if (!diagramId && this.currentDiagram) {
            diagramId = this.currentDiagram.id;
        }
        
        if (!diagramId) {
            throw new Error('No diagram to open');
        }
        
        const editUrl = this.getEditUrl(diagramId);
        window.open(editUrl, '_blank');
        
        return { success: true, url: editUrl };
    }

    // Export diagram as image
    async exportAsImage(diagramId, format = 'png') {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }
        
        if (!diagramId && this.currentDiagram) {
            diagramId = this.currentDiagram.id;
        }
        
        try {
            // Request thumbnail from Microsoft Graph
            const response = await fetch(
                `${this.visioApiUrl}/me/drive/items/${diagramId}/thumbnails/0/large/content`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to export diagram');
            }
            
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            // Trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = `diagram-${Date.now()}.${format}`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            return { success: true };
        } catch (error) {
            console.error('Failed to export diagram:', error);
            throw error;
        }
    }

    // List user's Visio diagrams
    async listDiagrams() {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }
        
        try {
            const response = await fetch(
                `${this.visioApiUrl}/me/drive/root/search(q='.vsdx')`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to list diagrams');
            }
            
            const data = await response.json();
            const diagrams = data.value.filter(file => 
                file.name.includes('DOM-Styles-')
            );
            
            return diagrams.map(file => ({
                id: file.id,
                name: file.name,
                modified: file.lastModifiedDateTime,
                webUrl: file.webUrl,
                size: file.size
            }));
            
        } catch (error) {
            console.error('Failed to list diagrams:', error);
            throw error;
        }
    }

    // Create embedded Visio viewer
    createEmbeddedViewer(containerId, diagramId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error('Container not found');
        }
        
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.office.com/embed/visio?id=${diagramId}&auth=2`;
        iframe.width = '100%';
        iframe.height = '600px';
        iframe.frameBorder = '0';
        iframe.setAttribute('allowfullscreen', 'true');
        
        container.innerHTML = '';
        container.appendChild(iframe);
        
        return iframe;
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VisioIntegrationManager;
} else {
    window.VisioIntegrationManager = VisioIntegrationManager;
}