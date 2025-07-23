// AI Integration Manager for DOM Style Injector Extension
// Manages multiple AI service integrations with secure API key handling

class AIIntegrationManager {
    constructor() {
        this.providers = {
            openai: {
                name: 'ChatGPT',
                endpoint: 'https://api.openai.com/v1/chat/completions',
                model: 'gpt-4',
                headers: (_apiKey) => ({
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                })
            },
            anthropic: {
                name: 'Claude',
                endpoint: 'https://api.anthropic.com/v1/messages',
                model: 'claude-3-opus-20240229',
                headers: (_apiKey) => ({
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                })
            },
            microsoft: {
                name: 'Copilot',
                endpoint: null, // Will use Azure OpenAI endpoint
                model: 'gpt-4',
                headers: (apiKey, _endpoint) => ({
                    'api-key': apiKey,
                    'Content-Type': 'application/json'
                })
            },
            google: {
                name: 'Gemini',
                endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
                headers: (_apiKey) => ({
                    'Content-Type': 'application/json'
                })
            },
            grok: {
                name: 'Grok',
                endpoint: 'https://api.x.ai/v1/chat/completions',
                model: 'grok-1',
                headers: (_apiKey) => ({
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                })
            }
        };
        
        this.secureBackendUrl = null;
        this.apiKeys = {};
    }

    // Initialize AI integration
    async initialize() {
        try {
            // Load secure backend URL
            const { secureBackendUrl } = await chrome.storage.sync.get('secureBackendUrl');
            if (secureBackendUrl) {
                this.secureBackendUrl = secureBackendUrl;
            }
            
            // Load API keys from secure storage
            await this.loadAPIKeys();
            
            console.log('AI Integration Manager initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize AI Integration Manager:', error);
            return false;
        }
    }

    // Load API keys from secure backend
    async loadAPIKeys() {
        if (!this.secureBackendUrl) {
            console.warn('Secure backend URL not configured');
            return;
        }
        
        try {
            const response = await fetch(`${this.secureBackendUrl}/api/keys`, {
                method: 'GET',
                headers: {
                    'Authorization': await this.getAuthToken()
                }
            });
            
            if (response.ok) {
                const keys = await response.json();
                this.apiKeys = keys;
            }
        } catch (error) {
            console.error('Failed to load API keys:', error);
            // Fall back to local storage (less secure)
            const { aiApiKeys } = await chrome.storage.local.get('aiApiKeys');
            if (aiApiKeys) {
                this.apiKeys = aiApiKeys;
            }
        }
    }

