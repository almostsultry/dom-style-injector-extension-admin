// build/release.js
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const buildAdmin = require('./build-admin');
const buildUser = require('./build-user');

async function release() {
    console.log(chalk.magenta('🚀 Starting full release process...'));

    // Set NODE_ENV to production for minification and specific build optimizations
    process.env.NODE_ENV = 'production';

    try {
        // Run admin build
        console.log(chalk.blue('\n--- Building Admin Version ---'));
        await buildAdmin();
        console.log(chalk.blue('--- Admin Version Build Complete ---\n'));

        // Run user build
        console.log(chalk.blue('--- Building User Version ---'));
        await buildUser();
        console.log(chalk.blue('--- User Version Build Complete ---\n'));

        console.log(chalk.magenta('✅ Full release process completed successfully!'));
    } catch (error) {
        console.error(chalk.red('❌ Full release failed:'), error);
        process.exit(1);
    }
}

release();