# **D365 DOM Style Injector \- Admin Version Usage Guide**

This guide provides instructions on how to use the Admin version of the D365 DOM Style Injector extension to manage and deploy custom CSS and DOM manipulations across your enterprise environments, specifically for Microsoft Dynamics 365 and SharePoint Online.

## **Table of Contents**

1. [Overview](#bookmark=id.6v3b6e27sc0x)  
2. [Installation](#bookmark=id.hodnn0wuaqpw)  
3. [Authentication and Configuration](#bookmark=id.uldarkh5mm30)  
4. [Managing Style Injections](#bookmark=id.m3myr2d3n2d0)  
   * [Creating a New Injection](#bookmark=id.janfcpdp7a08)  
   * [Editing Existing Injections](#bookmark=id.k3ibgdjkypr8)  
   * [Deleting Injections](#bookmark=id.u13gozo9yqtu)  
   * [Enabling/Disabling Injections](#bookmark=id.m0lygdavp3uq)  
5. [Targeting Specific Environments](#bookmark=id.2fubw3gdlg0e)  
   * [Matching](#bookmark=id.582hcgt5f8s4)  
   * [Site/Domain Specificity](#bookmark=id.9ffuv67i5p78)  
6. [Synchronization with SharePoint](#bookmark=id.10bum4ki6ot3)  
7. [Troubleshooting](#bookmark=id.66ki6avw4o1q)

## **1\. Overview**

The Admin version of the D365 DOM Style Injector extension offers advanced capabilities for centralized management of UI customizations. It integrates with Microsoft Graph to store and synchronize injection rules in a designated SharePoint list, allowing for consistent deployment across all users of the extension within your organization.

## **2\. Installation**

(Refer to docs/admin/installation.md for detailed installation steps, including sideloading and enterprise deployment via Group Policy or Intune.)

## **3\. Authentication and Configuration**

Before using the admin features, you must authenticate with your Azure AD account and configure the extension to connect to your SharePoint environment.

1. **Azure AD Login:** Click on the extension icon in your browser toolbar. You will be prompted to sign in with your organizational Microsoft account. This grants the extension necessary permissions to interact with Microsoft Graph.  
2. **SharePoint Site Configuration:**  
   * Navigate to the "Settings" tab in the extension popup.  
   * Enter the URL of the SharePoint site collection where the injection configuration list will reside (e.g., https://yourtenant.sharepoint.com/sites/YourAdminSite).  
   * Specify the name of the SharePoint list (e.g., "DOMStyleInjections"). This list must be created manually with specific columns. (See [SharePoint Setup](http://docs.google.com/sharepoint-setup.md) for details).  
   * Click "Save Configuration." The extension will attempt to verify access to the specified list.

## **4\. Managing Style Injections**

The main interface of the Admin extension allows you to create, edit, and manage your DOM style injection rules.

* **Accessing the Admin Panel:** After authentication, click the extension icon. The default view will show a list of current injections.

### **Creating a New Injection**

1. Click the "New Injection" button.  
2. **Name:** Provide a descriptive name for your injection (e.g., "D365 Header Color Change").  
3. **Target URL/Regex:** Define the URLs where this injection should apply. You can use wildcards (\*) or regular expressions for flexible matching.  
   * Examples:  
     * https://\*.dynamics.com/\* (All D365 instances)  
     * https://yourtenant.sharepoint.com/sites/Sales/\* (Specific SharePoint subsite)  
     * https://yourtenant.sharepoint.com/sites/Marketing/Lists/Announcements/NewForm.aspx (Specific SharePoint form)  
4. **CSS Content:** Enter the CSS rules you want to inject.  
   /\* Example: Change D365 command bar color \*/  
   .ms-CommandBar {  
       background-color: \#f0f0f0 \!important;  
   }

5. **JavaScript Content (DOM Manipulation):** Enter JavaScript code for more complex DOM manipulations. This script will run after the CSS is applied.  
   // Example: Hide a specific D365 button  
   document.querySelector('\[data-id="newButton"\]').style.display \= 'none';

6. **Active:** Toggle this switch to immediately enable or disable the injection upon save.  
7. Click "Save." The new injection will be added to the list and synchronized.

### **Editing Existing Injections**

1. From the main list, click the "Edit" icon next to the injection you wish to modify.  
2. Make your changes in the form.  
3. Click "Save." Changes will be synchronized.

### **Deleting Injections**

1. From the main list, click the "Delete" icon next to the injection you wish to remove.  
2. Confirm the deletion. The injection will be removed from the list and from the SharePoint configuration.

### **Enabling/Disabling Injections**

1. Each injection in the list has an "Active" toggle.  
2. Flip the toggle to enable or disable the injection without deleting it. This change will also synchronize to SharePoint.

## **5\. Targeting Specific Environments**

Effective use of the extension relies on precise targeting.

### **URL Matching**

The "Target URL/Regex" field supports flexible matching:

* **Exact Match:** https://example.com/page.html  
* **Wildcard:** https://\*.example.com/\* (matches all subdomains and paths)  
* **Protocol Wildcard:** \*://example.com/\* (matches http and https)  
* **Regular Expressions:** For advanced patterns, prefix your entry with regex: (e.g., regex:https:\\/\\/.\*\\.sharepoint\\.com\\/sites\\/(Sales|Marketing)\\/.\*).

### **Site/Domain Specificity**

Ensure your target URLs are specific enough to avoid unintended consequences. Test thoroughly in development environments before deploying widely.

## **6\. Synchronization with SharePoint**

The Admin version automatically synchronizes all injection rules with a designated SharePoint list.

* **How it Works:** When you save, edit, or delete an injection, the extension updates the corresponding item in the SharePoint list.  
* **User Version Sync:** The User version of the extension reads from this same SharePoint list, ensuring that all users within your organization receive the centrally managed injections. This process is typically handled by the background service worker.  
* **Offline Mode:** If SharePoint is unreachable, the extension will use the last successfully synced configuration. Changes made offline will be synced once connectivity is restored.

## **7\. Troubleshooting**

* **Injections not applying:**  
  * Check if the "Active" toggle is on for the injection.  
  * Verify the "Target URL/Regex" is correct and matches the current page.  
  * Ensure there are no syntax errors in your CSS or JavaScript.  
  * Check the browser's developer console for any errors related to content scripts or CSP violations.  
  * Verify your SharePoint configuration settings are correct.  
* **SharePoint Sync Issues:**  
  * Ensure your Azure AD authentication is still active.  
  * Verify the SharePoint site URL and list name are correct.  
  * Check the browser's developer console for network errors during sync.  
  * Ensure the SharePoint list has the correct column names and types as required by the extension. (See [SharePoint Setup](http://docs.google.com/sharepoint-setup.md)).