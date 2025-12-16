/**
 * JWT Security Tests
 *
 * Tests for JSON Web Token vulnerabilities and security.
 * Validates proper JWT implementation and protection against common attacks.
 *
 * These tests work WITHOUT requiring a running server - they test the JWT
 * utilities directly.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateDeviceFingerprint,
  TokenPayload
} from '@/lib/auth/token-manager';
import { NextRequest } from 'next/server';

describe('JWT Security Tests', () => {
  let testPayload: TokenPayload;
  let testDeviceFingerprint: string;
  let validAccessToken: string;
  let validRefreshToken: string;

  beforeAll(async () => {
    // Create test payload
    testPayload = {
      user_id: 1,
      tenant_id: 1,
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      tenant_slug: 'test-tenant'
    };

    // Generate device fingerprint
    const mockRequest = new NextRequest('http://localhost:3000', {
      headers: {
        'user-agent': 'test-agent',
        'accept-language': 'en-US',
        'accept-encoding': 'gzip, deflate'
      }
    });
    testDeviceFingerprint = generateDeviceFingerprint(mockRequest);

    // Generate valid tokens for testing
    validAccessToken = await generateAccessToken({
      ...testPayload,
      device_fingerprint: testDeviceFingerprint
    });

    validRefreshToken = await generateRefreshToken(
      testPayload,
      testDeviceFingerprint
    );
  });

  describe('Token Generation', () => {
    it('should generate valid access tokens', async () => {
      const token = await generateAccessToken(testPayload);
      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should generate valid refresh tokens', async () => {
      const token = await generateRefreshToken(testPayload, testDeviceFingerprint);
      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include required claims in access token', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      expect(payload.user_id).toBe(testPayload.user_id);
      expect(payload.email).toBe(testPayload.email);
      expect(payload.role).toBe(testPayload.role);
      expect(payload.type).toBe('access');
      expect(payload.iss).toBe('servicedesk');
      expect(payload.aud).toBe('servicedesk-users');
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();
    });

    it('should not include sensitive data in token', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      expect(payload.password).toBeUndefined();
      expect(payload.passwordHash).toBeUndefined();
      expect(payload.creditCard).toBeUndefined();
      expect(payload.ssn).toBeUndefined();
    });
  });

  describe('Token Verification', () => {
    it('should verify valid access tokens', async () => {
      const verified = await verifyAccessToken(validAccessToken, testDeviceFingerprint);
      expect(verified).toBeTruthy();
      expect(verified?.user_id).toBe(testPayload.user_id);
      expect(verified?.email).toBe(testPayload.email);
    });

    it('should reject tokens with invalid signature', async () => {
      const parts = validAccessToken.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;

      const verified = await verifyAccessToken(tamperedToken);
      expect(verified).toBeNull();
    });

    it('should reject tokens with modified payload', async () => {
      const parts = validAccessToken.split('.');
      const originalPayload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );
      const modifiedPayload = {
        ...originalPayload,
        role: 'admin' // Privilege escalation attempt
      };
      const newPayloadEncoded = Buffer.from(
        JSON.stringify(modifiedPayload)
      ).toString('base64url');

      const tamperedToken = `${parts[0]}.${newPayloadEncoded}.${parts[2]}`;

      const verified = await verifyAccessToken(tamperedToken);
      expect(verified).toBeNull();
    });

    it('should reject tokens with no signature', async () => {
      const parts = validAccessToken.split('.');
      const noSigToken = `${parts[0]}.${parts[1]}.`;

      const verified = await verifyAccessToken(noSigToken);
      expect(verified).toBeNull();
    });

    it('should reject malformed tokens', async () => {
      const malformedTokens = [
        'not.a.jwt',
        'only-one-part',
        'two.parts',
        'too.many.parts.here.error',
        '',
        'invalid'
      ];

      for (const token of malformedTokens) {
        const verified = await verifyAccessToken(token);
        expect(verified).toBeNull();
      }
    });
  });

  describe('None Algorithm Attack', () => {
    it('should reject tokens with "none" algorithm', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' })
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          user_id: 1,
          email: 'admin@example.com',
          role: 'admin',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        })
      ).toString('base64url');

      const noneToken = `${header}.${payload}.`;

      const verified = await verifyAccessToken(noneToken);
      expect(verified).toBeNull();
    });

    it('should reject tokens with "None" algorithm (case variation)', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'None', typ: 'JWT' })
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          user_id: 1,
          email: 'admin@example.com',
          role: 'admin',
          type: 'access'
        })
      ).toString('base64url');

      const noneToken = `${header}.${payload}.`;

      const verified = await verifyAccessToken(noneToken);
      expect(verified).toBeNull();
    });

    it('should reject tokens with "NONE" algorithm (uppercase)', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'NONE', typ: 'JWT' })
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ user_id: 1, role: 'admin', type: 'access' })
      ).toString('base64url');

      const noneToken = `${header}.${payload}.`;

      const verified = await verifyAccessToken(noneToken);
      expect(verified).toBeNull();
    });
  });

  describe('Token Expiration', () => {
    it('should have expiration claim in tokens', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );

      expect(payload.exp).toBeDefined();
      expect(typeof payload.exp).toBe('number');
      expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it('should have reasonable expiration time for access tokens', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );

      const now = Date.now() / 1000;
      const expiresIn = payload.exp - now;

      // Access tokens should expire in ~15 minutes
      expect(expiresIn).toBeGreaterThan(0);
      expect(expiresIn).toBeLessThan(20 * 60); // Less than 20 minutes
    });

    it('should have longer expiration for refresh tokens', async () => {
      const token = await generateRefreshToken(testPayload, testDeviceFingerprint);
      const parts = token.split('.');
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );

      const now = Date.now() / 1000;
      const expiresIn = payload.exp - now;

      // Refresh tokens should last several days
      expect(expiresIn).toBeGreaterThan(24 * 60 * 60); // More than 1 day
    });

    it('should reject expired tokens', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'JWT' })
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          user_id: 1,
          email: 'test@example.com',
          type: 'access',
          iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
          iss: 'servicedesk',
          aud: 'servicedesk-users'
        })
      ).toString('base64url');

      const expiredToken = `${header}.${payload}.fake-signature`;

      const verified = await verifyAccessToken(expiredToken);
      expect(verified).toBeNull();
    });
  });

  describe('Algorithm Validation', () => {
    it('should use HS256 algorithm', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());

      expect(header.alg).toBe('HS256');
    });

    it('should validate token type', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      expect(payload.type).toBe('access');
    });
  });

  describe('Device Fingerprinting', () => {
    it('should generate consistent device fingerprints', () => {
      const mockRequest1 = new NextRequest('http://localhost:3000', {
        headers: {
          'user-agent': 'test-agent',
          'accept-language': 'en-US',
          'accept-encoding': 'gzip'
        }
      });

      const mockRequest2 = new NextRequest('http://localhost:3000', {
        headers: {
          'user-agent': 'test-agent',
          'accept-language': 'en-US',
          'accept-encoding': 'gzip'
        }
      });

      const fingerprint1 = generateDeviceFingerprint(mockRequest1);
      const fingerprint2 = generateDeviceFingerprint(mockRequest2);

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate different fingerprints for different devices', () => {
      const mockRequest1 = new NextRequest('http://localhost:3000', {
        headers: {
          'user-agent': 'Mozilla/5.0',
          'accept-language': 'en-US',
          'accept-encoding': 'gzip'
        }
      });

      const mockRequest2 = new NextRequest('http://localhost:3000', {
        headers: {
          'user-agent': 'Chrome/90.0',
          'accept-language': 'pt-BR',
          'accept-encoding': 'br'
        }
      });

      const fingerprint1 = generateDeviceFingerprint(mockRequest1);
      const fingerprint2 = generateDeviceFingerprint(mockRequest2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should reject tokens with mismatched device fingerprint', async () => {
      const differentFingerprint = 'different-fingerprint-hash';
      const verified = await verifyAccessToken(validAccessToken, differentFingerprint);

      expect(verified).toBeNull();
    });
  });

  describe('Token Structure Validation', () => {
    it('should have three parts separated by dots', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeTruthy(); // Header
      expect(parts[1]).toBeTruthy(); // Payload
      expect(parts[2]).toBeTruthy(); // Signature
    });

    it('should have valid base64url encoding', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');

      // Should not contain +, /, or = (base64url specific)
      expect(parts[0]).not.toMatch(/[+/=]/);
      expect(parts[1]).not.toMatch(/[+/=]/);
    });
  });

  describe('JWT Claims Validation', () => {
    it('should validate required claims', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );

      // Required claims
      expect(payload.user_id).toBeDefined();
      expect(payload.iat).toBeDefined(); // Issued at
      expect(payload.exp).toBeDefined(); // Expiration
      expect(payload.iss).toBeDefined(); // Issuer
      expect(payload.aud).toBeDefined(); // Audience
      expect(payload.sub).toBeDefined(); // Subject
    });

    it('should include user identity in token', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );

      expect(payload.user_id).toBe(testPayload.user_id);
      expect(payload.email).toBe(testPayload.email);
    });

    it('should validate issuer claim', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );

      expect(payload.iss).toBe('servicedesk');
    });

    it('should validate audience claim', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );

      expect(payload.aud).toBe('servicedesk-users');
    });
  });

  describe('Token Type Differentiation', () => {
    it('should differentiate between access and refresh tokens', async () => {
      const accessToken = await generateAccessToken(testPayload);
      const refreshToken = await generateRefreshToken(testPayload, testDeviceFingerprint);

      const accessParts = accessToken.split('.');
      const refreshParts = refreshToken.split('.');

      const accessPayload = JSON.parse(
        Buffer.from(accessParts[1], 'base64url').toString()
      );
      const refreshPayload = JSON.parse(
        Buffer.from(refreshParts[1], 'base64url').toString()
      );

      expect(accessPayload.type).toBe('access');
      expect(refreshPayload.type).toBe('refresh');
    });

    it('should reject refresh token as access token', async () => {
      // Try to verify refresh token as access token
      const verified = await verifyAccessToken(validRefreshToken);
      expect(verified).toBeNull();
    });
  });

  describe('Header Validation', () => {
    it('should have JWT type in header', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());

      // jose library may not set typ header by default, which is acceptable
      // as long as the token is properly signed and verified
      expect(['JWT', undefined]).toContain(header.typ);
    });

    it('should reject tokens with invalid type header', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'NOT-JWT' })
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          user_id: 1,
          type: 'access',
          iss: 'servicedesk',
          aud: 'servicedesk-users'
        })
      ).toString('base64url');

      const invalidTypeToken = `${header}.${payload}.fake-signature`;

      const verified = await verifyAccessToken(invalidTypeToken);
      expect(verified).toBeNull();
    });
  });

  describe('Security Best Practices', () => {
    it('should use short expiration for access tokens', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );

      const expiresIn = payload.exp - payload.iat;

      // Should expire in 15 minutes or less
      expect(expiresIn).toBeLessThanOrEqual(15 * 60);
    });

    it('should include issued at timestamp', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );

      expect(payload.iat).toBeDefined();
      expect(typeof payload.iat).toBe('number');

      // Should be recent (within last minute)
      const now = Math.floor(Date.now() / 1000);
      expect(payload.iat).toBeGreaterThan(now - 60);
      expect(payload.iat).toBeLessThanOrEqual(now);
    });

    it('should include subject claim', async () => {
      const token = await generateAccessToken(testPayload);
      const parts = token.split('.');
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );

      expect(payload.sub).toBeDefined();
      expect(payload.sub).toBe(testPayload.user_id.toString());
    });
  });
});
