import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/security/config', () => ({
  getSecurityConfig: vi.fn(() => ({
    encryption: {
      atRest: { algorithm: 'aes-256-gcm', keyRotationDays: 90 },
      inTransit: {
        hsts: { enabled: true, maxAge: 31536000, includeSubDomains: true, preload: true }
      },
      fieldLevel: { sensitiveFields: ['phone', 'address', 'cpf'] }
    }
  }))
}));

vi.mock('@/lib/monitoring/structured-logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import {
  EncryptionManager,
  generateSecureToken,
  secureCompare,
  deriveApiKey,
  KeyManager,
  TransportSecurity,
} from '../encryption';

describe('EncryptionManager', () => {
  beforeEach(() => {
    (EncryptionManager as any).instance = undefined;
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    delete process.env.ENCRYPTION_KEY_V2;
  });

  describe('encrypt', () => {
    it('returns all required fields', async () => {
      const manager = EncryptionManager.getInstance();
      const result = await manager.encrypt('hello world');

      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('salt');
      expect(result).toHaveProperty('authTag');
      expect(result).toHaveProperty('version');
      expect(typeof result.encrypted).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(typeof result.salt).toBe('string');
      expect(typeof result.authTag).toBe('string');
      expect(typeof result.version).toBe('number');
    });
  });

  describe('encrypt + decrypt roundtrip', () => {
    it('decrypts back to original plaintext', async () => {
      const manager = EncryptionManager.getInstance();
      const plaintext = 'sensitive data 123!@#';
      const encrypted = await manager.encrypt(plaintext);
      const decrypted = await manager.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('decrypt with wrong key', () => {
    it('throws an error', async () => {
      const manager = EncryptionManager.getInstance();
      const encrypted = await manager.encrypt('secret');

      // Reset singleton with a different key
      (EncryptionManager as any).instance = undefined;
      process.env.ENCRYPTION_KEY = 'b'.repeat(64);

      const manager2 = EncryptionManager.getInstance();

      await expect(manager2.decrypt(encrypted)).rejects.toThrow('Decryption failed');
    });
  });

  describe('encryptField', () => {
    it('encrypts sensitive fields (phone, address)', async () => {
      const manager = EncryptionManager.getInstance();

      const encryptedPhone = await manager.encryptField('+5511999998888', 'phone');
      expect(encryptedPhone).not.toBe('+5511999998888');
      expect(encryptedPhone).not.toBeNull();
      // Should be valid JSON containing encryption result
      const parsed = JSON.parse(encryptedPhone!);
      expect(parsed).toHaveProperty('encrypted');
      expect(parsed).toHaveProperty('iv');

      const encryptedAddress = await manager.encryptField('Rua Exemplo 123', 'address');
      expect(encryptedAddress).not.toBe('Rua Exemplo 123');
      expect(encryptedAddress).not.toBeNull();
    });

    it('returns value unchanged for non-sensitive fields', async () => {
      const manager = EncryptionManager.getInstance();
      const result = await manager.encryptField('John Doe', 'name');

      expect(result).toBe('John Doe');
    });

    it('returns null for empty value', async () => {
      const manager = EncryptionManager.getInstance();
      const result = await manager.encryptField('', 'phone');

      expect(result).toBeNull();
    });
  });

  describe('decryptField', () => {
    it('roundtrip works for sensitive fields', async () => {
      const manager = EncryptionManager.getInstance();
      const original = '123.456.789-00';

      const encrypted = await manager.encryptField(original, 'cpf');
      expect(encrypted).not.toBeNull();

      const decrypted = await manager.decryptField(encrypted, 'cpf');
      expect(decrypted).toBe(original);
    });

    it('returns null for null input', async () => {
      const manager = EncryptionManager.getInstance();
      const result = await manager.decryptField(null, 'phone');

      expect(result).toBeNull();
    });

    it('returns value as-is for non-sensitive fields', async () => {
      const manager = EncryptionManager.getInstance();
      const result = await manager.decryptField('plain value', 'name');

      expect(result).toBe('plain value');
    });

    it('returns value as-is if JSON parse fails (backwards compatibility)', async () => {
      const manager = EncryptionManager.getInstance();
      const result = await manager.decryptField('not-json-data', 'phone');

      expect(result).toBe('not-json-data');
    });
  });

  describe('rotateKeys', () => {
    it('creates new version and retires old', async () => {
      const manager = EncryptionManager.getInstance();
      expect(manager.getCurrentKeyVersion()).toBe(1);

      const result = await manager.rotateKeys();

      expect(result.success).toBe(true);
      expect(result.newVersion).toBe(2);
      expect(result.errors).toHaveLength(0);

      expect(manager.getCurrentKeyVersion()).toBe(2);

      const versions = manager.getKeyVersionInfo();
      const v1 = versions.find((v) => v.version === 1);
      const v2 = versions.find((v) => v.version === 2);

      expect(v1?.status).toBe('retired');
      expect(v1?.rotatedAt).toBeDefined();
      expect(v2?.status).toBe('active');
    });
  });

  describe('getCurrentKeyVersion', () => {
    it('returns 1 for fresh instance', () => {
      const manager = EncryptionManager.getInstance();
      expect(manager.getCurrentKeyVersion()).toBe(1);
    });

    it('returns higher version when V2 env key exists', () => {
      (EncryptionManager as any).instance = undefined;
      process.env.ENCRYPTION_KEY_V2 = 'c'.repeat(64);

      const manager = EncryptionManager.getInstance();
      expect(manager.getCurrentKeyVersion()).toBe(2);

      delete process.env.ENCRYPTION_KEY_V2;
    });
  });

  describe('shouldRotateKey', () => {
    it('returns false for a newly created key', () => {
      const manager = EncryptionManager.getInstance();
      expect(manager.shouldRotateKey()).toBe(false);
    });
  });

  describe('getKeyVersionInfo', () => {
    it('returns array without key field exposed', () => {
      const manager = EncryptionManager.getInstance();
      const info = manager.getKeyVersionInfo();

      expect(Array.isArray(info)).toBe(true);
      expect(info.length).toBeGreaterThanOrEqual(1);
      expect(info[0]).toHaveProperty('version');
      expect(info[0]).toHaveProperty('createdAt');
      expect(info[0]).toHaveProperty('status');
      expect(info[0]).not.toHaveProperty('key');
    });
  });
});

describe('generateSecureToken', () => {
  it('generates correct default length (32 bytes = 64 hex chars)', () => {
    const token = generateSecureToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('generates correct custom length', () => {
    const token = generateSecureToken(16);
    expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
  });

  it('generates unique tokens each call', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a).not.toBe(b);
  });
});

describe('secureCompare', () => {
  it('returns true for equal strings', () => {
    expect(secureCompare('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(secureCompare('abc123', 'abc124')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(secureCompare('short', 'much longer string')).toBe(false);
  });
});

describe('deriveApiKey', () => {
  it('returns consistent results for same inputs', async () => {
    const key1 = await deriveApiKey('seed-value', 'api-access');
    const key2 = await deriveApiKey('seed-value', 'api-access');

    expect(key1).toBe(key2);
    expect(key1).toHaveLength(64); // 32 bytes hex
  });

  it('returns different results for different seeds', async () => {
    const key1 = await deriveApiKey('seed-a', 'purpose');
    const key2 = await deriveApiKey('seed-b', 'purpose');

    expect(key1).not.toBe(key2);
  });

  it('returns different results for different purposes', async () => {
    const key1 = await deriveApiKey('same-seed', 'purpose-a');
    const key2 = await deriveApiKey('same-seed', 'purpose-b');

    expect(key1).not.toBe(key2);
  });
});

describe('KeyManager', () => {
  beforeEach(() => {
    // Clear the static cache between tests
    (KeyManager as any).keyCache = new Map();
  });

  describe('getSessionKey', () => {
    it('returns a hex string', () => {
      const key = KeyManager.getSessionKey('session-1');
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    it('returns cached key on second call', () => {
      const key1 = KeyManager.getSessionKey('session-2');
      const key2 = KeyManager.getSessionKey('session-2');

      expect(key1).toBe(key2);
    });

    it('returns different keys for different sessions', () => {
      const key1 = KeyManager.getSessionKey('session-a');
      const key2 = KeyManager.getSessionKey('session-b');

      expect(key1).not.toBe(key2);
    });
  });

  describe('revokeSessionKey', () => {
    it('removes key from cache so next call returns new key', () => {
      const key1 = KeyManager.getSessionKey('session-revoke');
      KeyManager.revokeSessionKey('session-revoke');
      const key2 = KeyManager.getSessionKey('session-revoke');

      expect(key1).not.toBe(key2);
    });
  });
});

describe('TransportSecurity', () => {
  let transport: TransportSecurity;

  beforeEach(() => {
    transport = new TransportSecurity();
  });

  describe('isSecureTransport', () => {
    it('returns true for https protocol', () => {
      const request = { protocol: 'https', headers: {} };
      expect(transport.isSecureTransport(request)).toBe(true);
    });

    it('returns true for x-forwarded-proto https', () => {
      const request = { protocol: 'http', headers: { 'x-forwarded-proto': 'https' } };
      expect(transport.isSecureTransport(request)).toBe(true);
    });

    it('returns true in development even for http', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const request = { protocol: 'http', headers: {} };
      expect(transport.isSecureTransport(request)).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('returns false for http in production without forwarded proto', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const request = { protocol: 'http', headers: {} };
      expect(transport.isSecureTransport(request)).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('getHstsHeader', () => {
    it('returns correct HSTS header format', () => {
      const header = transport.getHstsHeader();
      expect(header).toBe('max-age=31536000; includeSubDomains; preload');
    });
  });

  describe('redirectToHttps', () => {
    it('converts http URL to https', () => {
      const result = transport.redirectToHttps('http://example.com/path');
      expect(result).toBe('https://example.com/path');
    });

    it('leaves https URL unchanged', () => {
      const result = transport.redirectToHttps('https://example.com/path');
      expect(result).toBe('https://example.com/path');
    });
  });
});
