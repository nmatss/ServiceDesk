# Accessibility Testing Guide

## Overview

This document describes the accessibility testing strategy and compliance standards for the ServiceDesk application. We aim for **WCAG 2.1 Level AA compliance** with aspirational AAA goals where feasible.

## Compliance Targets

### Primary Standards
- ✅ **WCAG 2.1 Level AA** - Required for all features
- ✅ **Section 508** (US Federal) - Government compliance
- ✅ **EN 301 549** (EU) - European accessibility standard

### Aspirational Standards
- ⭐ **WCAG 2.1 Level AAA** - Enhanced accessibility where possible

## Testing Tools

### Automated Testing
- **@axe-core/playwright** - Automated WCAG compliance scanning
- **Playwright** - Cross-browser testing and interaction simulation
- **axe-html-reporter** - HTML accessibility reports

### Manual Testing Tools (Recommended)
- **Screen Readers**:
  - NVDA (Windows) - Free, open-source
  - JAWS (Windows) - Industry standard
  - VoiceOver (macOS/iOS) - Built-in Apple screen reader
  - TalkBack (Android) - Built-in Android screen reader

- **Browser Extensions**:
  - axe DevTools - Real-time accessibility scanning
  - WAVE - Visual accessibility evaluation
  - Lighthouse - Chrome DevTools audit

- **Color Contrast Tools**:
  - WebAIM Contrast Checker
  - Colour Contrast Analyser

## Test Suite Structure

```
tests/a11y/
├── automated.spec.ts      # Automated axe-core scans (WCAG compliance)
├── keyboard.spec.ts       # Keyboard navigation and shortcuts
├── screen-reader.spec.ts  # ARIA, landmarks, semantic HTML
├── color-contrast.spec.ts # Color contrast ratios (WCAG AA/AAA)
├── focus.spec.ts          # Focus management and indicators
├── mobile.spec.ts         # Touch targets, mobile viewports
├── forms.spec.ts          # Form labels, errors, validation
└── axe.config.ts          # Shared axe-core configuration
```

## Running Tests

### Run All Accessibility Tests
```bash
npm run test:a11y
```

### Run Specific Test Categories
```bash
# Automated scans only
npx playwright test tests/a11y/automated.spec.ts

# Keyboard navigation
npx playwright test tests/a11y/keyboard.spec.ts

# Screen reader compatibility
npx playwright test tests/a11y/screen-reader.spec.ts

# Color contrast
npx playwright test tests/a11y/color-contrast.spec.ts

# Focus management
npx playwright test tests/a11y/focus.spec.ts

# Mobile accessibility
npx playwright test tests/a11y/mobile.spec.ts

# Forms accessibility
npx playwright test tests/a11y/forms.spec.ts
```

### Generate HTML Report
```bash
npm run test:a11y:report
```

Reports are generated in `reports/accessibility/`

## WCAG 2.1 Compliance Checklist

### Perceivable

#### 1.1 Text Alternatives
- [x] All images have alt text
- [x] Decorative images have empty alt or aria-hidden
- [x] Icon buttons have accessible names

#### 1.2 Time-based Media
- [ ] Video content has captions (if applicable)
- [ ] Audio content has transcripts (if applicable)

#### 1.3 Adaptable
- [x] Semantic HTML structure (headings, landmarks, lists)
- [x] Proper heading hierarchy (h1 → h2 → h3)
- [x] Form labels programmatically associated
- [x] Content works in portrait and landscape orientations

#### 1.4 Distinguishable
- [x] Color contrast ratio ≥ 4.5:1 for normal text (AA)
- [x] Color contrast ratio ≥ 3:1 for large text (AA)
- [x] Color is not the only visual means of conveying information
- [x] Text can be resized to 200% without loss of functionality
- [x] No horizontal scrolling at 320px width (reflow)

### Operable

#### 2.1 Keyboard Accessible
- [x] All functionality available via keyboard
- [x] No keyboard traps
- [x] Logical tab order
- [x] Skip navigation links

#### 2.2 Enough Time
- [x] No unexpected time limits on forms
- [x] Users can extend time limits (if applicable)

