/**
 * Enterprise Security Configuration
 * Centralized security settings for the ServiceDesk application
 */

export interface SecurityConfig {
  cors: CorsConfig;
  csp: CspConfig;
  encryption: EncryptionConfig;
  pii: PiiConfig;
  lgpd: LgpdConfig;
  monitoring: MonitoringConfig;
  vulnerabilityScanning: VulnerabilityConfig;
  inputSanitization: SanitizationConfig;
}

export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  preflightContinue: boolean;
  optionsSuccessStatus: number;
}

export interface CspConfig {
  useNonce: boolean;
  reportUri: string;
  reportOnly: boolean;
  directives: {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    fontSrc: string[];
    connectSrc: string[];
    mediaSrc: string[];
    objectSrc: string[];
    frameSrc: string[];
    workerSrc: string[];
    manifestSrc: string[];
    baseUri: string[];
    formAction: string[];
    frameAncestors: string[];
    upgradeInsecureRequests: boolean;
  };
}

export interface EncryptionConfig {
  atRest: {
    enabled: boolean;
    algorithm: string;
    keyRotationDays: number;
    backupEncryption: boolean;
  };
  inTransit: {
    enforceHttps: boolean;
    hsts: {
      enabled: boolean;
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
    tlsVersion: string;
  };
  fieldLevel: {
    enabled: boolean;
    sensitiveFields: string[];
    algorithm: string;
  };
}

export interface PiiConfig {
  detection: {
    enabled: boolean;
    patterns: Record<string, RegExp>;
    confidence: number;
  };
  masking: {
    enabled: boolean;
    strategies: Record<string, string>;
    preserveFormat: boolean;
  };
  logging: {
    logDetections: boolean;
    logMasking: boolean;
  };
}

export interface LgpdConfig {
  enabled: boolean;
  dataRetentionDays: number;
  consentTracking: boolean;
  rightToErasure: boolean;
  dataPortability: boolean;
  automaticDeletion: boolean;
  auditLogging: boolean;
  consentExpireDays: number;
}

export interface MonitoringConfig {
  securityEvents: {
    enabled: boolean;
    logLevel: string;
    retention: number;
  };
  anomalyDetection: {
    enabled: boolean;
    thresholds: Record<string, number>;
  };
  alerting: {
    enabled: boolean;
    webhooks: string[];
    emailAlerts: string[];
  };
}

export interface VulnerabilityConfig {
  enabled: boolean;
  scanFrequency: string;
  tools: string[];
  autoRemediation: boolean;
  alertThreshold: string;
}

export interface SanitizationConfig {
  enabled: boolean;
  strictMode: boolean;
  allowedTags: string[];
  allowedAttributes: Record<string, string[]>;
  customSanitizers: Record<string, (input: string) => string>;
}

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(): SecurityConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    cors: {
      allowedOrigins: isProduction
        ? (process.env.ALLOWED_ORIGINS?.split(',') || ['https://servicedesk.com'])
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Tenant-ID',
        'X-Tenant-Slug',
        'X-CSP-Nonce',
        'X-Request-ID'
      ],
      exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining'],
      credentials: true,
      maxAge: 86400, // 24 hours
      preflightContinue: false,
      optionsSuccessStatus: 204
    },

    csp: {
      useNonce: true,
      reportUri: process.env.CSP_REPORT_URI || '/api/security/csp-report',
      reportOnly: isDevelopment,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-eval'", // Required for Next.js development
          ...(isDevelopment ? ["'unsafe-inline'"] : []),
          'https://cdn.socket.io',
          'https://js.stripe.com'
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for Tailwind CSS
          'https://fonts.googleapis.com'
        ],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https:',
          process.env.NEXT_PUBLIC_CDN_URL || ''
        ].filter(Boolean),
        fontSrc: [
          "'self'",
          'data:',
          'https://fonts.gstatic.com',
          'https://fonts.googleapis.com'
        ],
        connectSrc: [
          "'self'",
          'https://api.stripe.com',
          'wss://servicedesk.com',
          ...(isDevelopment ? ['ws://localhost:3000', 'http://localhost:3000'] : [])
        ],
        mediaSrc: ["'self'", 'data:', 'blob:'],
        objectSrc: ["'none'"],
        frameSrc: ["'self'", 'https://js.stripe.com'],
        workerSrc: ["'self'", 'blob:'],
        manifestSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: isProduction
      }
    },

    encryption: {
      atRest: {
        enabled: true,
        algorithm: 'AES-256-GCM',
        keyRotationDays: 90,
        backupEncryption: true
      },
      inTransit: {
        enforceHttps: isProduction,
        hsts: {
          enabled: isProduction,
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true
        },
        tlsVersion: '1.3'
      },
      fieldLevel: {
        enabled: true,
        sensitiveFields: [
          'password',
          'credit_card',
          'ssn',
          'cpf',
          'phone',
          'address',
          'bank_account'
        ],
        algorithm: 'AES-256-GCM'
      }
    },

    pii: {
      detection: {
        enabled: true,
        patterns: {
          email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          cpf: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
          cnpj: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
          phone: /\b(?:\+55\s?)?(?:\(\d{2}\)\s?)?\d{4,5}-?\d{4}\b/g,
          creditCard: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
          bankAccount: /\b\d{4,6}-?\d{1,2}\b/g
        },
        confidence: 0.8
      },
      masking: {
        enabled: true,
        strategies: {
          email: 'partial', // user***@domain.com
          cpf: 'middle',    // 123.***.**-45
          cnpj: 'middle',   // 12.***.***/****-89
          phone: 'middle',  // (11) ****-5678
          creditCard: 'middle', // **** **** **** 1234
          bankAccount: 'full'   // ****-*
        },
        preserveFormat: true
      },
      logging: {
        logDetections: true,
        logMasking: false // Don't log masked data
      }
    },

    lgpd: {
      enabled: true,
      dataRetentionDays: 1095, // 3 years
      consentTracking: true,
      rightToErasure: true,
      dataPortability: true,
      automaticDeletion: true,
      auditLogging: true,
      consentExpireDays: 730 // 2 years
    },

    monitoring: {
      securityEvents: {
        enabled: true,
        logLevel: isProduction ? 'warn' : 'debug',
        retention: 90 // days
      },
      anomalyDetection: {
        enabled: true,
        thresholds: {
          failedLogins: 5,
          requestsPerMinute: 100,
          dataExfiltration: 1000000, // 1MB
          suspiciousPatterns: 3
        }
      },
      alerting: {
        enabled: isProduction,
        webhooks: process.env.SECURITY_WEBHOOKS?.split(',') || [],
        emailAlerts: process.env.SECURITY_EMAILS?.split(',') || []
      }
    },

    vulnerabilityScanning: {
      enabled: true,
      scanFrequency: isProduction ? 'daily' : 'weekly',
      tools: ['npm-audit', 'snyk', 'owasp-zap'],
      autoRemediation: false,
      alertThreshold: 'medium'
    },

    inputSanitization: {
      enabled: true,
      strictMode: isProduction,
      allowedTags: [
        'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'code', 'pre'
      ],
      allowedAttributes: {
        '*': ['class', 'id'],
        'a': ['href', 'title', 'target'],
        'img': ['src', 'alt', 'title', 'width', 'height']
      },
      customSanitizers: {}
    }
  };
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(config: SecurityConfig): string[] {
  const errors: string[] = [];

  // Validate CORS
  if (!config.cors.allowedOrigins.length) {
    errors.push('CORS: At least one allowed origin must be specified');
  }

  // Validate CSP
  if (config.csp.useNonce && !config.csp.reportUri) {
    errors.push('CSP: Report URI must be specified when using nonce');
  }

  // Validate encryption
  if (config.encryption.atRest.enabled && !process.env.ENCRYPTION_KEY) {
    errors.push('Encryption: ENCRYPTION_KEY environment variable required');
  }

  // Validate LGPD
  if (config.lgpd.enabled && config.lgpd.dataRetentionDays < 1) {
    errors.push('LGPD: Data retention period must be at least 1 day');
  }

  return errors;
}