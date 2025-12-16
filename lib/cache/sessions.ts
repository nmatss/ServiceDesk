/**
 * Redis Session Management
 *
 * Features:
 * - Distributed session storage
 * - Multi-device support
 * - Session refresh on activity
 * - Instant invalidation (logout)
 * - Device tracking
 * - Security features (IP validation, user agent)
 */

import { getRedisClient } from './redis-client';
import logger from '../monitoring/structured-logger';
import { randomBytes } from 'crypto';

export interface SessionData {
  userId: number;
  tenantId: number;
  role: string;
  email: string;
  deviceId: string;
  deviceName?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
  refreshToken?: string;
  metadata?: Record<string, any>;
}

export interface SessionOptions {
  ttl?: number; // Session TTL in seconds (default: 24 hours)
  refreshThreshold?: number; // Refresh if < this many seconds remain
  maxDevices?: number; // Maximum devices per user
  validateIp?: boolean; // Validate IP on each request
  validateUserAgent?: boolean; // Validate user agent
}

export class SessionManager {
  private static instance: SessionManager;
  private redisClient: ReturnType<typeof getRedisClient>;
  private keyPrefix = 'session';

  private defaultOptions: Required<SessionOptions> = {
    ttl: 86400, // 24 hours
    refreshThreshold: 3600, // Refresh if < 1 hour remains
    maxDevices: 5,
    validateIp: false,
    validateUserAgent: false,
  };

