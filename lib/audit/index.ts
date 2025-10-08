import db from '../db/connection';
import { AuditLog, CreateAuditLog, AuditLogWithDetails } from '../types/database';
import { logger } from '../monitoring/logger';

/**
 * Registra uma ação no log de auditoria
 */
export function logAuditAction(auditData: CreateAuditLog): AuditLog | null {
  try {
    const insertQuery = db.prepare(`
      INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id,
        old_values, new_values, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertQuery.run(
      auditData.user_id || null,
      auditData.action,
      auditData.resource_type,
      auditData.resource_id || null,
      auditData.old_values || null,
      auditData.new_values || null,
      auditData.ip_address || null,
      auditData.user_agent || null
    );

    if (result.lastInsertRowid) {
      return db.prepare('SELECT * FROM audit_logs WHERE id = ?')
        .get(result.lastInsertRowid) as AuditLog;
    }

    return null;
  } catch (error) {
    logger.error('Error logging audit action', error);
    return null;
  }
}

/**
 * Registra criação de recurso
 */
export function logCreate(
  userId: number,
  resourceType: string,
  resourceId: number,
  newValues: any,
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    return logAuditAction({
      user_id: userId,
      action: 'create',
      resource_type: resourceType,
      resource_id: resourceId,
      new_values: JSON.stringify(newValues),
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging create action', error);
    return false;
  }
}

/**
 * Registra atualização de recurso
 */
export function logUpdate(
  userId: number,
  resourceType: string,
  resourceId: number,
  oldValues: any,
  newValues: any,
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    return logAuditAction({
      user_id: userId,
      action: 'update',
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: JSON.stringify(oldValues),
      new_values: JSON.stringify(newValues),
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging update action', error);
    return false;
  }
}

/**
 * Registra exclusão de recurso
 */
export function logDelete(
  userId: number,
  resourceType: string,
  resourceId: number,
  oldValues: any,
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    return logAuditAction({
      user_id: userId,
      action: 'delete',
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: JSON.stringify(oldValues),
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging delete action', error);
    return false;
  }
}

/**
 * Registra visualização de recurso sensível
 */
export function logView(
  userId: number,
  resourceType: string,
  resourceId: number,
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    return logAuditAction({
      user_id: userId,
      action: 'view',
      resource_type: resourceType,
      resource_id: resourceId,
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging view action', error);
    return false;
  }
}

/**
 * Registra login do usuário
 */
export function logLogin(
  userId: number,
  ipAddress?: string,
  userAgent?: string,
  loginType: 'success' | 'failed' = 'success'
): boolean {
  try {
    return logAuditAction({
      user_id: userId,
      action: `login_${loginType}`,
      resource_type: 'user',
      resource_id: userId,
      new_values: JSON.stringify({
        login_time: new Date().toISOString(),
        type: loginType
      }),
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging login action', error);
    return false;
  }
}

/**
 * Registra logout do usuário
 */
export function logLogout(
  userId: number,
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    return logAuditAction({
      user_id: userId,
      action: 'logout',
      resource_type: 'user',
      resource_id: userId,
      new_values: JSON.stringify({
        logout_time: new Date().toISOString()
      }),
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging logout action', error);
    return false;
  }
}

/**
 * Registra mudança de senha
 */
export function logPasswordChange(
  userId: number,
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    return logAuditAction({
      user_id: userId,
      action: 'password_change',
      resource_type: 'user',
      resource_id: userId,
      new_values: JSON.stringify({
        changed_at: new Date().toISOString()
      }),
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging password change', error);
    return false;
  }
}

/**
 * Registra acesso negado
 */
export function logAccessDenied(
  userId: number | undefined,
  resourceType: string,
  resourceId?: number,
  reason?: string,
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    return logAuditAction({
      user_id: userId,
      action: 'access_denied',
      resource_type: resourceType,
      resource_id: resourceId,
      new_values: JSON.stringify({
        reason: reason || 'Insufficient permissions',
        attempted_at: new Date().toISOString()
      }),
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging access denied', error);
    return false;
  }
}

/**
 * Busca logs de auditoria
 */
export function getAuditLogs(options: {
  userId?: number;
  action?: string;
  resourceType?: string;
  resourceId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
} = {}): { logs: AuditLogWithDetails[]; total: number } {
  try {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = options;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      whereClause += ' AND al.user_id = ?';
      params.push(userId);
    }

    if (action) {
      whereClause += ' AND al.action = ?';
      params.push(action);
    }

    if (resourceType) {
      whereClause += ' AND al.resource_type = ?';
      params.push(resourceType);
    }

    if (resourceId) {
      whereClause += ' AND al.resource_id = ?';
      params.push(resourceId);
    }

    if (startDate) {
      whereClause += ' AND al.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND al.created_at <= ?';
      params.push(endDate);
    }

    // Buscar logs
    const logs = db.prepare(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as AuditLogWithDetails[];

    // Contar total
    const { total } = db.prepare(`
      SELECT COUNT(*) as total
      FROM audit_logs al
      ${whereClause}
    `).get(...params) as { total: number };

    return { logs, total };
  } catch (error) {
    logger.error('Error getting audit logs', error);
    return { logs: [], total: 0 };
  }
}

/**
 * Busca logs de auditoria de um recurso específico
 */
export function getResourceAuditHistory(
  resourceType: string,
  resourceId: number
): AuditLogWithDetails[] {
  try {
    return db.prepare(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.resource_type = ? AND al.resource_id = ?
      ORDER BY al.created_at DESC
    `).all(resourceType, resourceId) as AuditLogWithDetails[];
  } catch (error) {
    logger.error('Error getting resource audit history', error);
    return [];
  }
}

