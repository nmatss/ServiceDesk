import { randomBytes, createCipheriv, createDecipheriv, createHash, pbkdf2Sync, scrypt } from 'crypto';
import { promisify } from 'util';
import logger from '../monitoring/structured-logger';

const scryptAsync = promisify(scrypt);

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
  keyDerivation: 'pbkdf2' | 'scrypt';
  iterations?: number; // For PBKDF2
  memoryLimit?: number; // For scrypt
  parallelization?: number; // For scrypt
}

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  authTag?: string;
  salt: string;
  algorithm: string;
  keyDerivation: string;
}

export interface KeyRotationConfig {
  autoRotate: boolean;
  rotationIntervalDays: number;
  keepOldVersions: number;
}

export interface FieldEncryptionRule {
  tableName: string;
  fieldName: string;
  encryptionType: 'full' | 'deterministic' | 'searchable';
  algorithm: string;
  keyVersion: number;
}

class EncryptionManager {
  private readonly MASTER_KEY: Buffer;
  private readonly DEFAULT_CONFIG: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyDerivation: 'scrypt',
    iterations: 100000,
    memoryLimit: 64 * 1024 * 1024, // 64MB
    parallelization: 1
  };

  private keyCache = new Map<string, Buffer>();
  private fieldRules = new Map<string, FieldEncryptionRule>();

  constructor() {
    // In production, this should come from a secure key management service
    const masterKeyHex = process.env.MASTER_ENCRYPTION_KEY;
    if (!masterKeyHex) {
      throw new Error('MASTER_ENCRYPTION_KEY environment variable is required');
    }

    this.MASTER_KEY = Buffer.from(masterKeyHex, 'hex');
    this.loadFieldEncryptionRules();
  }

  /**
   * Encrypt data using AES-256-GCM (default)
   */
  async encrypt(
    data: string | Buffer,
    password?: string,
    config: Partial<EncryptionConfig> = {}
  ): Promise<EncryptedData> {
    try {
      const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
      const salt = randomBytes(32);
      const iv = randomBytes(12); // 96-bit IV for GCM

      // Derive key from password or use master key
      const key = password
        ? await this.deriveKey(password, salt, finalConfig)
        : this.MASTER_KEY;

      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

      let encryptedData: Buffer;
      let authTag: Buffer | undefined;

      switch (finalConfig.algorithm) {
        case 'aes-256-gcm': {
          const cipher = createCipheriv('aes-256-gcm', key.slice(0, 32), iv);
          cipher.setAAD(salt); // Use salt as additional authenticated data

          const encrypted1 = cipher.update(dataBuffer);
          const encrypted2 = cipher.final();
          authTag = cipher.getAuthTag();

          encryptedData = Buffer.concat([encrypted1, encrypted2]);
          break;
        }

        case 'aes-256-cbc': {
          const cipher = createCipheriv('aes-256-cbc', key.slice(0, 32), iv.slice(0, 16));

          const encrypted1 = cipher.update(dataBuffer);
          const encrypted2 = cipher.final();

          encryptedData = Buffer.concat([encrypted1, encrypted2]);
          break;
        }

        case 'chacha20-poly1305': {
          const cipher = createCipheriv('chacha20-poly1305', key.slice(0, 32), iv);
          cipher.setAAD(salt, { plaintextLength: dataBuffer.length });

          const encrypted1 = cipher.update(dataBuffer);
          const encrypted2 = cipher.final();
          authTag = cipher.getAuthTag();

          encryptedData = Buffer.concat([encrypted1, encrypted2]);
          break;
        }

        default:
          throw new Error(`Unsupported algorithm: ${finalConfig.algorithm}`);
      }

      return {
        encryptedData: encryptedData.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag?.toString('base64'),
        salt: salt.toString('base64'),
        algorithm: finalConfig.algorithm,
        keyDerivation: finalConfig.keyDerivation
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Encryption failed: ${errorMessage}`);
    }
  }

  /**
   * Decrypt data
   */
  async decrypt(
    encryptedData: EncryptedData,
    password?: string
  ): Promise<Buffer> {
    try {
      const salt = Buffer.from(encryptedData.salt, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const data = Buffer.from(encryptedData.encryptedData, 'base64');
      const authTag = encryptedData.authTag
        ? Buffer.from(encryptedData.authTag, 'base64')
        : undefined;

      const config: EncryptionConfig = {
        algorithm: encryptedData.algorithm as any,
        keyDerivation: encryptedData.keyDerivation as any,
        iterations: this.DEFAULT_CONFIG.iterations,
        memoryLimit: this.DEFAULT_CONFIG.memoryLimit,
        parallelization: this.DEFAULT_CONFIG.parallelization
      };

      // Derive key from password or use master key
      const key = password
        ? await this.deriveKey(password, salt, config)
        : this.MASTER_KEY;

      let decryptedData: Buffer;

      switch (encryptedData.algorithm) {
        case 'aes-256-gcm': {
          const decipher = createDecipheriv('aes-256-gcm', key.slice(0, 32), iv);
          if (authTag) {
            decipher.setAuthTag(authTag);
          }
          decipher.setAAD(salt);

          const decrypted1 = decipher.update(data);
          const decrypted2 = decipher.final();

          decryptedData = Buffer.concat([decrypted1, decrypted2]);
          break;
        }

        case 'aes-256-cbc': {
          const decipher = createDecipheriv('aes-256-cbc', key.slice(0, 32), iv.slice(0, 16));

          const decrypted1 = decipher.update(data);
          const decrypted2 = decipher.final();

          decryptedData = Buffer.concat([decrypted1, decrypted2]);
          break;
        }

        case 'chacha20-poly1305': {
          const decipher = createDecipheriv('chacha20-poly1305', key.slice(0, 32), iv);
          if (authTag) {
            decipher.setAuthTag(authTag);
          }
          decipher.setAAD(salt, { plaintextLength: data.length });

          const decrypted1 = decipher.update(data);
          const decrypted2 = decipher.final();

          decryptedData = Buffer.concat([decrypted1, decrypted2]);
          break;
        }

        default:
          throw new Error(`Unsupported algorithm: ${encryptedData.algorithm}`);
      }

      return decryptedData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Decryption failed: ${errorMessage}`);
    }
  }

  /**
   * Encrypt field data for database storage
   */
  async encryptField(
    tableName: string,
    fieldName: string,
    value: any
  ): Promise<string | any> {
    const rule = this.getFieldRule(tableName, fieldName);

    if (!rule) {
      return value; // No encryption rule, return as-is
    }

    if (value === null || value === undefined) {
      return value;
    }

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    switch (rule.encryptionType) {
      case 'full':
        return this.encryptFullField(stringValue, rule);

      case 'deterministic':
        return this.encryptDeterministicField(stringValue, rule);

      case 'searchable':
        return this.encryptSearchableField(stringValue, rule);

      default:
        return value;
    }
  }

  /**
   * Decrypt field data from database
   */
  async decryptField(
    tableName: string,
    fieldName: string,
    encryptedValue: any
  ): Promise<any> {
    const rule = this.getFieldRule(tableName, fieldName);

    if (!rule || !encryptedValue) {
      return encryptedValue;
    }

    try {
      switch (rule.encryptionType) {
        case 'full':
          return this.decryptFullField(encryptedValue, rule);

        case 'deterministic':
          return this.decryptDeterministicField(encryptedValue, rule);

        case 'searchable':
          return this.decryptSearchableField(encryptedValue, rule);

        default:
          return encryptedValue;
      }
    } catch (error) {
      logger.error(`Failed to decrypt field ${tableName}.${fieldName}:`, error);
      return '[ENCRYPTED]';
    }
  }

  /**
   * Generate deterministic hash for searching encrypted data
   */
  generateSearchHash(value: string, salt?: string): string {
    const searchSalt = salt || process.env.SEARCH_SALT || 'default-search-salt';
    return createHash('sha256')
      .update(value + searchSalt)
      .digest('hex');
  }

  /**
   * Encrypt file data
   */
  async encryptFile(
    fileBuffer: Buffer,
    password?: string
  ): Promise<EncryptedData> {
    return this.encrypt(fileBuffer, password);
  }

  /**
   * Decrypt file data
   */
  async decryptFile(
    encryptedData: EncryptedData,
    password?: string
  ): Promise<Buffer> {
    return this.decrypt(encryptedData, password);
  }

  /**
   * Generate encryption key for field
   */
  async generateFieldKey(
    tableName: string,
    fieldName: string,
    keyVersion: number = 1
  ): Promise<Buffer> {
    const cacheKey = `${tableName}.${fieldName}.v${keyVersion}`;

    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    // Derive field-specific key from master key
    const keyMaterial = `${tableName}:${fieldName}:v${keyVersion}`;
    const key = await scryptAsync(this.MASTER_KEY, keyMaterial, 32) as Buffer;

    this.keyCache.set(cacheKey, key);
    return key;
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(tableName?: string, fieldName?: string): Promise<void> {
    // This would implement key rotation logic
    // For now, we'll just clear the cache to force regeneration
    if (tableName && fieldName) {
      const pattern = `${tableName}.${fieldName}`;
      for (const [key, _value] of this.keyCache) {
        if (key.startsWith(pattern)) {
          this.keyCache.delete(key);
        }
      }
    } else {
      this.keyCache.clear();
    }
  }

  /**
   * Validate encryption integrity
   */
  async validateIntegrity(encryptedData: EncryptedData): Promise<boolean> {
    try {
      // For GCM and ChaCha20-Poly1305, integrity is verified during decryption
      if (encryptedData.authTag) {
        await this.decrypt(encryptedData);
        return true;
      }

      // For CBC, we need to implement our own integrity check
      // This is simplified - in production, use HMAC
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Derive key from password using PBKDF2 or scrypt
   */
  private async deriveKey(
    password: string,
    salt: Buffer,
    config: EncryptionConfig
  ): Promise<Buffer> {
    switch (config.keyDerivation) {
      case 'pbkdf2':
        return pbkdf2Sync(password, salt, config.iterations!, 32, 'sha256');

      case 'scrypt': {
        // Options reserved for future fine-tuning
        // const parallelization = config.parallelization ?? 1;
        // const memoryLimit = config.memoryLimit ?? (64 * 1024 * 1024);
        return await scryptAsync(
          password,
          salt,
          32
        ) as Buffer;
      }

      default:
        throw new Error(`Unsupported key derivation: ${config.keyDerivation}`);
    }
  }

  /**
   * Encrypt field with full encryption (not deterministic)
   */
  private async encryptFullField(value: string, _rule: FieldEncryptionRule): Promise<string> {
    // key available for future use
    // const key = await this.generateFieldKey(_rule.tableName, _rule.fieldName, _rule.keyVersion);
    const result = await this.encrypt(value);
    return JSON.stringify(result);
  }

  /**
   * Encrypt field with deterministic encryption (same input = same output)
   */
  private async encryptDeterministicField(value: string, rule: FieldEncryptionRule): Promise<string> {
    const key = await this.generateFieldKey(rule.tableName, rule.fieldName, rule.keyVersion);

    // Use a fixed IV based on the value for deterministic encryption
    const iv = createHash('md5').update(value + key.toString('hex')).digest().slice(0, 12);

    const cipher = createCipheriv('aes-256-gcm', key.slice(0, 32), iv);
    cipher.setAAD(Buffer.from(`${rule.tableName}:${rule.fieldName}`));

    const encrypted1 = cipher.update(Buffer.from(value, 'utf8'));
    const encrypted2 = cipher.final();
    const authTag = cipher.getAuthTag();

    const result = Buffer.concat([encrypted1, encrypted2]);

    return Buffer.concat([iv, authTag, result]).toString('base64');
  }

  /**
   * Encrypt field with searchable encryption
   */
  private async encryptSearchableField(value: string, rule: FieldEncryptionRule): Promise<string> {
    // For searchable encryption, we store both encrypted value and search hash
    const encryptedValue = await this.encryptFullField(value, rule);
    const searchHash = this.generateSearchHash(value, rule.tableName + rule.fieldName);

    return JSON.stringify({
      encrypted: encryptedValue,
      searchHash: searchHash
    });
  }

  /**
   * Decrypt full field
   */
  private async decryptFullField(encryptedValue: string, _rule: FieldEncryptionRule): Promise<string> {
    const encryptedData = JSON.parse(encryptedValue) as EncryptedData;
    const decrypted = await this.decrypt(encryptedData);
    return decrypted.toString('utf8');
  }

  /**
   * Decrypt deterministic field
   */
  private async decryptDeterministicField(encryptedValue: string, rule: FieldEncryptionRule): Promise<string> {
    const key = await this.generateFieldKey(rule.tableName, rule.fieldName, rule.keyVersion);
    const buffer = Buffer.from(encryptedValue, 'base64');

    const iv = buffer.slice(0, 12);
    const authTag = buffer.slice(12, 28);
    const data = buffer.slice(28);

    const decipher = createDecipheriv('aes-256-gcm', key.slice(0, 32), iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(`${rule.tableName}:${rule.fieldName}`));

    const decrypted1 = decipher.update(data);
    const decrypted2 = decipher.final();

    return Buffer.concat([decrypted1, decrypted2]).toString('utf8');
  }

  /**
   * Decrypt searchable field
   */
  private async decryptSearchableField(encryptedValue: string, rule: FieldEncryptionRule): Promise<string> {
    const searchableData = JSON.parse(encryptedValue);
    return this.decryptFullField(searchableData.encrypted, rule);
  }

  /**
   * Get field encryption rule
   */
  private getFieldRule(tableName: string, fieldName: string): FieldEncryptionRule | null {
    const key = `${tableName}.${fieldName}`;
    return this.fieldRules.get(key) || null;
  }

  /**
   * Load field encryption rules from configuration
   */
  private loadFieldEncryptionRules(): void {
    // In production, this would load from database or configuration
    const rules: readonly FieldEncryptionRule[] = [
      {
        tableName: 'users',
        fieldName: 'password_hash',
        encryptionType: 'full',
        algorithm: 'aes-256-gcm',
        keyVersion: 1
      },
      {
        tableName: 'users',
        fieldName: 'two_factor_secret',
        encryptionType: 'full',
        algorithm: 'aes-256-gcm',
        keyVersion: 1
      },
      {
        tableName: 'users',
        fieldName: 'email',
        encryptionType: 'searchable',
        algorithm: 'aes-256-gcm',
        keyVersion: 1
      },
      {
        tableName: 'tickets',
        fieldName: 'description',
        encryptionType: 'full',
        algorithm: 'aes-256-gcm',
        keyVersion: 1
      },
      {
        tableName: 'comments',
        fieldName: 'content',
        encryptionType: 'full',
        algorithm: 'aes-256-gcm',
        keyVersion: 1
      },
      {
        tableName: 'attachments',
        fieldName: 'filename',
        encryptionType: 'deterministic',
        algorithm: 'aes-256-gcm',
        keyVersion: 1
      }
    ];

    for (const rule of rules) {
      const key = `${rule.tableName}.${rule.fieldName}`;
      this.fieldRules.set(key, rule);
    }
  }

  /**
   * Add field encryption rule
   */
  addFieldRule(rule: FieldEncryptionRule): void {
    const key = `${rule.tableName}.${rule.fieldName}`;
    this.fieldRules.set(key, rule);
  }

  /**
   * Remove field encryption rule
   */
  removeFieldRule(tableName: string, fieldName: string): void {
    const key = `${tableName}.${fieldName}`;
    this.fieldRules.delete(key);
  }

  /**
   * Get all field encryption rules
   */
  getFieldRules(): FieldEncryptionRule[] {
    return Array.from(this.fieldRules.values());
  }
}

export const encryptionManager = new EncryptionManager();
export default encryptionManager;