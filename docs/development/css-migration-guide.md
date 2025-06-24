# CSS Architecture Migration Guide

## Overview

In version 2.0.0, we migrated from inline styles to a hybrid CSS architecture for better maintainability, reusability, and performance.

## Migration Changes

### Before (Inline Styles)
```html
<!-- popup.html -->
<style>
  body {
    width: 400px;
    font-family: Arial, sans-serif;
    /* ... hundreds of lines of CSS ... */
  }
</style>
```

### After (External CSS)
```html
<!-- popup.html -->
<link rel="stylesheet" href="styles/common.css">
<link rel="stylesheet" href="styles/popup.css">
<link rel="stylesheet" href="styles/admin-theme.css">
```

## File Structure

```
src/styles/
├── common.css        # Shared styles, variables, components
├── popup.css         # Popup-specific layout
├── admin-theme.css   # Admin version theming
└── user-theme.css    # User version theming
```

## CSS Architecture Principles

### 1. CSS Variables
All colors, spacing, and other design tokens are defined as CSS variables:

```css
:root {
  --primary-color: #667eea;
  --spacing-md: 16px;
  --shadow-sm: 0 2px 4px rgba(0,0,0,0.05);
}
```

### 2. Component Classes
Reusable components are defined in `common.css`:

```css
.btn { /* Base button styles */ }
.btn-primary { /* Primary button variant */ }
.card { /* Card container */ }
.form-input { /* Form input styles */ }
```

### 3. BEM-like Naming
We use a simplified BEM approach:
- Block: `.customization-item`
- Element: `.customization-name`
- Modifier: `.customization-item.active`

### 4. Utility Classes
Common utilities for quick styling:
```css
.text-center { text-align: center; }
.mt-md { margin-top: var(--spacing-md); }
.hidden { display: none !important; }
```

## Build Process Updates

### Development Mode
- CSS files are copied as-is
- No minification
- Separate file requests (better for debugging)

### Production Mode
- CSS files are minified
- Option to combine into single file
- Automatic path updates in HTML

## Adding New Styles

### 1. For Shared Styles
Add to `common.css`:
```css
.new-component {
  /* Styles using CSS variables */
  padding: var(--spacing-md);
  color: var(--text-primary);
}
```

### 2. For Page-Specific Styles
Add to appropriate file (`popup.css`, etc.):
```css
.popup-specific-element {
  /* Styles specific to popup */
}
```

### 3. For Theme Variations
Add to theme files:
```css
/* admin-theme.css */
.header {
  background: var(--admin-gradient);
}
```

## Benefits of Migration

1. **Better Organization** - Styles grouped by purpose
2. **Reusability** - Share styles between admin/user versions
3. **Maintainability** - Easy to find and update styles
4. **Performance** - CSS caching, smaller HTML files
5. **Tooling** - Better IDE support, CSS linting
6. **Theming** - Easy to create new themes

## Common Issues & Solutions

### Issue: Styles Not Loading
**Solution**: Check file paths in HTML and build output

### Issue: Specificity Conflicts
**Solution**: Use CSS variables and consistent naming

### Issue: Missing Styles in Production
**Solution**: Verify build process includes all CSS files

## Future Enhancements

1. **CSS Modules** - Component-scoped styles
2. **PostCSS** - Advanced CSS processing
3. **Dark Mode** - Using CSS variables
4. **CSS-in-JS** - For dynamic styling needs

## Testing CSS Changes

1. **Visual Testing**
   ```bash
   npm run dev:admin
   # Open extension and verify styles
   ```

2. **Build Testing**
   ```bash
   npm run build:prod
   # Check minified output
   ```

3. **Cross-Browser Testing**
   - Test in Chrome and Edge
   - Verify CSS variable support

## Rollback Plan

If issues arise, inline styles are preserved in git history:
```bash
git checkout v1.5.0 -- src/popup.html
```

## Questions?

For CSS-related questions:
- Check `src/styles/common.css` for available variables
- Review component classes before creating new ones
- Consult team for major CSS architecture changes