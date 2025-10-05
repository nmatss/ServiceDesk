/**
 * Input Sanitization and Validation Middleware
 * Comprehensive protection against injection attacks and malicious input
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecurityConfig } from './config';
import { securityLogger, SecurityEventType } from './monitoring';

export interface SanitizationOptions {
  allowHtml?: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  maxLength?: number;
  preventXSS?: boolean;
  preventSQLInjection?: boolean;
  customSanitizers?: Record<string, (input: string) => string>;
  strictMode?: boolean;
}

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'email' | 'url' | 'phone' | 'cpf' | 'cnpj';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  sanitize?: boolean;
  customValidator?: (value: any) => boolean | string;
}

/**
 * Input Sanitizer
 */
export class InputSanitizer {
  private config = getSecurityConfig();

  /**
   * Sanitize string input
   */
  public sanitizeString(
    input: string,
    options: SanitizationOptions = {}
  ): { sanitized: string; violations: string[] } {
    const violations: string[] = [];
    let sanitized = input;

    // Basic length check
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
      violations.push(`Input truncated to ${options.maxLength} characters`);
    }

    // XSS prevention
    if (options.preventXSS !== false) {
      const xssResult = this.preventXSS(sanitized);
      sanitized = xssResult.sanitized;
      violations.push(...xssResult.violations);
    }

    // SQL injection prevention
    if (options.preventSQLInjection !== false) {
      const sqlResult = this.preventSQLInjection(sanitized);
      sanitized = sqlResult.sanitized;
      violations.push(...sqlResult.violations);
    }

    // HTML sanitization
    if (!options.allowHtml) {
      sanitized = this.stripHTML(sanitized);
    } else if (options.allowedTags || options.allowedAttributes) {
      sanitized = this.sanitizeHTML(sanitized, options);
    }

    // Custom sanitizers
    if (options.customSanitizers) {
      for (const [key, sanitizer] of Object.entries(options.customSanitizers)) {
        if (sanitized.includes(key)) {
          sanitized = sanitizer(sanitized);
        }
      }
    }

    // Strict mode additional checks
    if (options.strictMode || this.config.inputSanitization.strictMode) {
      const strictResult = this.strictModeChecks(sanitized);
      sanitized = strictResult.sanitized;
      violations.push(...strictResult.violations);
    }

