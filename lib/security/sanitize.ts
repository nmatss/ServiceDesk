import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitiza HTML removendo XSS
 * Funciona tanto no cliente quanto no servidor (SSR-safe)
 */
export function sanitizeHTML(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
      'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true
  });
}

/**
 * Sanitiza Markdown convertendo para HTML seguro
 */
export function sanitizeMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(markdown, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
      'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img', 'hr'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id', 'src', 'alt', 'title', 'width', 'height'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true
  });
}

/**
 * Remove TODAS as tags HTML (apenas texto)
 */
export function stripHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
}

/**
 * Sanitiza HTML com configuração muito restritiva (input não confiável)
 */
export function sanitizeUserInput(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true
  });
}

/**
 * Sanitiza atributos style CSS
 */
export function sanitizeCSS(css: string): string {
  if (!css || typeof css !== 'string') {
    return '';
  }

  // Remover propriedades perigosas
  const dangerous = [
    'expression',
    'javascript:',
    'vbscript:',
    'data:',
    'import',
    '@import',
    'behavior',
    '-moz-binding'
  ];

  let safe = css;
  for (const pattern of dangerous) {
    safe = safe.replace(new RegExp(pattern, 'gi'), '');
  }

  return safe;
}

/**
 * Sanitiza URL removendo javascript:, data:, vbscript:
 */
export function sanitizeURL(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const dangerous = /^(javascript|data|vbscript|file|about):/i;
  if (dangerous.test(url.trim())) {
    return '';
  }

  // Permitir apenas http, https, mailto, tel, paths relativos
  const safe = /^(https?|mailto|tel):/i;
  if (!safe.test(url.trim()) && !url.startsWith('/') && !url.startsWith('#')) {
    return '';
  }

  return url;
}
