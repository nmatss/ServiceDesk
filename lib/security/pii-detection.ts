/**
 * PII Detection and Data Masking System
 * Advanced pattern recognition and data protection for sensitive information
 */

import { getSecurityConfig } from './config';

export interface PiiDetectionResult {
  hasPii: boolean;
  detections: PiiDetection[];
  confidence: number;
  maskedText?: string;
}

export interface PiiDetection {
  type: string;
  pattern: string;
  position: { start: number; end: number };
  confidence: number;
  originalValue: string;
  maskedValue: string;
}

export interface PiiMaskingOptions {
  strategy: 'full' | 'partial' | 'middle' | 'hash';
  preserveFormat: boolean;
  maskChar: string;
  customMasker?: (value: string) => string;
}

/**
 * PII Detection and Masking Engine
 */
export class PiiDetector {
  private config = getSecurityConfig();
  private patterns: Map<string, RegExp>;
  private maskingStrategies: Map<string, PiiMaskingOptions>;

  constructor() {
    this.patterns = new Map(Object.entries(this.config.pii.detection.patterns));
    this.initializeMaskingStrategies();
  }

  /**
   * Initialize masking strategies for different PII types
   */
  private initializeMaskingStrategies(): void {
    this.maskingStrategies = new Map([
      ['email', {
        strategy: 'partial',
        preserveFormat: true,
        maskChar: '*',
        customMasker: this.maskEmail.bind(this)
      }],
      ['cpf', {
        strategy: 'middle',
        preserveFormat: true,
        maskChar: '*'
      }],
      ['cnpj', {
        strategy: 'middle',
        preserveFormat: true,
        maskChar: '*'
      }],
      ['phone', {
        strategy: 'middle',
        preserveFormat: true,
        maskChar: '*'
      }],
      ['creditCard', {
        strategy: 'middle',
        preserveFormat: true,
        maskChar: '*'
      }],
      ['bankAccount', {
        strategy: 'full',
        preserveFormat: false,
        maskChar: '*'
      }]
    ]);
  }

  /**
   * Detect PII in text
   */
  public detectPii(text: string): PiiDetectionResult {
    const detections: PiiDetection[] = [];
    let maskedText = text;

    for (const [type, pattern] of this.patterns.entries()) {
      const matches = Array.from(text.matchAll(pattern));

      for (const match of matches) {
        if (match.index !== undefined) {
          const originalValue = match[0];
          const confidence = this.calculateConfidence(type, originalValue);

          if (confidence >= this.config.pii.detection.confidence) {
            const maskedValue = this.maskValue(originalValue, type);

            const detection: PiiDetection = {
              type,
              pattern: pattern.source,
              position: {
                start: match.index,
                end: match.index + originalValue.length
              },
              confidence,
              originalValue,
              maskedValue
            };

            detections.push(detection);

            // Replace in masked text
            maskedText = maskedText.replace(originalValue, maskedValue);
          }
        }
      }
    }

    return {
      hasPii: detections.length > 0,
      detections,
      confidence: detections.length > 0
        ? detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length
        : 0,
      maskedText: detections.length > 0 ? maskedText : undefined
    };
  }

  /**
   * Calculate confidence score for PII detection
   */
  private calculateConfidence(type: string, value: string): number {
    let confidence = 0.7; // Base confidence

    switch (type) {
      case 'email':
        // Check for valid email structure
        if (value.includes('@') && value.includes('.')) {
          confidence = 0.95;
        }
        break;

      case 'cpf':
        // Validate CPF checksum
        if (this.validateCpf(value)) {
          confidence = 0.98;
        }
        break;

      case 'cnpj':
        // Validate CNPJ checksum
        if (this.validateCnpj(value)) {
          confidence = 0.98;
        }
        break;

      case 'phone':
        // Brazilian phone validation
        if (this.validateBrazilianPhone(value)) {
          confidence = 0.9;
        }
        break;

      case 'creditCard':
        // Luhn algorithm validation
        if (this.validateCreditCard(value)) {
          confidence = 0.95;
        }
        break;

      default:
        confidence = 0.8;
    }

    return confidence;
  }

