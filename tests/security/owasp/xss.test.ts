/**
 * Cross-Site Scripting (XSS) Protection Tests (OWASP A03)
 * Unit tests for XSS prevention - no running server required
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InputSanitizer, InputValidator } from '@/lib/security/input-sanitization';
import { sanitizeHTML, sanitizeUserInput, sanitizeMarkdown } from '@/lib/security/sanitize';

describe('Cross-Site Scripting (XSS) Tests (OWASP A03)', () => {
  let sanitizer: InputSanitizer;
  let validator: InputValidator;

  beforeEach(() => {
    sanitizer = new InputSanitizer();
    validator = new InputValidator();
  });

  describe('InputSanitizer - XSS Prevention', () => {
    it('should remove script tags', () => {
      const maliciousInput = '<script>alert("XSS")</script>Normal text';
      const result = sanitizer.sanitizeString(maliciousInput);

      expect(result.sanitized).not.toContain('<script>');
      expect(result.sanitized).not.toContain('</script>');
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should remove javascript: protocol', () => {
      const maliciousInput = '<a href="javascript:alert(1)">Click me</a>';
      const result = sanitizer.sanitizeString(maliciousInput);

      expect(result.sanitized).not.toContain('javascript:');
      expect(result.violations.some(v => v.includes('XSS'))).toBe(true);
    });

    it('should remove event handlers (onclick, onmouseover, etc.)', () => {
      const testCases = [
        'onclick=alert(1)',
        'onmouseover=alert(1)',
        'onerror=alert(1)',
        'onload=alert(1)',
        'onfocus=alert(1)',
        'onblur=alert(1)',
        'onchange=alert(1)',
        'onsubmit=alert(1)',
      ];

      for (const malicious of testCases) {
        const result = sanitizer.sanitizeString(`<img src="x" ${malicious}>`);
        expect(result.sanitized).not.toMatch(new RegExp(malicious.split('=')[0], 'i'));
      }
    });

    it('should remove iframe, object, embed tags', () => {
      const maliciousInputs = [
        '<iframe src="http://evil.com"></iframe>',
        '<object data="http://evil.com"></object>',
        '<embed src="http://evil.com">',
      ];

      for (const input of maliciousInputs) {
        const result = sanitizer.sanitizeString(input);
        expect(result.sanitized).not.toContain('<iframe');
        expect(result.sanitized).not.toContain('<object');
        expect(result.sanitized).not.toContain('<embed');
      }
    });

    it('should encode dangerous characters', () => {
      const input = '<>"\'/ test';
      const result = sanitizer.sanitizeString(input);

      expect(result.sanitized).toContain('&lt;');
      expect(result.sanitized).toContain('&gt;');
      expect(result.sanitized).toContain('&quot;');
      expect(result.sanitized).toContain('&#x27;');
      expect(result.sanitized).toContain('&#x2F;');
    });

    it('should handle vbscript: protocol', () => {
      const maliciousInput = '<a href="vbscript:msgbox(1)">Click</a>';
      const result = sanitizer.sanitizeString(maliciousInput);

      expect(result.sanitized).not.toContain('vbscript:');
    });

    it('should remove expression() CSS attacks', () => {
      const maliciousInput = '<div style="width: expression(alert(1))">test</div>';
      const result = sanitizer.sanitizeString(maliciousInput);

      expect(result.sanitized).not.toMatch(/expression\s*\(/i);
    });

    it('should handle nested script tags', () => {
      const maliciousInput = '<scr<script>ipt>alert(1)</scr</script>ipt>';
      const result = sanitizer.sanitizeString(maliciousInput);

      expect(result.sanitized).not.toContain('<script');
      expect(result.sanitized).not.toContain('alert');
    });

    it('should handle case variations', () => {
      const testCases = [
        '<SCRIPT>alert(1)</SCRIPT>',
        '<ScRiPt>alert(1)</ScRiPt>',
        '<script >alert(1)</script>',
        'JAVASCRIPT:alert(1)',
        'JaVaScRiPt:alert(1)',
      ];

      for (const input of testCases) {
        const result = sanitizer.sanitizeString(input);
        expect(result.sanitized.toLowerCase()).not.toContain('<script');
        expect(result.sanitized.toLowerCase()).not.toContain('javascript:');
      }
    });

    it('should handle URL encoded XSS payloads', () => {
      const maliciousInput = '%3Cscript%3Ealert(1)%3C/script%3E';
      const result = sanitizer.sanitizeString(maliciousInput, { strictMode: true });

      // Strict mode should detect URL encoded characters
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should handle unicode/hex encoded payloads', () => {
      const maliciousInput = '\\x3cscript\\x3ealert(1)\\x3c/script\\x3e';
      const result = sanitizer.sanitizeString(maliciousInput);

      // Should not contain executable code after sanitization
      expect(result.sanitized).not.toMatch(/<script>/i);
    });

    it('should handle null byte injection', () => {
      const maliciousInput = '<script\x00>alert(1)</script>';
      const result = sanitizer.sanitizeString(maliciousInput, { strictMode: true });

      expect(result.violations.some(v => v.includes('Control characters'))).toBe(true);
    });
  });

  describe('InputSanitizer - Object Sanitization', () => {
    it('should sanitize nested objects', () => {
      const maliciousObject = {
        name: '<script>alert("name")</script>',
        details: {
          description: '<img onerror=alert(1) src=x>',
          nested: {
            value: 'javascript:void(0)'
          }
        }
      };

      const result = sanitizer.sanitizeObject(maliciousObject);

      expect(result.sanitized.name).not.toContain('<script>');
      expect(result.sanitized.details.description).not.toMatch(/onerror/i);
      expect(result.sanitized.details.nested.value).not.toContain('javascript:');
      expect(Object.keys(result.violations).length).toBeGreaterThan(0);
    });

    it('should sanitize arrays', () => {
      const maliciousArray = {
        items: [
          '<script>alert(1)</script>',
          '<img src=x onerror=alert(2)>',
          'normal text'
        ]
      };

      const result = sanitizer.sanitizeObject(maliciousArray);

      expect(result.sanitized.items[0]).not.toContain('<script>');
      expect(result.sanitized.items[1]).not.toMatch(/onerror/i);
      expect(result.sanitized.items[2]).toContain('normal text');
    });

    it('should preserve non-string values', () => {
      const mixedObject = {
        count: 42,
        active: true,
        data: null,
        text: '<script>alert(1)</script>'
      };

      const result = sanitizer.sanitizeObject(mixedObject);

      expect(result.sanitized.count).toBe(42);
      expect(result.sanitized.active).toBe(true);
      expect(result.sanitized.data).toBeNull();
      expect(result.sanitized.text).not.toContain('<script>');
    });
  });

  describe('InputValidator - Combined Validation', () => {
    it('should validate and sanitize user input', () => {
      const input = {
        email: 'test@example.com',
        name: '<script>alert("XSS")</script>John',
        message: 'Hello <b>World</b>'
      };

      const rules = [
        { field: 'email', type: 'email' as const, required: true, sanitize: true },
        { field: 'name', type: 'string' as const, required: true, maxLength: 100, sanitize: true },
        { field: 'message', type: 'string' as const, required: false, sanitize: true }
      ];

      const result = validator.validateInput(input, rules);

      expect(result.sanitized.name).not.toContain('<script>');
    });

    it('should reject invalid email with XSS', () => {
      const input = {
        email: '<script>alert(1)</script>@test.com'
      };

      const rules = [
        { field: 'email', type: 'email' as const, required: true, sanitize: true }
      ];

      const result = validator.validateInput(input, rules);

      expect(result.valid).toBe(false);
      expect(result.errors.email).toBeDefined();
    });
  });

  describe('sanitizeHTML - DOMPurify based', () => {
    // Note: DOMPurify only works in browser environment
    // These tests verify server-side fallback behavior

    it('should strip script tags on server-side', () => {
      const input = '<p>Hello</p><script>alert(1)</script><b>World</b>';
      const result = sanitizeHTML(input);

      expect(result).not.toContain('<script');
      expect(result).not.toContain('</script>');
    });

    it('should handle multiple script tags', () => {
      const input = '<script>a</script><script>b</script><script>c</script>';
      const result = sanitizeHTML(input);

      expect(result).not.toContain('<script');
      expect(result).toBe('');
    });
  });

  describe('sanitizeUserInput - Strict mode', () => {
    it('should strip all HTML on server-side', () => {
      const input = '<div><p>Hello</p><span>World</span></div>';
      const result = sanitizeUserInput(input);

      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('should handle dangerous HTML', () => {
      const input = '<img src=x onerror=alert(1)><script>evil()</script>';
      const result = sanitizeUserInput(input);

      expect(result).not.toContain('<img');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('<script');
    });
  });

  describe('sanitizeMarkdown', () => {
    it('should strip script tags from markdown output', () => {
      const input = '# Title\n<script>alert(1)</script>\n\nParagraph';
      const result = sanitizeMarkdown(input);

      expect(result).not.toContain('<script');
    });
  });

  describe('Edge Cases and Bypass Attempts', () => {
    it('should handle SVG-based XSS', () => {
      const maliciousInput = '<svg onload=alert(1)>';
      const result = sanitizer.sanitizeString(maliciousInput);

      expect(result.sanitized).not.toMatch(/onload/i);
    });

    it('should handle data: URI XSS', () => {
      const maliciousInput = '<a href="data:text/html,<script>alert(1)</script>">click</a>';
      const result = sanitizer.sanitizeString(maliciousInput);

      // Should encode or remove the dangerous URI
      expect(result.sanitized).not.toContain('data:text/html');
    });

    it('should handle base64 encoded XSS in data URI', () => {
      const maliciousInput = '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+">';
      const result = sanitizer.sanitizeString(maliciousInput);

      // Dangerous patterns should be encoded
      expect(result.sanitized).not.toContain('<img');
    });

    it('should handle template literal injection', () => {
      const maliciousInput = '${alert(1)}';
      const result = sanitizer.sanitizeString(maliciousInput);

      // Template literals should be escaped
      expect(result.sanitized).not.toBe('${alert(1)}');
    });

    it('should handle import() dynamic imports', () => {
      const maliciousInput = '<script>import("evil.js")</script>';
      const result = sanitizer.sanitizeString(maliciousInput);

      expect(result.sanitized).not.toMatch(/import\s*\(/i);
    });

    it('should handle meta refresh redirect', () => {
      const maliciousInput = '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">';
      const result = sanitizer.sanitizeString(maliciousInput);

      expect(result.sanitized).not.toContain('<meta');
    });

    it('should handle link stylesheet injection', () => {
      const maliciousInput = '<link rel="stylesheet" href="javascript:alert(1)">';
      const result = sanitizer.sanitizeString(maliciousInput);

      expect(result.sanitized).not.toContain('<link');
    });

    it('should handle form action injection', () => {
      const maliciousInput = '<form action="javascript:alert(1)"><input type="submit"></form>';
      const result = sanitizer.sanitizeString(maliciousInput);

      expect(result.sanitized).not.toContain('javascript:');
    });

    it('should handle body onload', () => {
      const maliciousInput = '<body onload="alert(1)">';
      const result = sanitizer.sanitizeString(maliciousInput);

      expect(result.sanitized).not.toMatch(/onload/i);
    });

    it('should handle img with both onerror and src', () => {
      const maliciousInput = '<img src="invalid" onerror="alert(document.cookie)">';
      const result = sanitizer.sanitizeString(maliciousInput);

      expect(result.sanitized).not.toMatch(/onerror/i);
      expect(result.sanitized).not.toContain('document.cookie');
    });
  });

  describe('Real-world XSS Payloads', () => {
    const realWorldPayloads = [
      '<img src=x onerror=alert(1)//>',
      '<svg><script>alert(1)</script></svg>',
      '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
      '"><script>alert(String.fromCharCode(88,83,83))</script>',
      '<img/src="x"onerror=alert(1)>',
      '<body onpageshow=alert(1)>',
      '<input onfocus=alert(1) autofocus>',
      '<marquee onstart=alert(1)>',
      '<video><source onerror=alert(1)>',
      '<audio src=x onerror=alert(1)>',
      '<details open ontoggle=alert(1)>',
      '<object data="javascript:alert(1)">',
      '<embed src="javascript:alert(1)">',
      '"><img src=x onerror=alert(1)><"',
      '\'><img src=x onerror=alert(1)><\'',
    ];

    it.each(realWorldPayloads)('should sanitize real-world payload: %s', (payload) => {
      const result = sanitizer.sanitizeString(payload);

      // Should not contain executable JavaScript after sanitization
      expect(result.sanitized).not.toMatch(/onerror\s*=/i);
      expect(result.sanitized).not.toMatch(/onload\s*=/i);
      expect(result.sanitized).not.toMatch(/javascript:/i);
      expect(result.sanitized).not.toMatch(/<script/i);
      expect(result.sanitized).not.toMatch(/alert\s*\(/i);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large inputs efficiently', () => {
      const largeInput = '<script>alert(1)</script>'.repeat(1000);
      const startTime = Date.now();

      const result = sanitizer.sanitizeString(largeInput);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
      expect(result.sanitized).not.toContain('<script>');
    });

    it('should handle deeply nested objects', () => {
      let nested: any = { value: '<script>alert(1)</script>' };
      for (let i = 0; i < 10; i++) {
        nested = { child: nested };
      }

      const startTime = Date.now();
      const result = sanitizer.sanitizeObject(nested);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(500);

      // Navigate to deepest level
      let current = result.sanitized;
      for (let i = 0; i < 10; i++) {
        current = current.child;
      }
      expect(current.value).not.toContain('<script>');
    });
  });
});
