# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-06-24

### Changed

- **Major architectural refactor** to a unified build system.
- Replaced separate `admin` and `user` versions with a single, role-aware extension.
- The extension UI now dynamically renders an "Admin" or "User" view based on the authenticated user's D365 Security Role ("System Customizer").
- Consolidated the build process using a single, unified `webpack.config.js`.
- Simplified `package.json` scripts for a cleaner development workflow (`npm run dev` and `npm run build`).

### Removed

- Deleted the obsolete `/user-version` directory.
- Removed legacy, bifurcated build scripts from the `/build` directory and `package.json`.
