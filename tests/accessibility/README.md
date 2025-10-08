# Accessibility Test Suite

Comprehensive accessibility testing for the ServiceDesk application, ensuring WCAG 2.1 AA compliance.

## Test Suites

### 1. wcag-compliance.spec.ts
WCAG 2.1 AA automated compliance testing using axe-core.

**Coverage:**
- Automated accessibility scanning
- Color contrast verification
- Form accessibility
- ARIA implementation
- Semantic HTML
- Keyboard navigation
- Screen reader compatibility

### 2. keyboard-navigation.spec.ts
Comprehensive keyboard navigation testing.

**Coverage:**
- Tab order and focus management
- Keyboard shortcuts
- Modal focus trapping
- Dropdown navigation
- Form field navigation

### 3. responsive-design.spec.ts
Responsive design across multiple viewports.

**Coverage:**
- Mobile, tablet, desktop layouts
- Touch target sizes
- Text readability
- Image responsiveness
- Content reflow

## Prerequisites

Install axe-core for Playwright:

```bash
npm install -D @axe-core/playwright
```

## Running Tests

```bash
# All accessibility tests
npm run test:e2e -- tests/accessibility/

# Specific suite
npm run test:e2e -- tests/accessibility/wcag-compliance.spec.ts

# With headed browser
npm run test:e2e -- tests/accessibility/ --headed

# Generate report
npm run test:e2e -- tests/accessibility/ --reporter=html
```

## Test Results

View results in:
- Terminal output
- `playwright-report/index.html` (after running with html reporter)

## Key Accessibility Standards

- **WCAG 2.1 AA**: Industry standard
- **Color Contrast**: 4.5:1 for normal text
- **Touch Targets**: 44x44px minimum
- **Keyboard**: Full navigation support
- **ARIA**: Proper roles and attributes

## Troubleshooting

### Tests failing due to axe-core missing:
```bash
npm install -D @axe-core/playwright
```

### Tests timing out:
Increase timeout in playwright.config.ts:
```typescript
use: {
  actionTimeout: 10000,
}
```

## Contributing

When adding new features, ensure:
1. Run accessibility tests
2. Fix any violations
3. Add new test cases if needed
4. Document ARIA patterns used
