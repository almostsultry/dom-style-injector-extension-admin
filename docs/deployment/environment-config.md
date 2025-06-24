# **Environment Configuration Guide for D365 DOM Style Injector Extension**

This guide details how to manage environment-specific configurations for the D365 DOM Style Injector Extension. This is crucial for handling different settings for development, staging, and production environments, especially concerning API endpoints, application IDs, and debugging flags.

## **Table of Contents**

1. [Overview](#bookmark=id.wb5bner7px1x)  
2. [Configuration Files](#bookmark=id.9r1gj73yec4s)  
   * [config/environments/development.json](#bookmark=id.y7qd27fost7v)  
   * [config/environments/staging.json](#bookmark=id.82pnges6j4jz)  
   * [config/environments/production.json](#bookmark=id.4roxflajo41r)  
3. [Accessing Configurations in Code](#bookmark=id.1hhxfpjliqtc)  
   * [Build-time Injection](#bookmark=id.2r6q724crz73)  
   * [Runtime Access (Limited)](#bookmark=id.x8p3m4zi6rui)  
4. [Examples of Environment-Specific Settings](#bookmark=id.vf4lezpylc1h)  
   * [Microsoft Graph API Endpoints](#bookmark=id.6dx91p93xz88)  
   * [Azure AD Application IDs](#bookmark=id.2rry4evnlje)  
   * [Feature Flags](#bookmark=id.6i907uaiaz2k)  
   * [Debugging and Logging](#bookmark=id.1rayu720nrgp)  
5. [Managing Secrets](#bookmark=id.l8v19tpvjhxv)  
6. [CI/CD Integration](#bookmark=id.czcyuag0jrbr)  
7. [Best Practices](#bookmark=id.yap7m212j10e)

## **1\. Overview**

Different environments (development, staging, production) often require distinct configurations. For the D365 DOM Style Injector Extension, this might include varying Azure AD application registrations, SharePoint site URLs for configuration, or different logging levels. A robust environment configuration strategy ensures that the correct settings are applied automatically based on the build target.

## **2\. Configuration Files**

The project uses JSON files within the config/environments/ directory to define environment-specific settings.

### **config/environments/development.json**

{  
    "name": "development",  
    "azureAd": {  
        "clientId": "YOUR\_DEV\_AZURE\_AD\_CLIENT\_ID",  
        "tenantId": "YOUR\_DEV\_AZURE\_AD\_TENANT\_ID",  
        "graphScopes": \["User.Read", "Sites.ReadWrite.All"\],  
        "redirectUri": "https://localhost:8080/redirect.html"  
    },  
    "sharePoint": {  
        "configSiteUrl": "https://yourtenant.sharepoint.com/sites/DevExtensionConfig",  
        "configListName": "DevDomStyleInjections"  
    },  
    "logging": {  
        "level": "debug",  
        "enableConsoleLogs": true  
    },  
    "featureFlags": {  
        "newAdminDashboard": true,  
        "experimentalSync": false  
    },  
    "manifestOverrides": {  
        "name": "D365 DOM Style Injector (DEV)",  
        "description": "Development build of the D365 DOM Style Injector."  
    }  
}

### **config/environments/staging.json**

{  
    "name": "staging",  
    "azureAd": {  
        "clientId": "YOUR\_STAGING\_AZURE\_AD\_CLIENT\_ID",  
        "tenantId": "YOUR\_STAGING\_AZURE\_AD\_TENANT\_ID",  
        "graphScopes": \["User.Read", "Sites.ReadWrite.All"\],  
        "redirectUri": "https://yourorg.com/staging/redirect.html"  
    },  
    "sharePoint": {  
        "configSiteUrl": "https://yourtenant.sharepoint.com/sites/StagingExtensionConfig",  
        "configListName": "StagingDomStyleInjections"  
    },  
    "logging": {  
        "level": "info",  
        "enableConsoleLogs": true  
    },  
    "featureFlags": {  
        "newAdminDashboard": false,  
        "experimentalSync": true  
    },  
    "manifestOverrides": {  
        "name": "D365 DOM Style Injector (Staging)",  
        "description": "Staging build of the D365 DOM Style Injector."  
    }  
}

### **config/environments/production.json**

{  
    "name": "production",  
    "azureAd": {  
        "clientId": "YOUR\_PROD\_AZURE\_AD\_CLIENT\_ID",  
        "tenantId": "YOUR\_PROD\_AZURE\_AD\_TENANT\_ID",  
        "graphScopes": \["User.Read", "Sites.ReadWrite.All"\],  
        "redirectUri": "https://yourorg.com/redirect.html"  
    },  
    "sharePoint": {  
        "configSiteUrl": "https://yourtenant.sharepoint.com/sites/ProdExtensionConfig",  
        "configListName": "ProdDomStyleInjections"  
    },  
    "logging": {  
        "level": "error",  
        "enableConsoleLogs": false  
    },  
    "featureFlags": {  
        "newAdminDashboard": false,  
        "experimentalSync": false  
    },  
    "manifestOverrides": {  
        "name": "D365 DOM Style Injector (Admin)",  
        "description": "Enterprise DOM Style Injection for D365 and SharePoint."  
    }  
}

## **3\. Accessing Configurations in Code**

### **Build-time Injection**

The most secure and common way to handle environment configurations in browser extensions (especially Manifest V3) is to inject them at build time.

* **Using webpack.config.js (Recommended):** If Webpack is used, you can leverage DefinePlugin or EnvironmentPlugin to replace variables in your code with values from the configuration files during the build process.  
  Example (concept, actual implementation depends on Webpack setup):  
  // In webpack.config.js  
  const environment \= process.env.NODE\_ENV || 'development';  
  const config \= require(\`./config/environments/${environment}.json\`);

  plugins: \[  
      new webpack.DefinePlugin({  
          \_\_ENV\_CONFIG\_\_: JSON.stringify(config)  
      })  
  \]  
  // In your JS code:  
  // const envConfig \= \_\_ENV\_CONFIG\_\_;  
  // console.log(envConfig.azureAd.clientId);

* **Using Node.js Build Scripts:** As demonstrated in build-admin.js and build-user.js, you can read the appropriate JSON config file and use its values to modify manifest.json or inject constants into JavaScript files during the build.  
  Example (in build-admin.js or build-user.js):  
  // Load config based on NODE\_ENV  
  const environment \= process.env.NODE\_ENV || 'development';  
  const envConfigPath \= path.join(\_\_dirname, \`../config/environments/${environment}.json\`);  
  const envConfig \= await fs.readJson(envConfigPath);

  // Modify manifest.json  
  manifest.name \= envConfig.manifestOverrides.name;  
  manifest.description \= envConfig.manifestOverrides.description;

  // Inject into JS (example: find and replace placeholders or generate a config file)  
  let msalConfigContent \= await fs.readFile(path.join(SRC\_DIR, 'auth/msal-config.js'), 'utf8');  
  msalConfigContent \= msalConfigContent.replace('YOUR\_CLIENT\_ID', envConfig.azureAd.clientId);  
  // ... write modified file

### **Runtime Access (Limited)**

Directly reading external configuration files at runtime is generally not possible or recommended for Manifest V3 extensions due to security restrictions (e.g., CSP). All necessary configuration should be bundled with the extension.

## **4\. Examples of Environment-Specific Settings**

### **Microsoft Graph API Endpoints**

* Development might use a test tenant or mock server endpoints.  
* Production points to the live Microsoft Graph API.

### **Azure AD Application IDs**

* Each environment should typically have its own Azure AD App Registration to isolate permissions and data.  
  * clientId, tenantId, redirectUri, scopes.

### **Feature Flags**

* Enable/disable experimental features in development or staging without affecting production.  
* Example: newAdminDashboard: true in dev, false in prod.

### **Debugging and Logging**

* console.log statements are useful in development but should be stripped or disabled in production for security and performance.  
* Logging levels (debug, info, warn, error) can be adjusted.

## **5\. Managing Secrets**

**Never commit sensitive information (API keys, client secrets, refresh tokens) directly into these JSON files or any part of the repository.**

* **GitHub Secrets:** For CI/CD, store secrets as GitHub Secrets.  
* **Local Environment Variables:** For local development, use .env files and load them using dotenv. Ensure .env is in .gitignore.

Example .env file (local development):

DEV\_AZURE\_AD\_CLIENT\_ID=your\_local\_dev\_client\_id  
DEV\_AZURE\_AD\_TENANT\_ID=your\_local\_dev\_tenant\_id  
\# etc.

Then, modify your build scripts to read these environment variables.

## **6\. CI/CD Integration**

The CI/CD workflows (.github/workflows/) should explicitly set the NODE\_ENV environment variable (e.g., NODE\_ENV: production) before running the build scripts. This ensures that the correct environment configuration is loaded and applied.

Example in GitHub Actions YAML:

jobs:  
  build:  
    runs-on: ubuntu-latest  
    steps:  
    \- uses: actions/checkout@v3  
    \- name: Set up Node.js  
      uses: actions/setup-node@v3  
      with:  
        node-version: '18'  
    \- name: Install dependencies  
      run: npm install  
    \- name: Build Production Admin & User Versions  
      run: node build/release.js  
      env:  
        NODE\_ENV: production \# This sets the environment for your build scripts

## **7\. Best Practices**

* **Consistency:** Maintain a consistent structure across all environment configuration files.  
* **Minimalism:** Only include truly environment-specific settings. Common configurations should be handled elsewhere.  
* **Security First:** Prioritize secure handling of sensitive data.  
* **Documentation:** Keep this guide updated as new configuration parameters are introduced.  
* **Review:** Regularly review environment configurations as part of your deployment checklist.