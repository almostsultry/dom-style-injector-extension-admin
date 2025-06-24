# **D365 DOM Style Injector \- User Version Usage Guide**

This guide explains how to interact with and understand the behavior of the D365 DOM Style Injector (User Version) extension. This version operates largely in the background, automatically applying visual customizations to Microsoft Dynamics 365 and SharePoint Online sites as defined by your organization's administrators.

## **Table of Contents**

1. [Overview](#bookmark=id.3b7decqcnm6a)  
2. [How it Works](#bookmark=id.e7jmo7s7ovfl)  
3. [Interacting with the Extension (Minimal UI)](#bookmark=id.p9qanbjjvudq)  
4. [What to Expect](#bookmark=id.6i3xczaniczk)  
5. [Troubleshooting (User-Specific)](#bookmark=id.rfb6b7opn6uc)

## **1\. Overview**

The D365 DOM Style Injector (User Version) is a "set it and forget it" extension. Once installed, it works silently in the background, listening for instructions from your organization's administrators. It applies these instructions to modify the appearance and behavior of Dynamics 365 and SharePoint Online web pages. You will generally not need to interact with it directly.

## **2\. How it Works**

1. **Administrator Configuration:** Your organization's administrators use the Admin version of this extension to create, update, and manage a set of CSS and JavaScript rules. These rules are stored centrally, typically in a SharePoint list.  
2. **Background Synchronization:** The User version of the extension periodically checks this central configuration for updates. When new rules or changes are detected, it downloads and stores them locally in your browser.  
3. **Automatic Application:** When you navigate to a Dynamics 365 or SharePoint Online page that matches one of the administrator-defined target URLs, the extension automatically injects the corresponding CSS and/or executes the JavaScript to apply the defined customizations.

## **3\. Interacting with the Extension (Minimal UI)**

The User version of the extension has a very minimal user interface.

* **Extension Icon:** You will see the extension's icon in your browser toolbar.  
  * Clicking this icon will likely open a simple popup, which may display basic information (e.g., the extension's name, version, and a message indicating it's active and managed by your organization). It does **not** provide options to create or modify rules.  
* **No Configuration Needed:** You do not need to configure any settings or log in to any accounts for the User version to function. All necessary configuration and rule management are handled by your administrators.

## **4\. What to Expect**

* **Visual Changes:** You might notice changes in colors, fonts, layouts, or the visibility of certain elements on D365 and SharePoint pages, as defined by your organization.  
* **Functional Adjustments:** In some cases, minor behavioral changes (e.g., pre-filling fields, hiding buttons) might occur due to JavaScript injections.  
* **Seamless Operation:** The extension is designed to run efficiently and should not noticeably impact your browser's performance.

## **5\. Troubleshooting (User-Specific)**

If you believe the extension is not working as expected, or if you encounter issues, consider the following:

* **Are you on a targeted site?** The customizations only apply to specific D365 or SharePoint URLs defined by your administrators.  
* **Refresh the page:** Sometimes a simple page refresh (F5 or Ctrl+R) can re-trigger the extension to apply the styles.  
* **Restart your browser:** Fully closing and reopening your browser can resolve temporary glitches.  
* **Check extension status:**  
  * **For Chrome:** Go to chrome://extensions in your address bar.  
  * **For Edge:** Go to edge://extensions in your address bar.  
  * Ensure "D365 DOM Style Injector" is listed and is toggled "On".  
* **Contact your IT Administrator:**  
  * If styles are missing or incorrect, or if you experience unexpected behavior, the most effective step is to contact your organization's IT support or the administrator responsible for deploying this extension. They can verify the deployed rules and investigate any issues with the central configuration.  
  * Provide them with details such as the specific URL, the expected behavior, and the actual behavior.