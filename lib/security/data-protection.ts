/**
 * Data Protection Module - Enterprise Security
 *
 * Features:
 * - Field-level encryption (AES-256)
 * - PII detection automatic
 * - Data masking for non-privileged users
 * - Secure file storage
 * - LGPD compliance helpers
 * - Transparent encryption/decryption
 * - Key rotation support
 */

import * as crypto from 'crypto';
import db from '../db/connection';
import { encryptionManager, EncryptedData } from './encryption-manager';
import { PiiDetector } from './pii-detection';
import { dataMasking } from './data-masking';
import logger from '../monitoring/structured-logger';

// Create PII detector instance
const piiDetector = new PiiDetector();

// File encryption metadata
export interface FileEncryptionMetadata {
  originalName: string;
  encryptedSize: number;
  originalSize: number;
  algorithm: string;
  keyVersion: number;
  checksum: string;
  encryptedData?: EncryptedData;
}

// Field-level encryption configuration
export interface FieldEncryptionConfig {
  tableName: string;
  fields: string[];
  encryptionKey?: string;
  autoDetectPII?: boolean;
  maskForRoles?: string[];
}

// Encrypted field metadata
export interface EncryptedField {
  id: number;
  table_name: string;
  field_name: string;
  encryption_algorithm: string;
  key_version: number;
  is_active: boolean;
  created_at: string;
}

// PII field metadata
export interface PIIField {
  id: number;
  table_name: string;
  field_name: string;
  pii_type: string;
  sensitivity_level: 'low' | 'medium' | 'high' | 'critical';
  mask_pattern?: string;
  is_active: boolean;
}

// Data access log entry
export interface DataAccessLog {
  userId: number;
  tableName: string;
  recordId: string | number;
  action: 'read' | 'write' | 'delete';
  fieldName?: string;
  containsPII: boolean;
  masked: boolean;
}

/**
 * Data Protection Manager
 */
export class DataProtectionManager {
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly KEY_SIZE = 32; // 256 bits
  private readonly IV_SIZE = 16;
  private readonly AUTH_TAG_SIZE = 16;

  /**
   * AUTO-DETECT AND ENCRYPT PII FIELDS
   */
  async autoProtectTable(
    tableName: string,
    organizationId: number,
    options: {
      autoEncrypt?: boolean;
      autoMask?: boolean;
      sensitivity?: 'low' | 'medium' | 'high' | 'critical';
    } = {}
  ): Promise<{ protectedFields: string[]; detectedFields: string[] }> {
    try {
      const protectedFields: string[] = [];
      const detectedFields: string[] = [];

      // Get table schema
      const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>;

      for (const column of tableInfo) {
        const fieldName = column.name;
        const sampleData = await this.getSampleData(tableName, fieldName);

        // Detect PII
        const piiResult = piiDetector.detectPii(sampleData);
        const piiType = piiResult.detections.length > 0 ? piiResult.detections[0]?.type : null;

        if (piiType) {
          detectedFields.push(fieldName);

          // Register PII field
          await this.registerPIIField(
            tableName,
            fieldName,
            piiType,
            options.sensitivity || 'medium',
            organizationId
          );

          // Auto-encrypt if enabled
          if (options.autoEncrypt) {
            await this.enableFieldEncryption(tableName, fieldName, organizationId);
            protectedFields.push(fieldName);
          }

          // Auto-mask if enabled
          if (options.autoMask) {
            await this.enableFieldMasking(
              tableName,
              fieldName,
              this.getMaskPattern(piiType),
              organizationId
            );
          }
        }
      }

      return { protectedFields, detectedFields };
    } catch (error) {
      logger.error('Auto-protect table error', error);
      return { protectedFields: [], detectedFields: [] };
    }
  }

