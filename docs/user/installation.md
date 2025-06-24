# **D365 DOM Style Injector \- User Version Installation Guide**

This guide provides instructions on how to install the User version of the D365 DOM Style Injector extension. This version is designed to automatically apply CSS and DOM manipulation rules pushed centrally by administrators.

## **Table of Contents**

1. [Overview](#bookmark=id.5elm83t5t2hb)  
2. [Prerequisites](#bookmark=id.flowh31nkz4g)  
3. [Installation Methods](#bookmark=id.2gjo7p6ao0t1)  
   * [Via Chrome Web Store / Edge Add-ons (Recommended)](#bookmark=id.o1gq6f484xlq)  
   * [Sideloading (For Testing or Manual Deployment)](#bookmark=id.xb5vae8vhot1)  
   * [Enterprise Deployment (For IT Administrators)](#bookmark=id.3ndrjxs6fkbp)  
4. [Verifying Installation](#bookmark=id.bifdtz4t5vqp)  
5. [Troubleshooting](#bookmark=id.800lqujfmed7)

## **1\. Overview**

The User version of the D365 DOM Style Injector extension is a lightweight tool that passively receives and applies visual customizations (CSS) and DOM manipulations to Microsoft Dynamics 365 and SharePoint Online sites. These rules are managed and deployed by your organization's administrators.

## **2\. Prerequisites**

* **Supported Browser:** Google Chrome or Microsoft Edge (latest stable version recommended).  
* **Internet Connection:** Required for initial installation and periodic synchronization with administrator-defined rules.

## **3\. Installation Methods**

### **Via Chrome Web Store / Edge Add-ons (Recommended)**

This is the easiest and most secure method for installing the extension, as it will be listed in the official browser stores.

1. **For Chrome:**  
   * Open your Chrome browser.  
   * Go to the [Chrome Web Store](https://chrome.google.com/webstore/category/extensions).  
   * Search for "D365 DOM Style Injector" (User version).  
   * Click "Add to Chrome".  
   * A dialog will appear asking for permissions. Review them and click "Add extension".  
2. **For Edge:**  
   * Open your Edge browser.  
   * Go to the [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/Microsoft-Edge-Extensions-Home) store.  
   * Search for "D365 DOM Style Injector" (User version).  
   * Click "Get".  
   * A dialog will appear asking for permissions. Review them and click "Add extension".

### **Sideloading (For Testing or Manual Deployment)**

This method is typically used by developers or for testing purposes before official store submission.

1. **Download the Extension Package:** Obtain the .zip file for the User version of the extension from your administrator or development team. Unzip this file to a memorable location on your computer (e.g., C:\\Extensions\\D365InjectorUser).  
2. **Open Extension Management:**  
   * **For Chrome:** Type chrome://extensions in your address bar and press Enter.  
   * **For Edge:** Type edge://extensions in your address bar and press Enter.  
3. **Enable Developer Mode:** In the top right corner of the Extensions page, toggle on "Developer mode".  
4. **Load Unpacked:** Click the "Load unpacked" button that appears.  
5. **Select Extension Directory:** Navigate to the folder where you unzipped the extension package (e.g., C:\\Extensions\\D365InjectorUser) and click "Select Folder".  
6. The extension should now appear in your list of installed extensions.

### **Enterprise Deployment (For IT Administrators)**

For large-scale deployments across an organization, IT administrators can deploy the extension using group policies (GPO) for Active Directory environments or Microsoft Intune for cloud-managed devices.

* **Chrome:** [Force install extensions \- Chrome Enterprise and Education Help](https://support.google.com/chrome/a/answer/188453?hl=en)  
* **Edge:** [Force install extensions using Microsoft Intune \- Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies#extensioninstallforcelist)

Your IT department will handle this process, and users typically don't need to take any manual steps.

## **4\. Verifying Installation**

After installation, you should see a new icon in your browser's toolbar.

* **Extension Icon:** Look for the D365 DOM Style Injector icon (it will not have the 'admin' badge) near your address bar. If it's hidden, click the puzzle piece icon (Extensions menu) and pin it to the toolbar.  
* **Check Functionality:** Navigate to a Microsoft Dynamics 365 or SharePoint Online site. If your administrators have deployed active style injections, you should see the intended visual changes on the page. The user version has no active UI for managing rules; it simply applies them.

## **5\. Troubleshooting**

* **Extension icon not visible:**  
  * Ensure the extension is enabled in chrome://extensions or edge://extensions.  
  * Check if it's hidden in the extensions menu.  
* **Styles not applying:**  
  * Ensure you are on a D365 or SharePoint site that is targeted by the administrator's rules.  
  * Your administrator might not have deployed any active rules yet, or they might be targeting different URLs. Contact your administrator for confirmation.  
  * Occasionally, refreshing the page or restarting your browser can resolve minor issues.