    // Save API key securely
    async saveAPIKey(provider, apiKey) {
        if (!this.isValidProvider(provider)) {
            throw new Error(`Invalid provider: ${provider}`);
        }
        
        // Validate API key format
        if (!this.validateAPIKey(provider, apiKey)) {
            throw new Error('Invalid API key format');
        }
        
        try {
            if (this.secureBackendUrl) {
                // Save to secure backend
                const response = await fetch(`${this.secureBackendUrl}/api/keys`, {
                    method: 'POST',
                    headers: {
                        'Authorization': await this.getAuthToken(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        provider,
                        apiKey: this.encryptAPIKey(apiKey)
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to save API key to backend');
                }
            } else {
                // Fall back to local storage with basic encryption
                this.apiKeys[provider] = this.encryptAPIKey(apiKey);
                await chrome.storage.local.set({ aiApiKeys: this.apiKeys });
            }
            
            return { success: true };
        } catch (error) {
            console.error('Failed to save API key:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete API key
    async deleteAPIKey(provider) {
        if (!this.isValidProvider(provider)) {
            throw new Error(`Invalid provider: ${provider}`);
        }
        
        try {
            if (this.secureBackendUrl) {
                const response = await fetch(`${this.secureBackendUrl}/api/keys/${provider}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': await this.getAuthToken()
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Failed to delete API key from backend');
                }
            }
            
            delete this.apiKeys[provider];
            await chrome.storage.local.set({ aiApiKeys: this.apiKeys });
            
            return { success: true };
        } catch (error) {
            console.error('Failed to delete API key:', error);
            return { success: false, error: error.message };
        }
    }

    // Get configured providers
    getConfiguredProviders() {
        return Object.keys(this.apiKeys);
    }

    // Check if provider is configured
    isProviderConfigured(provider) {
        return !!this.apiKeys[provider];
    }

    // Generate CSS documentation using AI
    async generateDocumentation(customizations, provider = 'openai') {
        if (!this.isProviderConfigured(provider)) {
            throw new Error(`${this.providers[provider]?.name || provider} is not configured`);
        }
        
        const prompt = this.buildDocumentationPrompt(customizations);
        
        try {
            const response = await this.callAI(provider, prompt);
            return this.parseDocumentationResponse(response);
        } catch (error) {
            console.error('Failed to generate documentation:', error);
            throw error;
        }
    }

    // Suggest CSS improvements using AI
    async suggestImprovements(customization, provider = 'openai') {
        if (!this.isProviderConfigured(provider)) {
            throw new Error(`${this.providers[provider]?.name || provider} is not configured`);
        }
        
        const prompt = this.buildImprovementPrompt(customization);
        
        try {
            const response = await this.callAI(provider, prompt);
            return this.parseImprovementResponse(response);
        } catch (error) {
            console.error('Failed to get improvement suggestions:', error);
            throw error;
        }
    }

    // Generate CSS from natural language description
    async generateCSS(description, targetElement, provider = 'openai') {
        if (!this.isProviderConfigured(provider)) {
            throw new Error(`${this.providers[provider]?.name || provider} is not configured`);
        }
        
        const prompt = this.buildCSSGenerationPrompt(description, targetElement);
        
        try {
            const response = await this.callAI(provider, prompt);
            return this.parseCSSResponse(response);
        } catch (error) {
            console.error('Failed to generate CSS:', error);
            throw error;
        }
    }

    // Call AI provider
    async callAI(provider, prompt) {
        const config = this.providers[provider];
        if (!config) {
            throw new Error(`Unknown provider: ${provider}`);
        }
        
        const apiKey = this.decryptAPIKey(this.apiKeys[provider]);
        const requestBody = this.buildRequestBody(provider, prompt);
        
        let endpoint = config.endpoint;
        
        // Special handling for Azure OpenAI (Copilot)
        if (provider === 'microsoft') {
            const { azureOpenAIEndpoint } = await chrome.storage.sync.get('azureOpenAIEndpoint');
            if (!azureOpenAIEndpoint) {
                throw new Error('Azure OpenAI endpoint not configured');
            }
            endpoint = `${azureOpenAIEndpoint}/openai/deployments/${config.model}/chat/completions?api-version=2024-02-01`;
        }
        
        // Special handling for Google Gemini
        if (provider === 'google') {
            endpoint = `${config.endpoint}?key=${apiKey}`;
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: config.headers(apiKey, endpoint),
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`AI API error: ${error}`);
        }
        
        return await response.json();
    }

    // Build request body for different providers
    buildRequestBody(provider, prompt) {
        switch (provider) {
            case 'openai':
            case 'microsoft':
            case 'grok':
                return {
                    model: this.providers[provider].model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a CSS expert helping with DOM style customizations for Dynamics 365.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                };
                
            case 'anthropic':
                return {
                    model: this.providers[provider].model,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 2000
                };
                
            case 'google':
                return {
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2000
                    }
                };
                
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }

    // Build documentation prompt
    buildDocumentationPrompt(customizations) {
        return `Generate comprehensive documentation for the following CSS customizations applied to Dynamics 365:

${customizations.map(c => `
Rule: ${c.name}
Selector: ${c.selector}
Category: ${c.category || 'General'}
Styles: ${JSON.stringify(c.styles, null, 2)}
${c.pseudoClasses ? `Pseudo-classes: ${JSON.stringify(c.pseudoClasses, null, 2)}` : ''}
`).join('\n---\n')}

Please provide:
1. Overview of all customizations
2. Purpose and effect of each rule
3. Best practices and recommendations
4. Potential conflicts or issues to watch for
5. Maintenance tips

Format the output in clear, structured markdown.`;
    }

    // Build improvement prompt
    buildImprovementPrompt(customization) {
        return `Analyze this CSS customization and suggest improvements:

Selector: ${customization.selector}
Current Styles: ${JSON.stringify(customization.styles, null, 2)}
${customization.pseudoClasses ? `Pseudo-classes: ${JSON.stringify(customization.pseudoClasses, null, 2)}` : ''}

Please suggest:
1. Performance optimizations
2. Better selector strategies
3. Cross-browser compatibility improvements
4. Accessibility enhancements
5. Code organization improvements

Provide specific CSS code examples for each suggestion.`;
    }

    // Build CSS generation prompt
    buildCSSGenerationPrompt(description, targetElement) {
        return `Generate CSS styles based on this description: "${description}"

Target element: ${targetElement}
Context: This is for customizing Dynamics 365 UI elements.

Please provide:
1. CSS rules with appropriate selectors
2. Include hover/focus states if relevant
3. Ensure accessibility compliance
4. Add comments explaining the styles
5. Consider Dynamics 365 UI patterns

Return the CSS in a format ready to use.`;
    }

    // Parse documentation response
    parseDocumentationResponse(response) {
        let content = '';
        
        // Extract content based on provider response format
        if (response.choices) {
            content = response.choices[0].message.content;
        } else if (response.content) {
            content = response.content[0].text;
        } else if (response.candidates) {
            content = response.candidates[0].content.parts[0].text;
        }
        
        return {
            documentation: content,
            timestamp: new Date().toISOString()
        };
    }

    // Parse improvement response
    parseImprovementResponse(response) {
        let content = '';
        
        if (response.choices) {
            content = response.choices[0].message.content;
        } else if (response.content) {
            content = response.content[0].text;
        } else if (response.candidates) {
            content = response.candidates[0].content.parts[0].text;
        }
        
        // Extract suggestions from the response
        const suggestions = this.extractSuggestions(content);
        
        return {
            suggestions,
            rawResponse: content,
            timestamp: new Date().toISOString()
        };
    }

    // Parse CSS response
    parseCSSResponse(response) {
        let content = '';
        
        if (response.choices) {
            content = response.choices[0].message.content;
        } else if (response.content) {
            content = response.content[0].text;
        } else if (response.candidates) {
            content = response.candidates[0].content.parts[0].text;
        }
        
        // Extract CSS code from the response
        const css = this.extractCSS(content);
        
        return {
            css,
            explanation: content,
            timestamp: new Date().toISOString()
        };
    }

    // Extract suggestions from AI response
    extractSuggestions(content) {
        const suggestions = [];
        const lines = content.split('\n');
        
        let currentSuggestion = null;
        
        for (const line of lines) {
            if (line.match(/^\d+\.|^-|^\*/)) {
                if (currentSuggestion) {
                    suggestions.push(currentSuggestion);
                }
                currentSuggestion = {
                    title: line.replace(/^\d+\.|^-|^\*/, '').trim(),
                    description: '',
                    code: ''
                };
            } else if (line.includes('```css')) {
                // Start of code block
                continue;
            } else if (line.includes('```')) {
                // End of code block
                continue;
            } else if (currentSuggestion && line.trim()) {
                if (line.startsWith('  ') || line.startsWith('\t')) {
                    currentSuggestion.code += line + '\n';
                } else {
                    currentSuggestion.description += line + ' ';
                }
            }
        }
        
        if (currentSuggestion) {
            suggestions.push(currentSuggestion);
        }
        
        return suggestions;
    }

    // Extract CSS from AI response
    extractCSS(content) {
        // Look for code blocks
        const codeBlockMatch = content.match(/```css\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }
        
        // Look for CSS-like content
        const cssMatch = content.match(/([.#][\w-]+\s*{[\s\S]*?})/g);
        if (cssMatch) {
            return cssMatch.join('\n\n');
        }
        
        // Return cleaned content as fallback
        return content.split('\n')
            .filter(line => line.includes('{') || line.includes('}') || line.includes(':'))
            .join('\n');
    }

    // Validate provider
    isValidProvider(provider) {
        return Object.keys(this.providers).includes(provider);
    }

    // Validate API key format
    validateAPIKey(provider, apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        
        switch (provider) {
            case 'openai':
            case 'grok':
                return apiKey.startsWith('sk-') && apiKey.length > 20;
            case 'anthropic':
                return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
            case 'microsoft':
                return apiKey.length === 32; // Azure API keys are typically 32 chars
            case 'google':
                return apiKey.length === 39; // Google API keys are typically 39 chars
            default:
                return apiKey.length > 10; // Basic validation
        }
    }

    // Basic encryption for API keys (should use proper encryption in production)
    encryptAPIKey(apiKey) {
        // In production, use proper encryption with the secure backend
        return btoa(apiKey);
    }

    // Basic decryption for API keys
    decryptAPIKey(encryptedKey) {
        // In production, use proper decryption with the secure backend
        return atob(encryptedKey);
    }

    // Get auth token for secure backend
    async getAuthToken() {
        // Get auth token from storage or generate one
        const { authToken } = await chrome.storage.session.get('authToken');
        return authToken || 'Bearer mock-token';
    }

    // Test API connection
    async testConnection(provider) {
        if (!this.isProviderConfigured(provider)) {
            throw new Error(`${this.providers[provider]?.name || provider} is not configured`);
        }
        
        try {
            const response = await this.callAI(provider, 'Test connection. Respond with "Connection successful".');
            return { success: true, response };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIIntegrationManager;
} else {
    window.AIIntegrationManager = AIIntegrationManager;
}