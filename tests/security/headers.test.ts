/**
 * Security Headers Validation Tests
 *
 * Tests for proper security headers configuration.
 * Validates OWASP recommended security headers are present and correctly configured.
 *
 * These tests work WITHOUT requiring a running server - they test the security
 * header functions directly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import {
  applyHelmetHeaders,
  validateSecurityHeaders,
  defaultConfig,
  createHelmetConfig
} from '@/lib/security/helmet';

describe('Security Headers Tests', () => {
  let response: NextResponse;

  beforeEach(() => {
    response = new NextResponse();
  });

  describe('HTTP Strict Transport Security (HSTS)', () => {
    it('should have HSTS header with proper configuration', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const hsts = responseWithHeaders.headers.get('strict-transport-security');

      // HSTS should be present in production
      if (process.env.NODE_ENV === 'production') {
        expect(hsts).toBeTruthy();

        if (hsts) {
          // Should have max-age
          expect(hsts).toMatch(/max-age=\d+/);

          // Max-age should be at least 1 year (31536000 seconds)
          const maxAge = hsts.match(/max-age=(\d+)/)?.[1];
          expect(Number(maxAge)).toBeGreaterThanOrEqual(31536000);

          // Should include subdomains
          expect(hsts.toLowerCase()).toMatch(/includesubdomains/i);

          // Should have preload
          expect(hsts.toLowerCase()).toMatch(/preload/i);
        }
      }
    });

    it('should have correct HSTS max-age value', () => {
      expect(defaultConfig.strictTransportSecurity?.maxAge).toBe(31536000);
    });
  });

  describe('X-Frame-Options', () => {
    it('should have X-Frame-Options header to prevent clickjacking', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const xfo = responseWithHeaders.headers.get('x-frame-options');

      expect(xfo).toBeTruthy();

      // Should be DENY or SAMEORIGIN
      if (xfo) {
        expect(xfo.toUpperCase()).toMatch(/^(DENY|SAMEORIGIN)$/);
      }
    });

    it('should default to DENY for maximum security', () => {
      expect(defaultConfig.xFrameOptions).toBe('DENY');
    });
  });

  describe('X-Content-Type-Options', () => {
    it('should have X-Content-Type-Options: nosniff', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const xcto = responseWithHeaders.headers.get('x-content-type-options');

      expect(xcto).toBeTruthy();
      expect(xcto?.toLowerCase()).toBe('nosniff');
    });

    it('should be enabled in default config', () => {
      expect(defaultConfig.xContentTypeOptions).toBe(true);
    });
  });

  describe('Content-Security-Policy (CSP)', () => {
    it('should have Content-Security-Policy header', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const csp = responseWithHeaders.headers.get('content-security-policy');

      expect(csp).toBeTruthy();
    });

    it('should have restrictive default-src directive', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const csp = responseWithHeaders.headers.get('content-security-policy');

      if (csp) {
        // Should have default-src
        expect(csp).toMatch(/default-src/i);

        // default-src should be restrictive (self only)
        expect(csp).toMatch(/default-src[^;]*'self'/i);
      }
    });

    it('should restrict script sources', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const csp = responseWithHeaders.headers.get('content-security-policy');

      if (csp) {
        const scriptSrc = csp.match(/script-src[^;]*/i)?.[0];
        expect(scriptSrc).toBeTruthy();
      }
    });

    it('should restrict frame sources to prevent clickjacking', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const csp = responseWithHeaders.headers.get('content-security-policy');

      if (csp) {
        // Should have frame-ancestors directive
        const frameAncestors = csp.match(/frame-ancestors[^;]*/i)?.[0];

        if (frameAncestors) {
          // Should be 'none' or 'self'
          expect(frameAncestors).toMatch(/'none'|'self'/);
        }
      }
    });

    it('should have object-src set to none', () => {
      const directives = defaultConfig.contentSecurityPolicy?.directives;
      expect(directives?.['object-src']).toContain("'none'");
    });

    it('should have base-uri restricted', () => {
      const directives = defaultConfig.contentSecurityPolicy?.directives;
      expect(directives?.['base-uri']).toContain("'self'");
    });
  });

  describe('Referrer-Policy', () => {
    it('should have Referrer-Policy header', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const referrerPolicy = responseWithHeaders.headers.get('referrer-policy');

      expect(referrerPolicy).toBeTruthy();
    });

    it('should have restrictive referrer policy', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const referrerPolicy = responseWithHeaders.headers.get('referrer-policy');

      if (referrerPolicy) {
        // Should be one of the secure options
        const secureOptions = [
          'no-referrer',
          'no-referrer-when-downgrade',
          'origin',
          'origin-when-cross-origin',
          'same-origin',
          'strict-origin',
          'strict-origin-when-cross-origin',
        ];

        expect(secureOptions).toContain(referrerPolicy.toLowerCase());
      }
    });

    it('should use strict-origin-when-cross-origin by default', () => {
      expect(defaultConfig.referrerPolicy).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Permissions-Policy', () => {
    it('should have Permissions-Policy header', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const permissionsPolicy = responseWithHeaders.headers.get('permissions-policy');

      expect(permissionsPolicy).toBeTruthy();
    });

    it('should disable dangerous features', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const permissionsPolicy = responseWithHeaders.headers.get('permissions-policy');

      if (permissionsPolicy) {
        // Should restrict sensitive features
        const restrictedFeatures = ['geolocation', 'microphone', 'camera'];

        for (const feature of restrictedFeatures) {
          // Should deny ()
          const regex = new RegExp(`${feature}=\\(\\)`, 'i');
          expect(permissionsPolicy).toMatch(regex);
        }
      }
    });

    it('should restrict all configured features', () => {
      const features = Object.keys(defaultConfig.permissionsPolicy || {});
      expect(features).toContain('geolocation');
      expect(features).toContain('microphone');
      expect(features).toContain('camera');
    });
  });

  describe('X-XSS-Protection', () => {
    it('should have X-XSS-Protection header', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const xssProtection = responseWithHeaders.headers.get('x-xss-protection');

      if (xssProtection) {
        expect(xssProtection).toMatch(/1.*mode=block/i);
      }
    });

    it('should be enabled in default config', () => {
      expect(defaultConfig.xssProtection).toBe(true);
    });
  });

  describe('X-Powered-By Header', () => {
    it('should not have X-Powered-By header', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const xPoweredBy = responseWithHeaders.headers.get('x-powered-by');

      // Should be removed to avoid fingerprinting
      expect(xPoweredBy).toBeNull();
    });
  });

  describe('Server Header', () => {
    it('should not expose server version', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const server = responseWithHeaders.headers.get('server');

      // Should either not be present or be generic
      if (server) {
        // Should not expose specific version numbers
        expect(server).not.toMatch(/\d+\.\d+\.\d+/);
        expect(server.toLowerCase()).not.toMatch(/nginx\/\d+/);
        expect(server.toLowerCase()).not.toMatch(/apache\/\d+/);
        expect(server.toLowerCase()).not.toMatch(/express\/\d+/);
      }
    });
  });

  describe('Comprehensive Header Validation', () => {
    it('should have all critical security headers', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const validation = validateSecurityHeaders(responseWithHeaders.headers);

      expect(validation.valid).toBe(true);
      expect(validation.missing).toEqual([]);
    });

    it('should validate required headers correctly', () => {
      const emptyHeaders = new Headers();
      const validation = validateSecurityHeaders(emptyHeaders);

      expect(validation.valid).toBe(false);
      expect(validation.missing.length).toBeGreaterThan(0);
      expect(validation.missing).toContain('Content-Security-Policy');
      expect(validation.missing).toContain('X-Frame-Options');
      expect(validation.missing).toContain('X-Content-Type-Options');
      expect(validation.missing).toContain('Referrer-Policy');
    });
  });

  describe('Custom Configuration', () => {
    it('should allow custom CSP directives', () => {
      const customConfig = createHelmetConfig({
        contentSecurityPolicy: {
          directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'", 'https://trusted.com']
          }
        }
      });

      expect(customConfig.contentSecurityPolicy?.directives['script-src']).toContain('https://trusted.com');
    });

    it('should allow custom HSTS settings', () => {
      const customConfig = createHelmetConfig({
        strictTransportSecurity: {
          maxAge: 63072000,
          includeSubDomains: true,
          preload: true
        }
      });

      expect(customConfig.strictTransportSecurity?.maxAge).toBe(63072000);
    });
  });

  describe('Development vs Production Settings', () => {
    it('should have appropriate settings for the environment', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const hsts = responseWithHeaders.headers.get('strict-transport-security');

      // HSTS should only be set in production
      if (process.env.NODE_ENV === 'production') {
        expect(hsts).toBeTruthy();
      }
    });
  });

  describe('CSP Directive Formatting', () => {
    it('should properly format CSP directives', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const csp = responseWithHeaders.headers.get('content-security-policy');

      if (csp) {
        // Should be properly formatted with semicolons
        const directives = csp.split(';').map(d => d.trim());
        expect(directives.length).toBeGreaterThan(1);

        // Each directive should have a name
        directives.forEach(directive => {
          if (directive) {
            expect(directive).toMatch(/^[a-z-]+/);
          }
        });
      }
    });
  });

  describe('Permissions Policy Formatting', () => {
    it('should properly format permissions policy', () => {
      const responseWithHeaders = applyHelmetHeaders(response);
      const permissionsPolicy = responseWithHeaders.headers.get('permissions-policy');

      if (permissionsPolicy) {
        // Should contain feature=(value) format
        expect(permissionsPolicy).toMatch(/[a-z-]+=\([^)]*\)/);
      }
    });
  });
});
