# **Testing Guide for D365 DOM Style Injector Extension**

This guide outlines the testing strategy for the D365 DOM Style Injector Extension. Comprehensive testing is crucial to ensure the quality, reliability, and security of the extension across different browsers and complex enterprise environments.

## **Table of Contents**

1. [Overview](#bookmark=id.l33jzr65pkfb)  
2. [Testing Pyramid](#bookmark=id.83uj4z3vf5v4)  
   * [Unit Tests](#bookmark=id.2zc6r9urp2m)  
   * [Integration Tests](#bookmark=id.5netk9qcgk27)  
   * [End-to-End (E2E) Tests](#bookmark=id.atb0oo8w0cv)  
3. [Setting Up the Testing Environment](#bookmark=id.ybj1ccu65hol)  
   * [Prerequisites](#bookmark=id.p7jufmiqb7qq)  
   * [Running Tests](#bookmark=id.vzkbqocj59my)  
4. [Writing Tests](#bookmark=id.s6uwijw6dsyb)  
   * [Best Practices](#bookmark=id.5az0xslp756w)  
   * [Mocking and Stubbing](#bookmark=id.m477ziao0guw)  
   * [Test Data Fixtures](#bookmark=id.k20aokqi7pa5)  
5. [Continuous Integration (CI)](#bookmark=id.k35wi0dw3nmq)  
6. [Security Testing](#bookmark=id.d0nawmev448c)  
7. [Browser Compatibility Testing](#bookmark=id.gl34b7go20qa)  
8. [Performance Testing](#bookmark=id.g3xkts8ljfow)

## **1\. Overview**

The testing strategy for this extension incorporates a multi-layered approach, covering different scopes of functionality from isolated components to full system interactions in a real browser environment. This ensures that features work as intended, regressions are caught early, and the extension remains stable.

## **2\. Testing Pyramid**

We follow a testing pyramid approach, with a large base of fast, isolated unit tests, a smaller layer of integration tests, and a small number of comprehensive end-to-end tests.

### **Unit Tests**

* **Purpose:** To verify the correctness of individual functions, methods, or small modules in isolation. They are fast, deterministic, and easy to debug.  
* **Scope:** Focus on specific pieces of business logic without external dependencies (e.g., authentication logic, string manipulation, rule parsing).  
* **Location:** tests/unit/  
* **Frameworks/Libraries:** Jest (or similar JavaScript testing framework).  
* **Execution:** npm run test:unit

### **Integration Tests**

* **Purpose:** To verify that different modules or services work correctly together. This involves testing interactions between components (e.g., auth-service.js with msal-browser.min.js, or sync-manager.js with sharepoint-service.js).  
* **Scope:** Focus on the interfaces and data flow between connected parts of the system. May involve mocking external APIs (like Microsoft Graph) or file system operations.  
* **Location:** tests/integration/  
* **Frameworks/Libraries:** Jest (or similar). Potentially nock for HTTP mocking.  
* **Execution:** npm run test:integration

### **End-to-End (E2E) Tests**

* **Purpose:** To simulate real user scenarios by interacting with the entire extension installed in a live browser instance. These tests verify the complete user flow, from loading the extension to applying styles on targeted web pages.  
* **Scope:** Covers the full stack, including browser API interactions, content script injection, UI interactions, and potentially actual network calls (e.g., to D365/SharePoint test environments).  
* **Location:** tests/e2e/  
* **Frameworks/Libraries:** Playwright (recommended for browser automation) or Cypress.  
* **Execution:** npm run test:e2e

## **3\. Setting Up the Testing Environment**

### **Prerequisites**

* Node.js and npm/Yarn (as per Contributing.md).  
* Browser binaries (Chrome/Edge) for E2E testing (Playwright will often manage these).  
* For integration tests involving external services (like SharePoint/Graph), consider using a dedicated test tenant or mocking HTTP requests.  
* tests/fixtures/test-data.json: A file containing mock data for various testing scenarios.

### **Running Tests**

Ensure all dependencies are installed (npm install).

* **Run all tests:** npm test  
* **Run unit tests only:** npm run test:unit  
* **Run integration tests only:** npm run test:integration  
* **Run E2E tests only:** npm run test:e2e

## **4\. Writing Tests**

### **Best Practices**

* **Clear Naming:** Test files and descriptions should clearly indicate what is being tested.  
* **Arrange-Act-Assert (AAA):** Structure your tests into three phases:  
  * **Arrange:** Set up the test environment and data.  
  * **Act:** Perform the action being tested.  
  * **Assert:** Verify the outcome.  
* **Single Responsibility Principle:** Each test should ideally verify one specific behavior.  
* **Readability:** Write clean, understandable code.  
* **Idempotency:** Tests should be repeatable and not depend on the order of execution.

### **Mocking and Stubbing**

* **Unit Tests:** Heavily use Jest's mocking capabilities to isolate the code under test from its dependencies (e.g., chrome.storage, fetch, external modules).  
* **Integration Tests:** May mock external API calls (e.g., using nock or a custom mock server) to ensure tests are fast and reliable without requiring live external services.

### **Test Data Fixtures**

Store reusable test data in tests/fixtures/test-data.json or similar files. This ensures consistency and makes tests easier to manage.

{  
  "sampleInjectionRule": {  
    "Title": "Test Rule 1",  
    "TargetUrl": "https://example.com/\*",  
    "CssContent": "body { background-color: \#f0f0f0; }",  
    "JsContent": "console.log('Test JS executed');",  
    "IsActive": true  
  },  
  "mockSharePointResponse": {  
    "value": \[  
      {  
        "id": "1",  
        "Title": "SP Rule 1",  
        "TargetUrl": "https://\*.sharepoint.com/\*",  
        "CssContent": ".ms-CommandBar { border: 1px solid red; }",  
        "JsContent": "",  
        "IsActive": true  
      }  
    \]  
  }  
}

## **5\. Continuous Integration (CI)**

The project will integrate testing into its CI pipeline (.github/workflows/ci.yml). Every pull request and push to main should automatically trigger the test suite, ensuring that new code doesn't break existing functionality.

## **6\. Security Testing**

* **Automated Scans:** Leverage tools configured in security/vulnerability-scan-config.yml for dependency vulnerability scanning (Snyk, Dependabot) and static analysis (ESLint security plugins).  
* **Manual Review:** Regular code reviews focusing on security best practices, especially concerning chrome.\* API usage, data handling, and external communication.  
* **Permissions Audit:** Continuously review and justify all requested permissions (docs/admin/permissions.md, security/permissions-audit.md).

## **7\. Browser Compatibility Testing**

While E2E tests can run on different browsers, manual testing on various versions of Chrome and Edge is crucial to catch browser-specific quirks.

## **8\. Performance Testing**

Monitor the extension's impact on browser performance:

* **Memory Usage:** Ensure the extension doesn't cause excessive memory leaks.  
* **CPU Usage:** Avoid computationally intensive operations in critical paths (e.g., content scripts).  
* **Load Times:** Minimize the impact on page load times, especially for content scripts.