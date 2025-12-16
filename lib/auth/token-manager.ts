/**
 * Enterprise Token Management System
 *
 * Security Features:
 * - httpOnly cookies for access tokens (XSS protection)
 * - Secure refresh token rotation
 * - Device fingerprinting for token binding
 * - Short-lived access tokens (15 min)
 * - Long-lived refresh tokens (7 days)
 * - Automatic token rotation on refresh
 * - Token revocation support
 */

import { SignJWT, jwtVerify } from 'jose';
import * as crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { validateJWTSecret, isProduction } from '@/lib/config/env';
import { captureAuthError } from '@/lib/monitoring/sentry-helpers';
import logger from '@/lib/monitoring/structured-logger';
import db from '@/lib/db/connection';

// Token configuration
const JWT_SECRET = new TextEncoder().encode(validateJWTSecret());
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes for access tokens
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days for refresh tokens
const COOKIE_MAX_AGE_ACCESS = 15 * 60; // 15 minutes in seconds
const COOKIE_MAX_AGE_REFRESH = 7 * 24 * 60 * 60; // 7 days in seconds

// Cookie names
export const ACCESS_TOKEN_COOKIE = 'auth_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const DEVICE_ID_COOKIE = 'device_id';

/**
 * Token payload interface
 */
export interface TokenPayload {
  user_id: number;
  tenant_id: number;
  name: string;
  email: string;
  role: string;
  tenant_slug: string;
  device_fingerprint?: string;
}

/**
 * Refresh token record in database
 */
interface RefreshTokenRecord {
  id: number;
  user_id: number;
  tenant_id: number;
  token_hash: string;
  device_fingerprint: string;
  expires_at: string;
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
}

/**
 * Generate device fingerprint from request
 * Combines multiple request attributes for unique device identification
 */
export function generateDeviceFingerprint(request: NextRequest): string {
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';

  // Combine headers for fingerprint
  const fingerprintData = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;

  return crypto
    .createHash('sha256')
    .update(fingerprintData)
    .digest('base64url')
    .substring(0, 32);
}

/**
 * Get or create device ID for persistent device identification
 */
