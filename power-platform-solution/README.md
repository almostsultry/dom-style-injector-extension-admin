# DOM Style Injector Extension - Power Platform Solution

This directory contains the managed Power Platform solution for the DOM Style Injector Extension, which includes Dataverse tables, security roles, and configuration required for enterprise deployment.

## Solution Components

### 1. Dataverse Table: `cr123_domstylecustomizations`
- Stores CSS and JavaScript customizations for D365 DOM manipulation
- Organization-owned entity with full audit capabilities
- Supports hierarchical organization through Business Unit, Team, and Queue relationships

### 2. Security Roles
- **DOM Style Administrator**: Full CRUD permissions for managing customizations
- **DOM Style User**: Read-only access to view customizations

### 3. Views
- Active Customizations (default)
- All Customizations
- Quick Find view for searching

### 4. Forms
- Main form with sections for general info, targeting, and customization code

## Prerequisites

1. **Power Platform CLI**
   ```bash
   npm install -g @microsoft/powerplatform-cli
   ```

2. **Dataverse Environment**
   - System Administrator access to target environment
   - Environment URL (e.g., https://yourorg.crm.dynamics.com)

3. **PowerShell**
   - Version 5.1 or higher
   - Execution policy allowing scripts

## Building the Solution

1. Navigate to the solution directory:
   ```bash
   cd power-platform-solution
   ```

2. Run the build script:
   ```bash
   .\scripts\build-solution.ps1 -Version "1.0.0.0"
   ```

   Optional parameters:
   - `-Version`: Solution version (default: 1.0.0.0)
   - `-Managed`: Build as managed solution (default: true)
   - `-OutputPath`: Output directory (default: ../dist)

3. The solution package will be created in the `dist` directory.

## Deploying the Solution

### Option 1: Using PowerShell Script (Recommended)

1. Run the deployment script:
   ```bash
   .\scripts\deploy-solution.ps1 -EnvironmentUrl "https://yourorg.crm.dynamics.com"
   ```

   Optional parameters:
   - `-SolutionFile`: Path to solution zip (auto-detects latest if not specified)
   - `-ImportAsHolding`: Import as holding solution
   - `-PublishWorkflows`: Publish workflows after import (default: true)
   - `-OverwriteUnmanagedCustomizations`: Overwrite unmanaged customizations (default: true)

### Option 2: Manual Import via Power Platform Admin Center

1. Go to [Power Platform Admin Center](https://admin.powerplatform.microsoft.com)
2. Select your environment
3. Navigate to Solutions
4. Click "Import solution"
5. Upload the solution zip file from `dist` directory
6. Follow the import wizard
7. After import, publish all customizations

### Option 3: Using Power Platform CLI

```bash
# Authenticate
pac auth create --url https://yourorg.crm.dynamics.com

# Import solution
pac solution import --path ".\dist\DOMStyleInjectorExtension_1.0.0.0_Managed.zip"

# Publish customizations
pac solution publish
```

## Post-Deployment Configuration

1. **Assign Security Roles**
   - Navigate to Settings > Security > Users
   - Select users who need access
   - Assign appropriate roles:
     - `DOM Style Administrator` for full access
     - `DOM Style User` for read-only access

2. **Configure Browser Extension**
   Update the extension settings with:
   - Dataverse Environment URL
   - Table Name: `cr123_domstylecustomizations`

3. **Verify Deployment**
   - Check that the table is created
   - Verify security roles are available
   - Test creating a record in the table

## Solution Structure

```
power-platform-solution/
├── solution.xml                    # Solution manifest
├── src/
│   ├── Entities/                   # Entity definitions
│   │   └── cr123_domstylecustomizations/
│   │       └── Entity.xml          # Table schema
│   └── SecurityRoles/              # Security role definitions
│       ├── cr123_domstyleadmin.xml
│       └── cr123_domstyleuser.xml
├── scripts/
│   ├── build-solution.ps1          # Build script
│   └── deploy-solution.ps1         # Deployment script
├── docs/
│   └── dataverse-config.json       # Generated configuration
└── README.md                       # This file
```

## Troubleshooting

### Build Issues
- Ensure Power Platform CLI is installed: `pac --version`
- Check that all XML files are valid
- Verify publisher prefix matches (cr123)

### Deployment Issues
- Verify you have System Administrator role
- Check environment URL is correct
- Ensure no duplicate publisher exists
- Review import logs in Admin Center

### Permission Issues
- Verify security roles are assigned correctly
- Check Business Unit access levels
- Ensure users have basic Dataverse access

## Development Workflow

1. Make changes to Entity.xml or security roles
2. Increment version in build script
3. Build new solution package
4. Deploy to development environment
5. Test thoroughly
6. Deploy to production

## Support

For issues or questions:
- Check the browser extension documentation
- Review Dataverse logs for sync errors
- Contact support with error details and environment information