/**
 * Busca estatísticas de auditoria
 */
export function getAuditStats(days: number = 30): any {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total de ações por tipo
    const actionStats = db.prepare(`
      SELECT
        action,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= ?
      GROUP BY action
      ORDER BY count DESC
    `).all(startDate.toISOString());

    // Ações por tipo de recurso
    const resourceStats = db.prepare(`
      SELECT
        resource_type,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= ?
      GROUP BY resource_type
      ORDER BY count DESC
    `).all(startDate.toISOString());

    // Usuários mais ativos
    const activeUsers = db.prepare(`
      SELECT
        u.name,
        u.email,
        u.role,
        COUNT(al.id) as action_count
      FROM audit_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= ?
      GROUP BY u.id, u.name, u.email, u.role
      ORDER BY action_count DESC
      LIMIT 10
    `).all(startDate.toISOString());

    // Atividade por dia
    const dailyActivity = db.prepare(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(startDate.toISOString());

    // Tentativas de acesso negado
    const accessDeniedCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE action = 'access_denied' AND created_at >= ?
    `).get(startDate.toISOString()) as { count: number };

    // Logins falhados
    const failedLoginsCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE action = 'login_failed' AND created_at >= ?
    `).get(startDate.toISOString()) as { count: number };

    return {
      period_days: days,
      actions: actionStats,
      resources: resourceStats,
      active_users: activeUsers,
      daily_activity: dailyActivity,
      security: {
        access_denied: accessDeniedCount.count,
        failed_logins: failedLoginsCount.count
      }
    };
  } catch (error) {
    logger.error('Error getting audit stats', error);
    return null;
  }
}

/**
 * Limpa logs antigos
 */
export function cleanupOldAuditLogs(daysOld: number = 90): number {
  try {
    if (daysOld < 30) {
      throw new Error('Cannot delete audit logs less than 30 days old');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = db.prepare(`
      DELETE FROM audit_logs
      WHERE created_at < ?
    `).run(cutoffDate.toISOString());

    logger.info(`Cleanup: ${result.changes} audit logs deleted (older than ${daysOld} days)`);
    return result.changes;
  } catch (error) {
    logger.error('Error cleaning up audit logs', error);
    return 0;
  }
}

/**
 * Exporta logs de auditoria para CSV
 */
export function exportAuditLogsToCSV(options: {
  userId?: number;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
} = {}): string {
  try {
    const { logs } = getAuditLogs({
      ...options,
      limit: 10000 // Limite alto para exportação
    });

    const headers = [
      'ID',
      'Data/Hora',
      'Usuário',
      'Email',
      'Ação',
      'Tipo de Recurso',
      'ID do Recurso',
      'Valores Antigos',
      'Valores Novos',
      'IP',
      'User Agent'
    ];

    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.id,
        `"${log.created_at}"`,
        `"${log.user_name || 'Sistema'}"`,
        `"${log.user_email || ''}"`,
        `"${log.action}"`,
        `"${log.resource_type}"`,
        log.resource_id || '',
        `"${log.old_values || ''}"`,
        `"${log.new_values || ''}"`,
        `"${log.ip_address || ''}"`,
        `"${log.user_agent || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  } catch (error) {
    logger.error('Error exporting audit logs to CSV', error);
    return '';
  }
}

/**
 * Verifica integridade dos logs de auditoria
 */
export function verifyAuditIntegrity(): {
  total_logs: number;
  missing_users: number;
  invalid_json: number;
  suspicious_activity: number;
} {
  try {
    // Total de logs
    const { total_logs } = db.prepare(`
      SELECT COUNT(*) as total_logs FROM audit_logs
    `).get() as { total_logs: number };

    // Logs com usuários inexistentes
    const { missing_users } = db.prepare(`
      SELECT COUNT(*) as missing_users
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id IS NOT NULL AND u.id IS NULL
    `).get() as { missing_users: number };

    // Logs com JSON inválido
    const logsWithJson = db.prepare(`
      SELECT id, old_values, new_values
      FROM audit_logs
      WHERE old_values IS NOT NULL OR new_values IS NOT NULL
    `).all();

    let invalidJson = 0;
    logsWithJson.forEach((log: any) => {
      try {
        if (log.old_values) JSON.parse(log.old_values);
        if (log.new_values) JSON.parse(log.new_values);
      } catch {
        invalidJson++;
      }
    });

    // Atividade suspeita (muitas ações em pouco tempo)
    const { suspicious_activity } = db.prepare(`
      SELECT COUNT(*) as suspicious_activity
      FROM (
        SELECT
          user_id,
          COUNT(*) as action_count
        FROM audit_logs
        WHERE created_at >= datetime('now', '-1 hour')
        GROUP BY user_id
        HAVING action_count > 100
      )
    `).get() as { suspicious_activity: number };

    return {
      total_logs,
      missing_users,
      invalid_json: invalidJson,
      suspicious_activity
    };
  } catch (error) {
    logger.error('Error verifying audit integrity', error);
    return {
      total_logs: 0,
      missing_users: 0,
      invalid_json: 0,
      suspicious_activity: 0
    };
  }
}