import { Redis } from 'ioredis';
import * as crypto from 'crypto';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import logger from '../monitoring/structured-logger';
import {
  User,
  UserWithRoles
} from '../types/database';
import { logAuthEvent } from './enterprise-auth';

// ========================================
// ADVANCED SESSION MANAGEMENT WITH REDIS
// ========================================

/**
 * Sistema avancado de gerenciamento de sessoes com Redis
 * - Sessoes distribuidas
 * - Controle de dispositivos multiplos
 * - Invalidacao em tempo real
 * - Deteccao de sessoes suspeitas
 * - Analytics de sessao
 */

// ========================================
// CONFIGURACAO E INICIALIZACAO
// ========================================

let redisClient: Redis | null = null;
let useRedis = false;

export function initializeSessionManager(): void {
  try {
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, {
        enableReadyCheck: false,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        commandTimeout: 5000
      });

      redisClient.on('connect', () => {
        logger.info('Redis connected for session management');
        useRedis = true;
      });

      redisClient.on('error', (error) => {
        logger.error('Redis error', error);
        useRedis = false;
      });

      redisClient.on('close', () => {
        logger.info('Redis connection closed');
        useRedis = false;
      });
    } else {
      logger.info('No Redis URL provided, using database-only session management');
    }
  } catch (error) {
    logger.error('Error initializing Redis for session management', error);
    useRedis = false;
  }
}

// ========================================
// INTERFACES E TIPOS
// ========================================

export interface SessionData {
  sessionId: string;
  userId: number;
  deviceInfo: {
    userAgent: string;
    platform: string;
    browser: string;
    browserVersion: string;
    os: string;
    osVersion: string;
    isMobile: boolean;
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  };
  location?: {
    ip: string;
    country?: string;
    city?: string;
    timezone?: string;
  };
  security: {
    loginMethod: 'password' | 'sso' | 'api_key' | 'two_factor';
    riskScore: number; // 0-100, higher = more risky
    isTrusted: boolean;
    requiresMFA: boolean;
  };
  activity: {
    createdAt: string;
    lastActivity: string;
    lastIp: string;
    pageViews: number;
    actionsCount: number;
  };
  tokens: {
    refreshToken: string;
    accessTokenHash: string;
  };
  settings: {
    rememberDevice: boolean;
    allowConcurrentSessions: boolean;
    sessionTimeout: number; // minutes
  };
}

export interface ActiveSession {
  sessionId: string;
  deviceInfo: SessionData['deviceInfo'];
  location: SessionData['location'];
  lastActivity: string;
  isCurrent: boolean;
  riskScore: number;
  loginMethod: string;
}

export interface SessionAnalytics {
  totalSessions: number;
  activeSessions: number;
  uniqueDevices: number;
  averageSessionDuration: number;
  topCountries: { country: string; count: number }[];
  topBrowsers: { browser: string; count: number }[];
  suspiciousActivity: number;
}

// ========================================
// FUNCOES DE SESSAO
// ========================================

