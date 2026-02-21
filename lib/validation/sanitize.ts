import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML input, allowing safe tags (b, i, em, strong, a, p, br, ul, ol, li, etc.)
 */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input);
}

/**
 * Strip ALL HTML tags, returning plain text only
 */
export function sanitizeText(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}
