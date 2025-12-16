import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param dirty - Unsanitized HTML string
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeHTML(dirty: string): string {
  if (typeof window === 'undefined') {
    // Server-side: use a basic sanitizer to remove script tags
    // For full server-side sanitization, consider using isomorphic-dompurify
    return dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
  });
}

/**
 * Sanitizes markdown-rendered HTML content
 * Uses more permissive settings for rich content
 * @param dirty - Unsanitized HTML from markdown
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeMarkdown(dirty: string): string {
  if (typeof window === 'undefined') {
    // Server-side: basic sanitization
    return dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id', 'src', 'alt', 'title', 'width', 'height'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitizes HTML with very strict settings (for untrusted user input)
 * @param dirty - Unsanitized user input
 * @returns Sanitized HTML with minimal tags
 */
export function sanitizeUserInput(dirty: string): string {
  if (typeof window === 'undefined') {
    // Server-side: strip all HTML
    return dirty.replace(/<[^>]*>/g, '');
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
  });
}
