# **SharePoint Setup for D365 DOM Style Injector (Admin Version)**

This document details the necessary setup within your SharePoint Online environment to enable the D365 DOM Style Injector (Admin Version) to store and synchronize custom CSS and DOM manipulation rules. The extension uses a dedicated SharePoint list to manage these configurations centrally.

## **Table of Contents**

1. [Overview](#bookmark=id.af0043c74tfc)  
2. [Prerequisites](#bookmark=id.nfa4dkkph3uo)  
3. [Creating the SharePoint Site](#bookmark=id.x24itqp0m52y)  
4. [Creating the Configuration List](#bookmark=id.b2f92f28sqiw)  
   * [Required Columns](#bookmark=id.cdzpq01roj4)  
   * [Column Types and Settings](#bookmark=id.v2ydv9tzg5iq)  
5. [Granting Permissions](#bookmark=id.nne4iir2q80t)  
6. [Configuring the Extension](#bookmark=id.d54mh4qajs5b)  
7. [Example List Structure](#bookmark=id.ocioxmvel5gu)  
8. [Troubleshooting](#bookmark=id.az2m77evi0zc)

## **1\. Overview**

The Admin version of the extension requires a specific SharePoint list to serve as its backend data store. This list will hold all the defined CSS and JavaScript injection rules, along with their targeting configurations and active status. When admins create or modify rules via the extension, these changes are pushed to this list. The user version of the extension then reads from this same list to apply the rules.

## **2\. Prerequisites**

* **SharePoint Online Admin Access:** You need sufficient permissions to create a site collection (optional, but recommended for a dedicated site) and create lists within SharePoint Online.  
* **Azure AD Application Registration:** The extension relies on an Azure AD application registration configured with appropriate Microsoft Graph API permissions (e.g., Sites.ReadWrite.All or Sites.Manage.All) to interact with SharePoint. This setup is part of the extension's deployment process.

## **3\. Creating the SharePoint Site (Recommended)**

It is highly recommended to create a dedicated SharePoint site collection (e.g., a Communication Site or Team Site) to host the configuration list. This provides a clean separation and allows for precise permission management.

1. Go to the SharePoint admin center or a site where you have site creation privileges.  
2. Create a new site (e.g., "DOM Style Injector Config").  
3. Note down the full URL of this site (e.g., https://yourtenant.sharepoint.com/sites/DomStyleInjectorConfig). You will need this URL when configuring the extension.

## **4\. Creating the Configuration List**

Within the chosen SharePoint site, create a new custom list.

1. Navigate to your designated SharePoint site.  
2. Go to "Site contents" and click "New" \> "List".  
3. Select "Blank list".  
4. Give the list a clear name (e.g., "D365DOMStyleInjections" or "ExtensionRules"). Note this name carefully, as you'll enter it into the extension's settings.  
5. Click "Create".

### **Required Columns**

After creating the blank list, you need to add specific columns (fields) to it. The column names **must match exactly** as specified below, as the extension expects these names for data mapping.

| Column Name | Type | Description |
| :---- | :---- | :---- |
| Title | Single line of text | The unique name or identifier for the injection rule (default SharePoint column). |
| TargetUrl | Single line of text | The URL or regex pattern where the CSS/JS should be applied. |
| CssContent | Multiple lines of text | The CSS code to be injected. |
| JsContent | Multiple lines of text | The JavaScript code (for DOM manipulation) to be executed. |
| IsActive | Yes/No (Checkbox) | Indicates if the injection rule is currently active (Yes) or disabled (No). |

### **Column Types and Settings**

When creating each column, ensure you select the correct type and settings:

1. **Title:** This is a default column in every SharePoint list. No action needed unless you want to rename it (not recommended as the extension expects Title).  
2. **TargetUrl:**  
   * Type: Single line of text  
3. **CssContent:**  
   * Type: Multiple lines of text  
   * Specify the type of text to be Plain text. (Enhanced rich text can cause issues with code.)  
4. **JsContent:**  
   * Type: Multiple lines of text  
   * Specify the type of text to be Plain text.  
5. **IsActive:**  
   * Type: Yes/No (checkbox)  
   * Default value: No (or Yes, depending on your preference for new rules)

## **5\. Granting Permissions**

The Azure AD application associated with your extension must have permissions to read and write to this SharePoint list.

1. **Application Permissions:** Ensure your Azure AD app registration has been granted **Sites.ReadWrite.All** or **Sites.Manage.All** permissions for Microsoft Graph. These are application permissions, which means the extension can act on behalf of itself (daemon app), not a specific user.  
2. **SharePoint Site Permissions (if needed):** If your Azure AD application does not have organization-wide site management permissions, you might need to grant it explicit permissions to the *specific SharePoint site* hosting the list. This usually involves adding the application's service principal to a SharePoint group (e.g., "Contributors" or "Owners") on that site.

## **6\. Configuring the Extension**

Once the SharePoint site and list are set up, configure the Admin extension:

1. Open the D365 DOM Style Injector (Admin) extension.  
2. Navigate to the "Settings" or "Configuration" section.  
3. Enter the exact SharePoint **Site URL** (e.g., https://yourtenant.sharepoint.com/sites/DomStyleInjectorConfig).  
4. Enter the exact **List Name** (e.g., D365DOMStyleInjections).  
5. Save the configuration. The extension should now be able to communicate with your SharePoint list.

## **7\. Example List Structure**

When you view the SharePoint list, it should look something like this after you've added a few injections from the extension:

| Title | TargetUrl | CssContent | JsContent | IsActive |
| :---- | :---- | :---- | :---- | :---- |
| D365 Red Header | https://\*.dynamics.com/\* | .header { color: red; } | // No JS for this | Yes |
| SP Hide Announcements | https://\*.sharepoint.com/sites/HR/\* | .announcements { display: none; } | // Custom JS here | No |
| CRM Form Field Adjust | regex:.\*form\\.aspx.\* | input { border: 1px solid blue; } | document.getElementById('myfield').value \= 'default'; | Yes |

## **8\. Troubleshooting**

* **"List not found" or "Access denied" errors:**  
  * Double-check the SharePoint Site URL and List Name for typos in the extension settings.  
  * Verify the Azure AD application has Sites.ReadWrite.All or Sites.Manage.All Graph permissions.  
  * Ensure the application's service principal has explicit permissions on the SharePoint site if necessary.  
* **Data not saving/loading correctly:**  
  * Confirm that all required columns (Title, TargetUrl, CssContent, JsContent, IsActive) exist in the SharePoint list with the exact names and correct types.  
  * Check the browser's developer console for any specific API errors during synchronization attempts.