  /**
   * Mask PII value based on type and strategy
   */
  private maskValue(value: string, type: string): string {
    const strategy = this.maskingStrategies.get(type);

    if (!strategy) {
      return this.maskFull(value, '*');
    }

    if (strategy.customMasker) {
      return strategy.customMasker(value);
    }

    switch (strategy.strategy) {
      case 'full':
        return this.maskFull(value, strategy.maskChar);
      case 'partial':
        return this.maskPartial(value, strategy.maskChar);
      case 'middle':
        return this.maskMiddle(value, strategy.maskChar, strategy.preserveFormat);
      case 'hash':
        return this.maskHash(value);
      default:
        return this.maskFull(value, strategy.maskChar);
    }
  }

  /**
   * Masking strategies
   */
  private maskFull(value: string, maskChar: string): string {
    return maskChar.repeat(value.length);
  }

  private maskPartial(value: string, maskChar: string): string {
    if (value.length <= 3) return this.maskFull(value, maskChar);
    return value.substring(0, 2) + maskChar.repeat(value.length - 3) + value.slice(-1);
  }

  private maskMiddle(value: string, maskChar: string, preserveFormat: boolean): string {
    if (value.length <= 4) return this.maskFull(value, maskChar);

    const keepStart = Math.floor(value.length * 0.25);
    const keepEnd = Math.floor(value.length * 0.25);
    const maskLength = value.length - keepStart - keepEnd;

    let masked = value.substring(0, keepStart) +
                 maskChar.repeat(maskLength) +
                 value.substring(value.length - keepEnd);

    // Preserve original formatting characters
    if (preserveFormat) {
      const formatChars = /[.\-\s()\/]/g;
      const originalFormat = value.match(formatChars) || [];
      let formatIndex = 0;

      masked = masked.replace(/./g, (char, index) => {
        if (formatChars.test(value[index])) {
          return value[index];
        }
        return char;
      });
    }

    return masked;
  }

  private maskHash(value: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(value).digest('hex');
    return `***${hash.substring(0, 8)}`;
  }

  /**
   * Custom email masker
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');

    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }

    const maskedLocal = local[0] + '*'.repeat(local.length - 2) + local.slice(-1);
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Validation methods
   */
  private validateCpf(cpf: string): boolean {
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

  private validateCnpj(cnpj: string): boolean {
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

  private validateBrazilianPhone(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');

    // Mobile: 11 digits, landline: 10 digits
    if (cleaned.length === 11) {
      // Mobile number should start with 9
      return cleaned[2] === '9';
    } else if (cleaned.length === 10) {
      // Landline number
      return true;
    }

    return false;
  }

  private validateCreditCard(cardNumber: string): boolean {
    const cleaned = cardNumber.replace(/\D/g, '');

    if (cleaned.length < 13 || cleaned.length > 19) {
      return false;
    }

    // Luhn algorithm
    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned.charAt(i));

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }
}

/**
 * PII Scanner for database records
 */
export class DatabasePiiScanner {
  private detector = new PiiDetector();
  private config = getSecurityConfig();

  /**
   * Scan database record for PII
   */
  public scanRecord(record: any, tableName: string): {
    hasPii: boolean;
    fields: Record<string, PiiDetectionResult>;
    recommendation: string;
  } {
    const fields: Record<string, PiiDetectionResult> = {};
    let hasPii = false;

    for (const [fieldName, value] of Object.entries(record)) {
      if (typeof value === 'string' && value.length > 0) {
        const result = this.detector.detectPii(value);

        if (result.hasPii) {
          fields[fieldName] = result;
          hasPii = true;

          // Log PII detection if enabled
          if (this.config.pii.logging.logDetections) {
            this.logPiiDetection(tableName, fieldName, result);
          }
        }
      }
    }

    return {
      hasPii,
      fields,
      recommendation: this.getRecommendation(hasPii, Object.keys(fields))
    };
  }

