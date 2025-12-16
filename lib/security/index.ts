/**
 * Security Module - Unified Export
 *
 * Complete security infrastructure including:
 * - Data Protection (Field-level encryption, PII detection)
 * - Encryption Management
 * - Data Masking
 * - PII Detection
 * - LGPD Compliance
 * - Input Sanitization
 * - Security Monitoring
 */

// Data Protection (NEW - Sprint 7)
export { dataProtection } from './data-protection';
export type {
  FieldEncryptionConfig,
  EncryptedField,
  PIIField,
  DataAccessLog,
} from './data-protection';

// Encryption Management
export { encryptionManager } from './encryption-manager';

// Data Masking
export { dataMasking } from './data-masking';

// PII Detection
export { PiiDetector } from './pii-detection';

// Input Sanitization
export { sanitizeHTML, sanitizeMarkdown, sanitizeUserInput } from './sanitize';

// Security Configuration
export type { SecurityConfig } from './config';

/**
 * Quick Start Examples
 */

// Example 1: Auto-protect table with PII detection
/*
import { dataProtection } from '@/lib/security';

const result = await dataProtection.autoProtectTable('users', organizationId, {
  autoEncrypt: true,
  autoMask: true,
  sensitivity: 'high'
});

logger.info('Protected fields', result.protected);
logger.info('Detected PII', result.detected);
*/

// Example 2: Encrypt/Decrypt fields
/*
import { dataProtection } from '@/lib/security';

// Encrypt
const encrypted = await dataProtection.encryptField(
  'john@example.com',
  'users',
  'email',
  organizationId
);

// Decrypt
const decrypted = await dataProtection.decryptField(
  encrypted,
  'users',
  'email',
  organizationId
);
*/

// Example 3: LGPD Compliance
/*
import { dataProtection } from '@/lib/security';

// Export user data
const userData = await dataProtection.exportUserData(userId, organizationId);

// Anonymize user (right to be forgotten)
await dataProtection.anonymizeUserData(userId, organizationId);
*/

// Example 4: PII Detection
/*
import { piiDetector } from '@/lib/security';

const text = 'My email is john@example.com and phone is (11) 98765-4321';
const piiType = piiDetector.detectPII(text);
logger.info('PII Type', piiType); // 'email'
*/

// Example 5: Data Masking
/*
import { dataMasking } from '@/lib/security';

const masked = dataMasking.maskData('john@example.com', 'email');
logger.info(masked); // 'j***@***.com'
*/