    return { sanitized, violations };
  }

  /**
   * Prevent XSS attacks
   */
  private preventXSS(input: string): { sanitized: string; violations: string[] } {
    const violations: string[] = [];
    let sanitized = input;

    // Common XSS patterns
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /onmouseover\s*=/gi,
      /onfocus\s*=/gi,
      /onblur\s*=/gi,
      /onchange\s*=/gi,
      /onsubmit\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /<link\b[^>]*>/gi,
      /<meta\b[^>]*>/gi,
      /expression\s*\(/gi,
      /url\s*\(/gi,
      /import\s*\(/gi
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(sanitized)) {
        violations.push(`XSS pattern detected: ${pattern.source}`);
        sanitized = sanitized.replace(pattern, '');
      }
    }

    // Encode dangerous characters
    sanitized = sanitized
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    return { sanitized, violations };
  }

  /**
   * Prevent SQL injection attacks
   */
  private preventSQLInjection(input: string): { sanitized: string; violations: string[] } {
    const violations: string[] = [];
    let sanitized = input;

    // SQL injection patterns
    const sqlPatterns = [
      /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|MERGE|SELECT|UPDATE|UNION|USE)\b)/gi,
      /((\b(AND|OR)\b\s+\d+\s*=\s*\d+)|(\b(AND|OR)\b\s+['"][^'"]*['"]))/gi,
      /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT|ONLOAD|ONERROR|ONCLICK)\b)/gi,
      /([\s\S]*((\%27)|(\')|(--)|(\%23)|(#))[\s\S]*)/gi,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(--)|(\%3B)|(;))/gi,
      /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
      /((\%27)|(\'))union/gi,
      /exec(\s|\+)+(s|x)p\w+/gi,
      /UNION(?:\s+ALL)?\s+SELECT/gi,
      /'\s*(OR|AND)\s*'\w*'\s*=\s*'\w*'/gi,
      /'\s*(OR|AND)\s*\d+\s*=\s*\d+/gi,
      /'\s*;\s*(DROP|DELETE|INSERT|UPDATE)\s+/gi,
      /benchmark\s*\(/gi,
      /sleep\s*\(/gi,
      /waitfor\s+delay/gi
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(sanitized)) {
        violations.push(`SQL injection pattern detected: ${pattern.source}`);
        // For SQL injection, we're more aggressive and remove the entire input
        sanitized = '';
        break;
      }
    }

    return { sanitized, violations };
  }

  /**
   * Strip HTML tags
   */
  private stripHTML(input: string): string {
    return input.replace(/<[^>]*>/g, '');
  }

  /**
   * Sanitize HTML with allowed tags and attributes
   */
  private sanitizeHTML(input: string, options: SanitizationOptions): string {
    const allowedTags = options.allowedTags || this.config.inputSanitization.allowedTags;
    const allowedAttributes = options.allowedAttributes || this.config.inputSanitization.allowedAttributes;

    // Simple HTML sanitization - in production, use a proper library like DOMPurify
    let sanitized = input;

    // Remove all tags except allowed ones
    sanitized = sanitized.replace(/<(\/?[^>]+)>/g, (match, tag) => {
      const tagName = tag.replace(/^\//, '').split(' ')[0].toLowerCase();

      if (allowedTags.includes(tagName)) {
        // Check attributes
        if (allowedAttributes[tagName] || allowedAttributes['*']) {
          // Simplified attribute filtering
          return match;
        }
        return `<${tagName}>`;
      }

      return '';
    });

    return sanitized;
  }

  /**
   * Strict mode additional security checks
   */
  private strictModeChecks(input: string): { sanitized: string; violations: string[] } {
    const violations: string[] = [];
    let sanitized = input;

    // Check for encoded attacks
    const encodedPatterns = [
      /%3C/gi, // <
      /%3E/gi, // >
      /%22/gi, // "
      /%27/gi, // '
      /%2F/gi, // /
      /%3D/gi, // =
      /%3B/gi, // ;
      /%28/gi, // (
      /%29/gi  // )
    ];

    for (const pattern of encodedPatterns) {
      if (pattern.test(sanitized)) {
        violations.push(`Encoded character detected: ${pattern.source}`);
        sanitized = sanitized.replace(pattern, '');
      }
    }

    // Check for null bytes and control characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(sanitized)) {
      violations.push('Control characters detected');
      sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    return { sanitized, violations };
  }

  /**
   * Sanitize object recursively
   */
  public sanitizeObject(
    obj: any,
    options: SanitizationOptions = {}
  ): { sanitized: any; violations: Record<string, string[]> } {
    const violations: Record<string, string[]> = {};

    const sanitize = (value: any, path: string): any => {
      if (typeof value === 'string') {
        const result = this.sanitizeString(value, options);
        if (result.violations.length > 0) {
          violations[path] = result.violations;
        }
        return result.sanitized;
      } else if (Array.isArray(value)) {
        return value.map((item, index) => sanitize(item, `${path}[${index}]`));
      } else if (typeof value === 'object' && value !== null) {
        const sanitizedObj: any = {};
        for (const [key, val] of Object.entries(value)) {
          sanitizedObj[key] = sanitize(val, path ? `${path}.${key}` : key);
        }
        return sanitizedObj;
      }
      return value;
    };

    return {
      sanitized: sanitize(obj, ''),
      violations
    };
  }
}

/**
 * Input Validator
 */
export class InputValidator {
  /**
   * Validate input against rules
   */
  public validateInput(data: any, rules: ValidationRule[]): {
    valid: boolean;
    errors: Record<string, string[]>;
    sanitized: any;
  } {
    const errors: Record<string, string[]> = {};
    const sanitized: any = { ...data };
    const sanitizer = new InputSanitizer();

    for (const rule of rules) {
      const fieldErrors: string[] = [];
      const value = data[rule.field];

      // Required check
      if (rule.required && (value === undefined || value === null || value === '')) {
        fieldErrors.push(`${rule.field} is required`);
        continue;
      }

      // Skip validation if not required and empty
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type validation
      const typeError = this.validateType(value, rule.type);
      if (typeError) {
        fieldErrors.push(typeError);
      }

      // Length validation
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          fieldErrors.push(`${rule.field} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          fieldErrors.push(`${rule.field} must not exceed ${rule.maxLength} characters`);
        }
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        fieldErrors.push(`${rule.field} format is invalid`);
      }

      // Custom validation
      if (rule.customValidator) {
        const customResult = rule.customValidator(value);
        if (customResult !== true) {
          fieldErrors.push(typeof customResult === 'string' ? customResult : `${rule.field} is invalid`);
        }
      }

      // Sanitization
      if (rule.sanitize && typeof value === 'string') {
        const sanitizeResult = sanitizer.sanitizeString(value);
        sanitized[rule.field] = sanitizeResult.sanitized;
        if (sanitizeResult.violations.length > 0) {
          fieldErrors.push(...sanitizeResult.violations.map(v => `${rule.field}: ${v}`));
        }
      }

      if (fieldErrors.length > 0) {
        errors[rule.field] = fieldErrors;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Validate specific data types
   */
  private validateType(value: any, type: string): string | null {
    switch (type) {
      case 'string':
        return typeof value !== 'string' ? 'Must be a string' : null;

      case 'number':
        return isNaN(Number(value)) ? 'Must be a number' : null;

      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !emailPattern.test(value) ? 'Must be a valid email' : null;

      case 'url':
        try {
          new URL(value);
          return null;
        } catch {
          return 'Must be a valid URL';
        }

      case 'phone':
        const phonePattern = /^\+?[\d\s\-\(\)]{10,}$/;
        return !phonePattern.test(value) ? 'Must be a valid phone number' : null;

      case 'cpf':
        return this.validateCPF(value) ? null : 'Must be a valid CPF';

      case 'cnpj':
        return this.validateCNPJ(value) ? null : 'Must be a valid CNPJ';

      default:
        return null;
    }
  }

  /**
   * Validate Brazilian CPF
   */
  private validateCPF(cpf: string): boolean {
    const cleaned = cpf.replace(/\D/g, '');

    if (cleaned.length !== 11 || /^(\d)\1{10}$/.test(cleaned)) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned.charAt(i)) * (10 - i);
    }

    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;

    if (digit !== parseInt(cleaned.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned.charAt(i)) * (11 - i);
    }

    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;

    return digit === parseInt(cleaned.charAt(10));
  }

  /**
   * Validate Brazilian CNPJ
   */
  private validateCNPJ(cnpj: string): boolean {
    const cleaned = cnpj.replace(/\D/g, '');

    if (cleaned.length !== 14 || /^(\d)\1{13}$/.test(cleaned)) {
      return false;
    }

    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleaned.charAt(i)) * weights1[i];
    }

    let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (digit !== parseInt(cleaned.charAt(12))) return false;

    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cleaned.charAt(i)) * weights2[i];
    }

    digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return digit === parseInt(cleaned.charAt(13));
  }
}

/**
 * Request sanitization middleware
 */
export function createSanitizationMiddleware(options: SanitizationOptions = {}) {
  const sanitizer = new InputSanitizer();

  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Skip sanitization for GET requests and specific paths
    if (request.method === 'GET' || request.nextUrl.pathname.startsWith('/_next/')) {
      return null;
    }

    try {
      // Get request body
      const body = await request.json().catch(() => null);

      if (body) {
        // Sanitize request body
        const result = sanitizer.sanitizeObject(body, options);

        // Log violations if any
        if (Object.keys(result.violations).length > 0) {
          await securityLogger.logEvent(
            SecurityEventType.XSS_ATTEMPT,
            {
              violations: result.violations,
              originalBody: body,
              sanitizedBody: result.sanitized,
              url: request.url,
              method: request.method
            },
            {
              severity: 'medium',
              ipAddress: request.ip,
              userAgent: request.headers.get('user-agent') || undefined
            }
          );
        }

        // Create new request with sanitized body
        const newRequest = new NextRequest(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(result.sanitized)
        });

        return NextResponse.next({
          request: newRequest
        });
      }
    } catch (error) {
      console.error('Sanitization middleware error:', error);
    }

    return null;
  };
}

/**
 * Common validation rules
 */
export const commonValidationRules = {
  email: (): ValidationRule => ({
    field: 'email',
    type: 'email',
    required: true,
    maxLength: 255,
    sanitize: true
  }),

  password: (): ValidationRule => ({
    field: 'password',
    type: 'string',
    required: true,
    minLength: 8,
    maxLength: 128,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    customValidator: (value: string) => {
      if (!/(?=.*[a-z])/.test(value)) return 'Password must contain at least one lowercase letter';
      if (!/(?=.*[A-Z])/.test(value)) return 'Password must contain at least one uppercase letter';
      if (!/(?=.*\d)/.test(value)) return 'Password must contain at least one number';
      if (!/(?=.*[@$!%*?&])/.test(value)) return 'Password must contain at least one special character';
      return true;
    }
  }),

  name: (): ValidationRule => ({
    field: 'name',
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 100,
    sanitize: true
  }),

  phone: (): ValidationRule => ({
    field: 'phone',
    type: 'phone',
    required: false,
    sanitize: true
  }),

  cpf: (): ValidationRule => ({
    field: 'cpf',
    type: 'cpf',
    required: false,
    sanitize: true
  }),

  cnpj: (): ValidationRule => ({
    field: 'cnpj',
    type: 'cnpj',
    required: false,
    sanitize: true
  })
};

/**
 * Export singleton instances
 */
export const inputSanitizer = new InputSanitizer();
export const inputValidator = new InputValidator();