  /**
   * Generate recommendations for PII handling
   */
  private getRecommendation(hasPii: boolean, piiFields: string[]): string {
    if (!hasPii) {
      return 'No PII detected. Safe to process normally.';
    }

    const recommendations = [
      'PII detected in the following fields: ' + piiFields.join(', '),
      'Consider encrypting these fields before storage',
      'Implement access controls for PII fields',
      'Add audit logging for PII access',
      'Review data retention policies'
    ];

    return recommendations.join('. ');
  }

  /**
   * Log PII detection event
   */
  private logPiiDetection(tableName: string, fieldName: string, result: PiiDetectionResult): void {
    const logData = {
      timestamp: new Date().toISOString(),
      type: 'pii_detection',
      table: tableName,
      field: fieldName,
      detectionCount: result.detections.length,
      confidence: result.confidence,
      piiTypes: result.detections.map(d => d.type)
    };

    console.log('PII Detection:', logData);
  }
}

/**
 * Real-time PII masking for API responses
 */
export class ApiResponseMasker {
  private detector = new PiiDetector();

  /**
   * Mask PII in API response
   */
  public maskResponse(data: any, options?: { deepScan: boolean }): any {
    if (typeof data === 'string') {
      const result = this.detector.detectPii(data);
      return result.maskedText || data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.maskResponse(item, options));
    }

    if (typeof data === 'object' && data !== null) {
      const masked: any = {};

      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          const result = this.detector.detectPii(value);
          masked[key] = result.maskedText || value;
        } else if (options?.deepScan && (typeof value === 'object' || Array.isArray(value))) {
          masked[key] = this.maskResponse(value, options);
        } else {
          masked[key] = value;
        }
      }

      return masked;
    }

    return data;
  }
}

/**
 * Compliance reporting for PII handling
 */
export class PiiComplianceReporter {
  private detector = new PiiDetector();

  /**
   * Generate PII compliance report
   */
  public generateReport(data: any[]): {
    summary: {
      totalRecords: number;
      recordsWithPii: number;
      piiFields: string[];
      complianceScore: number;
    };
    details: any[];
    recommendations: string[];
  } {
    const scanner = new DatabasePiiScanner();
    const details = data.map((record, index) => ({
      recordId: index,
      ...scanner.scanRecord(record, 'compliance_scan')
    }));

    const recordsWithPii = details.filter(d => d.hasPii).length;
    const allPiiFields = new Set<string>();

    details.forEach(detail => {
      Object.keys(detail.fields).forEach(field => allPiiFields.add(field));
    });

    const complianceScore = this.calculateComplianceScore(details);

    return {
      summary: {
        totalRecords: data.length,
        recordsWithPii,
        piiFields: Array.from(allPiiFields),
        complianceScore
      },
      details,
      recommendations: this.generateRecommendations(complianceScore, Array.from(allPiiFields))
    };
  }

  /**
   * Calculate compliance score (0-100)
   */
  private calculateComplianceScore(details: any[]): number {
    if (details.length === 0) return 100;

    const recordsWithPii = details.filter(d => d.hasPii).length;
    const piiRatio = recordsWithPii / details.length;

    // Higher PII ratio = lower compliance score
    return Math.max(0, Math.round((1 - piiRatio) * 100));
  }

  /**
   * Generate compliance recommendations
   */
  private generateRecommendations(score: number, piiFields: string[]): string[] {
    const recommendations: string[] = [];

    if (score < 70) {
      recommendations.push('High PII exposure detected - immediate action required');
      recommendations.push('Implement encryption for all PII fields');
      recommendations.push('Review and update data collection practices');
    }

    if (piiFields.length > 0) {
      recommendations.push(`Consider data minimization for fields: ${piiFields.join(', ')}`);
      recommendations.push('Implement regular PII audits');
      recommendations.push('Train staff on PII handling procedures');
    }

    if (score >= 90) {
      recommendations.push('Good PII compliance - maintain current practices');
    }

    return recommendations;
  }
}