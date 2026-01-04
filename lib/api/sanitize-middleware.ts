import { sanitizeHTML, stripHTML, sanitizeURL } from '@/lib/security/sanitize';

export interface SanitizationOptions {
  /** Campos que devem ser sanitizados como HTML (permitir tags seguras) */
  htmlFields?: string[];

  /** Campos que devem ter TODAS as tags removidas (apenas texto) */
  stripFields?: string[];

  /** Campos que são URLs e devem ser validados */
  urlFields?: string[];

  /** Modo estrito: remove HTML de TODOS os campos string */
  strict?: boolean;
}

/**
 * Sanitiza recursivamente um objeto removendo XSS
 */
export function sanitizeObject(
  obj: any,
  options: SanitizationOptions = {}
): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Primitivos
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return options.strict ? stripHTML(obj) : obj;
    }
    return obj;
  }

  // Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }

  // Objetos
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Campos HTML (permitir tags seguras)
    if (options.htmlFields?.includes(key) && typeof value === 'string') {
      sanitized[key] = sanitizeHTML(value);
      continue;
    }

    // Campos strip (remover TODAS as tags)
    if (options.stripFields?.includes(key) && typeof value === 'string') {
      sanitized[key] = stripHTML(value);
      continue;
    }

    // Campos URL
    if (options.urlFields?.includes(key) && typeof value === 'string') {
      sanitized[key] = sanitizeURL(value);
      continue;
    }

    // Recursivo
    sanitized[key] = sanitizeObject(value, options);
  }

  return sanitized;
}

/**
 * Middleware para sanitizar request body
 */
export async function sanitizeRequestBody(
  body: any,
  options: SanitizationOptions = {}
): Promise<any> {
  return sanitizeObject(body, options);
}
