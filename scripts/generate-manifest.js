// scripts/generate-manifest.js
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

// This script can be used to generate or modify the manifest.json
// beyond what the build scripts do, e.g., for specific environments
// or feature flags. Currently, build-admin.js and build-user.js
// handle most manifest modifications directly.

async function generateManifest(environment = 'development', isAdmin = false) {
    const baseManifestPath = path.join(__dirname, '../src/manifest.json');
    const configPath = path.join(__dirname, `../config/environments/${environment}.json`);
    const outputPath = isAdmin
        ? path.join(__dirname, '../dist/admin/manifest.json')
        : path.join(__dirname, '../dist/user/manifest.json');

    try {
        if (!await fs.pathExists(baseManifestPath)) {
            throw new Error(`Base manifest not found at ${baseManifestPath}`);
        }
        let manifest = await fs.readJson(baseManifestPath);

        // Load environment-specific configurations
        if (await fs.pathExists(configPath)) {
            const envConfig = await fs.readJson(configPath);
            // Apply environment-specific changes (e.g., API keys, permissions, content_security_policy)
            // This is a placeholder for how you might merge configurations
            if (envConfig.manifestOverrides) {
                manifest = { ...manifest, ...envConfig.manifestOverrides };
            }
        } else {
            console.warn(chalk.yellow(`  Warning: Environment config not found for ${environment}.`));
        }

        // Apply admin/user specific changes (if this script were to be called directly instead of via build scripts)
        // Note: The build-admin.js and build-user.js already handle this directly.
        // This is here for completeness if this utility were used standalone.
        if (isAdmin) {
            manifest.name = "D365 DOM Style Injector (Admin)";
            // ... more admin-specific changes
        } else {
            manifest.name = "D365 DOM Style Injector (User)";
            // ... more user-specific changes
        }

        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeJson(outputPath, manifest, { spaces: 2 });
        console.log(chalk.green(`Generated manifest for ${isAdmin ? 'Admin' : 'User'} in ${environment} environment.`));
        return manifest;
    } catch (error) {
        console.error(chalk.red('❌ Failed to generate manifest:'), error);
        process.exit(1);
    }
}

// Example usage if run directly: node generate-manifest.js production true
if (require.main === module) {
    const env = process.argv[2] || 'development';
    const isAdmin = process.argv[3] === 'true';
    generateManifest(env, isAdmin);
} else {
    module.exports = generateManifest;
}