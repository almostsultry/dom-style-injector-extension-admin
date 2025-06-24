// build/build-user.js
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const chalk = require('chalk');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

const SRC_DIR = path.join(__dirname, '../user-version');
const ADMIN_SRC_DIR = path.join(__dirname, '../src');
const DIST_DIR = path.join(__dirname, '../dist/user');

async function build() {
    console.log(chalk.blue('🔨 Building User Version...'));

    try {
        // Clean dist directory
        await fs.emptyDir(DIST_DIR);
        console.log(chalk.green('✓ Cleaned dist directory'));

        // Copy static files
        await copyStaticFiles();

        // Process and minify JavaScript files
        await processJavaScriptFiles();

        // Copy and process CSS files from admin src
        await processCSSFiles();

        // Process HTML files
        await processHTMLFiles();

        // Generate manifest
        await generateManifest();

        // Create ZIP for distribution
        await createZipArchive();

        console.log(chalk.green('\n✅ User build completed successfully!'));
        console.log(chalk.cyan(`📁 Output: ${DIST_DIR}`));
    } catch (error) {
        console.error(chalk.red('❌ Build failed:'), error);
        process.exit(1);
    }
}

async function copyStaticFiles() {
    // Copy icons from admin version
    const iconsDir = path.join(ADMIN_SRC_DIR, 'icons');
    const destIconsDir = path.join(DIST_DIR, 'icons');

    if (await fs.pathExists(iconsDir)) {
        await fs.copy(iconsDir, destIconsDir);
        console.log(chalk.gray('  Copied icons'));

        // Remove admin-specific icons
        const adminBadge = path.join(destIconsDir, 'admin-badge.png');
        if (await fs.pathExists(adminBadge)) {
            await fs.remove(adminBadge);
        }
    }
}

async function processJavaScriptFiles() {
    const jsFiles = ['popup.js', 'content.js'];

    // Add background.js if it exists
    const bgPath = path.join(SRC_DIR, 'background.js');
    if (await fs.pathExists(bgPath)) {
        jsFiles.push('background.js');
    }

    for (const file of jsFiles) {
        const srcPath = path.join(SRC_DIR, file);
        const destPath = path.join(DIST_DIR, file);

        if (await fs.pathExists(srcPath)) {
            const code = await fs.readFile(srcPath, 'utf8');

            if (process.env.NODE_ENV === 'production') {
                const minified = await minify(code, {
                    compress: {
                        drop_console: true, // Remove console logs in user version
                        drop_debugger: true,
                        pure_funcs: ['console.log', 'console.info', 'console.debug']
                    },
                    mangle: {
                        toplevel: true
                    },
                    format: {
                        comments: false
                    }
                });

                await fs.writeFile(destPath, minified.code);
                console.log(chalk.gray(`  Minified ${file}`));
            } else {
                await fs.copy(srcPath, destPath);
                console.log(chalk.gray(`  Copied ${file}`));
            }
        }
    }
}

async function processCSSFiles() {
    // Create styles directory
    const destStylesDir = path.join(DIST_DIR, 'styles');
    await fs.ensureDir(destStylesDir);

    // Copy CSS files from admin src
    const adminStylesDir = path.join(ADMIN_SRC_DIR, 'styles');
    const cssFiles = ['common.css', 'popup.css', 'user-theme.css']; // Note: user-theme instead of admin-theme

    const cleanCSS = new CleanCSS({
        level: 2,
        compatibility: 'chrome'
    });

    if (process.env.NODE_ENV === 'production') {
        // In production, combine and minify
        let combinedCSS = '';

        for (const file of cssFiles) {
            const srcPath = path.join(adminStylesDir, file);
            if (await fs.pathExists(srcPath)) {
                const css = await fs.readFile(srcPath, 'utf8');
                combinedCSS += css + '\n';
            }
        }

        // Minify combined CSS
        const minified = cleanCSS.minify(combinedCSS);

        // Save as combined file
        await fs.writeFile(path.join(destStylesDir, 'user.min.css'), minified.styles);
        console.log(chalk.gray('  Created combined user.min.css'));

        // Also save individual files for development/debugging
        for (const file of cssFiles) {
            const srcPath = path.join(adminStylesDir, file);
            if (await fs.pathExists(srcPath)) {
                const css = await fs.readFile(srcPath, 'utf8');
                const minified = cleanCSS.minify(css);
                await fs.writeFile(path.join(destStylesDir, file), minified.styles);
            }
        }
    } else {
        // Development mode - copy files as-is
        for (const file of cssFiles) {
            const srcPath = path.join(adminStylesDir, file);
            const destPath = path.join(destStylesDir, file);

            if (await fs.pathExists(srcPath)) {
                await fs.copy(srcPath, destPath);
                console.log(chalk.gray(`  Copied ${file}`));
            }
        }
    }
}

async function processHTMLFiles() {
    const htmlPath = path.join(SRC_DIR, 'popup.html');
    const htmlDest = path.join(DIST_DIR, 'popup.html');

    if (await fs.pathExists(htmlPath)) {
        let html = await fs.readFile(htmlPath, 'utf8');

        // Update CSS paths to point to local styles directory
        html = html.replace(/\.\.\/src\/styles\//g, 'styles/');

        if (process.env.NODE_ENV === 'production') {
            // Update CSS references to use minified version
            html = html.replace(
                /<link rel="stylesheet" href="styles\/common\.css">\s*<link rel="stylesheet" href="styles\/popup\.css">\s*<link rel="stylesheet" href="styles\/user-theme\.css">/,
                '<link rel="stylesheet" href="styles/user.min.css">'
            );

            // Minify HTML
            html = html
                .replace(/\s+/g, ' ')
                .replace(/>\s+</g, '><')
                .trim();
        }

        await fs.writeFile(htmlDest, html);
        console.log(chalk.gray('  Processed popup.html'));
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
    manifest.version_name = `${packageJson.version} (User Build ${new Date().toISOString().split('T')[0]})`;

    // User-specific modifications
    manifest.name = "DOM Style Injector - User";
    manifest.description = "Apply CSS customizations managed by your IT administrator";

    // Remove admin-specific permissions
    if (manifest.permissions) {
        manifest.permissions = manifest.permissions.filter(p =>
            !['identity', 'management'].includes(p)
        );
    }

    // Environment-specific modifications
    if (process.env.NODE_ENV === 'production') {
        // Remove development permissions
        if (manifest.host_permissions) {
            manifest.host_permissions = manifest.host_permissions.filter(p =>
                !p.includes('localhost')
            );
        }
    }

    await fs.writeJson(manifestDest, manifest, { spaces: 2 });
    console.log(chalk.green(`✓ Generated manifest v${manifest.version}`));
}

async function createZipArchive() {
    const output = fs.createWriteStream(
        path.join(__dirname, `../dist/dom-style-injector-user-v${require('../package.json').version}.zip`)
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