  /**
   * FIELD-LEVEL ENCRYPTION
   */
  async encryptField(
    plaintext: string,
    tableName: string,
    fieldName: string,
    organizationId: number
  ): Promise<string> {
    try {
      // Get or create encryption key
      const key = await this.getEncryptionKey(tableName, fieldName, organizationId);

      // Generate IV
      const iv = crypto.randomBytes(this.IV_SIZE);

      // Create cipher
      const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv);

      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Combine IV + authTag + encrypted data
      const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'hex'),
      ]);

      // Return base64 encoded
      return combined.toString('base64');
    } catch (error) {
      logger.error('Field encryption error', error);
      throw new Error('Failed to encrypt field');
    }
  }

  /**
   * Decrypt field
   */
  async decryptField(
    ciphertext: string,
    tableName: string,
    fieldName: string,
    organizationId: number
  ): Promise<string> {
    try {
      // Get encryption key
      const key = await this.getEncryptionKey(tableName, fieldName, organizationId);

      // Decode base64
      const combined = Buffer.from(ciphertext, 'base64');

      // Extract components
      const iv = combined.subarray(0, this.IV_SIZE);
      const authTag = combined.subarray(this.IV_SIZE, this.IV_SIZE + this.AUTH_TAG_SIZE);
      const encrypted = combined.subarray(this.IV_SIZE + this.AUTH_TAG_SIZE);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Field decryption error', error);
      throw new Error('Failed to decrypt field');
    }
  }

  /**
   * TRANSPARENT ENCRYPTION/DECRYPTION
   * Automatically encrypt/decrypt based on field configuration
   */
  async encryptRecord(
    tableName: string,
    record: Record<string, unknown>,
    organizationId: number
  ): Promise<Record<string, unknown>> {
    const encryptedFields = await this.getEncryptedFields(tableName, organizationId);
    const result = { ...record };

    for (const field of encryptedFields) {
      if (result[field.field_name] !== undefined && result[field.field_name] !== null) {
        result[field.field_name] = await this.encryptField(
          String(result[field.field_name]),
          tableName,
          field.field_name,
          organizationId
        );
      }
    }

    return result;
  }

  /**
   * Decrypt record
   */
  async decryptRecord(
    tableName: string,
    record: Record<string, unknown>,
    organizationId: number,
    userId?: number,
    userRole?: string
  ): Promise<Record<string, unknown>> {
    const encryptedFields = await this.getEncryptedFields(tableName, organizationId);
    const result = { ...record };

    for (const field of encryptedFields) {
      if (result[field.field_name] !== undefined && result[field.field_name] !== null) {
        try {
          // Decrypt
          const decrypted = await this.decryptField(
            String(result[field.field_name]),
            tableName,
            field.field_name,
            organizationId
          );

          // Check if masking is required
          if (userId && userRole) {
            const shouldMask = await this.shouldMaskField(
              tableName,
              field.field_name,
              userRole,
              organizationId
            );

            if (shouldMask) {
              result[field.field_name] = await this.maskField(
                decrypted,
                tableName,
                field.field_name,
                organizationId
              );
            } else {
              result[field.field_name] = decrypted;
            }
          } else {
            result[field.field_name] = decrypted;
          }
        } catch (error) {
          logger.error(`Failed to decrypt field ${field.field_name}:`, error);
          result[field.field_name] = '[ENCRYPTED]';
        }
      }
    }

    return result;
  }

  /**
   * DATA MASKING
   */
  async maskField(
    value: string,
    tableName: string,
    fieldName: string,
    organizationId: number
  ): Promise<string> {
    try {
      // Get PII field info
      const piiField = await this.getPIIField(tableName, fieldName, organizationId);

      if (!piiField) {
        return value;
      }

      // Mask pattern available for future use
      // const pattern = piiField.mask_pattern || this.getMaskPattern(piiField.pii_type);

      // Apply masking based on PII type
      const masked = await dataMasking.autoMask(value, fieldName);
      return typeof masked === 'string' ? masked : String(masked);
    } catch (error) {
      logger.error('Field masking error', error);
      return value;
    }
  }

  /**
   * PII DETECTION
   */
  async detectAndProtectPII(
    data: Record<string, unknown>,
    tableName: string,
    organizationId: number
  ): Promise<{ detectedFields: string[]; protectedData: Record<string, unknown> }> {
    const detectedFields: string[] = [];
    const protectedData: Record<string, unknown> = { ...data };

    for (const [fieldName, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        const piiResult = piiDetector.detectPii(value);
        const piiType = piiResult.detections.length > 0 ? piiResult.detections[0]?.type : null;

        if (piiType) {
          detectedFields.push(fieldName);

          // Register if not already registered
          await this.registerPIIField(
            tableName,
            fieldName,
            piiType,
            'medium',
            organizationId
          );

          // Encrypt
          protectedData[fieldName] = await this.encryptField(
            value,
            tableName,
            fieldName,
            organizationId
          );
        }
      }
    }

    return { detectedFields, protectedData };
  }

  /**
   * SECURE FILE STORAGE
   */
  async encryptFile(
    fileBuffer: Buffer,
    fileName: string,
    // organizationId available for future use
    _organizationId: number
  ): Promise<{ encrypted: Buffer; metadata: FileEncryptionMetadata }> {
    try {
      // Use encryption manager for file encryption
      const result = await encryptionManager.encryptFile(fileBuffer);

      // Store metadata
      const metadata: FileEncryptionMetadata = {
        originalName: fileName,
        encryptedSize: Buffer.from(result.encryptedData, 'base64').length,
        originalSize: fileBuffer.length,
        algorithm: this.ENCRYPTION_ALGORITHM,
        keyVersion: 1,
        checksum: crypto.createHash('sha256').update(fileBuffer).digest('hex'),
        encryptedData: result,
      };

      return {
        encrypted: Buffer.from(result.encryptedData, 'base64'),
        metadata,
      };
    } catch (error) {
      logger.error('File encryption error', error);
      throw new Error('Failed to encrypt file');
    }
  }

  /**
   * Decrypt file
   */
  async decryptFile(
    // encryptedBuffer available for future use
    _encryptedBuffer: Buffer,
    metadata: FileEncryptionMetadata,
    // organizationId available for future use
    _organizationId: number
  ): Promise<Buffer> {
    try {
      if (!metadata.encryptedData) {
        throw new Error('Missing encrypted data in metadata');
      }

      const decrypted = await encryptionManager.decryptFile(metadata.encryptedData);

      // Verify checksum
      const checksum = crypto.createHash('sha256').update(decrypted).digest('hex');
      if (checksum !== metadata.checksum) {
        throw new Error('File integrity check failed');
      }

      return decrypted;
    } catch (error) {
      logger.error('File decryption error', error);
      throw new Error('Failed to decrypt file');
    }
  }

  /**
   * LGPD COMPLIANCE HELPERS
   */
  async exportUserData(
    userId: number,
    organizationId: number
  ): Promise<Record<string, unknown>> {
    try {
      // Collect all user data from various tables
      const userData: Record<string, unknown> = {};

      // User profile
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
      if (user) {
        userData.profile = await this.decryptRecord('users', user, organizationId);
      }

      // Tickets
      const tickets = db.prepare('SELECT * FROM tickets WHERE created_by = ?').all(userId) as Record<string, unknown>[];
      userData.tickets = await Promise.all(
        tickets.map(t => this.decryptRecord('tickets', t, organizationId))
      );

      // Comments
      const comments = db.prepare('SELECT * FROM comments WHERE user_id = ?').all(userId) as Record<string, unknown>[];
      userData.comments = await Promise.all(
        comments.map(c => this.decryptRecord('comments', c, organizationId))
      );

      return userData;
    } catch (error) {
      logger.error('Export user data error', error);
      throw new Error('Failed to export user data');
    }
  }

  /**
   * Anonymize user data (LGPD right to be forgotten)
   */
  async anonymizeUserData(
    userId: number,
    _organizationId: number
  ): Promise<boolean> {
    try {
      // Get all PII fields (available for future use)
      // const piiFields = await this.getAllPIIFields(_organizationId);

      // Anonymize user record
      db.prepare(`
        UPDATE users
        SET email = ?,
            name = ?,
            two_factor_secret = NULL,
            two_factor_backup_codes = NULL,
            sso_provider = NULL,
            sso_user_id = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        `anonymized_${userId}@deleted.local`,
        `Anonymized User ${userId}`,
        userId
      );

      // Log anonymization
      this.logDataAccess({
        userId,
        tableName: 'users',
        recordId: userId,
        action: 'delete',
        containsPII: true,
        masked: false,
      });

      return true;
    } catch (error) {
      logger.error('Anonymize user data error', error);
      return false;
    }
  }

  /**
   * DATA ACCESS LOGGING
   */
  logDataAccess(entry: DataAccessLog): void {
    try {
      db.prepare(`
        INSERT INTO data_access_log (
          user_id, table_name, record_id, action,
          field_name, contains_pii, masked, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        entry.userId,
        entry.tableName,
        entry.recordId.toString(),
        entry.action,
        entry.fieldName || null,
        entry.containsPII ? 1 : 0,
        entry.masked ? 1 : 0
      );
    } catch (error) {
      logger.error('Data access log error', error);
    }
  }

  /**
   * HELPER METHODS
   */

  private async getEncryptionKey(
    tableName: string,
    fieldName: string,
    organizationId: number
  ): Promise<Buffer> {
    try {
      // Get key from encryption manager
      const keyVersion = await this.getKeyVersion(tableName, fieldName, organizationId);
      return await encryptionManager.generateFieldKey(tableName, fieldName, keyVersion);
    } catch (error) {
      // Generate new key if not exists
      return crypto.randomBytes(this.KEY_SIZE);
    }
  }

  private async getKeyVersion(
    tableName: string,
    fieldName: string,
    organizationId: number
  ): Promise<number> {
    const field = await this.getEncryptedFieldConfig(tableName, fieldName, organizationId);
    return field?.key_version || 1;
  }

  private async getSampleData(tableName: string, fieldName: string): Promise<string> {
    try {
      const result = db.prepare(`
        SELECT ${fieldName} FROM ${tableName}
        WHERE ${fieldName} IS NOT NULL
        LIMIT 1
      `).get() as Record<string, unknown> | undefined;

      return result ? String(result[fieldName]) : '';
    } catch {
      return '';
    }
  }

  private getMaskPattern(piiType: string): string {
    const patterns: Record<string, string> = {
      email: 'x***@***.x',
      cpf: '***.***.***-**',
      phone: '(**) ****-****',
      credit_card: '**** **** **** ****',
      ssn: '***-**-****',
      default: '***',
    };

    return patterns[piiType] ?? patterns.default ?? '***';
  }

  private async registerPIIField(
    tableName: string,
    fieldName: string,
    piiType: string,
    sensitivity: 'low' | 'medium' | 'high' | 'critical',
    organizationId: number
  ): Promise<void> {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO pii_fields (
          table_name, field_name, pii_type, sensitivity_level,
          mask_pattern, organization_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        tableName,
        fieldName,
        piiType,
        sensitivity,
        this.getMaskPattern(piiType),
        organizationId
      );
    } catch (error) {
      logger.error('Register PII field error', error);
    }
  }

  private async enableFieldEncryption(
    tableName: string,
    fieldName: string,
    organizationId: number
  ): Promise<void> {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO encrypted_fields (
          table_name, field_name, encryption_algorithm,
          key_version, organization_id
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        tableName,
        fieldName,
        this.ENCRYPTION_ALGORITHM,
        1,
        organizationId
      );
    } catch (error) {
      logger.error('Enable field encryption error', error);
    }
  }

  private async enableFieldMasking(
    tableName: string,
    fieldName: string,
    maskPattern: string,
    organizationId: number
  ): Promise<void> {
    try {
      db.prepare(`
        UPDATE pii_fields
        SET mask_pattern = ?
        WHERE table_name = ? AND field_name = ? AND organization_id = ?
      `).run(maskPattern, tableName, fieldName, organizationId);
    } catch (error) {
      logger.error('Enable field masking error', error);
    }
  }

  private async getEncryptedFields(
    tableName: string,
    organizationId: number
  ): Promise<EncryptedField[]> {
    try {
      return db.prepare(`
        SELECT * FROM encrypted_fields
        WHERE table_name = ? AND organization_id = ? AND is_active = 1
      `).all(tableName, organizationId) as EncryptedField[];
    } catch {
      return [];
    }
  }

  private async getEncryptedFieldConfig(
    tableName: string,
    fieldName: string,
    organizationId: number
  ): Promise<EncryptedField | null> {
    try {
      return db.prepare(`
        SELECT * FROM encrypted_fields
        WHERE table_name = ? AND field_name = ? AND organization_id = ? AND is_active = 1
      `).get(tableName, fieldName, organizationId) as EncryptedField | null;
    } catch {
      return null;
    }
  }

  private async getPIIField(
    tableName: string,
    fieldName: string,
    organizationId: number
  ): Promise<PIIField | null> {
    try {
      return db.prepare(`
        SELECT * FROM pii_fields
        WHERE table_name = ? AND field_name = ? AND organization_id = ? AND is_active = 1
      `).get(tableName, fieldName, organizationId) as PIIField | null;
    } catch {
      return null;
    }
  }

  // Method available for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getAllPIIFields(organizationId: number): Promise<PIIField[]> {
    try {
      return db.prepare(`
        SELECT * FROM pii_fields
        WHERE organization_id = ? AND is_active = 1
      `).all(organizationId) as PIIField[];
    } catch {
      return [];
    }
  }

  private async shouldMaskField(
    tableName: string,
    fieldName: string,
    userRole: string,
    organizationId: number
  ): Promise<boolean> {
    try {
      const piiField = await this.getPIIField(tableName, fieldName, organizationId);
      if (!piiField) return false;

      // Admin never gets masked data
      if (userRole === 'admin') return false;

      // High/critical sensitivity always masked for non-admins
      if (piiField.sensitivity_level === 'high' || piiField.sensitivity_level === 'critical') {
        return userRole !== 'admin';
      }

      return false;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const dataProtection = new DataProtectionManager();

// Export for use in other modules
export default dataProtection;
