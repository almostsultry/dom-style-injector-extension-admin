#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const version = getArgValue('--version') || 'admin';
const browser = getArgValue('--browser') || 'chrome';
const environment = getArgValue('--env') || 'production';

function getArgValue(argName) {
  const arg = args.find(a => a.startsWith(argName));
  return arg ? arg.split('=')[1] : null;
}

console.log(`📦 Packaging ${version} version for ${browser} (${environment})`);

async function packageExtension() {
  try {
    // Ensure build exists
    const buildDir = path.join(__dirname, '..', 'dist', version, browser);
    
    if (!fs.existsSync(buildDir)) {
      console.log('🏗️  Build not found, creating...');
      execSync(`npm run build:${version}:${browser}`, { stdio: 'inherit' });
    }
    
    // Validate build
    await validateBuild(buildDir);
    
    // Create package
    const packagePath = await createPackage(buildDir, version, browser);
    
    // Verify package
    await verifyPackage(packagePath);
    
    console.log(`✅ Successfully packaged: ${packagePath}`);
    return packagePath;
    
  } catch (error) {
    console.error('❌ Packaging failed:', error.message);
    process.exit(1);
  }
}

async function validateBuild(buildDir) {
  console.log('🔍 Validating build...');
  
  const requiredFiles = [
    'manifest.json',
    'popup.html',
    'popup.js',
    'content.js',
    'background.js'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(buildDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required file missing: ${file}`);
    }
  }
  
  // Validate manifest
  const manifestPath = path.join(buildDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  if (!manifest.name || !manifest.version) {
    throw new Error('Invalid manifest.json');
  }
  
  // Check file sizes
  const stats = fs.statSync(path.join(buildDir, 'popup.js'));
  if (stats.size > 2 * 1024 * 1024) { // 2MB limit
    console.warn('⚠️  popup.js is quite large:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
  }
  
  console.log('✅ Build validation passed');
}

async function createPackage(buildDir, version, browser) {
  console.log('📦 Creating package...');
  
  const packageName = `dom-style-injector-${version}-${browser}`;
  const packagePath = path.join(__dirname, '..', 'dist', `${packageName}.zip`);
  
  // Remove existing package
  if (fs.existsSync(packagePath)) {
    fs.unlinkSync(packagePath);
  }
  
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(packagePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    output.on('close', () => {
      const sizeKB = (archive.pointer() / 1024).toFixed(2);
      console.log(`📦 Package created: ${sizeKB} KB`);
      resolve(packagePath);
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    
    // Add all files from build directory
    archive.directory(buildDir, false);
    archive.finalize();
  });
}

async function verifyPackage(packagePath) {
  console.log('🔍 Verifying package...');
  
  const stats = fs.statSync(packagePath);
  const sizeMB = stats.size / 1024 / 1024;
  
  // Check package size limits
  if (sizeMB > 128) {
    throw new Error(`Package too large: ${sizeMB.toFixed(2)}MB (limit: 128MB)`);
  }
  
  if (sizeMB < 0.1) {
    throw new Error(`Package suspiciously small: ${sizeMB.toFixed(2)}MB`);
  }
  
  console.log(`✅ Package verification passed: ${sizeMB.toFixed(2)}MB`);
}

// Run packaging
packageExtension().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});