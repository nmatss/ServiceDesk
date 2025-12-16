/**
 * VAPID (Voluntary Application Server Identification) Manager
 * Handles VAPID key generation and management for web push notifications
 */

import crypto from 'crypto';
import logger from '../monitoring/structured-logger';

// Store VAPID keys (in production, use environment variables or secure storage)
let cachedVapidKeys: { publicKey: string; privateKey: string } | null = null;

interface VapidKeys {
  publicKey: string;
  privateKey: string;
  publicKeyBuffer: Buffer;
  privateKeyBuffer: Buffer;
}

/**
 * Generate VAPID keys for web push
 * Uses ECDH (Elliptic Curve Diffie-Hellman) with P-256 curve
 */
export function generateVapidKeys(): VapidKeys {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();

  const publicKey = ecdh.getPublicKey('base64', 'uncompressed');
  const privateKey = ecdh.getPrivateKey('base64');

  return {
    publicKey,
    privateKey,
    publicKeyBuffer: Buffer.from(publicKey, 'base64'),
    privateKeyBuffer: Buffer.from(privateKey, 'base64'),
  };
}

/**
 * Convert base64 to URL-safe base64
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = Buffer.from(base64, 'base64');
  return new Uint8Array(rawData);
}

/**
 * Get or generate VAPID keys
 * In production, these should be stored securely and not regenerated
 */
export function getVapidKeys(): VapidKeys {
  // Check environment variables first
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (publicKey && privateKey) {
    logger.info('Using VAPID keys from environment');
    return {
      publicKey,
      privateKey,
      publicKeyBuffer: Buffer.from(publicKey, 'base64'),
      privateKeyBuffer: Buffer.from(privateKey, 'base64'),
    };
  }

  // Use cached keys if available
  if (cachedVapidKeys) {
    return {
      ...cachedVapidKeys,
      publicKeyBuffer: Buffer.from(cachedVapidKeys.publicKey, 'base64'),
      privateKeyBuffer: Buffer.from(cachedVapidKeys.privateKey, 'base64'),
    };
  }

  // Generate new keys (not recommended for production)
  logger.warn('Generating new VAPID keys - Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in production');
  const newKeys = generateVapidKeys();
  cachedVapidKeys = {
    publicKey: newKeys.publicKey,
    privateKey: newKeys.privateKey,
  };

  // Log the keys for manual configuration (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('\n=== VAPID Keys Generated ===');
    console.log('Add these to your .env file:');
    console.log(`VAPID_PUBLIC_KEY=${newKeys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${newKeys.privateKey}`);
    console.log('============================\n');
  }

  return newKeys;
}

/**
 * Get public VAPID key in application server key format
 */
export function getPublicVapidKey(): string {
  const { publicKey } = getVapidKeys();
  return publicKey;
}

/**
 * Convert VAPID key to JWT format for push service authentication
 */
export function createVapidAuthenticationHeader(
  audience: string,
  subject: string,
  expiration?: number
): string {
  const { privateKey } = getVapidKeys();

  const header = {
    typ: 'JWT',
    alg: 'ES256',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: expiration || now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Sign with ECDSA using P-256 curve
  const sign = crypto.createSign('SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign(
    {
      key: privateKey,
      format: 'der',
      type: 'sec1',
    },
    'base64url'
  );

  return `${unsignedToken}.${signature}`;
}

/**
 * Validate VAPID configuration
 */
export function validateVapidConfig(): {
  valid: boolean;
  message: string;
} {
  try {
    const { publicKey, privateKey } = getVapidKeys();

    if (!publicKey || !privateKey) {
      return {
        valid: false,
        message: 'VAPID keys not configured',
      };
    }

    // Check key length (should be valid base64)
    if (publicKey.length < 64 || privateKey.length < 32) {
      return {
        valid: false,
        message: 'VAPID keys appear to be invalid',
      };
    }

    return {
      valid: true,
      message: 'VAPID configuration is valid',
    };
  } catch (error) {
    return {
      valid: false,
      message: `VAPID validation error: ${error}`,
    };
  }
}

/**
 * Initialize VAPID keys on server startup
 */
export function initializeVapid(): void {
  const validation = validateVapidConfig();

  if (!validation.valid) {
    logger.warn('VAPID configuration issue:', validation.message);
  } else {
    logger.info('VAPID initialized successfully');
  }

  // Ensure keys are loaded
  getVapidKeys();
}

// Export configuration helper
export const vapidConfig = {
  getKeys: getVapidKeys,
  getPublicKey: getPublicVapidKey,
  generateKeys: generateVapidKeys,
  validate: validateVapidConfig,
  initialize: initializeVapid,
  createAuthHeader: createVapidAuthenticationHeader,
};
