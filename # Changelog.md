# Changelog

All notable changes to the DOM Style Injector Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial development phase
- Core infrastructure setup
- Documentation framework

## [2.0.0] - 2024-XX-XX

### Added
- Admin version with full CRUD capabilities
- SharePoint integration for centralized storage
- Microsoft Graph authentication
- User version with read-only access
- Automatic synchronization between admin and user versions
- Role-based access control (RBAC)
- Audit logging for compliance
- CI/CD pipeline with GitHub Actions
- Automated security scanning
- Comprehensive test suite

### Changed
- Migrated from Manifest V2 to V3
- Separated admin and user versions
- Moved from local storage to cloud-based storage
- Enhanced security with domain restrictions

### Security
- Added Microsoft Azure AD integration
- Implemented content security policies
- Added permission auditing
- Restricted to approved corporate domains

## [1.5.0] - 2024-01-15

### Added
- Export/Import functionality for customizations
- Bulk operations support
- Advanced CSS selector validation
- Performance monitoring

### Changed
- Improved UI/UX based on user feedback
- Optimized content script injection
- Enhanced error handling

### Fixed
- Memory leak in long-running sessions
- Race condition in DOM detection
- CSS specificity issues

## [1.4.0] - 2023-11-20

### Added
- Dark mode support
- Keyboard shortcuts
- Search and filter functionality
- Customization templates

### Changed
- Redesigned popup interface
- Improved synchronization algorithm
- Better handling of dynamic content

### Fixed
- Issue with iframe content
- Compatibility with D365 updates

## [1.3.0] - 2023-09-10

### Added
- Multi-language support
- Backup and restore functionality
- Usage analytics (privacy-compliant)
- Customization groups

### Changed
- Migrated to TypeScript
- Improved build process
- Updated dependencies

### Deprecated
- Legacy storage format (will be removed in 2.0.0)

## [1.2.0] - 2023-07-05

### Added
- Real-time preview of changes
- Undo/Redo functionality
- CSS validation
- Element picker tool

### Fixed
- Issues with Shadow DOM elements
- Performance on pages with many customizations

## [1.1.0] - 2023-05-15

### Added
- Support for multiple CSS properties per customization
- Domain whitelist/blacklist
- Basic synchronization between devices
- Customization categories

### Changed
- Improved element targeting algorithm
- Better handling of page navigation

### Fixed
- Memory usage optimization
- Conflicts with other extensions

## [1.0.0] - 2023-03-01

### Added
- Initial release
- Basic CSS injection functionality
- Element targeting by attributes
- Persistent storage
- Simple toggle on/off
- Domain-specific customizations
- Basic UI for managing customizations

[Unreleased]: https://github.com/almostsultry/dom-style-injector-extension-admin/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/almostsultry/dom-style-injector-extension-admin/compare/v1.5.0...v2.0.0
[1.5.0]: https://github.com/almostsultry/dom-style-injector-extension-admin/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/almostsultry/dom-style-injector-extension-admin/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/almostsultry/dom-style-injector-extension-admin/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/almostsultry/dom-style-injector-extension-admin/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/almostsultry/dom-style-injector-extension-admin/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/almostsultry/dom-style-injector-extension-admin/releases/tag/v1.0.0