# **Contributing to D365 DOM Style Injector Extension**

We welcome contributions to the D365 DOM Style Injector Extension project\! Whether it's reporting a bug, suggesting a new feature, or submitting code, your help is invaluable. This document outlines the guidelines for contributing to ensure a smooth and collaborative development process.

## **Table of Contents**

1. [Code of Conduct](#bookmark=id.xol548br3gmc)  
2. [How to Contribute](#bookmark=id.u1n4oawsc8zs)  
   * [Bug Reports](#bookmark=id.o9xp36in4o4w)  
   * [Feature Requests](#bookmark=id.5cfcoyqyyeje)  
   * [Code Contributions](#bookmark=id.qjeuw43n17j8)  
3. [Development Setup](#bookmark=id.e55lge5mxb1i)  
   * [Prerequisites](#bookmark=id.fep9duso0ab)  
   * [Cloning the Repository](#bookmark=id.80tes338xi5k)  
   * [Installing Dependencies](#bookmark=id.h4yuvfey4ryo)  
   * [Running the Build](#bookmark=id.dwkqm3z9youh)  
   * [Loading the Extension in Browser](#bookmark=id.l3ecm7y7yrbe)  
4. [Coding Guidelines](#bookmark=id.q5sv5g82tnh8)  
   * [JavaScript](#bookmark=id.vpmbu6cv7fw3)  
   * [CSS](#bookmark=id.yrc0apyttnn7)  
   * [HTML](#bookmark=id.vbrokxnnp3t5)  
   * [Commit Messages](#bookmark=id.1l6zphtxx0vk)  
5. [Testing](#bookmark=id.shst0wt6a4fe)  
   * [Unit Tests](#bookmark=id.pyrughq3qi08)  
   * [Integration Tests](#bookmark=id.c8adnba4tlo6)  
   * [End-to-End Tests](#bookmark=id.p4ygdjdrpxoo)  
6. [Pull Request Process](#bookmark=id.c3s708qqxqg0)  
7. [License](#bookmark=id.9mmk82oqc5o0)

## **1\. Code of Conduct**

Please note that this project is released with a [Contributor Code of Conduct](http://docs.google.com/CODE_OF_CONDUCT.md). By participating in this project, you agree to abide by its terms.

## **2\. How to Contribute**

### **Bug Reports**

If you find a bug, please open an issue on GitHub using the [Bug Report template](http://docs.google.com/.github/ISSUE_TEMPLATE/bug_report.md). Provide as much detail as possible, including:

* A clear and concise description of the bug.  
* Steps to reproduce the behavior.  
* Expected behavior.  
* Screenshots or videos (if applicable).  
* Your browser version (Chrome/Edge) and extension version.  
* Any relevant error messages from the browser's developer console.

### **Feature Requests**

Have an idea for a new feature or improvement? Open an issue on GitHub using the [Feature Request template](http://docs.google.com/.github/ISSUE_TEMPLATE/feature_request.md). Describe:

* The problem you're trying to solve.  
* A clear description of the requested feature.  
* Any potential use cases or benefits.

### **Code Contributions**

We welcome pull requests for bug fixes, new features, and improvements. Please follow the guidelines below.

## **3\. Development Setup**

### **Prerequisites**

* Node.js (LTS version recommended)  
* npm (comes with Node.js) or Yarn  
* A code editor (e.g., VS Code)

### **Cloning the Repository**

git clone https://github.com/almostsultry/dom-style-injector-extension-admin.git  
cd dom-style-injector-extension-admin

### **Installing Dependencies**

npm install  
\# or  
yarn install

### **Running the Build**

To build both admin and user versions for development:

npm run build:dev \# This will likely be a script that runs build-admin.js and build-user.js without minification  
\# or to build for production:  
npm run build:prod \# This will run release.js

You can also run individual builds:

node build/build-admin.js \# for admin version  
node build/build-user.js  \# for user version

### **Loading the Extension in Browser**

After building, you can load the unpacked extension into your browser.

1. **For Chrome:**  
   * Open Chrome and navigate to chrome://extensions.  
   * Toggle on "Developer mode" in the top right.  
   * Click "Load unpacked".  
   * Select the dist/admin folder (for the admin version) or dist/user folder (for the user version).  
2. **For Edge:**  
   * Open Edge and navigate to edge://extensions.  
   * Toggle on "Developer mode".  
   * Click "Load unpacked".  
   * Select the dist/admin or dist/user folder.

The extension should now appear in your browser, and you can test your changes.

## **4\. Coding Guidelines**

Please adhere to the existing coding style and conventions found in the codebase.

### **JavaScript**

* Follow ES6+ syntax.  
* Use const and let over var.  
* Prefer async/await for asynchronous operations.  
* Use JSDoc comments for functions, classes, and complex logic.  
* Ensure proper error handling with try...catch blocks.  
* Stick to the file structure defined in the src/ directory.

### **CSS**

* Follow BEM (Block Element Modifier) or a similar modular CSS methodology for larger components.  
* Keep CSS organized and readable.  
* Prefer rem or em for font sizes and responsive layouts where appropriate.

### **HTML**

* Use semantic HTML5 elements.  
* Maintain a clean and accessible structure.

### **Commit Messages**

Follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for commit messages. This helps with automatic changelog generation.

Examples:

* feat: add new SharePoint sync feature  
* fix(auth): resolve token refresh issue  
* docs: update admin usage guide  
* chore(deps): upgrade fs-extra to 10.0.0

## **5\. Testing**

The project includes unit, integration, and end-to-end tests. Please ensure your changes are covered by tests.

### **Unit Tests**

Located in tests/unit/. These test individual functions and components in isolation.  
To run: npm run test:unit

### **Integration Tests**

Located in tests/integration/. These test the interaction between different modules (e.g., authentication flow, SharePoint service).  
To run: npm run test:integration

### **End-to-End Tests**

Located in tests/e2e/. These simulate user interactions with the browser extension in a real browser environment.  
To run: npm run test:e2e

## **6\. Pull Request Process**

1. Fork the repository and create your branch from main.  
2. Make your changes, adhering to coding guidelines.  
3. Add or update tests as appropriate.  
4. Ensure all tests pass.  
5. Write clear and concise commit messages.  
6. Open a pull request to the main branch of the upstream repository.  
7. Fill out the [Pull Request Template](http://docs.google.com/.github/PULL_REQUEST_TEMPLATE.md) completely.  
8. Your PR will be reviewed by a maintainer. Be prepared for feedback and potential requests for changes.

## **7\. License**

By contributing, you agree that your contributions will be licensed under the MIT License.