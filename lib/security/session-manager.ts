/**
 * Enterprise Session Management
 *
 * Implements secure session handling:
 * - Session ID regeneration after authentication
 * - Account lockout after failed login attempts
 * - Session timeout and inactivity tracking
 * - Concurrent session limits
 * - Session revocation
 */

import db from '@/lib/db/connection';
import logger from '@/lib/monitoring/structured-logger';
import * as crypto from 'crypto';

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  LOCKOUT_THRESHOLD: 5, // Failed attempts before lockout
  LOCKOUT_DURATION_MINUTES: 30, // Duration of account lockout
  SESSION_TIMEOUT_MINUTES: 120, // 2 hours
  INACTIVITY_TIMEOUT_MINUTES: 30, // 30 minutes
  MAX_CONCURRENT_SESSIONS: 5, // Maximum concurrent sessions per user
};

/**
 * Session record
 */
export interface Session {
  id: number;
  user_id: number;
  tenant_id: number;
  session_id: string;
  device_fingerprint: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  revoked_at?: string;
}

/**
 * Failed login attempt record
 */
export interface FailedLoginAttempt {
  id: number;
  tenant_id: number;
  email: string;
  ip_address: string;
  user_agent: string;
  attempt_count: number;
  locked_until?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize session management tables
 */
export function initializeSessionTables(): void {
  try {
    // Create user_sessions table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tenant_id INTEGER NOT NULL,
        session_id TEXT NOT NULL UNIQUE,
        device_fingerprint TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_activity_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `).run();

    // Create failed_login_attempts table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS failed_login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 1,
        locked_until TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `).run();

    // Create indexes
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user
      ON user_sessions(user_id, tenant_id)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sessions_session_id
      ON user_sessions(session_id)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_failed_logins_email
      ON failed_login_attempts(tenant_id, email)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_failed_logins_ip
      ON failed_login_attempts(ip_address)
    `).run();

    logger.info('Session management tables initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize session tables', error);
    throw error;
  }
}

/**
 * Generate new session ID
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Create new session
 */
export function createSession(
  userId: number,
  tenantId: number,
  deviceFingerprint: string,
  ipAddress: string,
  userAgent: string
): string {
  try {
    const sessionId = generateSessionId();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + SESSION_CONFIG.SESSION_TIMEOUT_MINUTES);

    // Check concurrent session limit
    const activeSessions = db.prepare(`
      SELECT COUNT(*) as count FROM user_sessions
      WHERE user_id = ? AND tenant_id = ? AND revoked_at IS NULL
        AND expires_at > datetime('now')
    `).get(userId, tenantId) as { count: number };

    if (activeSessions.count >= SESSION_CONFIG.MAX_CONCURRENT_SESSIONS) {
      // Revoke oldest session
      const oldestSession = db.prepare(`
        SELECT id FROM user_sessions
        WHERE user_id = ? AND tenant_id = ? AND revoked_at IS NULL
        ORDER BY created_at ASC
        LIMIT 1
      `).get(userId, tenantId) as { id: number } | undefined;

      if (oldestSession) {
        revokeSession(oldestSession.id);
      }
    }

    // Insert new session
    db.prepare(`
      INSERT INTO user_sessions (
        user_id, tenant_id, session_id, device_fingerprint,
        ip_address, user_agent, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      tenantId,
      sessionId,
      deviceFingerprint,
      ipAddress,
      userAgent,
      expiresAt.toISOString()
    );

    logger.info('Session created', { userId, tenantId, sessionId });
    return sessionId;
  } catch (error) {
    logger.error('Failed to create session', { userId, tenantId, error });
    throw error;
  }
}

/**
 * Regenerate session ID (call after authentication)
 */
export function regenerateSessionId(oldSessionId: string): string | null {
  try {
    const session = db.prepare(`
      SELECT * FROM user_sessions WHERE session_id = ?
    `).get(oldSessionId) as Session | undefined;

    if (!session) {
      return null;
    }

    const newSessionId = generateSessionId();

    db.prepare(`
      UPDATE user_sessions
      SET session_id = ?
      WHERE id = ?
    `).run(newSessionId, session.id);

    logger.info('Session ID regenerated', { oldSessionId, newSessionId, userId: session.user_id });
    return newSessionId;
  } catch (error) {
    logger.error('Failed to regenerate session ID', { oldSessionId, error });
    return null;
  }
}

/**
 * Validate session
 */