export async function createSession(
  user: UserWithRoles,
  deviceInfo: { userAgent: string; platform?: string },
  location: { ip: string; country?: string; city?: string; timezone?: string },
  loginMethod: 'password' | 'sso' | 'api_key' | 'two_factor' = 'password'
): Promise<SessionData> {
  try {
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Analisar informacoes do dispositivo
    const parsedDeviceInfo = parseDeviceInfo(deviceInfo);

    // Calcular score de risco
    const riskScore = calculateRiskScore(user, parsedDeviceInfo, location, loginMethod);

    // Gerar refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');

    const sessionData: SessionData = {
      sessionId,
      userId: user.id,
      deviceInfo: parsedDeviceInfo,
      location,
      security: {
        loginMethod,
        riskScore,
        isTrusted: riskScore < 30,
        requiresMFA: riskScore > 70 || user.two_factor_enabled
      },
      activity: {
        createdAt: now,
        lastActivity: now,
        lastIp: location.ip,
        pageViews: 0,
        actionsCount: 0
      },
      tokens: {
        refreshToken,
        accessTokenHash: ''
      },
      settings: {
        rememberDevice: false,
        allowConcurrentSessions: true,
        sessionTimeout: 480 // 8 hours default
      }
    };

    // Salvar sessao
    await saveSession(sessionData);

    // Verificar limite de sessoes simultaneas
    await enforceSessionLimits(user.id);

    // Log de auditoria
    await logAuthEvent(user.id, 'session_created', {
      ip_address: location.ip,
      user_agent: deviceInfo.userAgent,
      details: JSON.stringify({
        sessionId,
        riskScore,
        loginMethod,
        deviceType: parsedDeviceInfo.deviceType
      })
    });

    return sessionData;
  } catch (error) {
    logger.error('Error creating session', error);
    throw new Error('Failed to create session');
  }
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  try {
    if (useRedis && redisClient) {
      const cached = await redisClient.get(`session:${sessionId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Fallback para database
    const session = await executeQueryOne<{
      id: string;
      user_id: number;
      user_agent?: string;
      ip_address: string;
      created_at: string;
      last_activity: string;
      is_active: number;
    }>(`
      SELECT * FROM user_sessions WHERE id = ? AND is_active = 1
    `, [sessionId]);

    if (!session) return null;

    const parsedDeviceInfo: SessionData['deviceInfo'] = session.user_agent
      ? JSON.parse(session.user_agent)
      : {
          userAgent: '',
          platform: 'unknown',
          browser: 'Unknown',
          browserVersion: 'Unknown',
          os: 'Unknown',
          osVersion: 'Unknown',
          isMobile: false,
          deviceType: 'unknown'
        };

    const sessionData: SessionData = {
      sessionId: session.id,
      userId: session.user_id,
      deviceInfo: parsedDeviceInfo,
      location: {
        ip: session.ip_address
      },
      security: {
        loginMethod: 'password',
        riskScore: 0,
        isTrusted: true,
        requiresMFA: false
      },
      activity: {
        createdAt: session.created_at,
        lastActivity: session.last_activity,
        lastIp: session.ip_address,
        pageViews: 0,
        actionsCount: 0
      },
      tokens: {
        refreshToken: '',
        accessTokenHash: ''
      },
      settings: {
        rememberDevice: false,
        allowConcurrentSessions: true,
        sessionTimeout: 480
      }
    };

    return sessionData;
  } catch (error) {
    logger.error('Error getting session', error);
    return null;
  }
}

export async function updateSession(sessionId: string, updates: Partial<SessionData>): Promise<boolean> {
  try {
    const existingSession = await getSession(sessionId);
    if (!existingSession) return false;

    const updatedSession = {
      ...existingSession,
      ...updates,
      activity: {
        ...existingSession.activity,
        ...updates.activity,
        lastActivity: new Date().toISOString()
      }
    };

    return await saveSession(updatedSession);
  } catch (error) {
    logger.error('Error updating session', error);
    return false;
  }
}

export async function saveSession(sessionData: SessionData): Promise<boolean> {
  try {
    if (useRedis && redisClient) {
      // Salvar no Redis com TTL
      const ttl = sessionData.settings.sessionTimeout * 60; // converter para segundos
      await redisClient.setex(`session:${sessionData.sessionId}`, ttl, JSON.stringify(sessionData));

      // Manter index por usuario
      await redisClient.sadd(`user_sessions:${sessionData.userId}`, sessionData.sessionId);
      await redisClient.expire(`user_sessions:${sessionData.userId}`, ttl);
    }

    // Salvar/atualizar no database
    await executeRun(`
      INSERT OR REPLACE INTO user_sessions (
        id, user_id, socket_id, user_agent, ip_address, is_active, last_activity
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
    `, [
      sessionData.sessionId,
      sessionData.userId,
      null, // socket_id usado para WebSocket
      JSON.stringify(sessionData.deviceInfo),
      sessionData.location?.ip,
      sessionData.activity.lastActivity
    ]);

    return true;
  } catch (error) {
    logger.error('Error saving session', error);
    return false;
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const session = await getSession(sessionId);
    if (!session) return false;

    if (useRedis && redisClient) {
      await redisClient.del(`session:${sessionId}`);
      await redisClient.srem(`user_sessions:${session.userId}`, sessionId);
    }

    // Remover do database
    const result = await executeRun(`
      UPDATE user_sessions SET is_active = 0 WHERE id = ?
    `, [sessionId]);

    // Log de auditoria
    await logAuthEvent(session.userId, 'session_deleted', {
      ip_address: session.location?.ip || 'unknown',
      details: JSON.stringify({ sessionId })
    });

    return (result.changes ?? 0) > 0;
  } catch (error) {
    logger.error('Error deleting session', error);
    return false;
  }
}

export async function deleteAllUserSessions(userId: number, exceptSessionId?: string): Promise<number> {
  try {
    let deletedCount = 0;

    if (useRedis && redisClient) {
      const sessionIds = await redisClient.smembers(`user_sessions:${userId}`);

      for (const sessionId of sessionIds) {
        if (sessionId !== exceptSessionId) {
          await redisClient.del(`session:${sessionId}`);
          await redisClient.srem(`user_sessions:${userId}`, sessionId);
          deletedCount++;
        }
      }
    }

    // Atualizar database
    const whereClause = exceptSessionId
      ? 'user_id = ? AND id != ? AND is_active = 1'
      : 'user_id = ? AND is_active = 1';

    const params = exceptSessionId ? [userId, exceptSessionId] : [userId];

    const result = await executeRun(`
      UPDATE user_sessions SET is_active = 0 WHERE ${whereClause}
    `, params);

    deletedCount = Math.max(deletedCount, result.changes ?? 0);

    // Log de auditoria
    await logAuthEvent(userId, 'all_sessions_deleted', {
      ip_address: 'system',
      details: JSON.stringify({ deletedCount, exceptSessionId })
    });

    return deletedCount;
  } catch (error) {
    logger.error('Error deleting all user sessions', error);
    return 0;
  }
}

// ========================================
// FUNCOES DE ATIVIDADE DE SESSAO
// ========================================

export async function trackSessionActivity(
  sessionId: string,
  activity: {
    action: string;
    path?: string;
    ip?: string;
    userAgent?: string;
  }
): Promise<boolean> {
  try {
    const session = await getSession(sessionId);
    if (!session) return false;

    const updates: Partial<SessionData> = {
      activity: {
        ...session.activity,
        lastActivity: new Date().toISOString(),
        lastIp: activity.ip || session.activity.lastIp,
        actionsCount: session.activity.actionsCount + 1
      }
    };

    // Incrementar pageViews se for navegacao
    if (activity.action === 'page_view') {
      updates.activity!.pageViews = session.activity.pageViews + 1;
    }

    return await updateSession(sessionId, updates);
  } catch (error) {
    logger.error('Error tracking session activity', error);
    return false;
  }
}

export async function getUserActiveSessions(userId: number): Promise<ActiveSession[]> {
  try {
    const sessions: ActiveSession[] = [];

    if (useRedis && redisClient) {
      const sessionIds = await redisClient.smembers(`user_sessions:${userId}`);

      for (const sessionId of sessionIds) {
        const sessionData = await getSession(sessionId);
        if (sessionData) {
          sessions.push({
            sessionId: sessionData.sessionId,
            deviceInfo: sessionData.deviceInfo,
            location: sessionData.location,
            lastActivity: sessionData.activity.lastActivity,
            isCurrent: false, // sera determinado pelo caller
            riskScore: sessionData.security.riskScore,
            loginMethod: sessionData.security.loginMethod
          });
        }
      }
    } else {
      // Fallback para database
      const dbSessions = await executeQuery<{
        id: string;
        user_id: number;
        user_agent?: string;
        ip_address: string;
        last_activity: string;
        is_active: number;
      }>(`
        SELECT * FROM user_sessions
        WHERE user_id = ? AND is_active = 1
        ORDER BY last_activity DESC
      `, [userId]);

      for (const session of dbSessions) {
        const parsedDeviceInfo: SessionData['deviceInfo'] = session.user_agent
          ? JSON.parse(session.user_agent)
          : {
              userAgent: '',
              platform: 'unknown',
              browser: 'Unknown',
              browserVersion: 'Unknown',
              os: 'Unknown',
              osVersion: 'Unknown',
              isMobile: false,
              deviceType: 'unknown'
            };

        sessions.push({
          sessionId: session.id,
          deviceInfo: parsedDeviceInfo,
          location: { ip: session.ip_address },
          lastActivity: session.last_activity,
          isCurrent: false,
          riskScore: 0,
          loginMethod: 'password'
        });
      }
    }

    return sessions;
  } catch (error) {
    logger.error('Error getting user active sessions', error);
    return [];
  }
}

// ========================================
// FUNCOES DE SEGURANCA
// ========================================

function calculateRiskScore(
  user: User,
  deviceInfo: SessionData['deviceInfo'],
  _location: { ip: string; country?: string; city?: string; timezone?: string },
  loginMethod: 'password' | 'sso' | 'api_key' | 'two_factor'
): number {
  let score = 0;

  // Base score por metodo de login
  switch (loginMethod) {
    case 'password':
      score += 20;
      break;
    case 'sso':
      score += 10;
      break;
    case 'api_key':
      score += 30;
      break;
    case 'two_factor':
      score += 5;
      break;
  }

  // Dispositivo desconhecido
  if (deviceInfo.deviceType === 'unknown') {
    score += 15;
  }

  // Mobile devices tem score ligeiramente maior
  if (deviceInfo.isMobile) {
    score += 5;
  }

  // Primeiro login do usuario
  if (!user.last_login_at) {
    score += 20;
  }

  // Tentativas de login falhadas recentes
  if (user.failed_login_attempts > 0) {
    score += user.failed_login_attempts * 10;
  }

  // Horario fora do normal
  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) {
    score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

function parseDeviceInfo(rawDeviceInfo: { userAgent: string; platform?: string }): SessionData['deviceInfo'] {
  const userAgent = rawDeviceInfo.userAgent || '';

  // Parse basico do User-Agent (em producao, use uma biblioteca como ua-parser-js)
  const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
  const isTablet = /iPad|Tablet/.test(userAgent);

  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'unknown';
  if (isTablet) deviceType = 'tablet';
  else if (isMobile) deviceType = 'mobile';
  else if (userAgent) deviceType = 'desktop';

  return {
    userAgent,
    platform: rawDeviceInfo.platform || 'unknown',
    browser: extractBrowser(userAgent),
    browserVersion: extractBrowserVersion(userAgent),
    os: extractOS(userAgent),
    osVersion: extractOSVersion(userAgent),
    isMobile,
    deviceType
  };
}

function extractBrowser(userAgent: string): string {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  return 'Unknown';
}

function extractBrowserVersion(userAgent: string): string {
  const matches = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+\.\d+)/);
  return matches && matches[2] ? matches[2] : 'Unknown';
}

function extractOS(userAgent: string): string {
  if (userAgent.includes('Windows NT')) return 'Windows';
  if (userAgent.includes('Mac OS X')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone OS') || userAgent.includes('iPad OS')) return 'iOS';
  return 'Unknown';
}

function extractOSVersion(userAgent: string): string {
  const windowsMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
  if (windowsMatch && windowsMatch[1]) return windowsMatch[1];

  const macMatch = userAgent.match(/Mac OS X (\d+[._]\d+[._]\d+)/);
  if (macMatch && macMatch[1]) return macMatch[1].replace(/_/g, '.');

  const androidMatch = userAgent.match(/Android (\d+\.\d+)/);
  if (androidMatch && androidMatch[1]) return androidMatch[1];

  const iosMatch = userAgent.match(/OS (\d+_\d+)/);
  if (iosMatch && iosMatch[1]) return iosMatch[1].replace(/_/g, '.');

  return 'Unknown';
}

// ========================================
// FUNCOES DE LIMPEZA E MANUTENCAO
// ========================================

export async function cleanupExpiredSessions(): Promise<number> {
  try {
    let cleanedCount = 0;

    if (useRedis && redisClient) {
      // Redis TTL cuida da expiracao automaticamente
      // Mas vamos limpar indices orfaos
      const userKeys = await redisClient.keys('user_sessions:*');

      for (const userKey of userKeys) {
        const sessionIds = await redisClient.smembers(userKey);
        const validSessionIds = [];

        for (const sessionId of sessionIds) {
          const exists = await redisClient.exists(`session:${sessionId}`);
          if (exists) {
            validSessionIds.push(sessionId);
          } else {
            cleanedCount++;
          }
        }

        // Atualizar indice com apenas sessoes validas
        if (validSessionIds.length > 0) {
          await redisClient.del(userKey);
          await redisClient.sadd(userKey, ...validSessionIds);
        } else {
          await redisClient.del(userKey);
        }
      }
    }

    // Limpar sessoes expiradas no database
    const result = await executeRun(`
      UPDATE user_sessions
      SET is_active = 0
      WHERE is_active = 1
        AND datetime(last_activity, '+8 hours') < datetime('now')
    `, []);

    cleanedCount += result.changes ?? 0;

    logger.info(`Cleaned up ${cleanedCount} expired sessions`);
    return cleanedCount;
  } catch (error) {
    logger.error('Error cleaning up expired sessions', error);
    return 0;
  }
}

export async function enforceSessionLimits(userId: number, maxSessions: number = 10): Promise<void> {
  try {
    // Get active sessions from database
    const dbSessions = await executeQuery<{
      id: string;
      user_agent?: string;
      ip_address: string;
      last_activity: string;
    }>(`
      SELECT id, user_agent, ip_address, last_activity
      FROM user_sessions
      WHERE user_id = ? AND is_active = 1
      ORDER BY last_activity ASC
    `, [userId]);

    // Check if we need to enforce limits
    if (dbSessions.length <= maxSessions) return;

    // Calculate how many sessions to remove
    const removeCount = dbSessions.length - maxSessions;
    const sessionsToRemove = dbSessions.slice(0, removeCount);

    // Delete sessions from database
    for (const session of sessionsToRemove) {
      await executeRun('UPDATE user_sessions SET is_active = 0 WHERE id = ?', [session.id]);
    }

    const removedSessionIds = sessionsToRemove.map(s => s.id);

    // Clean up Redis (best-effort, async)
    if (removedSessionIds.length > 0 && useRedis && redisClient) {
      for (const sessionId of removedSessionIds) {
        redisClient.del(`session:${sessionId}`).catch((err) => {
          logger.error('Error deleting session from Redis', err);
        });
        redisClient.srem(`user_sessions:${userId}`, sessionId).catch((err) => {
          logger.error('Error removing session from Redis index', err);
        });
      }
    }

    // Log audit event if sessions were removed
    if (removedSessionIds.length > 0) {
      await logAuthEvent(userId, 'session_limit_enforced', {
        ip_address: 'system',
        details: JSON.stringify({
          removedSessions: removedSessionIds.length,
          maxSessions
        })
      });
    }
  } catch (error) {
    logger.error('Error enforcing session limits', error);
  }
}

// ========================================
// ANALYTICS DE SESSAO
// ========================================

export async function getSessionAnalytics(userId?: number): Promise<SessionAnalytics> {
  try {
    const analytics: SessionAnalytics = {
      totalSessions: 0,
      activeSessions: 0,
      uniqueDevices: 0,
      averageSessionDuration: 0,
      topCountries: [],
      topBrowsers: [],
      suspiciousActivity: 0
    };

    if (useRedis && redisClient) {
      // Implementar analytics baseado em Redis
      const sessionKeys = await redisClient.keys('session:*');
      analytics.activeSessions = sessionKeys.length;
    } else {
      // Analytics baseado em database
      const whereClause = userId ? 'WHERE user_id = ?' : '';
      const params = userId ? [userId] : [];

      // Total de sessoes
      const totalResult = await executeQueryOne<{ count: number }>(`
        SELECT COUNT(*) as count FROM user_sessions ${whereClause}
      `, params);
      analytics.totalSessions = totalResult?.count ?? 0;

      // Sessoes ativas
      const activeResult = await executeQueryOne<{ count: number }>(`
        SELECT COUNT(*) as count FROM user_sessions
        ${whereClause} ${whereClause ? 'AND' : 'WHERE'} is_active = 1
      `, params);
      analytics.activeSessions = activeResult?.count ?? 0;
    }

    return analytics;
  } catch (error) {
    logger.error('Error getting session analytics', error);
    return {
      totalSessions: 0,
      activeSessions: 0,
      uniqueDevices: 0,
      averageSessionDuration: 0,
      topCountries: [],
      topBrowsers: [],
      suspiciousActivity: 0
    };
  }
}

// ========================================
// INICIALIZACAO
// ========================================

// Inicializar quando o modulo for carregado
initializeSessionManager();

// Configurar limpeza automatica a cada hora
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
