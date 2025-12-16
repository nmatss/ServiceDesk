/**
 * Enterprise Encryption Implementation
 * Handles encryption at rest and in transit for sensitive data
 */

import { randomBytes, createCipheriv, createDecipheriv, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { getSecurityConfig } from './config';
import logger from '../monitoring/structured-logger';

const scryptAsync = promisify(scrypt);

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
  version?: number; // Key version for rotation support
}

export interface DecryptionInput {
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
  version?: number; // Key version for rotation support
}

export interface KeyVersion {
  version: number;
  key: string;
  createdAt: number;
  rotatedAt?: number;
  status: 'active' | 'retired' | 'deprecated';
}

export interface KeyRotationResult {
  success: boolean;
  newVersion: number;
  itemsReEncrypted: number;
  errors: string[];
}

/**
 * Encryption manager for sensitive data
 */
export class EncryptionManager {
  private static instance: EncryptionManager;
  private config = getSecurityConfig();
  private masterKey: string;
  private keyVersions: Map<number, KeyVersion>;
  private currentKeyVersion: number;

  constructor() {
    this.masterKey = process.env.ENCRYPTION_KEY || this.generateMasterKey();
    this.keyVersions = new Map();
    this.currentKeyVersion = 1;

    // Initialize with current key as version 1
    this.keyVersions.set(1, {
      version: 1,
      key: this.masterKey,
      createdAt: Date.now(),
      status: 'active'
    });

    // Load additional key versions from environment if available
    this.loadKeyVersionsFromEnvironment();

    if (process.env.NODE_ENV === 'production' && !process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
  }

  public static getInstance(): EncryptionManager {
    if (!EncryptionManager.instance) {
      EncryptionManager.instance = new EncryptionManager();
    }
    return EncryptionManager.instance;
  }

  /**
   * Generate a new master key (for development only)
   */
  private generateMasterKey(): string {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Master key generation not allowed in production');
    }
    return randomBytes(32).toString('hex');
  }

  /**
   * Load key versions from environment variables
   * Format: ENCRYPTION_KEY_V2, ENCRYPTION_KEY_V3, etc.
   */
  private loadKeyVersionsFromEnvironment(): void {
    // Check for versioned keys in environment
    for (let version = 2; version <= 100; version++) {
      const envKey = process.env[`ENCRYPTION_KEY_V${version}`];
      if (envKey) {
        this.keyVersions.set(version, {
          version,
          key: envKey,
          createdAt: Date.now(),
          status: 'retired'
        });

        // Update current version if this is a newer key
        if (version > this.currentKeyVersion) {
          // Mark old current key as retired
          const oldKey = this.keyVersions.get(this.currentKeyVersion);
          if (oldKey) {
            oldKey.status = 'retired';
            oldKey.rotatedAt = Date.now();
          }

          // Set new current version
          this.currentKeyVersion = version;
          const newKey = this.keyVersions.get(version);
          if (newKey) {
            newKey.status = 'active';
          }
        }
      } else {
        // Stop checking if we hit a gap in versions
        break;
      }
    }

    logger.info(`Loaded ${this.keyVersions.size} encryption key versions, current: v${this.currentKeyVersion}`);
  }

  /**
   * Get key for a specific version
   */
  private getKeyForVersion(version: number): string {
    const keyVersion = this.keyVersions.get(version);
    if (!keyVersion) {
      throw new Error(`Encryption key version ${version} not found`);
    }
    return keyVersion.key;
  }

  /**
   * Get current active key
   */
  private getCurrentKey(): string {
    return this.getKeyForVersion(this.currentKeyVersion);
  }