#### 2.3 Seizures
- [x] No content flashes more than 3 times per second

#### 2.4 Navigable
- [x] Page titles are descriptive and unique
- [x] Focus order follows DOM order
- [x] Link text is descriptive (no "click here")
- [x] Multiple ways to navigate (menu, search, breadcrumbs)
- [x] Headings and labels are descriptive
- [x] Keyboard focus is visible

#### 2.5 Input Modalities
- [x] Touch targets ≥ 44x44px (iOS/WCAG AAA)
- [x] Touch targets ≥ 48x48px (Android Material Design)
- [x] Pointer gestures have keyboard alternatives
- [x] No motion-only input required
- [x] Label text included in accessible name

### Understandable

#### 3.1 Readable
- [x] Page language is identified (lang attribute)
- [x] Language changes are marked (if applicable)

#### 3.2 Predictable
- [x] Focus does not cause unexpected context changes
- [x] Input does not cause unexpected context changes
- [x] Navigation is consistent across pages
- [x] Components are identified consistently

#### 3.3 Input Assistance
- [x] Form errors are identified and described
- [x] Labels and instructions are provided
- [x] Error suggestions are provided
- [x] Error prevention for critical actions (confirmation dialogs)
- [x] Help text available for complex inputs

### Robust

#### 4.1 Compatible
- [x] Valid HTML (no parsing errors)
- [x] All UI components have accessible names
- [x] Status messages can be programmatically determined
- [x] ARIA attributes are used correctly

## Common Accessibility Patterns

### Forms

#### Accessible Form Labels
```tsx
// Good - Associated label
<label htmlFor="email">Email Address</label>
<input id="email" name="email" type="email" required />

// Good - aria-label
<input
  name="search"
  type="search"
  aria-label="Search tickets"
/>

// Bad - Placeholder only
<input placeholder="Email" /> ❌
```

#### Error Handling
```tsx
// Good - Accessible error
<input
  id="email"
  aria-invalid="true"
  aria-describedby="email-error"
/>
<span id="email-error" role="alert">
  Please enter a valid email address
</span>

// Bad - Visual error only
<input className="error" /> ❌
<span className="error-text">Error</span> ❌
```

### Buttons and Links

#### Accessible Buttons
```tsx
// Good - Text button
<button type="submit">Submit Form</button>

// Good - Icon button with label
<button aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>

// Bad - Icon button without label
<button><XIcon /></button> ❌

// Bad - Div as button
<div onClick={handleClick}>Click me</div> ❌
```

#### Accessible Links
```tsx
// Good - Descriptive link
<a href="/ticket/123">View Ticket #123</a>

// Bad - Vague link
<a href="/ticket/123">Click here</a> ❌
<a href="/ticket/123">Read more</a> ❌
```

### Navigation

#### Landmarks
```tsx
// Good - Semantic landmarks
<header role="banner">
  <nav role="navigation" aria-label="Main navigation">
    {/* Navigation items */}
  </nav>
</header>

<main role="main">
  {/* Main content */}
</main>

<footer role="contentinfo">
  {/* Footer content */}
</footer>

// Multiple nav - unique labels
<nav aria-label="Primary navigation">...</nav>
<nav aria-label="Breadcrumb navigation">...</nav>
```

#### Skip Links
```tsx
// Good - Skip to main content
<a href="#main-content" className="skip-link">
  Skip to main content
</a>

<main id="main-content" tabIndex={-1}>
  {/* Content */}
</main>
```

### Modals/Dialogs

#### Accessible Modal
```tsx
// Good - ARIA dialog with focus trap
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Confirm Delete</h2>
  <p id="dialog-description">
    Are you sure you want to delete this ticket?
  </p>
  <button onClick={handleConfirm}>Confirm</button>
  <button onClick={handleCancel}>Cancel</button>
</div>

// Focus management
useEffect(() => {
  if (isOpen) {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();

    return () => {
      previousFocus?.focus(); // Restore focus on close
    };
  }
}, [isOpen]);
```

### Live Regions

