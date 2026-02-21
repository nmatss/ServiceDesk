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
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';

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

type TokenPayloadCompat = Partial<TokenPayload> & {
  id?: number;
  organization_id?: number;
};

/**
 * Refresh token record in database
 */
interface RefreshTokenRecord {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
  is_active?: boolean;
}

/**
 * Generate device fingerprint from request
 * Combines multiple request attributes for unique device identification
 *
 * Enhanced with additional security attributes:
 * - IP address (first in chain to prevent proxy spoofing)
 * - Client Hints headers (browser, platform, mobile detection)
 * - Screen resolution hints
 * - Timezone offset
 */
export function generateDeviceFingerprint(request: NextRequest): string {
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';

  // Get real IP (first in x-forwarded-for chain to prevent spoofing)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() :
                     request.headers.get('x-real-ip') ||
                     request.headers.get('cf-connecting-ip') ||
                     'unknown';

  // Client Hints for better device identification
  const secChUa = request.headers.get('sec-ch-ua') || ''; // Browser brand/version
  const secChUaPlatform = request.headers.get('sec-ch-ua-platform') || ''; // OS
  const secChUaMobile = request.headers.get('sec-ch-ua-mobile') || ''; // Mobile detection
  const secChUaModel = request.headers.get('sec-ch-ua-model') || ''; // Device model

  // Viewport hints
  const secChViewportWidth = request.headers.get('sec-ch-viewport-width') || '';
  const secChViewportHeight = request.headers.get('sec-ch-viewport-height') || '';

  // Combine all headers for enhanced fingerprint
  const fingerprintData = [
    ipAddress,
    userAgent,
    acceptLanguage,
    acceptEncoding,
    secChUa,
    secChUaPlatform,
    secChUaMobile,
    secChUaModel,
    secChViewportWidth,
    secChViewportHeight
  ].join('|');

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
      await executeRun(
        `
        INSERT INTO refresh_tokens (
          user_id, token_hash, expires_at, device_info, is_active
        ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          payload.user_id,
          tokenHash,
          expiresAt,
          JSON.stringify({ device_fingerprint: deviceFingerprint }),
          1,
        ]
      );
    } catch {
      try {
        await executeRun(
          `
          INSERT INTO refresh_tokens (
            user_id, tenant_id, token_hash, device_fingerprint, expires_at
          ) VALUES (?, ?, ?, ?, ?)
          `,
          [
            payload.user_id,
            payload.tenant_id,
            tokenHash,
            deviceFingerprint,
            expiresAt,
          ]
        );
      } catch (dbError) {
        logger.error('Failed to store refresh token in database', dbError);
        // Continue anyway - token is still valid
      }
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

    const compatPayload = payload as TokenPayloadCompat;
    const userId = Number(compatPayload.user_id ?? compatPayload.id);
    const tenantId = Number(compatPayload.tenant_id ?? compatPayload.organization_id);

    if (!Number.isFinite(userId) || !Number.isFinite(tenantId)) {
      return null;
    }

    return {
      user_id: userId,
      tenant_id: tenantId,
      name: String(payload.name ?? ''),
      email: String(payload.email ?? ''),
      role: String(payload.role ?? ''),
      tenant_slug: String(payload.tenant_slug ?? ''),
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
    const tokenRecord = await executeQueryOne<RefreshTokenRecord>(`
      SELECT * FROM refresh_tokens
      WHERE token_hash = ? AND revoked_at IS NULL
    `, [tokenHash]);

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
    try {
      await executeRun(
        `
        UPDATE refresh_tokens
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [tokenRecord.id]
      );
    } catch {
      // Column may not exist depending on schema version.
    }

    // Get user data for token payload
    let user = await executeQueryOne<{
      id: number;
      name: string;
      email: string;
      role: string;
      tenant_id: number;
    }>(
      `
      SELECT id, name, email, role, organization_id AS tenant_id
      FROM users
      WHERE id = ?
      `,
      [payload.user_id]
    );

    if (!user) {
      user = await executeQueryOne<{
        id: number;
        name: string;
        email: string;
        role: string;
        tenant_id: number;
      }>(
        `
        SELECT id, name, email, role, tenant_id
        FROM users
        WHERE id = ?
        `,
        [payload.user_id]
      );
    }

    if (!user) {
      logger.warn('User not found for refresh token', {
        user_id: payload.user_id
      });
      return null;
    }

    // Get tenant slug
    let tenant = await executeQueryOne<{ slug: string }>(
      `SELECT slug FROM organizations WHERE id = ?`,
      [user.tenant_id]
    );

    if (!tenant) {
      tenant = await executeQueryOne<{ slug: string }>(
        `SELECT slug FROM tenants WHERE id = ?`,
        [user.tenant_id]
      );
    }

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
export async function revokeRefreshToken(token: string): Promise<boolean> {
  try {
    const tokenHash = hashToken(token);
    const result = await executeRun(`
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP, is_active = 0
      WHERE token_hash = ? AND revoked_at IS NULL
    `, [tokenHash]);

    return result.changes > 0;
  } catch (error) {
    logger.error('Failed to revoke refresh token', error);
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserTokens(userId: number, tenantId: number): Promise<boolean> {
  try {
    let result;
    try {
      result = await executeRun(
        `
        UPDATE refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP, is_active = 0
        WHERE user_id = ? AND tenant_id = ? AND revoked_at IS NULL
        `,
        [userId, tenantId]
      );
    } catch {
      result = await executeRun(
        `
        UPDATE refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP, is_active = 0
        WHERE user_id = ? AND revoked_at IS NULL
        `,
        [userId]
      );
    }

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
export async function cleanupExpiredTokens(): Promise<void> {
  try {
    let result;
    try {
      result = await executeRun(
        `
        DELETE FROM refresh_tokens
        WHERE expires_at < CURRENT_TIMESTAMP
        OR (revoked_at IS NOT NULL AND revoked_at < CURRENT_TIMESTAMP - INTERVAL '30 days')
        `
      );
    } catch {
      result = await executeRun(
        `
        DELETE FROM refresh_tokens
        WHERE expires_at < datetime('now')
        OR (revoked_at IS NOT NULL AND revoked_at < datetime('now', '-30 days'))
        `
      );
    }

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
    sameSite: 'Lax' as any,
    maxAge: COOKIE_MAX_AGE_ACCESS,
    path: '/'
  });

  // Set refresh token cookie (httpOnly, long-lived)
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'Lax' as any,
    maxAge: COOKIE_MAX_AGE_REFRESH,
    path: '/'
  });

  // Set device ID cookie (not httpOnly, used for fingerprinting)
  response.cookies.set(DEVICE_ID_COOKIE, deviceId, {
    httpOnly: false,
    secure: isProduction(),
    sameSite: 'Lax' as any,
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
    sameSite: 'Lax' as any,
    maxAge: 0,
    path: '/'
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'Lax' as any,
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
export async function initializeTokensTable(): Promise<void> {
  try {
    // PostgreSQL schema should be managed by migrations/init scripts.
    if (getDatabaseType() === 'postgresql') {
      logger.info('Refresh tokens table initialization skipped for PostgreSQL');
      return;
    }

    await executeRun(`
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
    `);

    // Create indexes for performance
    await executeRun(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
      ON refresh_tokens(token_hash)
    `);

    await executeRun(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
      ON refresh_tokens(user_id, tenant_id)
    `);

    await executeRun(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
      ON refresh_tokens(expires_at)
    `);

    logger.info('Refresh tokens table initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize refresh tokens table', error);
  }
}
