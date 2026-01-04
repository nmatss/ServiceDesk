/**
 * Lighthouse CI Configuration
 *
 * Configuration for automated performance, accessibility, and best practices testing
 * using Lighthouse CI.
 *
 * Usage:
 *   npm install -g @lhci/cli
 *   lhci autorun
 *
 * Or with npx:
 *   npx @lhci/cli autorun
 */

module.exports = {
  ci: {
    // ========================
    // COLLECT CONFIGURATION
    // ========================
    collect: {
      // URLs to test
      url: [
        'http://localhost:3000/', // Landing page
        'http://localhost:3000/auth/login', // Login
        'http://localhost:3000/portal', // Portal
        'http://localhost:3000/admin/dashboard/itil', // Admin dashboard
      ],

      // Number of runs per URL (for averaging)
      numberOfRuns: 3,

      // Start server before collecting (optional)
      // startServerCommand: 'npm run build && npm run start',
      // startServerReadyPattern: 'ready on',
      // startServerReadyTimeout: 30000,

      // Lighthouse settings
      settings: {
        // Use desktop preset for consistent results
        preset: 'desktop',

        // Additional settings
        throttling: {
          rttMs: 40,
          throughputKbps: 10 * 1024,
          cpuSlowdownMultiplier: 1,
        },

        // Screen emulation
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },

        // Form factor
        formFactor: 'desktop',

        // Disable device emulation
        emulatedUserAgent: false,

        // Only run specific categories (faster)
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },

    // ========================
    // UPLOAD CONFIGURATION
    // ========================
    upload: {
      // Upload results to temporary public storage
      target: 'temporary-public-storage',

      // Or use filesystem storage
      // target: 'filesystem',
      // outputDir: './lighthouse-reports',

      // Or use LHCI server (self-hosted)
      // target: 'lhci',
      // serverBaseUrl: 'https://your-lhci-server.com',
      // token: 'your-build-token',
    },

    // ========================
    // ASSERT CONFIGURATION
    // ========================
    assert: {
      // Use recommended preset as baseline
      preset: 'lighthouse:recommended',

      // Custom assertions
      assertions: {
        // ========================
        // PERFORMANCE THRESHOLDS
        // ========================
        'categories:performance': ['error', { minScore: 0.85 }], // 85% minimum
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }], // 2s
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }], // 2.5s
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }], // 0.1
        'total-blocking-time': ['warn', { maxNumericValue: 300 }], // 300ms
        'speed-index': ['warn', { maxNumericValue: 3400 }], // 3.4s

        // ========================
        // ACCESSIBILITY THRESHOLDS
        // ========================
        'categories:accessibility': ['error', { minScore: 0.95 }], // 95% minimum
        'color-contrast': 'error', // Must have proper contrast
        'image-alt': 'error', // Images must have alt text
        'label': 'error', // Form inputs must have labels
        'aria-allowed-attr': 'error', // Valid ARIA attributes
        'aria-required-attr': 'error', // Required ARIA attributes
        'aria-valid-attr': 'error', // Valid ARIA attributes
        'button-name': 'error', // Buttons must have names
        'link-name': 'error', // Links must have names

        // ========================
        // BEST PRACTICES THRESHOLDS
        // ========================
        'categories:best-practices': ['error', { minScore: 0.9 }], // 90% minimum
        'errors-in-console': 'off', // Allow console errors in development
        'no-vulnerable-libraries': 'warn', // Warn about vulnerable dependencies
        'uses-https': 'error', // Must use HTTPS in production
        'is-on-https': 'off', // Skip HTTPS check for localhost

        // ========================
        // SEO THRESHOLDS
        // ========================
        'categories:seo': ['error', { minScore: 0.9 }], // 90% minimum
        'document-title': 'error', // Must have title
        'meta-description': 'error', // Must have description
        'viewport': 'error', // Must have viewport meta tag
        'canonical': 'warn', // Should have canonical URL

        // ========================
        // RESOURCE HINTS
        // ========================
        'uses-rel-preconnect': 'off', // Optional optimization
        'uses-rel-preload': 'off', // Optional optimization

        // ========================
        // IMAGES
        // ========================
        'modern-image-formats': 'warn', // Use WebP/AVIF when possible
        'offscreen-images': 'warn', // Lazy load offscreen images
        'image-size-responsive': 'warn', // Use responsive images

        // ========================
        // SCRIPTS
        // ========================
        'unused-javascript': 'off', // Can be noisy in development
        'uses-optimized-images': 'warn', // Optimize images

        // ========================
        // FONTS
        // ========================
        'font-display': 'warn', // Use font-display: swap

        // ========================
        // BUDGETS
        // ========================
        'resource-summary:document:size': ['warn', { maxNumericValue: 50000 }], // 50KB HTML
        'resource-summary:script:size': ['warn', { maxNumericValue: 500000 }], // 500KB JS
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 100000 }], // 100KB CSS
        'resource-summary:image:size': ['warn', { maxNumericValue: 1000000 }], // 1MB images
        'resource-summary:font:size': ['warn', { maxNumericValue: 200000 }], // 200KB fonts
        'resource-summary:total:size': ['warn', { maxNumericValue: 2000000 }], // 2MB total
      },
    },

    // ========================
    // SERVER CONFIGURATION
    // ========================
    server: {
      // Configuration for LHCI server (if using)
      // port: 9001,
      // storage: {
      //   storageMethod: 'sql',
      //   sqlDatabasePath: './lhci.db',
      // },
    },

    // ========================
    // WIZARD CONFIGURATION
    // ========================
    wizard: {
      // Configuration for setup wizard
      // Run: lhci wizard
    },
  },
}
