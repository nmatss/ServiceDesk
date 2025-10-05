/**
 * Enterprise Encryption Implementation
 * Handles encryption at rest and in transit for sensitive data
 */

import { randomBytes, createCipheriv, createDecipheriv, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { getSecurityConfig } from './config';

const scryptAsync = promisify(scrypt);

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
}

export interface DecryptionInput {
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
}

/**
 * Encryption manager for sensitive data
 */
export class EncryptionManager {
  private static instance: EncryptionManager;
  private config = getSecurityConfig();
  private masterKey: string;

  constructor() {
    this.masterKey = process.env.ENCRYPTION_KEY || this.generateMasterKey();

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
   * Derive encryption key from master key and salt
   */
  private async deriveKey(salt: Buffer): Promise<Buffer> {
    return scryptAsync(this.masterKey, salt, 32) as Promise<Buffer>;
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
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  public async decrypt(data: DecryptionInput): Promise<string> {
    try {
      const salt = Buffer.from(data.salt, 'hex');
      const iv = Buffer.from(data.iv, 'hex');
      const authTag = Buffer.from(data.authTag, 'hex');
      const key = await this.deriveKey(salt);

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
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
  public async hashForSearch(value: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await this.deriveKey(salt);
    return `${salt.toString('hex')}:${key.toString('hex')}`;
  }

  /**
   * Key rotation functionality
   */
  public async rotateKeys(): Promise<void> {
    // TODO: Implement key rotation
    // This would involve:
    // 1. Generate new master key
    // 2. Re-encrypt all data with new key
    // 3. Update key in secure storage
    // 4. Clean up old keys after grace period
    console.log('Key rotation not yet implemented');
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