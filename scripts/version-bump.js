// scripts/version-bump.js
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

async function bumpVersion(type = 'patch') {
    const manifestPath = path.join(__dirname, '../src/manifest.json');
    const packagePath = path.join(__dirname, '../package.json');

    try {
        // Read manifest.json
        const manifest = await fs.readJson(manifestPath);
        let currentVersion = manifest.version;
        console.log(chalk.blue(`Current version: ${currentVersion}`));

        // Parse version and bump
        let [major, minor, patch] = currentVersion.split('.').map(Number);

        switch (type) {
            case 'major':
                major += 1;
                minor = 0;
                patch = 0;
                break;
            case 'minor':
                minor += 1;
                patch = 0;
                break;
            case 'patch':
            default:
                patch += 1;
                break;
        }

        const newVersion = `${major}.${minor}.${patch}`;
        manifest.version = newVersion;

        // Write updated manifest.json
        await fs.writeJson(manifestPath, manifest, { spaces: 2 });
        console.log(chalk.green(`Updated src/manifest.json to v${newVersion}`));

        // Update package.json
        if (await fs.pathExists(packagePath)) {
            const packageJson = await fs.readJson(packagePath);
            packageJson.version = newVersion;
            await fs.writeJson(packagePath, packageJson, { spaces: 2 });
            console.log(chalk.green(`Updated package.json to v${newVersion}`));
        } else {
            console.warn(chalk.yellow('  Warning: package.json not found. Skipping version update there.'));
        }

        console.log(chalk.green(`\nVersion bumped successfully to ${newVersion}`));
        return newVersion;
    } catch (error) {
        console.error(chalk.red('❌ Failed to bump version:'), error);
        process.exit(1);
    }
}

// Allow calling from command line, e.g., 'node version-bump.js minor'
if (require.main === module) {
    const versionType = process.argv[2] || 'patch';
    if (!['major', 'minor', 'patch'].includes(versionType)) {
        console.error(chalk.red('Invalid version type. Use "major", "minor", or "patch".'));
        process.exit(1);
    }
    bumpVersion(versionType);
} else {
    module.exports = bumpVersion;
}