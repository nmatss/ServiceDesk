/**
 * Webhook Security Module
 *
 * Implements secure webhook handling:
 * - HMAC-SHA256 signature verification
 * - Timestamp validation (anti-replay attacks)
 * - IP whitelisting
 * - Rate limiting per webhook endpoint
 * - Request logging and monitoring
 */

import * as crypto from 'crypto';
import { NextRequest } from 'next/server';
import logger from '@/lib/monitoring/structured-logger';

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  secret: string;
  allowedIPs?: string[];
  timestampToleranceSeconds?: number;
  signatureHeader?: string;
  timestampHeader?: string;
}

/**
 * Webhook verification result
 */
export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
  ip?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  timestampToleranceSeconds: 300, // 5 minutes
  signatureHeader: 'x-webhook-signature',
  timestampHeader: 'x-webhook-timestamp',
};

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp?: number
): string {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${payload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return `t=${ts},v1=${signature}`;
}

/**
 * Verify webhook signature
 */
export async function verifyWebhookSignature(
  request: NextRequest,
  config: WebhookConfig
): Promise<WebhookVerificationResult> {
  try {
    const {
      secret,
      allowedIPs,
      timestampToleranceSeconds = DEFAULT_CONFIG.timestampToleranceSeconds,
      signatureHeader = DEFAULT_CONFIG.signatureHeader,
      timestampHeader = DEFAULT_CONFIG.timestampHeader,
    } = config;

    // Get request IP
    const ip = getClientIP(request);

    // IP whitelist check
    if (allowedIPs && allowedIPs.length > 0) {
      if (!allowedIPs.includes(ip)) {
        logger.warn('Webhook rejected: IP not whitelisted', { ip, allowedIPs });
        return {
          valid: false,
          error: 'IP address not authorized',
          ip,
        };
      }
    }

    // Get signature header
    const signatureHeaderValue = request.headers.get(signatureHeader);
    if (!signatureHeaderValue) {
      logger.warn('Webhook rejected: Missing signature header', { ip });
      return {
        valid: false,
        error: 'Missing signature header',
        ip,
      };
    }

    // Parse signature header (format: "t=timestamp,v1=signature")
    const parts = signatureHeaderValue.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      logger.warn('Webhook rejected: Invalid signature format', { ip, header: signatureHeaderValue });
      return {
        valid: false,
        error: 'Invalid signature format',
        ip,
      };
    }

    const timestamp = parseInt(timestampPart.split('=')[1], 10);
    const providedSignature = signaturePart.split('=')[1];

    // Verify timestamp (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    const age = now - timestamp;

    if (age > timestampToleranceSeconds) {
      logger.warn('Webhook rejected: Timestamp too old', {
        ip,
        timestamp,
        age,
        tolerance: timestampToleranceSeconds
      });
      return {
        valid: false,
        error: 'Request timestamp too old (possible replay attack)',
        timestamp,
        ip,
      };
    }

    if (age < -timestampToleranceSeconds) {
      logger.warn('Webhook rejected: Timestamp in future', { ip, timestamp, age });
      return {
        valid: false,
        error: 'Request timestamp in future',
        timestamp,
        ip,
      };
    }

    // Get request body
    const body = await request.text();

    // Recreate signature
    const signedPayload = `${timestamp}.${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      logger.warn('Webhook rejected: Invalid signature', { ip, timestamp });
      return {
        valid: false,
        error: 'Invalid signature',
        timestamp,
        ip,
      };
    }

    logger.info('Webhook signature verified successfully', { ip, timestamp });
    return {
      valid: true,
      timestamp,
      ip,
    };
  } catch (error) {
    logger.error('Webhook verification error', error);
    return {
      valid: false,
      error: 'Internal verification error',
    };
  }
}

/**
 * Get client IP from request (handles proxies)
 */
function getClientIP(request: NextRequest): string {
  // Check various headers that may contain the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list, take the first one
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return 'unknown';
}

/**
 * Create webhook middleware for route protection
 */
export function createWebhookMiddleware(config: WebhookConfig) {
  return async (request: NextRequest): Promise<boolean> => {
    const result = await verifyWebhookSignature(request, config);

    if (!result.valid) {
      // Log failed attempt for security monitoring
      logger.error('Webhook authentication failed', {
        error: result.error,
        ip: result.ip,
        path: request.nextUrl.pathname,
        method: request.method,
      });
    }

    return result.valid;
  };
}

/**
 * Webhook rate limiting tracker
 */
const webhookRateLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Check webhook rate limit
 */
export function checkWebhookRateLimit(
  identifier: string, // IP or endpoint ID
  maxRequests: number = 100,
  windowSeconds: number = 60
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const limit = webhookRateLimits.get(identifier);

  if (!limit || now > limit.resetAt) {
    // Reset window
    const resetAt = now + (windowSeconds * 1000);
    webhookRateLimits.set(identifier, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt,
    };
  }

  if (limit.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: limit.resetAt,
    };
  }

  limit.count++;
  webhookRateLimits.set(identifier, limit);

  return {
    allowed: true,
    remaining: maxRequests - limit.count,
    resetAt: limit.resetAt,
  };
}

/**
 * Log webhook activity
 */
export function logWebhookActivity(
  endpoint: string,
  success: boolean,
  metadata: Record<string, unknown>
): void {
  logger.info('Webhook activity', {
    endpoint,
    success,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Validate webhook payload structure
 */
export function validateWebhookPayload<T>(
  payload: unknown,
  schema: (data: unknown) => T
): { valid: boolean; data?: T; error?: string } {
  try {
    const validated = schema(payload);
    return { valid: true, data: validated };
  } catch (error) {
    logger.warn('Webhook payload validation failed', { error });
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid payload',
    };
  }
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupWebhookRateLimits(): void {
  const now = Date.now();
  for (const [key, value] of webhookRateLimits.entries()) {
    if (now > value.resetAt) {
      webhookRateLimits.delete(key);
    }
  }
}

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupWebhookRateLimits, 5 * 60 * 1000);
}
