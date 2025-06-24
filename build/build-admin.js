// build/build-admin.js
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const chalk = require('chalk');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

const SRC_DIR = path.join(__dirname, '../src');
const DIST_DIR = path.join(__dirname, '../dist/admin');

async function build() {
    console.log(chalk.blue('🔨 Building Admin Version...'));

    try {
        // Clean dist directory
        await fs.emptyDir(DIST_DIR);
        console.log(chalk.green('✓ Cleaned dist directory'));

        // Copy static files
        await copyStaticFiles();

        // Process and minify JavaScript files
        await processJavaScriptFiles();

        // Process and minify CSS files
        await processCSSFiles();

        // Process HTML files
        await processHTMLFiles();

        // Generate manifest with version bump
        await generateManifest();

        // Create ZIP for distribution
        await createZipArchive();

        console.log(chalk.green('\n✅ Admin build completed successfully!'));
        console.log(chalk.cyan(`📁 Output: ${DIST_DIR}`));
    } catch (error) {
        console.error(chalk.red('❌ Build failed:'), error);
        process.exit(1);
    }
}

async function copyStaticFiles() {
    const staticFiles = [
        'icons',
        'lib/msal-browser.min.js'
    ];

    for (const file of staticFiles) {
        const srcPath = path.join(SRC_DIR, file);
        const destPath = path.join(DIST_DIR, file);

        if (await fs.pathExists(srcPath)) {
            await fs.copy(srcPath, destPath);
            console.log(chalk.gray(`  Copied ${file}`));
        }
    }
}

async function processJavaScriptFiles() {
    const jsFiles = [
        'popup.js',
        'content.js',
        'background.js',
        'auth/msal-config.js',
        'auth/auth-service.js',
        'sync/sharepoint-service.js',
        'sync/sync-manager.js'
    ];

    for (const file of jsFiles) {
        const srcPath = path.join(SRC_DIR, file);
        const destPath = path.join(DIST_DIR, file);

        if (await fs.pathExists(srcPath)) {
            const code = await fs.readFile(srcPath, 'utf8');

            // Minify in production
            if (process.env.NODE_ENV === 'production') {
                const minified = await minify(code, {
                    compress: {
                        drop_console: false, // Keep console logs for debugging admin version
                        drop_debugger: true
                    },
                    mangle: {
                        toplevel: true
                    },
                    format: {
                        comments: false
                    }
                });

                await fs.ensureDir(path.dirname(destPath));
                await fs.writeFile(destPath, minified.code);
                console.log(chalk.gray(`  Minified ${file}`));
            } else {
                // Development mode - just copy
                await fs.ensureDir(path.dirname(destPath));
                await fs.copy(srcPath, destPath);
                console.log(chalk.gray(`  Copied ${file}`));
            }
        }
    }
}

async function processCSSFiles() {
    const cssDir = path.join(SRC_DIR, 'styles');
    const destDir = path.join(DIST_DIR, 'styles');

    await fs.ensureDir(destDir);

    const cleanCSS = new CleanCSS({
        level: 2,
        compatibility: 'chrome'
    });

    // Process individual CSS files
    const cssFiles = [
        'common.css',
        'popup.css',
        'admin-theme.css'
    ];

    if (process.env.NODE_ENV === 'production') {
        // In production, we can optionally combine CSS files
        let combinedCSS = '';

        for (const file of cssFiles) {
            const srcPath = path.join(cssDir, file);
            if (await fs.pathExists(srcPath)) {
                const css = await fs.readFile(srcPath, 'utf8');
                combinedCSS += css + '\n';
            }
        }

        // Minify combined CSS
        const minified = cleanCSS.minify(combinedCSS);

        // Option 1: Save as combined file
        await fs.writeFile(path.join(destDir, 'admin.min.css'), minified.styles);
        console.log(chalk.gray('  Created combined admin.min.css'));

        // Option 2: Also save individual files for flexibility
        for (const file of cssFiles) {
            const srcPath = path.join(cssDir, file);
            if (await fs.pathExists(srcPath)) {
                const css = await fs.readFile(srcPath, 'utf8');
                const minified = cleanCSS.minify(css);
                await fs.writeFile(path.join(destDir, file), minified.styles);
            }
        }
    } else {
        // Development mode - copy files as-is
        for (const file of cssFiles) {
            const srcPath = path.join(cssDir, file);
            const destPath = path.join(destDir, file);

            if (await fs.pathExists(srcPath)) {
                await fs.copy(srcPath, destPath);
                console.log(chalk.gray(`  Copied ${file}`));
            }
        }
    }
}

async function processHTMLFiles() {
    const htmlFiles = ['popup.html'];

    for (const file of htmlFiles) {
        const srcPath = path.join(SRC_DIR, file);
        const destPath = path.join(DIST_DIR, file);

        if (await fs.pathExists(srcPath)) {
            let html = await fs.readFile(srcPath, 'utf8');

            if (process.env.NODE_ENV === 'production') {
                // Update CSS references to use minified version
                html = html.replace(
                    /<link rel="stylesheet" href="styles\/common\.css">\s*<link rel="stylesheet" href="styles\/popup\.css">\s*<link rel="stylesheet" href="styles\/admin-theme\.css">/,
                    '<link rel="stylesheet" href="styles/admin.min.css">'
                );

                // Minify HTML
                html = html
                    .replace(/\s+/g, ' ')
                    .replace(/>\s+</g, '><')
                    .trim();
            }

            await fs.writeFile(destPath, html);
            console.log(chalk.gray(`  Processed ${file}`));
        }
    }
}

async function generateManifest() {
    const manifestSrc = path.join(SRC_DIR, 'manifest.json');
    const manifestDest = path.join(DIST_DIR, 'manifest.json');
    const packageJson = await fs.readJson(path.join(__dirname, '../package.json'));

    const manifest = await fs.readJson(manifestSrc);

    // Update version from package.json
    manifest.version = packageJson.version;

    // Add build timestamp
    manifest.version_name = `${packageJson.version} (Admin Build ${new Date().toISOString().split('T')[0]})`;

    // Environment-specific modifications
    if (process.env.NODE_ENV === 'production') {
        // Remove development permissions
        manifest.permissions = manifest.permissions.filter(p => p !== 'http://localhost/*');
    }

    await fs.writeJson(manifestDest, manifest, { spaces: 2 });
    console.log(chalk.green(`✓ Generated manifest v${manifest.version}`));
}

async function createZipArchive() {
    const output = fs.createWriteStream(
        path.join(__dirname, `../dist/dom-style-injector-admin-v${require('../package.json').version}.zip`)
    );

    const archive = archiver('zip', {
        zlib: { level: 9 }
    });

    return new Promise((resolve, reject) => {
        output.on('close', () => {
            console.log(chalk.green(`✓ Created ZIP archive (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`));
            resolve();
        });

        archive.on('error', reject);

        archive.pipe(output);
        archive.directory(DIST_DIR, false);
        archive.finalize();
    });
}

// Run build
build().catch(console.error);