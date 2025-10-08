import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import db from '../db/connection';
import { rbacEngine } from './rbac-engine';
import { dataRowSecurity } from './data-row-security';
import { logger } from '../monitoring/logger';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  identifier: 'ip' | 'user' | 'api_key';
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface APIKey {
  id: string;
  name: string;
  key_hash: string;
  user_id: number;
  permissions: string[];
  rate_limit?: RateLimitConfig;
  allowed_ips?: string[];
  expires_at?: string;
  last_used_at?: string;
  is_active: boolean;
  created_by: number;
  created_at: string;
}

export interface SecurityHeaders {
  'Content-Security-Policy'?: string;
  'X-Frame-Options'?: string;
  'X-Content-Type-Options'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
  'Strict-Transport-Security'?: string;
  'X-XSS-Protection'?: string;
}

export interface APIProtectionOptions {
  requireAuth?: boolean;
  requirePermission?: string;
  rateLimit?: RateLimitConfig;
  allowedMethods?: string[];
  validateSchema?: any;
  corsPolicy?: {
    origin: string | string[];
    methods: string[];
    allowedHeaders: string[];
  };
  apiKeySupport?: boolean;
  ipWhitelist?: string[];
  encryptResponse?: boolean;
}

class APIProtectionManager {
  private readonly DEFAULT_RATE_LIMIT: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    identifier: 'ip'
  };

  private readonly SECURITY_HEADERS: SecurityHeaders = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-XSS-Protection': '1; mode=block'
  };

  /**
   * Main API protection middleware
   */
  async protectAPI(
    request: NextRequest,
    options: APIProtectionOptions = {}
  ): Promise<NextResponse | null> {
    try {
      // Apply security headers
      const response = this.createSecureResponse();

      // Check HTTP method
      if (options.allowedMethods && !options.allowedMethods.includes(request.method)) {
        return this.createErrorResponse('Method not allowed', 405, response);
      }

      // Apply CORS policy
      if (options.corsPolicy) {
        this.applyCORSHeaders(response, options.corsPolicy, request);
      }

      // Check IP whitelist
      if (options.ipWhitelist) {
        const clientIP = this.getClientIP(request);
        if (!this.isIPAllowed(clientIP, options.ipWhitelist)) {
          return this.createErrorResponse('IP not whitelisted', 403, response);
        }
      }

      // Rate limiting
      const rateLimitConfig = options.rateLimit || this.DEFAULT_RATE_LIMIT;
      const rateLimitResult = await this.checkRateLimit(request, rateLimitConfig);
      if (!rateLimitResult.allowed) {
        return this.createErrorResponse(
          'Rate limit exceeded',
          429,
          response,
          rateLimitResult.headers
        );
      }

      // Apply rate limit headers
      if (rateLimitResult.headers) {
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }

      // Authentication
      if (options.requireAuth || options.requirePermission || options.apiKeySupport) {
        const authResult = await this.authenticateRequest(request, options);
        if (!authResult.success) {
          return this.createErrorResponse(authResult.error!, 401, response);
        }

        // Store auth info for later use
        request.headers.set('X-User-ID', authResult.userId!.toString());
        request.headers.set('X-User-Role', authResult.userRole!);
      }

      // Permission check
      if (options.requirePermission) {
        const userId = parseInt(request.headers.get('X-User-ID') || '0');
        const userRole = request.headers.get('X-User-Role') || '';

        const hasPermission = await this.checkPermission(
          userId,
          userRole,
          options.requirePermission,
          request
        );

        if (!hasPermission) {
          return this.createErrorResponse('Insufficient permissions', 403, response);
        }
      }

      // Log API access
      await this.logAPIAccess(request, options);

      return null; // Allow request to continue
    } catch (error) {
      logger.error('API protection error', error);
      return this.createErrorResponse('Internal server error', 500);
    }
  }

  /**
   * Create API key
   */
  async createAPIKey(
    name: string,
    userId: number,
    permissions: string[],
    createdBy: number,
    options: {
      expiresAt?: string;
      allowedIps?: string[];
      rateLimit?: RateLimitConfig;
    } = {}
  ): Promise<{ id: string; key: string } | null> {
    try {
      const keyId = this.generateKeyId();
      const apiKey = this.generateAPIKey();
      const keyHash = this.hashAPIKey(apiKey);

      const result = db.prepare(`
        INSERT INTO api_keys
        (id, name, key_hash, user_id, permissions, rate_limit, allowed_ips, expires_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        keyId,
        name,
        keyHash,
        userId,
        JSON.stringify(permissions),
        options.rateLimit ? JSON.stringify(options.rateLimit) : null,
        options.allowedIps ? JSON.stringify(options.allowedIps) : null,
        options.expiresAt || null,
        createdBy
      );

      if (result.changes > 0) {
        return { id: keyId, key: apiKey };
      }

      return null;
    } catch (error) {
      logger.error('Error creating API key', error);
      return null;
    }
  }

  /**
   * Revoke API key
   */
  revokeAPIKey(keyId: string): boolean {
    try {
      const stmt = db.prepare(`
        UPDATE api_keys SET is_active = 0 WHERE id = ?
      `);

      const result = stmt.run(keyId);
      return result.changes > 0;
    } catch (error) {
      logger.error('Error revoking API key', error);
      return false;
    }
  }

  /**
   * Get API keys for user
   */
  getUserAPIKeys(userId: number): APIKey[] {
    try {
      const keys = db.prepare(`
        SELECT * FROM api_keys
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).all(userId) as any[];

      return keys.map(key => ({
        ...key,
        permissions: JSON.parse(key.permissions),
        rate_limit: key.rate_limit ? JSON.parse(key.rate_limit) : undefined,
        allowed_ips: key.allowed_ips ? JSON.parse(key.allowed_ips) : undefined
      }));
    } catch (error) {
      logger.error('Error getting user API keys', error);
      return [];
    }
  }

  /**
   * Validate API key and return user info
   */
  async validateAPIKey(apiKey: string): Promise<{
    valid: boolean;
    userId?: number;
    permissions?: string[];
    keyId?: string;
  }> {
    try {
      const keyHash = this.hashAPIKey(apiKey);

      const keyRecord = db.prepare(`
        SELECT * FROM api_keys
        WHERE key_hash = ? AND is_active = 1
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `).get(keyHash) as any;

      if (!keyRecord) {
        return { valid: false };
      }

      // Update last used timestamp
      db.prepare(`
        UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(keyRecord.id);

      return {
        valid: true,
        userId: keyRecord.user_id,
        permissions: JSON.parse(keyRecord.permissions),
        keyId: keyRecord.id
      };
    } catch (error) {
      logger.error('Error validating API key', error);
      return { valid: false };
    }
  }

  /**
   * Apply data protection to response
   */
  async protectResponseData(
    data: any,
    userId: number,
    userRole: string,
    tableName?: string
  ): Promise<any> {
    try {
      if (!tableName || !Array.isArray(data)) {
        return data;
      }

      // Apply row-level security to filter data
      const securityContext = {
        userId,
        userRole,
        userDepartment: await this.getUserDepartment(userId)
      };

      // This is a simplified version - in production, you'd want to
      // apply the security policies more comprehensively
      const filteredData = data.filter(row => {
        return this.isRowAccessible(row, securityContext, tableName);
      });

      // Apply field-level masking
      return this.applyFieldMasking(filteredData, userRole);
    } catch (error) {
      logger.error('Error protecting response data', error);
      return data;
    }
  }

  /**
   * Create secure response with headers
   */
  private createSecureResponse(): NextResponse {
    const response = new NextResponse();

    // Apply security headers
    Object.entries(this.SECURITY_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    message: string,
    status: number,
    response?: NextResponse,
    extraHeaders?: Record<string, string>
  ): NextResponse {
    const errorResponse = response || this.createSecureResponse();

    if (extraHeaders) {
      Object.entries(extraHeaders).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
    }

    return NextResponse.json(
      { error: message, timestamp: new Date().toISOString() },
      { status, headers: errorResponse.headers }
    );
  }

  /**
   * Apply CORS headers
   */
  private applyCORSHeaders(
    response: NextResponse,
    corsPolicy: NonNullable<APIProtectionOptions['corsPolicy']>,
    request: NextRequest
  ): void {
    const origin = request.headers.get('origin');

    if (origin) {
      const allowedOrigins = Array.isArray(corsPolicy.origin)
        ? corsPolicy.origin
        : [corsPolicy.origin];

      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
      }
    }

    response.headers.set('Access-Control-Allow-Methods', corsPolicy.methods.join(', '));
    response.headers.set('Access-Control-Allow-Headers', corsPolicy.allowedHeaders.join(', '));
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  /**
   * Check rate limit
   */
  private async checkRateLimit(
    request: NextRequest,
    config: RateLimitConfig
  ): Promise<{
    allowed: boolean;
    headers?: Record<string, string>;
  }> {
    try {
      let identifier: string;

      switch (config.identifier) {
        case 'ip':
          identifier = this.getClientIP(request);
          break;
        case 'user':
          identifier = request.headers.get('X-User-ID') || 'anonymous';
          break;
        case 'api_key':
          identifier = this.extractAPIKey(request) || 'no-key';
          break;
        default:
          identifier = this.getClientIP(request);
      }

      const endpoint = new URL(request.url).pathname;
      const now = new Date();
      const windowStart = new Date(now.getTime() - config.windowMs);

      // Clean up old rate limit records
      db.prepare(`
        DELETE FROM rate_limits
        WHERE last_attempt_at < ?
      `).run(windowStart.toISOString());

      // Get current rate limit record
      const existing = db.prepare(`
        SELECT * FROM rate_limits
        WHERE identifier = ? AND identifier_type = ? AND endpoint = ?
      `).get(identifier, config.identifier, endpoint) as any;

      if (existing) {
        const firstAttempt = new Date(existing.first_attempt_at);
        const isNewWindow = now.getTime() - firstAttempt.getTime() >= config.windowMs;

        if (isNewWindow) {
          // Reset the window
          db.prepare(`
            UPDATE rate_limits
            SET attempts = 1, first_attempt_at = ?, last_attempt_at = ?, blocked_until = NULL
            WHERE id = ?
          `).run(now.toISOString(), now.toISOString(), existing.id);
        } else {
          // Increment attempts
          const newAttempts = existing.attempts + 1;

          if (newAttempts > config.maxRequests) {
            // Block the request
            const blockUntil = new Date(firstAttempt.getTime() + config.windowMs);

            db.prepare(`
              UPDATE rate_limits
              SET attempts = ?, last_attempt_at = ?, blocked_until = ?
              WHERE id = ?
            `).run(newAttempts, now.toISOString(), blockUntil.toISOString(), existing.id);

            const resetTime = Math.ceil((blockUntil.getTime() - now.getTime()) / 1000);

            return {
              allowed: false,
              headers: {
                'X-RateLimit-Limit': config.maxRequests.toString(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': resetTime.toString(),
                'Retry-After': resetTime.toString()
              }
            };
          } else {
            // Update attempts
            db.prepare(`
              UPDATE rate_limits
              SET attempts = ?, last_attempt_at = ?
              WHERE id = ?
            `).run(newAttempts, now.toISOString(), existing.id);

            const remaining = config.maxRequests - newAttempts;
            const resetTime = Math.ceil((firstAttempt.getTime() + config.windowMs - now.getTime()) / 1000);

            return {
              allowed: true,
              headers: {
                'X-RateLimit-Limit': config.maxRequests.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
                'X-RateLimit-Reset': resetTime.toString()
              }
            };
          }
        }
      } else {
        // Create new rate limit record
        db.prepare(`
          INSERT INTO rate_limits (identifier, identifier_type, endpoint, attempts, first_attempt_at, last_attempt_at)
          VALUES (?, ?, ?, 1, ?, ?)
        `).run(identifier, config.identifier, endpoint, now.toISOString(), now.toISOString());
      }

      const remaining = config.maxRequests - 1;
      const resetTime = Math.ceil(config.windowMs / 1000);

      return {
        allowed: true,
        headers: {
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': resetTime.toString()
        }
      };
    } catch (error) {
      logger.error('Error checking rate limit', error);
      return { allowed: true }; // Allow on error to prevent system lockout
    }
  }

  /**
   * Authenticate request
   */
  private async authenticateRequest(
    request: NextRequest,
    options: APIProtectionOptions
  ): Promise<{
    success: boolean;
    userId?: number;
    userRole?: string;
    error?: string;
  }> {
    // Try API key authentication first
    if (options.apiKeySupport) {
      const apiKey = this.extractAPIKey(request);
      if (apiKey) {
        const keyResult = await this.validateAPIKey(apiKey);
        if (keyResult.valid) {
          const user = db.prepare('SELECT * FROM users WHERE id = ?').get(keyResult.userId!) as any;
          return {
            success: true,
            userId: keyResult.userId!,
            userRole: user?.role || 'api_client'
          };
        }
      }
    }

    // Try JWT token authentication
    const token = this.extractJWTToken(request);
    if (token) {
      // This would integrate with your JWT verification logic
      // For now, we'll simulate it
      try {
        // const tokenResult = await verifyToken(token);
        // if (tokenResult) {
        //   return {
        //     success: true,
        //     userId: tokenResult.id,
        //     userRole: tokenResult.role
        //   };
        // }
      } catch (error) {
        return {
          success: false,
          error: 'Invalid token'
        };
      }
    }

    return {
      success: false,
      error: 'Authentication required'
    };
  }

  /**
   * Check permission for API endpoint
   */
  private async checkPermission(
    userId: number,
    userRole: string,
    requiredPermission: string,
    request: NextRequest
  ): Promise<boolean> {
    try {
      const [resource, action] = requiredPermission.split(':');

      const context = {
        userId,
        userRole,
        resourceType: resource,
        action,
        environment: {
          ipAddress: this.getClientIP(request),
          userAgent: request.headers.get('user-agent') || '',
          timestamp: new Date().toISOString()
        }
      };

      const result = await rbacEngine.checkPermission(context);
      return result.granted;
    } catch (error) {
      logger.error('Error checking permission', error);
      return false;
    }
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const remoteAddress = request.headers.get('remote-addr');

    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    return realIP || remoteAddress || '127.0.0.1';
  }

  /**
   * Check if IP is allowed
   */
  private isIPAllowed(ip: string, whitelist: string[]): boolean {
    return whitelist.includes('*') || whitelist.includes(ip);
  }

  /**
   * Extract API key from request
   */
  private extractAPIKey(request: NextRequest): string | null {
    // Check Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Check X-API-Key header
    const apiKeyHeader = request.headers.get('x-api-key');
    if (apiKeyHeader) {
      return apiKeyHeader;
    }

    // Check query parameter
    const url = new URL(request.url);
    const apiKeyParam = url.searchParams.get('api_key');
    if (apiKeyParam) {
      return apiKeyParam;
    }

    return null;
  }

  /**
   * Extract JWT token from request
   */
  private extractJWTToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // Simple check to see if it looks like a JWT
      if (token.split('.').length === 3) {
        return token;
      }
    }

    return null;
  }

  /**
   * Generate API key
   */
  private generateAPIKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generate key ID
   */
  private generateKeyId(): string {
    return `key_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Hash API key
   */
  private hashAPIKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Log API access
   */
  private async logAPIAccess(request: NextRequest, options: APIProtectionOptions): Promise<void> {
    try {
      const userId = parseInt(request.headers.get('X-User-ID') || '0');
      const endpoint = new URL(request.url).pathname;
      const method = request.method;
      const ip = this.getClientIP(request);
      const userAgent = request.headers.get('user-agent') || '';

      db.prepare(`
        INSERT INTO api_access_logs
        (user_id, endpoint, method, ip_address, user_agent, timestamp)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(userId || null, endpoint, method, ip, userAgent);
    } catch (error) {
      logger.error('Error logging API access', error);
    }
  }

  /**
   * Get user department
   */
  private async getUserDepartment(userId: number): Promise<string | undefined> {
    try {
      const result = db.prepare(`
        SELECT d.name FROM departments d
        JOIN user_departments ud ON d.id = ud.department_id
        WHERE ud.user_id = ? AND ud.is_primary = 1
      `).get(userId) as any;

      return result?.name;
    } catch (error) {
      logger.error('Error getting user department', error);
      return undefined;
    }
  }

  /**
   * Check if row is accessible to user
   */
  private isRowAccessible(
    row: any,
    context: { userId: number; userRole: string; userDepartment?: string },
    tableName: string
  ): boolean {
    // Simplified row-level security check
    // In production, this would use the full dataRowSecurity module

    switch (tableName) {
      case 'tickets':
        return row.user_id === context.userId ||
               row.assigned_to === context.userId ||
               context.userRole === 'admin';

      case 'users':
        return row.id === context.userId ||
               context.userRole === 'admin' ||
               context.userRole === 'manager';

      default:
        return true;
    }
  }

  /**
   * Apply field-level masking
   */
  private applyFieldMasking(data: any[], userRole: string): any[] {
    if (userRole === 'admin') {
      return data; // Admins see everything
    }

    return data.map(row => {
      const masked = { ...row };

      // Mask sensitive fields based on role
      if (userRole !== 'admin' && userRole !== 'manager') {
        delete masked.password_hash;
        delete masked.two_factor_secret;
        delete masked.two_factor_backup_codes;

        // Mask email for non-admin users
        if (masked.email) {
          const [localPart, domain] = masked.email.split('@');
          masked.email = `${localPart.slice(0, 2)}***@${domain}`;
        }
      }

      return masked;
    });
  }
}

export const apiProtection = new APIProtectionManager();
export default apiProtection;