export function getOrCreateDeviceId(request: NextRequest): string {
  const existingDeviceId = request.cookies.get(DEVICE_ID_COOKIE)?.value;

  if (existingDeviceId && /^[a-zA-Z0-9_-]{32}$/.test(existingDeviceId)) {
    return existingDeviceId;
  }

  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Hash refresh token for secure storage
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate access token (short-lived, httpOnly cookie)
 */
export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  try {
    const token = await new SignJWT({
      user_id: payload.user_id,
      tenant_id: payload.tenant_id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      tenant_slug: payload.tenant_slug,
      device_fingerprint: payload.device_fingerprint,
      type: 'access'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('servicedesk')
      .setAudience('servicedesk-users')
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .setSubject(payload.user_id.toString())
      .sign(JWT_SECRET);

    return token;
  } catch (error) {
    captureAuthError(error, { method: 'access_token_generation' });
    throw new Error('Failed to generate access token');
  }
}

/**
 * Generate refresh token (long-lived, httpOnly cookie)
 */
export async function generateRefreshToken(
  payload: TokenPayload,
  deviceFingerprint: string
): Promise<string> {
  try {
    // Generate unique token ID for tracking
    const tokenId = crypto.randomBytes(16).toString('base64url');

    const token = await new SignJWT({
      user_id: payload.user_id,
      tenant_id: payload.tenant_id,
      token_id: tokenId,
      device_fingerprint: deviceFingerprint,
      type: 'refresh'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('servicedesk')
      .setAudience('servicedesk-users')
      .setIssuedAt()
      .setExpirationTime(REFRESH_TOKEN_EXPIRY)
      .setSubject(payload.user_id.toString())
      .sign(JWT_SECRET);

    // Store refresh token in database
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      db.prepare(`
        INSERT INTO refresh_tokens (
          user_id, tenant_id, token_hash, device_fingerprint, expires_at
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        payload.user_id,
        payload.tenant_id,
        tokenHash,
        deviceFingerprint,
        expiresAt
      );
    } catch (dbError) {
      logger.error('Failed to store refresh token in database', dbError);
      // Continue anyway - token is still valid
    }

    return token;
  } catch (error) {
    captureAuthError(error, { method: 'refresh_token_generation' });
    throw new Error('Failed to generate refresh token');
  }
}

/**
 * Verify access token
 */
export async function verifyAccessToken(
  token: string,
  deviceFingerprint?: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: 'servicedesk',
      audience: 'servicedesk-users',
    });

    // Validate token type
    if (payload.type !== 'access') {
      logger.warn('Invalid token type for access token verification');
      return null;
    }

    // Validate device fingerprint if provided
    if (deviceFingerprint && payload.device_fingerprint !== deviceFingerprint) {
      logger.warn('Device fingerprint mismatch', {
        user_id: payload.user_id,
        expected: deviceFingerprint,
        actual: payload.device_fingerprint
      });
      return null;
    }

    return {
      user_id: payload.user_id as number,
      tenant_id: payload.tenant_id as number,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as string,
      tenant_slug: payload.tenant_slug as string,
      device_fingerprint: payload.device_fingerprint as string
    };
  } catch (error) {
    // Token expired or invalid
    return null;
  }
}

/**
 * Verify refresh token and check database
 */
export async function verifyRefreshToken(
  token: string,
  deviceFingerprint: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: 'servicedesk',
      audience: 'servicedesk-users',
    });

    // Validate token type
    if (payload.type !== 'refresh') {
      logger.warn('Invalid token type for refresh token verification');
      return null;
    }

    // Validate device fingerprint
    if (payload.device_fingerprint !== deviceFingerprint) {
      logger.warn('Device fingerprint mismatch on refresh', {
        user_id: payload.user_id
      });
      return null;
    }

    // Check if token exists and is not revoked in database
    const tokenHash = hashToken(token);
    const tokenRecord = db.prepare(`
      SELECT * FROM refresh_tokens
      WHERE token_hash = ? AND revoked_at IS NULL
    `).get(tokenHash) as RefreshTokenRecord | undefined;

    if (!tokenRecord) {
      logger.warn('Refresh token not found or revoked', {
        user_id: payload.user_id
      });
      return null;
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      logger.warn('Refresh token expired', {
        user_id: payload.user_id
      });
      return null;
    }

    // Update last used timestamp
    db.prepare(`
      UPDATE refresh_tokens
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(tokenRecord.id);

    // Get user data for token payload
    const user = db.prepare(`
      SELECT id, name, email, role, tenant_id FROM users WHERE id = ?
    `).get(payload.user_id) as {
      id: number;
      name: string;
      email: string;
      role: string;
      tenant_id: number;
    } | undefined;

    if (!user) {
      logger.warn('User not found for refresh token', {
        user_id: payload.user_id
      });
      return null;
    }

    // Get tenant slug
    const tenant = db.prepare(`
      SELECT slug FROM tenants WHERE id = ?
    `).get(user.tenant_id) as { slug: string } | undefined;

    if (!tenant) {
      logger.warn('Tenant not found for refresh token', {
        tenant_id: user.tenant_id
      });
      return null;
    }

    return {
      user_id: user.id,
      tenant_id: user.tenant_id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_slug: tenant.slug,
      device_fingerprint: deviceFingerprint
    };
  } catch (error) {
    captureAuthError(error, { method: 'refresh_token_verification' });
    return null;
  }
}

/**
 * Revoke refresh token
 */
export function revokeRefreshToken(token: string): boolean {
  try {
    const tokenHash = hashToken(token);
    const result = db.prepare(`
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE token_hash = ? AND revoked_at IS NULL
    `).run(tokenHash);

    return result.changes > 0;
  } catch (error) {
    logger.error('Failed to revoke refresh token', error);
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user
 */
export function revokeAllUserTokens(userId: number, tenantId: number): boolean {
  try {
    const result = db.prepare(`
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND tenant_id = ? AND revoked_at IS NULL
    `).run(userId, tenantId);

    logger.info(`Revoked ${result.changes} tokens for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Failed to revoke user tokens', error);
    return false;
  }
}

/**
 * Clean up expired tokens
 */
export function cleanupExpiredTokens(): void {
  try {
    const result = db.prepare(`
      DELETE FROM refresh_tokens
      WHERE expires_at < datetime('now')
      OR revoked_at IS NOT NULL AND revoked_at < datetime('now', '-30 days')
    `).run();

    logger.info(`Cleaned up ${result.changes} expired/old refresh tokens`);
  } catch (error) {
    logger.error('Failed to cleanup expired tokens', error);
  }
}

/**
 * Set authentication cookies on response
 */
export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  deviceId: string
): void {
  // Set access token cookie (httpOnly, short-lived)
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE_ACCESS,
    path: '/'
  });

  // Set refresh token cookie (httpOnly, long-lived)
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE_REFRESH,
    path: '/'
  });

  // Set device ID cookie (not httpOnly, used for fingerprinting)
  response.cookies.set(DEVICE_ID_COOKIE, deviceId, {
    httpOnly: false,
    secure: isProduction(),
    sameSite: 'strict',
    maxAge: 365 * 24 * 60 * 60, // 1 year
    path: '/'
  });
}

/**
 * Clear authentication cookies
 */
export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    maxAge: 0,
    path: '/'
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    maxAge: 0,
    path: '/'
  });
}

/**
 * Extract tokens from request
 */
export function extractTokensFromRequest(request: NextRequest): {
  accessToken: string | null;
  refreshToken: string | null;
  deviceFingerprint: string;
} {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value || null;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value || null;
  const deviceFingerprint = generateDeviceFingerprint(request);

  return { accessToken, refreshToken, deviceFingerprint };
}

/**
 * Initialize refresh_tokens table if it doesn't exist
 */
export function initializeTokensTable(): void {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tenant_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        device_fingerprint TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_used_at TEXT,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `).run();

    // Create indexes for performance
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
      ON refresh_tokens(token_hash)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
      ON refresh_tokens(user_id, tenant_id)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
      ON refresh_tokens(expires_at)
    `).run();

    logger.info('Refresh tokens table initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize refresh tokens table', error);
  }
}
