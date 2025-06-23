# Permissions Audit for D365 DOM Style Injector Extension

This document outlines the permissions requested by the D365 DOM Style Injector extension and provides a justification for each, ensuring transparency and addressing security considerations.

## Manifest V3 Permissions

The extension adheres to Manifest V3 principles, emphasizing explicit host permissions and a service worker background script.

---

### Admin Version Permissions (`src/manifest.json` and `dist/admin/manifest.json`)

The admin version requires a broader set of permissions to enable its full CRUD capabilities for enterprise-wide customization, including Microsoft Graph integration.

* **`activeTab`**:
    * **Justification:** Allows the extension to temporarily access the currently active tab when the user invokes the extension (e.g., by clicking its icon). This is essential for injecting `content.js` and applying styles to the current page. Its temporary nature enhances security by limiting access only when explicitly user-initiated.
* **`scripting`**:
    * **Justification:** Required by Manifest V3 to inject JavaScript (`content.js`) and CSS onto web pages. This is the core functionality for DOM manipulation and style injection on Dynamics 365 and SharePoint sites.
* **`storage`**:
    * **Justification:** Enables the extension to store data locally (e.g., user preferences, cached styles, authentication tokens). This is crucial for persistence across browser sessions and for local fallback if cloud sync is unavailable.
* **`identity`**:
    * **Justification:** Needed for Azure AD authentication, allowing the extension to obtain access tokens for Microsoft Graph API calls. This facilitates secure communication with SharePoint and other Microsoft 365 services for managing style injections.
* **`alarms`**:
    * **Justification:** Potentially used by the background service worker (`background.js`) for scheduling periodic tasks, such as synchronizing style injection data with SharePoint lists or CRM.
* **Host Permissions (`host_permissions`)**:
    * `*://*.sharepoint.com/*`:
        * **Justification:** Grants access to all SharePoint Online sites. This is fundamental for applying custom styles and manipulating the DOM within SharePoint environments and for interacting with SharePoint lists to store/retrieve injection configurations.
    * `*://*.dynamics.com/*`:
        * **Justification:** Grants access to all Microsoft Dynamics 365 instances. This is necessary for customizing the UI and behavior of D365 applications via CSS and DOM manipulation.
    * `*://login.microsoftonline.com/*`:
        * **Justification:** Required for authenticating with Azure Active Directory and obtaining tokens necessary for accessing Microsoft Graph and other Microsoft 365 services.
    * `https://graph.microsoft.com/*`:
        * **Justification:** Allows the extension to make authenticated requests to the Microsoft Graph API. This is vital for CRUD operations on SharePoint lists (e.g., storing CSS rules, managing injection configurations) and potentially for retrieving user/group information relevant to access control.

---

### User Version Permissions (`user-version/manifest.json` and `dist/user/manifest.json`)

The user version has a more restricted set of permissions, focusing purely on applying styles locally, without cloud synchronization or administrative features.

* **`activeTab`**:
    * **Justification:** Same as for the admin version; allows temporary access to the active tab for applying styles.
* **`scripting`**:
    * **Justification:** Required for injecting CSS onto web pages based on the user's local settings.
* **`storage`**:
    * **Justification:** Used to store user-specific custom styles and preferences locally within the browser, as the user version does not sync with cloud services.
* **Host Permissions (`host_permissions`)**:
    * `*://*.sharepoint.com/*`:
        * **Justification:** Grants access to SharePoint Online sites for applying styles configured locally by the user.
    * `*://*.dynamics.com/*`:
        * **Justification:** Grants access to Microsoft Dynamics 365 instances for applying styles configured locally by the user.

---

### Security Considerations and Best Practices

* **Least Privilege:** Permissions are requested only if strictly necessary for the extension's core functionality.
* **User Consent:** All permissions are clearly visible to the user during installation.
* **No Remote Code:** Manifest V3 strictly enforces that no remotely hosted code can be executed, reducing the attack surface. All JavaScript is bundled with the extension.
* **CSP (Content Security Policy):** The extension uses a strict CSP to prevent the execution of malicious scripts and loading of unauthorized resources.
* **Data Handling:** User data (locally stored styles) is handled with care, and no sensitive personal data beyond necessary authentication tokens (for admin version) is processed or stored.

This audit will be reviewed regularly to ensure permissions remain minimal and justified as the extension evolves.