export function validateSession(sessionId: string): Session | null {
  try {
    const session = db.prepare(`
      SELECT * FROM user_sessions
      WHERE session_id = ?
        AND revoked_at IS NULL
        AND expires_at > datetime('now')
    `).get(sessionId) as Session | undefined;

    if (!session) {
      return null;
    }

    // Check inactivity timeout
    const lastActivity = new Date(session.last_activity_at);
    const now = new Date();
    const inactiveMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

    if (inactiveMinutes > SESSION_CONFIG.INACTIVITY_TIMEOUT_MINUTES) {
      logger.warn('Session expired due to inactivity', { sessionId, inactiveMinutes });
      revokeSession(session.id);
      return null;
    }

    // Update last activity
    db.prepare(`
      UPDATE user_sessions
      SET last_activity_at = datetime('now')
      WHERE id = ?
    `).run(session.id);

    return session;
  } catch (error) {
    logger.error('Failed to validate session', { sessionId, error });
    return null;
  }
}

/**
 * Revoke session
 */
export function revokeSession(sessionId: number | string): boolean {
  try {
    const field = typeof sessionId === 'number' ? 'id' : 'session_id';
    const result = db.prepare(`
      UPDATE user_sessions
      SET revoked_at = datetime('now')
      WHERE ${field} = ? AND revoked_at IS NULL
    `).run(sessionId);

    logger.info('Session revoked', { sessionId, changes: result.changes });
    return result.changes > 0;
  } catch (error) {
    logger.error('Failed to revoke session', { sessionId, error });
    return false;
  }
}

/**
 * Revoke all user sessions
 */
export function revokeAllUserSessions(userId: number, tenantId: number): number {
  try {
    const result = db.prepare(`
      UPDATE user_sessions
      SET revoked_at = datetime('now')
      WHERE user_id = ? AND tenant_id = ? AND revoked_at IS NULL
    `).run(userId, tenantId);

    logger.info('All user sessions revoked', { userId, tenantId, count: result.changes });
    return result.changes;
  } catch (error) {
    logger.error('Failed to revoke all user sessions', { userId, tenantId, error });
    return 0;
  }
}

/**
 * Record failed login attempt
 */
