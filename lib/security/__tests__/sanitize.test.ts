import { describe, it, expect } from 'vitest';
import { sanitizeHTML, stripHTML, sanitizeURL, sanitizeMarkdown, sanitizeCSS, sanitizeUserInput } from '../sanitize';

describe('XSS Protection', () => {
  describe('sanitizeHTML', () => {
    it('should remove script tags', () => {
      const result = sanitizeHTML('<script>alert("XSS")</script>');
      expect(result).toBe('');
    });

    it('should remove event handlers', () => {
      const result1 = sanitizeHTML('<img src=x onerror=alert(1)>');
      expect(result1).not.toContain('onerror');

      const result2 = sanitizeHTML('<div onclick=alert(1)>test</div>');
      expect(result2).not.toContain('onclick');
    });

    it('should remove javascript: URLs', () => {
      const result = sanitizeHTML('<a href="javascript:alert(1)">click</a>');
      expect(result).not.toContain('javascript:');
    });

    it('should remove data: URLs', () => {
      const result = sanitizeHTML('<a href="data:text/html,<script>alert(1)</script>">click</a>');
      expect(result).not.toContain('data:');
    });

    it('should allow safe HTML', () => {
      const safe = '<p>Hello <strong>world</strong></p>';
      const result = sanitizeHTML(safe);
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('Hello');
      expect(result).toContain('world');
    });

    it('should allow safe links', () => {
      const safe = '<a href="https://example.com">Link</a>';
      const result = sanitizeHTML(safe);
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('Link');
    });

    it('should handle empty or invalid input', () => {
      expect(sanitizeHTML('')).toBe('');
      expect(sanitizeHTML(null as any)).toBe('');
      expect(sanitizeHTML(undefined as any)).toBe('');
    });

    it('should prevent XSS via style attribute', () => {
      const malicious = '<div style="background:url(javascript:alert(1))">test</div>';
      const result = sanitizeHTML(malicious);
      expect(result).not.toContain('javascript:');
    });

    it('should prevent XSS via iframe', () => {
      const malicious = '<iframe src="javascript:alert(1)"></iframe>';
      const result = sanitizeHTML(malicious);
      expect(result).toBe('');
    });
  });

  describe('stripHTML', () => {
    it('should remove all tags', () => {
      const result = stripHTML('<p>Hello <strong>world</strong></p>');
      expect(result).toBe('Hello world');
    });

    it('should remove script tags and content', () => {
      const result = stripHTML('<script>alert(1)</script>Hello');
      expect(result).toBe('Hello');
    });

    it('should keep text content', () => {
      const result = stripHTML('<div><span>Keep</span> this <b>text</b></div>');
      expect(result).toBe('Keep this text');
    });

    it('should handle empty input', () => {
      expect(stripHTML('')).toBe('');
      expect(stripHTML(null as any)).toBe('');
    });
  });

  describe('sanitizeURL', () => {
    it('should block javascript: URLs', () => {
      expect(sanitizeURL('javascript:alert(1)')).toBe('');
      expect(sanitizeURL('JavaScript:alert(1)')).toBe('');
    });

    it('should block data: URLs', () => {
      expect(sanitizeURL('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    it('should block vbscript: URLs', () => {
      expect(sanitizeURL('vbscript:msgbox(1)')).toBe('');
    });

    it('should block file: URLs', () => {
      expect(sanitizeURL('file:///etc/passwd')).toBe('');
    });

    it('should allow https URLs', () => {
      const url = 'https://example.com';
      expect(sanitizeURL(url)).toBe(url);
    });

    it('should allow http URLs', () => {
      const url = 'http://example.com';
      expect(sanitizeURL(url)).toBe(url);
    });

    it('should allow mailto URLs', () => {
      const url = 'mailto:test@example.com';
      expect(sanitizeURL(url)).toBe(url);
    });

    it('should allow tel URLs', () => {
      const url = 'tel:+1234567890';
      expect(sanitizeURL(url)).toBe(url);
    });

    it('should allow relative paths', () => {
      expect(sanitizeURL('/path/to/page')).toBe('/path/to/page');
      expect(sanitizeURL('#anchor')).toBe('#anchor');
    });

    it('should handle empty input', () => {
      expect(sanitizeURL('')).toBe('');
      expect(sanitizeURL(null as any)).toBe('');
    });
  });

  describe('sanitizeMarkdown', () => {
    it('should allow markdown-safe HTML', () => {
      const markdown = '<h1>Title</h1><p>Paragraph</p>';
      const result = sanitizeMarkdown(markdown);
      expect(result).toContain('<h1>');
      expect(result).toContain('Title');
    });

    it('should remove dangerous tags', () => {
      const markdown = '<h1>Safe</h1><script>alert(1)</script>';
      const result = sanitizeMarkdown(markdown);
      expect(result).toContain('Safe');
      expect(result).not.toContain('script');
    });

    it('should allow images', () => {
      const markdown = '<img src="https://example.com/image.jpg" alt="Test">';
      const result = sanitizeMarkdown(markdown);
      expect(result).toContain('img');
      expect(result).toContain('src="https://example.com/image.jpg"');
    });

    it('should allow tables', () => {
      const markdown = '<table><tr><td>Cell</td></tr></table>';
      const result = sanitizeMarkdown(markdown);
      expect(result).toContain('table');
      expect(result).toContain('Cell');
    });
  });

  describe('sanitizeCSS', () => {
    it('should remove javascript: in CSS', () => {
      const css = 'background:url(javascript:alert(1))';
      const result = sanitizeCSS(css);
      expect(result).not.toContain('javascript:');
    });

    it('should remove expression()', () => {
      const css = 'width:expression(alert(1))';
      const result = sanitizeCSS(css);
      expect(result).not.toContain('expression');
    });

    it('should remove @import', () => {
      const css = '@import url(evil.css)';
      const result = sanitizeCSS(css);
      expect(result).not.toContain('@import');
    });

    it('should remove -moz-binding', () => {
      const css = '-moz-binding:url(xss.xml)';
      const result = sanitizeCSS(css);
      expect(result).not.toContain('-moz-binding');
    });

    it('should allow safe CSS', () => {
      const css = 'color:red;font-size:14px';
      const result = sanitizeCSS(css);
      expect(result).toContain('color:red');
      expect(result).toContain('font-size:14px');
    });
  });

  describe('sanitizeUserInput', () => {
    it('should only allow very basic formatting', () => {
      const dirty = '<p>Hello <strong>world</strong></p>';
      const clean = sanitizeUserInput(dirty);
      expect(clean).toContain('<p>');
      expect(clean).toContain('<strong>');
    });

    it('should remove links', () => {
      const dirty = '<p>Check <a href="https://example.com">this</a></p>';
      const clean = sanitizeUserInput(dirty);
      expect(clean).not.toContain('<a');
    });

    it('should remove script tags', () => {
      const dirty = '<p>Hello</p><script>alert("XSS")</script>';
      const clean = sanitizeUserInput(dirty);
      expect(clean).not.toContain('<script');
    });
  });

  describe('Edge Cases', () => {
    it('should handle nested tags', () => {
      const nested = '<div><script><script>alert(1)</script></script></div>';
      const result = sanitizeHTML(nested);
      expect(result).not.toContain('script');
    });

    it('should handle malformed HTML', () => {
      const malformed = '<div<script>alert(1)</script>>';
      const result = sanitizeHTML(malformed);
      expect(result).not.toContain('script');
    });

    it('should handle Unicode attacks', () => {
      const unicode = '<script\u0000>alert(1)</script>';
      const result = sanitizeHTML(unicode);
      expect(result).not.toContain('alert');
    });

    it('should handle case variations', () => {
      const cases = '<ScRiPt>alert(1)</sCrIpT>';
      const result = sanitizeHTML(cases);
      expect(result).not.toContain('alert');
    });
  });
});
