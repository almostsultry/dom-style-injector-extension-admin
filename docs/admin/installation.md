# Admin Installation Guide

This guide covers the installation and initial setup of the DOM Style Injector Extension - Admin Version.

## Prerequisites

### System Requirements

- **Chrome 88+** or **Edge 88+** with Manifest V3 support
- **Microsoft 365 Enterprise** account with admin privileges
- **SharePoint site** with appropriate permissions
- **Azure AD app registration** for Microsoft Graph API access

### Required Permissions

- **SharePoint**: `Sites.ReadWrite.All` or `Sites.Selected`
- **Microsoft Graph**: `User.Read`, `Sites.ReadWrite.All`
- **Azure AD**: Application registration with API permissions

## Installation Methods

### Method 1: Development Installation

For testing and development environments:

1. **Clone the repository**:

   ```bash
   git clone https://github.com/your-org/dom-style-injector-extension-admin.git
   cd dom-style-injector-extension-admin
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Build the admin version**:

   ```bash
   npm run build:admin:chrome
   ```

4. **Load in Chrome/Edge**:
   - Open `chrome://extensions/` or `edge://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/admin/chrome` folder

### Method 2: Production Installation

For enterprise deployment:

1. **Download the latest release** from GitHub Releases
2. **Extract the admin extension** package
3. **Deploy via Group Policy** (recommended for enterprise)
4. **Or install via Chrome Web Store** (when available)

## Azure AD App Registration

### Step 1: Create App Registration

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: "DOM Style Injector Admin"
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: `chrome-extension://[extension-id]/popup.html`

### Step 2: Configure API Permissions

Add the following Microsoft Graph permissions:

**Delegated Permissions**:

- `User.Read`
- `Sites.ReadWrite.All`

**Application Permissions** (optional for advanced scenarios):

- `Sites.ReadWrite.All`

### Step 3: Authentication Configuration

1. Go to **Authentication** section
2. Add **Web** platform with redirect URI:

   ```chrome-extension://[extension-id]/popup.html
   ```

3. Enable **Access tokens** and **ID tokens**
4. Configure **Logout URL**: `chrome-extension://[extension-id]/popup.html`

### Step 4: Generate Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Set expiration (recommended: 24 months)
4. **Copy the secret value** immediately

## SharePoint Site Setup

### Step 1: Create SharePoint Site

1. Navigate to SharePoint Admin Center
2. Create new site or use existing site
3. Recommended URL structure:

   ```https://yourtenant.sharepoint.com/sites/dom-style-customizations
   ```

### Step 2: Configure Permissions

Set up security
