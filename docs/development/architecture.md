# **D365 DOM Style Injector Extension \- Architecture Overview**

This document provides a high-level overview of the D365 DOM Style Injector Extension's architecture, outlining its core components, their responsibilities, and how they interact. Understanding this architecture is crucial for new contributors and for maintaining the extensibility and maintainability of the project.

## **Table of Contents**

1. [Introduction](#bookmark=id.kf0zmh8xk1en)  
2. [Core Components](#bookmark=id.vfc7lhjrofyl)  
   * [Manifest (manifest.json)](#bookmark=id.ikux5jqtocww)  
   * [Popup (popup.html, popup.js, popup.css)](#bookmark=id.4fwdmf98oygf)  
   * [Content Script (content.js)](#bookmark=id.fqyrhkusdzay)  
   * [Background Service Worker (background.js)](#bookmark=id.m1ketnfcdbbm)  
3. [Key Modules and Services](#bookmark=id.m917tmyiordr)  
   * [Authentication (auth/)](#bookmark=id.4i9bs0ehrwxu)  
   * [Synchronization (sync/)](#bookmark=id.skl7y3sleqv)  
   * [Styles (styles/)](#bookmark=id.i6252mnhh2co)  
   * [Lib (lib/)](#bookmark=id.vnwzx6imo9jj)  
4. [Data Flow and Interactions](#bookmark=id.x9306oe0h8c7)  
   * [Admin Version Flow](#bookmark=id.nxg01p4b6i3s)  
   * [User Version Flow](#bookmark=id.or6d92s8q96)  
5. [Build and Deployment Process](#bookmark=id.49uqppj16ww5)  
6. [Security Considerations](#bookmark=id.ztihwg1o9ey)  
7. [Future Enhancements](#bookmark=id.m4di2spd3dec)

## **1\. Introduction**

The D365 DOM Style Injector is a browser extension designed for CSS injection and DOM manipulation on Microsoft Dynamics 365 and SharePoint Online environments. It comes in two primary versions:

* **Admin Version:** Provides full CRUD (Create, Read, Update, Delete) capabilities for managing style injections, integrates with Microsoft Graph for cloud synchronization, and is aimed at IT administrators.  
* **User Version:** A read-only version that consumes and applies the style injections defined by administrators, ensuring consistent UI customization across an organization.

The extension is built with Manifest V3 compliance for both Chrome and Edge browsers and leverages Azure AD for authentication in the Admin version.

## **2\. Core Components**

### **Manifest (manifest.json)**

The heart of the extension, defining its metadata, permissions, entry points (HTML, JS), and capabilities.

* **Admin Manifest:** Includes permissions for identity, alarms, and broad host permissions for Graph API, SharePoint, and Dynamics domains. Specifies background.js as the service worker.  
* **User Manifest:** Has a reduced set of permissions, typically activeTab, scripting, storage, and specific host permissions for Dynamics and SharePoint only. Does *not* include background.js or identity for cloud sync/authentication.

### **Popup (popup.html, popup.js, popup.css)**

The user interface that appears when the extension icon is clicked in the browser toolbar.

* **Admin Popup:** Provides the UI for managing (CRUD) style injection rules, including forms for adding/editing CSS/JS, URL targeting, and activation status. It interacts with the background script to perform synchronization.  
* **User Popup:** A simplified UI that might only display basic information about the extension, as the user version is read-only and automatically applies rules.

### **Content Script (content.js)**

A JavaScript file injected into the web pages (Dynamics 365, SharePoint) based on manifest configurations.

* **Responsibility:** Reads active style injection rules (from local storage in user version, or pushed by background script in admin version) and dynamically injects CSS and executes JavaScript to modify the DOM of the host page.  
* **Isolation:** Runs in an isolated world, meaning it cannot directly access the host page's JavaScript variables or functions, but can interact with the DOM. Communication with the popup and background scripts occurs via message passing.

### **Background Service Worker (background.js)**

(Admin Version Only) A persistent script that runs in the background, independent of any open tabs or the popup.

* **Responsibility:**  
  * Handles Azure AD authentication and token management using MSAL.  
  * Manages synchronization logic with SharePoint (via Microsoft Graph API) to fetch and store injection rules.  
  * Listens for browser events (e.g., tab updates, alarms).  
  * Acts as a central communication hub between the popup and content scripts for complex operations.  
  * Pushes updated injection rules to local storage, which content scripts then pick up.

## **3\. Key Modules and Services**

### **Authentication (auth/)**

* **msal-config.js**: Contains the Azure AD application registration details (client ID, tenant ID, redirect URIs, scopes) for MSAL.  
* **auth-service.js**: Provides functions for initiating login, acquiring tokens silently, handling token refresh, and managing the authentication state. Interacts directly with msal-browser.min.js.

### **Synchronization (sync/)**

* **sharepoint-service.js**: Encapsulates Microsoft Graph API calls related to SharePoint, specifically for reading from and writing to the designated SharePoint list where injection rules are stored.  
* **sync-manager.js**: Orchestrates the synchronization process. It uses sharepoint-service.js to fetch remote rules and storage API to update local cache. It also handles conflict resolution or delta updates.

### **Styles (styles/)**

* **popup.css**: Styling for the extension's popup UI.  
* **admin-theme.css**: (Admin Version Only) Specific styling for the admin UI elements, potentially overriding popup.css or adding new admin-specific visual cues.

### **Lib (lib/)**

* **msal-browser.min.js**: The minified Microsoft Authentication Library (MSAL) for browser-based applications, handling OAuth 2.0 and OpenID Connect protocols with Azure AD.

## **4\. Data Flow and Interactions**

### **Admin Version Flow**

1. **User opens Popup:** popup.js initializes.  
2. **Authentication:** popup.js (or background.js) triggers auth-service.js to perform Azure AD authentication using msal-browser.min.js. Tokens are acquired.  
3. **Rule Management:** Admin creates/edits/deletes rules in popup.html using popup.js.  
4. **Sync Trigger:** popup.js sends messages to background.js (specifically sync-manager.js) to update rules.  
5. **SharePoint Interaction:** sync-manager.js uses sharepoint-service.js and acquired tokens to perform CRUD operations on the SharePoint configuration list via Microsoft Graph API.  
6. **Local Cache Update:** background.js updates the local chrome.storage with the latest rules.  
7. **Content Script Application:** When a matching D365/SharePoint page loads:  
   * content.js is injected.  
   * content.js reads active rules from chrome.storage.  
   * content.js injects CSS and executes JS on the page's DOM.

### **User Version Flow**

1. **Extension Load:** The extension starts (no background script).  
2. **Rule Fetch (Indirect):** The User version relies on administrators to update the SharePoint list. Its content.js primarily reads from chrome.storage.local. In a managed enterprise environment, the chrome.storage.managed API might be used if rules are pushed via policy. If the user version is expected to *poll* the SharePoint list directly without admin intervention, it would need the background.js and identity permissions too, which contradicts the "read-only" simplified nature. The current design implies the Admin version syncs the rules to a shared repository, and the User version *reads* from that, either directly (if permissions allow) or through local storage updated by the Admin's deployed version or enterprise policy. Given the current design, the user version strictly loads from local storage.  
3. **Content Script Application:** When a matching D365/SharePoint page loads:  
   * content.js is injected.  
   * content.js reads active rules from chrome.storage.local.  
   * content.js injects CSS and executes JS on the page's DOM.

## **5\. Build and Deployment Process**

* **webpack.config.js**: (To be implemented/used) For bundling, transpiling, and optimizing JavaScript, CSS, and other assets.  
* **build-admin.js**: Node.js script to create the production-ready Admin version (minification, packaging, manifest modifications).  
* **build-user.js**: Node.js script to create the production-ready User version (minification, packaging, manifest modifications, removal of admin-specific features).  
* **release.js**: Orchestrates both build-admin.js and build-user.js, preparing the final .zip files for store submission.  
* **version-bump.js**: Utility for automating version number updates in manifest.json and package.json.  
* **CI/CD Workflows (.github/workflows/)**: Automate testing, building, and deployment to Chrome Web Store and Edge Add-ons.

## **6\. Security Considerations**

* **Manifest V3:** Strict CSP, no remote code execution.  
* **Permissions:** Minimal necessary permissions requested.  
* **Data Isolation:** Content scripts run in isolated worlds.  
* **Authentication:** MSAL handles secure token acquisition and refresh.  
* **Input Sanitization:** Frontend inputs for CSS/JS content should be handled with care to prevent potential vulnerabilities if rules are ever rendered/executed in an insecure context (though browser content script execution is generally safe).

## **7\. Future Enhancements**

* **Content Security Policy (CSP) Refinement:** Further tighten CSP rules.  
* **Error Reporting:** Centralized error logging.  
* **UI Enhancements:** More intuitive UI/UX for rule management.  
* **Code Linting & Formatting:** Enforce consistent code style (e.g., ESLint, Prettier).  
* **Automated Testing:** Expand test coverage for all modules and scenarios.