# **D365 DOM Style Injector \- Admin Version Permissions**

This document outlines the permissions required by the Admin version of the D365 DOM Style Injector extension and provides a justification for each. This information is a summary; for a complete and detailed audit, please refer to the comprehensive [Permissions Audit document](http://docs.google.com/security/permissions-audit.md).

## **Table of Contents**

1. [Overview](#bookmark=id.t9d74kq3frqe)  
2. [Required Browser Permissions](#bookmark=id.5tive6goerzs)  
3. [Microsoft Graph API Permissions](#bookmark=id.4laf312hm6p8)  
4. [Security and Privacy Notes](#bookmark=id.w4a9r79awkwc)

## **1\. Overview**

The Admin version of the D365 DOM Style Injector requires specific browser permissions and access to Microsoft Graph API endpoints to provide its centralized management and synchronization features. These permissions enable the extension to inject custom styles, manipulate the DOM, authenticate with Azure AD, and interact with SharePoint Online.

## **2\. Required Browser Permissions**

These are the permissions requested in the extension's manifest.json file, visible to users during installation:

* **activeTab**: Allows temporary access to the active browser tab when the extension icon is clicked. Used to apply styles and scripts to the currently viewed page.  
* **scripting**: Required by Manifest V3 to programmatically inject CSS and JavaScript into web pages. This is core to the extension's functionality.  
* **storage**: Permits the extension to store data locally within the browser, such as configuration settings and cached rules.  
* **identity**: Necessary for Azure AD authentication, allowing the extension to obtain tokens for Microsoft Graph API calls to SharePoint.  
* **alarms**: Used by the background service worker to schedule periodic synchronization tasks with SharePoint.  
* **Host Permissions (host\_permissions)**:  
  * \*://\*.sharepoint.com/\*: Grants access to all SharePoint Online sites for applying styles and interacting with SharePoint lists.  
  * \*://\*.dynamics.com/\*: Grants access to all Microsoft Dynamics 365 instances for applying styles.  
  * \*://login.microsoftonline.com/\*: Required for Azure AD authentication flows.  
  * https://graph.microsoft.com/\*: Enables direct communication with the Microsoft Graph API for data management (e.g., reading/writing SharePoint list items).

## **3\. Microsoft Graph API Permissions**

Beyond the browser permissions, the Azure AD application registered for this extension (which the extension uses to authenticate) requires specific permissions to interact with Microsoft Graph:

* **Sites.ReadWrite.All**:  
  * **Justification:** Allows the extension to read, create, update, and delete items in all SharePoint site collections that it has access to. This is essential for the CRUD operations on the designated configuration list in SharePoint.  
  * **Alternative (more granular):** Sites.Manage.All could also be used, or potentially more specific site-scoped permissions if the Azure AD application's scope is further restricted.

## **4\. Security and Privacy Notes**

* **Least Privilege:** The permissions requested are carefully chosen to be the minimum necessary for the extension to function.  
* **User Consent:** All permissions are presented to the user during the extension installation process for explicit consent.  
* **No Remote Code:** Adhering to Manifest V3, the extension does not execute any remotely hosted code, reducing the risk of malicious script injection. All logic is self-contained within the extension package.  
* **Data Handling:** The extension primarily manages configuration data (CSS/JS rules, target URLs). Authentication tokens are handled securely by MSAL. No personal user data is collected or transmitted outside the Microsoft 365 ecosystem without explicit user action.

For an in-depth explanation of each permission and its implications, please refer to:  
Permissions Audit Document