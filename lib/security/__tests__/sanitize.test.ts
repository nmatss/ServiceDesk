import { sanitizeHTML, sanitizeMarkdown, sanitizeUserInput } from '../sanitize';

describe('HTML Sanitization', () => {
  describe('sanitizeHTML', () => {
    it('should remove script tags', () => {
      const dirty = '<p>Hello</p><script>alert("XSS")</script>';
      const clean = sanitizeHTML(dirty);
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('alert');
    });

    it('should allow safe HTML tags', () => {
      const dirty = '<p>Hello <strong>world</strong></p>';
      const clean = sanitizeHTML(dirty);
      expect(clean).toContain('<p>');
      expect(clean).toContain('<strong>');
    });

    it('should remove event handlers', () => {
      const dirty = '<p onclick="alert(\'XSS\')">Click me</p>';
      const clean = sanitizeHTML(dirty);
      expect(clean).not.toContain('onclick');
      expect(clean).not.toContain('alert');
    });

    it('should allow safe links', () => {
      const dirty = '<a href="https://example.com">Link</a>';
      const clean = sanitizeHTML(dirty);
      expect(clean).toContain('<a');
      expect(clean).toContain('href');
    });

    it('should remove javascript: protocol', () => {
      const dirty = '<a href="javascript:alert(\'XSS\')">Click</a>';
      const clean = sanitizeHTML(dirty);
      expect(clean).not.toContain('javascript:');
    });

    it('should remove data URIs with scripts', () => {
      const dirty = '<img src="data:text/html,<script>alert(\'XSS\')</script>">';
      const clean = sanitizeHTML(dirty);
      expect(clean).not.toContain('data:text/html');
    });
  });

  describe('sanitizeMarkdown', () => {
    it('should allow more permissive tags for markdown', () => {
      const dirty = '<table><tr><td>Cell</td></tr></table>';
      const clean = sanitizeMarkdown(dirty);
      expect(clean).toContain('<table');
    });

    it('should still remove script tags', () => {
      const dirty = '<h1>Title</h1><script>alert("XSS")</script>';
      const clean = sanitizeMarkdown(dirty);
      expect(clean).not.toContain('<script');
    });

    it('should allow images with safe src', () => {
      const dirty = '<img src="https://example.com/image.jpg" alt="Test">';
      const clean = sanitizeMarkdown(dirty);
      expect(clean).toContain('<img');
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

  describe('Server-side behavior', () => {
    // Mock window being undefined to simulate server-side rendering
    const originalWindow = global.window;

    beforeEach(() => {
      // @ts-ignore
      delete global.window;
    });

    afterEach(() => {
      global.window = originalWindow;
    });

    it('should handle server-side sanitization', () => {
      const dirty = '<p>Hello</p><script>alert("XSS")</script>';
      const clean = sanitizeHTML(dirty);
      expect(clean).not.toContain('<script');
    });
  });
});