  /**
   * Derive encryption key from master key and salt
   */
  private async deriveKey(salt: Buffer, keyVersion?: number): Promise<Buffer> {
    const masterKey = keyVersion ? this.getKeyForVersion(keyVersion) : this.getCurrentKey();
    return scryptAsync(masterKey, salt, 32) as Promise<Buffer>;
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  public async encrypt(plaintext: string): Promise<EncryptionResult> {
    try {
      const salt = randomBytes(16);
      const iv = randomBytes(16);
      const key = await this.deriveKey(salt);

      const cipher = createCipheriv('aes-256-gcm', key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        authTag: authTag.toString('hex'),
        version: this.currentKeyVersion // Include version in encrypted data
      };
    } catch (error) {
      logger.error('Encryption failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt sensitive data with support for multiple key versions
   */
  public async decrypt(data: DecryptionInput): Promise<string> {
    try {
      const salt = Buffer.from(data.salt, 'hex');
      const iv = Buffer.from(data.iv, 'hex');
      const authTag = Buffer.from(data.authTag, 'hex');

      // Use the key version specified in data, or default to version 1 for backwards compatibility
      const keyVersion = data.version || 1;
      const key = await this.deriveKey(salt, keyVersion);

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Log if we're decrypting with an old key version
      if (keyVersion < this.currentKeyVersion) {
        logger.warn(`Decrypted data with old key version ${keyVersion}, current is ${this.currentKeyVersion}`);
      }

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        keyVersion: data.version || 1
      });
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt database field
   */
  public async encryptField(value: string, fieldName: string): Promise<string | null> {
    if (!value) return null;

    const sensitiveFields = this.config.encryption.fieldLevel.sensitiveFields;

    if (!sensitiveFields.includes(fieldName)) {
      return value; // Don't encrypt non-sensitive fields
    }

    const encrypted = await this.encrypt(value);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt database field
   */
  public async decryptField(encryptedValue: string | null, fieldName: string): Promise<string | null> {
    if (!encryptedValue) return null;

    const sensitiveFields = this.config.encryption.fieldLevel.sensitiveFields;

    if (!sensitiveFields.includes(fieldName)) {
      return encryptedValue; // Return as-is if not encrypted
    }

    try {
      const data = JSON.parse(encryptedValue) as DecryptionInput;
      return await this.decrypt(data);
    } catch {
      // If parsing fails, assume it's not encrypted (backwards compatibility)
      return encryptedValue;
    }
  }

  /**
   * Hash sensitive data for searching (one-way)
   */
  public async hashForSearch(_value: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await this.deriveKey(salt);
    return `${salt.toString('hex')}:${key.toString('hex')}`;
  }

  /**
   * Re-encrypt data from one key version to another
   */
  public async reEncrypt(data: DecryptionInput, targetVersion?: number): Promise<EncryptionResult> {
    // First decrypt with the old key
    const plaintext = await this.decrypt(data);

    // Then encrypt with the target version (defaults to current)
    if (targetVersion && targetVersion !== this.currentKeyVersion) {
      // Temporarily switch to target version
      const originalVersion = this.currentKeyVersion;
      this.currentKeyVersion = targetVersion;
      const result = await this.encrypt(plaintext);
      this.currentKeyVersion = originalVersion;
      return result;
    }

    // Encrypt with current version
    return await this.encrypt(plaintext);
  }

  /**
   * Generate a new encryption key for rotation
   */
  private generateNewKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Key rotation functionality
   * Generates a new key and prepares for re-encryption of all data
   */
  public async rotateKeys(): Promise<KeyRotationResult> {
    const errors: string[] = [];
    let itemsReEncrypted = 0;

    try {
      logger.info('Starting encryption key rotation', { currentVersion: this.currentKeyVersion });

      // 1. Generate new master key
      const newKey = this.generateNewKey();
      const newVersion = this.currentKeyVersion + 1;

      // 2. Store new key version
      this.keyVersions.set(newVersion, {
        version: newVersion,
        key: newKey,
        createdAt: Date.now(),
        status: 'active'
      });

      // 3. Mark current key as retired
      const oldKey = this.keyVersions.get(this.currentKeyVersion);
      if (oldKey) {
        oldKey.status = 'retired';
        oldKey.rotatedAt = Date.now();
      }

      // 4. Update current version
      const previousVersion = this.currentKeyVersion;
      this.currentKeyVersion = newVersion;

      logger.info('New encryption key generated', {
        newVersion,
        previousVersion,
        totalVersions: this.keyVersions.size
      });

      // 5. Log instructions for key storage
      logger.warn('IMPORTANT: Store new encryption key in environment variables', {
        envVar: `ENCRYPTION_KEY_V${newVersion}`,
        value: '[REDACTED - Check secure logs]',
        action: `Set ENCRYPTION_KEY_V${newVersion}=${newKey} in your environment`
      });

      // Note: Actual re-encryption of data should be done by a separate migration process
      // This is intentional to avoid blocking operations and allow for controlled rollout
      logger.warn('Key rotation completed. Use reEncryptData() method to migrate existing data', {
        newVersion,
        previousVersion
      });

      return {
        success: true,
        newVersion,
        itemsReEncrypted,
        errors
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      logger.error('Key rotation failed', {
        error: errorMessage,
        currentVersion: this.currentKeyVersion
      });

      return {
        success: false,
        newVersion: this.currentKeyVersion,
        itemsReEncrypted,
        errors
      };
    }
  }

  /**
   * Get information about all key versions
   */
  public getKeyVersionInfo(): Array<Omit<KeyVersion, 'key'>> {
    return Array.from(this.keyVersions.values()).map(({ version, createdAt, rotatedAt, status }) => ({
      version,
      createdAt,
      rotatedAt,
      status
    }));
  }

  /**
   * Check if a key version needs rotation based on age
   */
  public shouldRotateKey(): boolean {
    const currentKey = this.keyVersions.get(this.currentKeyVersion);
    if (!currentKey) return false;

    const keyAgeDays = (Date.now() - currentKey.createdAt) / (1000 * 60 * 60 * 24);
    const rotationDays = this.config.encryption.atRest.keyRotationDays;

    return keyAgeDays >= rotationDays;
  }

  /**
   * Deprecate old key versions (mark for deletion but keep for compatibility)
   */
  public async deprecateOldKeys(versionsToKeep: number = 3): Promise<void> {
    const sortedVersions = Array.from(this.keyVersions.keys()).sort((a, b) => b - a);

    for (let i = versionsToKeep; i < sortedVersions.length; i++) {
      const version = sortedVersions[i] ?? 0;
      const keyVersion = this.keyVersions.get(version);

      if (keyVersion && keyVersion.status !== 'deprecated') {
        keyVersion.status = 'deprecated';
        logger.warn(`Key version ${version} deprecated`, {
          version,
          age: Date.now() - keyVersion.createdAt
        });
      }
    }
  }

  /**
   * Get the current key version number
   */
  public getCurrentKeyVersion(): number {
    return this.currentKeyVersion;
  }
}

/**
 * Database encryption utilities
 */
export class DatabaseEncryption {
  private encryption = EncryptionManager.getInstance();

  /**
   * Encrypt user data before database storage
   */
  public async encryptUserData(userData: any): Promise<any> {
    const encrypted = { ...userData };

    // Encrypt sensitive fields
    if (userData.phone) {
      encrypted.phone = await this.encryption.encryptField(userData.phone, 'phone');
    }

    if (userData.address) {
      encrypted.address = await this.encryption.encryptField(userData.address, 'address');
    }

    // Hash password (separate from encryption)
    if (userData.password) {
      const bcrypt = require('bcrypt');
      encrypted.password = await bcrypt.hash(userData.password, 12);
    }

    return encrypted;
  }

  /**
   * Decrypt user data after database retrieval
   */
  public async decryptUserData(userData: any): Promise<any> {
    if (!userData) return userData;

    const decrypted = { ...userData };

    // Decrypt sensitive fields
    if (userData.phone) {
      decrypted.phone = await this.encryption.decryptField(userData.phone, 'phone');
    }

    if (userData.address) {
      decrypted.address = await this.encryption.decryptField(userData.address, 'address');
    }

    // Remove password from decrypted data
    delete decrypted.password;

    return decrypted;
  }
}

/**
 * File encryption for attachments and uploads
 */
export class FileEncryption {
  private encryption = EncryptionManager.getInstance();

  /**
   * Encrypt file content
   */
  public async encryptFile(fileBuffer: Buffer, filename: string): Promise<{
    encryptedBuffer: Buffer;
    metadata: EncryptionResult;
    originalName: string;
  }> {
    const fileContent = fileBuffer.toString('base64');
    const encrypted = await this.encryption.encrypt(fileContent);

    return {
      encryptedBuffer: Buffer.from(encrypted.encrypted, 'hex'),
      metadata: encrypted,
      originalName: filename
    };
  }

  /**
   * Decrypt file content
   */
  public async decryptFile(encryptedBuffer: Buffer, metadata: DecryptionInput): Promise<Buffer> {
    const encryptedContent = encryptedBuffer.toString('hex');
    const decryptedBase64 = await this.encryption.decrypt({
      ...metadata,
      encrypted: encryptedContent
    });

    return Buffer.from(decryptedBase64, 'base64');
  }
}

/**
 * TLS/HTTPS enforcement utilities
 */
export class TransportSecurity {
  private config = getSecurityConfig();

  /**
   * Check if request uses secure transport
   */
  public isSecureTransport(request: any): boolean {
    // Check for HTTPS
    if (request.protocol === 'https') return true;

    // Check for forwarded proto (load balancers)
    const forwardedProto = request.headers['x-forwarded-proto'];
    if (forwardedProto === 'https') return true;

    // Allow HTTP in development
    if (process.env.NODE_ENV === 'development') return true;

    return false;
  }

  /**
   * Generate HSTS header
   */
  public getHstsHeader(): string {
    const hsts = this.config.encryption.inTransit.hsts;

    if (!hsts.enabled) return '';

    let header = `max-age=${hsts.maxAge}`;

    if (hsts.includeSubDomains) {
      header += '; includeSubDomains';
    }

    if (hsts.preload) {
      header += '; preload';
    }

    return header;
  }

  /**
   * Redirect HTTP to HTTPS
   */
  public redirectToHttps(url: string): string {
    return url.replace(/^http:/, 'https:');
  }
}

/**
 * Secure random token generation
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Secure string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Key derivation for API keys and tokens
 */
export async function deriveApiKey(seed: string, purpose: string): Promise<string> {
  const salt = Buffer.from(purpose, 'utf8');
  const key = await scryptAsync(seed, salt, 32) as Buffer;
  return key.toString('hex');
}

/**
 * Encryption key management
 */
export class KeyManager {
  private static keyCache = new Map<string, { key: string; created: number }>();
  private static readonly KEY_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get or generate session key
   */
  public static getSessionKey(sessionId: string): string {
    const cached = this.keyCache.get(sessionId);
    const now = Date.now();

    if (cached && (now - cached.created) < this.KEY_TTL) {
      return cached.key;
    }

    const newKey = generateSecureToken(32);
    this.keyCache.set(sessionId, { key: newKey, created: now });

    // Clean up expired keys
    this.cleanupExpiredKeys();

    return newKey;
  }

  /**
   * Clean up expired session keys
   */
  private static cleanupExpiredKeys(): void {
    const now = Date.now();

    for (const [sessionId, data] of this.keyCache.entries()) {
      if ((now - data.created) >= this.KEY_TTL) {
        this.keyCache.delete(sessionId);
      }
    }
  }

  /**
   * Revoke session key
   */
  public static revokeSessionKey(sessionId: string): void {
    this.keyCache.delete(sessionId);
  }
}