#### Notifications
```tsx
// Good - Polite announcement
<div role="status" aria-live="polite">
  Ticket #123 created successfully
</div>

// Good - Urgent announcement
<div role="alert" aria-live="assertive">
  Error: Unable to save changes
</div>
```

### Focus Management

#### Visible Focus Indicators
```css
/* Good - Visible focus */
button:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* Also acceptable - Custom focus style */
button:focus-visible {
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.5);
}

/* Bad - No focus indicator */
*:focus {
  outline: none; /* ❌ Don't do this */
}
```

## Mobile Accessibility

### Touch Targets
- **Minimum size**: 44x44px (iOS HIG, WCAG AAA)
- **Recommended size**: 48x48px (Android Material Design)
- **Spacing**: Adequate space between targets (8px minimum)

### Viewport Configuration
```html
<!-- Good - Allows zooming -->
<meta name="viewport" content="width=device-width, initial-scale=1" />

<!-- Bad - Prevents zooming -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" /> ❌
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" /> ❌
```

### Responsive Design
- Support both portrait and landscape orientations
- No horizontal scrolling required at 320px width
- Touch-friendly tap targets on all screen sizes

## Color and Contrast

### WCAG AA Requirements (Minimum)
- **Normal text**: 4.5:1 contrast ratio
- **Large text** (18pt+ or 14pt+ bold): 3:1 contrast ratio
- **UI components**: 3:1 contrast ratio
- **Focus indicators**: 3:1 contrast ratio

### WCAG AAA Requirements (Enhanced)
- **Normal text**: 7:1 contrast ratio
- **Large text**: 4.5:1 contrast ratio

### Testing Tools
```bash
# Use WebAIM Contrast Checker
https://webaim.org/resources/contrastchecker/

# Or use browser DevTools
# Chrome: Inspect > Accessibility > Contrast
```

## Screen Reader Testing

### NVDA (Windows)
```bash
# Download: https://www.nvaccess.org/download/

# Basic commands:
# NVDA + Down Arrow - Read next line
# NVDA + Up Arrow - Read previous line
# Insert - Navigate by heading
# Tab - Jump to next interactive element
```

### VoiceOver (macOS)
```bash
# Enable: System Preferences > Accessibility > VoiceOver

# Basic commands:
# Cmd + F5 - Toggle VoiceOver
# VO + Right Arrow - Read next item
# VO + Left Arrow - Read previous item
# VO + U - Open rotor
```

### Testing Checklist
- [ ] All content is announced in logical order
- [ ] Interactive elements have clear labels
- [ ] Form errors are announced
- [ ] Dynamic content updates are announced (live regions)
- [ ] Navigation landmarks are identified
- [ ] Images have meaningful alt text
- [ ] Buttons and links have descriptive labels

## Continuous Integration

### Pre-commit Checks
```bash
# Run accessibility tests before commit
npm run test:a11y
```

### CI/CD Pipeline
```yaml
# .github/workflows/accessibility.yml
name: Accessibility Tests

on: [push, pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:a11y
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: accessibility-report
          path: reports/accessibility/
```

## Resources

### WCAG Guidelines
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM WCAG Checklist](https://webaim.org/standards/wcag/checklist)

### Testing Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

### Screen Readers
- [NVDA (Windows)](https://www.nvaccess.org/)
- [JAWS (Windows)](https://www.freedomscientific.com/products/software/jaws/)
- [VoiceOver (macOS/iOS)](https://www.apple.com/accessibility/voiceover/)
- [TalkBack (Android)](https://support.google.com/accessibility/android/answer/6283677)

### Best Practices
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Inclusive Components](https://inclusive-components.design/)
- [A11y Project](https://www.a11yproject.com/)

## Support

For accessibility issues or questions, please:
1. Check this documentation
2. Review test failures in CI/CD
3. Consult [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
4. File an issue with label `accessibility`

## Maintenance

This test suite should be run:
- ✅ Before every commit (pre-commit hook)
- ✅ On every pull request (CI/CD)
- ✅ Before every release
- ✅ After UI/UX changes
- ✅ Quarterly accessibility audits

**Remember**: Automated tests catch ~30-40% of accessibility issues. Manual testing with screen readers and keyboard navigation is essential for full compliance.