  private constructor() {
    this.redisClient = getRedisClient();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generate device ID
   */
  private generateDeviceId(userAgent: string, ipAddress: string): string {
    const data = `${userAgent}:${ipAddress}`;
    return Buffer.from(data).toString('base64').substring(0, 32);
  }

  /**
   * Build Redis key for session
   */
  private buildSessionKey(sessionId: string): string {
    return `${this.keyPrefix}:${sessionId}`;
  }

  /**
   * Build Redis key for user sessions index
   */
  private buildUserSessionsKey(userId: number): string {
    return `${this.keyPrefix}:user:${userId}:sessions`;
  }

  /**
   * Build Redis key for device tracking
   */
  private buildDeviceKey(userId: number, deviceId: string): string {
    return `${this.keyPrefix}:user:${userId}:device:${deviceId}`;
  }

  /**
   * Create new session
   */
  async createSession(
    data: Omit<SessionData, 'deviceId' | 'createdAt' | 'lastActivity' | 'expiresAt'>,
    options: SessionOptions = {}
  ): Promise<{ sessionId: string; session: SessionData }> {
    const opts = { ...this.defaultOptions, ...options };
    const sessionId = this.generateSessionId();
    const deviceId = this.generateDeviceId(data.userAgent, data.ipAddress);
    const now = Date.now();

    const session: SessionData = {
      ...data,
      deviceId,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + opts.ttl * 1000,
    };

    try {
      const redis = this.redisClient.getClient();
      const sessionKey = this.buildSessionKey(sessionId);
      const userSessionsKey = this.buildUserSessionsKey(data.userId);
      const deviceKey = this.buildDeviceKey(data.userId, deviceId);

      // Check device limit
      const existingSessions = await redis.smembers(userSessionsKey);
      if (existingSessions.length >= opts.maxDevices) {
        // Remove oldest session
        await this.removeOldestSession(data.userId, existingSessions);
      }

      // Store session
      await redis.setex(sessionKey, opts.ttl, JSON.stringify(session));

      // Add to user sessions index
      await redis.sadd(userSessionsKey, sessionId);
      await redis.expire(userSessionsKey, opts.ttl);

      // Track device
      await redis.setex(deviceKey, opts.ttl, sessionId);

      logger.info('Session created', {
        sessionId,
        userId: data.userId,
        deviceId,
        ttl: opts.ttl,
      });

      return { sessionId, session };
    } catch (error) {
      logger.error('Failed to create session', error);
      throw new Error('Session creation failed');
    }
  }

  /**
   * Get session by ID
   */
  async getSession(
    sessionId: string,
    options: { validateIp?: string; validateUserAgent?: string } = {}
  ): Promise<SessionData | null> {
    try {
      const redis = this.redisClient.getClient();
      const sessionKey = this.buildSessionKey(sessionId);

      const data = await redis.get(sessionKey);
      if (!data) {
        return null;
      }

      const session = JSON.parse(data) as SessionData;

      // Check expiration
      if (Date.now() > session.expiresAt) {
        await this.deleteSession(sessionId);
        return null;
      }

      // Validate IP if required
      if (options.validateIp && session.ipAddress !== options.validateIp) {
        logger.warn('Session IP mismatch', {
          sessionId,
          expected: session.ipAddress,
          actual: options.validateIp,
        });
        return null;
      }

      // Validate User Agent if required
      if (options.validateUserAgent && session.userAgent !== options.validateUserAgent) {
        logger.warn('Session User-Agent mismatch', {
          sessionId,
          expected: session.userAgent,
          actual: options.validateUserAgent,
        });
        return null;
      }

      return session;
    } catch (error) {
      logger.error('Failed to get session', { sessionId, error });
      return null;
    }
  }

  /**
   * Update session activity
   */
  async touchSession(
    sessionId: string,
    options: SessionOptions = {}
  ): Promise<boolean> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      const redis = this.redisClient.getClient();
      const sessionKey = this.buildSessionKey(sessionId);
      const now = Date.now();
      const remainingTtl = Math.floor((session.expiresAt - now) / 1000);

      // Update last activity
      session.lastActivity = now;

      // Refresh TTL if below threshold
      if (remainingTtl < opts.refreshThreshold) {
        session.expiresAt = now + opts.ttl * 1000;
        await redis.setex(sessionKey, opts.ttl, JSON.stringify(session));

        logger.debug('Session refreshed', {
          sessionId,
          userId: session.userId,
          newTtl: opts.ttl,
        });
      } else {
        // Just update the session data
        await redis.setex(sessionKey, remainingTtl, JSON.stringify(session));
      }

      return true;
    } catch (error) {
      logger.error('Failed to touch session', { sessionId, error });
      return false;
    }
  }

  /**
   * Delete session (logout)
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      const redis = this.redisClient.getClient();
      const sessionKey = this.buildSessionKey(sessionId);
      const userSessionsKey = this.buildUserSessionsKey(session.userId);
      const deviceKey = this.buildDeviceKey(session.userId, session.deviceId);

      // Delete session
      await redis.del(sessionKey);

      // Remove from user sessions index
      await redis.srem(userSessionsKey, sessionId);

      // Delete device tracking
      await redis.del(deviceKey);

      logger.info('Session deleted', {
        sessionId,
        userId: session.userId,
        deviceId: session.deviceId,
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete session', { sessionId, error });
      return false;
    }
  }

  /**
   * Delete all sessions for a user (logout all devices)
   */
  async deleteUserSessions(userId: number): Promise<number> {
    try {
      const redis = this.redisClient.getClient();
      const userSessionsKey = this.buildUserSessionsKey(userId);

      // Get all session IDs
      const sessionIds = await redis.smembers(userSessionsKey);

      if (sessionIds.length === 0) {
        return 0;
      }

      // Delete all sessions
      let deleted = 0;
      for (const sessionId of sessionIds) {
        const success = await this.deleteSession(sessionId);
        if (success) deleted++;
      }

      // Clean up user sessions index
      await redis.del(userSessionsKey);

      logger.info('All user sessions deleted', {
        userId,
        count: deleted,
      });

      return deleted;
    } catch (error) {
      logger.error('Failed to delete user sessions', { userId, error });
      return 0;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: number): Promise<SessionData[]> {
    try {
      const redis = this.redisClient.getClient();
      const userSessionsKey = this.buildUserSessionsKey(userId);

      const sessionIds = await redis.smembers(userSessionsKey);
      const sessions: SessionData[] = [];

      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (error) {
      logger.error('Failed to get user sessions', { userId, error });
      return [];
    }
  }

  /**
   * Get session count for user
   */
  async getUserSessionCount(userId: number): Promise<number> {
    try {
      const redis = this.redisClient.getClient();
      const userSessionsKey = this.buildUserSessionsKey(userId);

      return await redis.scard(userSessionsKey);
    } catch (error) {
      logger.error('Failed to get session count', { userId, error });
      return 0;
    }
  }

  /**
   * Remove oldest session for user
   */
  private async removeOldestSession(
    userId: number,
    sessionIds: string[]
  ): Promise<void> {
    try {
      let oldestSession: SessionData | null = null;
      let oldestSessionId: string | null = null;

      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          if (!oldestSession || session.createdAt < oldestSession.createdAt) {
            oldestSession = session;
            oldestSessionId = sessionId;
          }
        }
      }

      if (oldestSessionId) {
        await this.deleteSession(oldestSessionId);
        logger.info('Removed oldest session due to device limit', {
          userId,
          sessionId: oldestSessionId,
        });
      }
    } catch (error) {
      logger.error('Failed to remove oldest session', { userId, error });
    }
  }

  /**
   * Extend session TTL
   */
  async extendSession(sessionId: string, additionalSeconds: number): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      const redis = this.redisClient.getClient();
      const sessionKey = this.buildSessionKey(sessionId);

      // Extend expiration
      session.expiresAt += additionalSeconds * 1000;

      const newTtl = Math.floor((session.expiresAt - Date.now()) / 1000);
      await redis.setex(sessionKey, newTtl, JSON.stringify(session));

      logger.debug('Session extended', {
        sessionId,
        userId: session.userId,
        additionalSeconds,
      });

      return true;
    } catch (error) {
      logger.error('Failed to extend session', { sessionId, error });
      return false;
    }
  }

  /**
   * Update session metadata
   */
  async updateSessionMetadata(
    sessionId: string,
    metadata: Record<string, any>
  ): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      const redis = this.redisClient.getClient();
      const sessionKey = this.buildSessionKey(sessionId);

      // Update metadata
      session.metadata = { ...session.metadata, ...metadata };

      const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);
      await redis.setex(sessionKey, ttl, JSON.stringify(session));

      return true;
    } catch (error) {
      logger.error('Failed to update session metadata', { sessionId, error });
      return false;
    }
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    sessionsByUser: Map<number, number>;
    sessionsByDevice: Map<string, number>;
  }> {
    try {
      const redis = this.redisClient.getClient();

      // Scan for all session keys
      let cursor = '0';
      const keys: string[] = [];

      do {
        const [nextCursor, matchedKeys] = await redis.scan(
          cursor,
          'MATCH',
          `${this.keyPrefix}:*[0-9a-f]*`,
          'COUNT',
          100
        );
        cursor = nextCursor;
        keys.push(...matchedKeys.filter(k => k.match(/^session:[0-9a-f]{64}$/)));
      } while (cursor !== '0');

      const sessionsByUser = new Map<number, number>();
      const sessionsByDevice = new Map<string, number>();

      for (const key of keys) {
        const sessionId = key.split(':')[1];
        if (!sessionId) continue;

        const session = await this.getSession(sessionId);

        if (session) {
          // Count by user
          const userCount = sessionsByUser.get(session.userId) || 0;
          sessionsByUser.set(session.userId, userCount + 1);

          // Count by device
          const deviceCount = sessionsByDevice.get(session.deviceId) || 0;
          sessionsByDevice.set(session.deviceId, deviceCount + 1);
        }
      }

      return {
        totalSessions: keys.length,
        sessionsByUser,
        sessionsByDevice,
      };
    } catch (error) {
      logger.error('Failed to get session stats', error);
      return {
        totalSessions: 0,
        sessionsByUser: new Map(),
        sessionsByDevice: new Map(),
      };
    }
  }

  /**
   * Clean up expired sessions (background job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const redis = this.redisClient.getClient();
      let cursor = '0';
      let cleaned = 0;

      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          `${this.keyPrefix}:*[0-9a-f]*`,
          'COUNT',
          100
        );
        cursor = nextCursor;

        for (const key of keys) {
          const sessionId = key.split(':')[1];
          if (!sessionId) continue;

          const session = await this.getSession(sessionId);

          if (!session) {
            // Already expired or invalid
            await redis.del(key);
            cleaned++;
          }
        }
      } while (cursor !== '0');

      if (cleaned > 0) {
        logger.info('Cleaned up expired sessions', { count: cleaned });
      }

      return cleaned;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', error);
      return 0;
    }
  }
}

/**
 * Get SessionManager instance
 */
export function getSessionManager(): SessionManager {
  return SessionManager.getInstance();
}

/**
 * Export singleton
 */
export const sessionManager = SessionManager.getInstance();