export function recordFailedLogin(
  tenantId: number,
  email: string,
  ipAddress: string,
  userAgent: string
): { locked: boolean; lockoutMinutes?: number } {
  try {
    // Get existing record
    const existing = db.prepare(`
      SELECT * FROM failed_login_attempts
      WHERE tenant_id = ? AND email = ?
    `).get(tenantId, email) as FailedLoginAttempt | undefined;

    const now = new Date();

    // Check if currently locked
    if (existing?.locked_until) {
      const lockoutEnd = new Date(existing.locked_until);
      if (lockoutEnd > now) {
        const minutesRemaining = Math.ceil((lockoutEnd.getTime() - now.getTime()) / (1000 * 60));
        logger.warn('Account is locked', { email, minutesRemaining });
        return { locked: true, lockoutMinutes: minutesRemaining };
      }
    }

    if (existing) {
      // Update existing record
      const newCount = (existing.locked_until && new Date(existing.locked_until) > now)
        ? existing.attempt_count + 1
        : 1; // Reset count if lockout expired

      let lockedUntil = null;
      if (newCount >= SESSION_CONFIG.LOCKOUT_THRESHOLD) {
        const lockoutEnd = new Date();
        lockoutEnd.setMinutes(lockoutEnd.getMinutes() + SESSION_CONFIG.LOCKOUT_DURATION_MINUTES);
        lockedUntil = lockoutEnd.toISOString();

        logger.warn('Account locked due to failed login attempts', {
          email,
          attemptCount: newCount,
          lockoutMinutes: SESSION_CONFIG.LOCKOUT_DURATION_MINUTES,
        });
      }

      db.prepare(`
        UPDATE failed_login_attempts
        SET attempt_count = ?,
            locked_until = ?,
            ip_address = ?,
            user_agent = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(newCount, lockedUntil, ipAddress, userAgent, existing.id);

      return {
        locked: lockedUntil !== null,
        lockoutMinutes: lockedUntil ? SESSION_CONFIG.LOCKOUT_DURATION_MINUTES : undefined,
      };
    } else {
      // Create new record
      db.prepare(`
        INSERT INTO failed_login_attempts (
          tenant_id, email, ip_address, user_agent, attempt_count
        ) VALUES (?, ?, ?, ?, 1)
      `).run(tenantId, email, ipAddress, userAgent);

      return { locked: false };
    }
  } catch (error) {
    logger.error('Failed to record login attempt', { tenantId, email, error });
    return { locked: false }; // Fail open
  }
}

/**
 * Clear failed login attempts (after successful login)
 */
export function clearFailedLoginAttempts(tenantId: number, email: string): void {
  try {
    db.prepare(`
      DELETE FROM failed_login_attempts
      WHERE tenant_id = ? AND email = ?
    `).run(tenantId, email);

    logger.info('Failed login attempts cleared', { tenantId, email });
  } catch (error) {
    logger.error('Failed to clear login attempts', { tenantId, email, error });
  }
}

/**
 * Check if account is locked
 */
export function isAccountLocked(tenantId: number, email: string): { locked: boolean; minutesRemaining?: number } {
  try {
    const record = db.prepare(`
      SELECT locked_until FROM failed_login_attempts
      WHERE tenant_id = ? AND email = ?
    `).get(tenantId, email) as { locked_until: string } | undefined;

    if (!record?.locked_until) {
      return { locked: false };
    }

    const lockoutEnd = new Date(record.locked_until);
    const now = new Date();

    if (lockoutEnd <= now) {
      return { locked: false };
    }

    const minutesRemaining = Math.ceil((lockoutEnd.getTime() - now.getTime()) / (1000 * 60));
    return { locked: true, minutesRemaining };
  } catch (error) {
    logger.error('Failed to check account lock status', { tenantId, email, error });
    return { locked: false }; // Fail open
  }
}

/**
 * Get active sessions for user
 */
export function getUserSessions(userId: number, tenantId: number): Session[] {
  try {
    return db.prepare(`
      SELECT * FROM user_sessions
      WHERE user_id = ? AND tenant_id = ?
        AND revoked_at IS NULL
        AND expires_at > datetime('now')
      ORDER BY last_activity_at DESC
    `).all(userId, tenantId) as Session[];
  } catch (error) {
    logger.error('Failed to get user sessions', { userId, tenantId, error });
    return [];
  }
}

/**
 * Cleanup expired sessions and old failed attempts
 */
export function cleanupExpiredData(): { sessionsDeleted: number; attemptsDeleted: number } {
  try {
    const sessions = db.prepare(`
      DELETE FROM user_sessions
      WHERE expires_at < datetime('now')
        OR revoked_at < datetime('now', '-30 days')
    `).run();

    const attempts = db.prepare(`
      DELETE FROM failed_login_attempts
      WHERE updated_at < datetime('now', '-7 days')
    `).run();

    logger.info('Expired data cleaned up', {
      sessionsDeleted: sessions.changes,
      attemptsDeleted: attempts.changes,
    });

    return {
      sessionsDeleted: sessions.changes,
      attemptsDeleted: attempts.changes,
    };
  } catch (error) {
    logger.error('Failed to cleanup expired data', error);
    return { sessionsDeleted: 0, attemptsDeleted: 0 };
  }
}

/**
 * Get session statistics
 */
export function getSessionStats(tenantId: number): {
  active_sessions: number;
  failed_attempts_24h: number;
  locked_accounts: number;
  sessions_by_user: Array<{ user_id: number; count: number }>;
} {
  try {
    const activeSessions = db.prepare(`
      SELECT COUNT(*) as count FROM user_sessions
      WHERE tenant_id = ?
        AND revoked_at IS NULL
        AND expires_at > datetime('now')
    `).get(tenantId) as { count: number };

    const failedAttempts = db.prepare(`
      SELECT COUNT(*) as count FROM failed_login_attempts
      WHERE tenant_id = ?
        AND updated_at > datetime('now', '-1 day')
    `).get(tenantId) as { count: number };

    const lockedAccounts = db.prepare(`
      SELECT COUNT(*) as count FROM failed_login_attempts
      WHERE tenant_id = ?
        AND locked_until > datetime('now')
    `).get(tenantId) as { count: number };

    const sessionsByUser = db.prepare(`
      SELECT user_id, COUNT(*) as count FROM user_sessions
      WHERE tenant_id = ?
        AND revoked_at IS NULL
        AND expires_at > datetime('now')
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT 10
    `).all(tenantId) as Array<{ user_id: number; count: number }>;

    return {
      active_sessions: activeSessions.count,
      failed_attempts_24h: failedAttempts.count,
      locked_accounts: lockedAccounts.count,
      sessions_by_user: sessionsByUser,
    };
  } catch (error) {
    logger.error('Failed to get session stats', { tenantId, error });
    throw error;
  }
}
