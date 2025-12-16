import db from '../db/connection';
import { AuditLog, CreateAuditLog, AuditLogWithDetails } from '../types/database';
import logger from '../monitoring/structured-logger';

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
 * Registra falha de autenticação
 */
export function logAuthFailure(
  email: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    return logAuditAction({
      action: 'auth_failure',
      resource_type: 'authentication',
      new_values: JSON.stringify({
        email,
        reason,
        failed_at: new Date().toISOString()
      }),
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging auth failure', error);
    return false;
  }
}

/**
 * Registra autorização negada
 */
export function logAuthorizationDenied(
  userId: number,
  resourceType: string,
  resourceId: number | undefined,
  requiredPermission: string,
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    return logAuditAction({
      user_id: userId,
      action: 'authorization_denied',
      resource_type: resourceType,
      resource_id: resourceId,
      new_values: JSON.stringify({
        required_permission: requiredPermission,
        denied_at: new Date().toISOString(),
        reason: 'Insufficient permissions'
      }),
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging authorization denied', error);
    return false;
  }
}

/**
 * Registra acesso a dados sensíveis (PII)
 */
export function logPIIAccess(
  userId: number,
  resourceType: string,
  resourceId: number,
  piiFields: string[],
  purpose: string,
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    return logAuditAction({
      user_id: userId,
      action: 'pii_access',
      resource_type: resourceType,
      resource_id: resourceId,
      new_values: JSON.stringify({
        pii_fields: piiFields,
        purpose,
        accessed_at: new Date().toISOString(),
        lgpd_compliance: true
      }),
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging PII access', error);
    return false;
  }
}

/**
 * Registra mudança de configuração do sistema
 */
export function logConfigChange(
  userId: number,
  configKey: string,
  oldValue: any,
  newValue: any,
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    return logAuditAction({
      user_id: userId,
      action: 'config_change',
      resource_type: 'system_config',
      old_values: JSON.stringify({
        key: configKey,
        value: oldValue
      }),
      new_values: JSON.stringify({
        key: configKey,
        value: newValue,
        changed_at: new Date().toISOString()
      }),
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging config change', error);
    return false;
  }
}

/**
 * Registra violação de segurança
 */
export function logSecurityViolation(
  userId: number | undefined,
  violationType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: any,
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    return logAuditAction({
      user_id: userId,
      action: 'security_violation',
      resource_type: 'security',
      new_values: JSON.stringify({
        violation_type: violationType,
        severity,
        details,
        detected_at: new Date().toISOString()
      }),
      ip_address: ipAddress,
      user_agent: userAgent
    }) !== null;
  } catch (error) {
    logger.error('Error logging security violation', error);
    return false;
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
 * Exporta logs de auditoria em diferentes formatos
 */
export function exportAuditLogs(
  format: 'csv' | 'json',
  options: {
    userId?: number;
    action?: string;
    resourceType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}
): string {
  try {
    const { logs } = getAuditLogs({
      ...options,
      limit: options.limit || 10000 // Limite alto para exportação
    });

    if (format === 'json') {
      return JSON.stringify({
        exported_at: new Date().toISOString(),
        total_records: logs.length,
        filters: options,
        logs: logs.map(log => ({
          id: log.id,
          timestamp: log.created_at,
          user: {
            id: log.user_id,
            name: log.user_name,
            email: log.user_email
          },
          action: log.action,
          resource: {
            type: log.resource_type,
            id: log.resource_id
          },
          changes: {
            old_values: log.old_values ? JSON.parse(log.old_values) : null,
            new_values: log.new_values ? JSON.parse(log.new_values) : null
          },
          metadata: {
            ip_address: log.ip_address,
            user_agent: log.user_agent
          }
        }))
      }, null, 2);
    }

    // CSV format
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
        `"${(log.old_values || '').replace(/"/g, '""')}"`,
        `"${(log.new_values || '').replace(/"/g, '""')}"`,
        `"${log.ip_address || ''}"`,
        `"${(log.user_agent || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  } catch (error) {
    logger.error(`Error exporting audit logs to ${format}`, error);
    return '';
  }
}

/**
 * Exporta logs de auditoria para CSV (backward compatibility)
 */
export function exportAuditLogsToCSV(options: {
  userId?: number;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
} = {}): string {
  return exportAuditLogs('csv', options);
}

/**
 * Busca logs de auditoria por ação específica
 */
export function getAuditLogsByAction(
  action: string,
  limit: number = 100
): AuditLogWithDetails[] {
  try {
    return db.prepare(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.action = ?
      ORDER BY al.created_at DESC
      LIMIT ?
    `).all(action, limit) as AuditLogWithDetails[];
  } catch (error) {
    logger.error('Error getting audit logs by action', error);
    return [];
  }
}

/**
 * Busca logs de auditoria por usuário
 */
export function getUserAuditHistory(
  userId: number,
  limit: number = 100
): AuditLogWithDetails[] {
  try {
    return db.prepare(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id = ?
      ORDER BY al.created_at DESC
      LIMIT ?
    `).all(userId, limit) as AuditLogWithDetails[];
  } catch (error) {
    logger.error('Error getting user audit history', error);
    return [];
  }
}

/**
 * Busca logs de segurança (falhas de auth, acessos negados, violações)
 */
export function getSecurityAuditLogs(
  startDate?: string,
  endDate?: string,
  limit: number = 100
): AuditLogWithDetails[] {
  try {
    let whereClause = `WHERE (
      al.action IN ('auth_failure', 'authorization_denied', 'security_violation', 'access_denied', 'login_failed')
      OR al.resource_type = 'security'
    )`;

    const params: any[] = [];

    if (startDate) {
      whereClause += ' AND al.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND al.created_at <= ?';
      params.push(endDate);
    }

    return db.prepare(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ?
    `).all(...params, limit) as AuditLogWithDetails[];
  } catch (error) {
    logger.error('Error getting security audit logs', error);
    return [];
  }
}

/**
 * Busca logs de acesso a PII (dados sensíveis)
 */
export function getPIIAccessLogs(
  startDate?: string,
  endDate?: string,
  limit: number = 100
): AuditLogWithDetails[] {
  try {
    let whereClause = `WHERE al.action = 'pii_access'`;
    const params: any[] = [];

    if (startDate) {
      whereClause += ' AND al.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND al.created_at <= ?';
      params.push(endDate);
    }

    return db.prepare(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ?
    `).all(...params, limit) as AuditLogWithDetails[];
  } catch (error) {
    logger.error('Error getting PII access logs', error);
    return [];
  }
}

/**
 * Busca logs de mudanças de configuração
 */
export function getConfigChangeLogs(
  startDate?: string,
  endDate?: string,
  limit: number = 100
): AuditLogWithDetails[] {
  try {
    let whereClause = `WHERE al.action = 'config_change'`;
    const params: any[] = [];

    if (startDate) {
      whereClause += ' AND al.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND al.created_at <= ?';
      params.push(endDate);
    }

    return db.prepare(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ?
    `).all(...params, limit) as AuditLogWithDetails[];
  } catch (error) {
    logger.error('Error getting config change logs', error);
    return [];
  }
}

/**
 * Obtém estatísticas de atividades suspeitas
 */
export function getSuspiciousActivityStats(hours: number = 24): {
  failed_logins: number;
  access_denied: number;
  security_violations: number;
  unusual_activity_users: any[];
} {
  try {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);
    const startDateStr = startDate.toISOString();

    // Contagem de falhas de login
    const { failed_logins } = db.prepare(`
      SELECT COUNT(*) as failed_logins
      FROM audit_logs
      WHERE action IN ('auth_failure', 'login_failed')
      AND created_at >= ?
    `).get(startDateStr) as { failed_logins: number };

    // Contagem de acessos negados
    const { access_denied } = db.prepare(`
      SELECT COUNT(*) as access_denied
      FROM audit_logs
      WHERE action IN ('access_denied', 'authorization_denied')
      AND created_at >= ?
    `).get(startDateStr) as { access_denied: number };

    // Contagem de violações de segurança
    const { security_violations } = db.prepare(`
      SELECT COUNT(*) as security_violations
      FROM audit_logs
      WHERE action = 'security_violation'
      AND created_at >= ?
    `).get(startDateStr) as { security_violations: number };

    // Usuários com atividade incomum (muitas ações)
    const unusual_activity_users = db.prepare(`
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(al.id) as action_count,
        GROUP_CONCAT(DISTINCT al.action) as actions
      FROM audit_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= ?
      GROUP BY u.id, u.name, u.email
      HAVING action_count > 50
      ORDER BY action_count DESC
    `).all(startDateStr);

    return {
      failed_logins,
      access_denied,
      security_violations,
      unusual_activity_users
    };
  } catch (error) {
    logger.error('Error getting suspicious activity stats', error);
    return {
      failed_logins: 0,
      access_denied: 0,
      security_violations: 0,
      unusual_activity_users: []
    };
  }
}

/**
 * Configura política de retenção de logs
 */
export interface AuditRetentionPolicy {
  action_type: string;
  retention_days: number;
  description: string;
}

const DEFAULT_RETENTION_POLICIES: AuditRetentionPolicy[] = [
  { action_type: 'security_violation', retention_days: 365 * 7, description: 'Security violations - 7 years' },
  { action_type: 'auth_failure', retention_days: 365 * 2, description: 'Auth failures - 2 years' },
  { action_type: 'pii_access', retention_days: 365 * 5, description: 'PII access - 5 years (LGPD)' },
  { action_type: 'config_change', retention_days: 365 * 3, description: 'Config changes - 3 years' },
  { action_type: 'access_denied', retention_days: 365, description: 'Access denied - 1 year' },
  { action_type: 'login_success', retention_days: 90, description: 'Successful logins - 90 days' },
  { action_type: 'default', retention_days: 180, description: 'Default retention - 180 days' }
];

/**
 * Aplica política de retenção de logs
 */
export function applyRetentionPolicy(
  policies: AuditRetentionPolicy[] = DEFAULT_RETENTION_POLICIES
): { total_deleted: number; details: any[] } {
  try {
    const details: any[] = [];
    let total_deleted = 0;

    for (const policy of policies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

      let result;
      if (policy.action_type === 'default') {
        // Delete logs que não se encaixam em outras políticas
        const specificActions = policies
          .filter(p => p.action_type !== 'default')
          .map(p => `'${p.action_type}'`)
          .join(',');

        result = db.prepare(`
          DELETE FROM audit_logs
          WHERE created_at < ?
          AND action NOT IN (${specificActions})
        `).run(cutoffDate.toISOString());
      } else {
        result = db.prepare(`
          DELETE FROM audit_logs
          WHERE created_at < ?
          AND action = ?
        `).run(cutoffDate.toISOString(), policy.action_type);
      }

      if (result.changes > 0) {
        details.push({
          action_type: policy.action_type,
          deleted_count: result.changes,
          retention_days: policy.retention_days,
          cutoff_date: cutoffDate.toISOString()
        });
        total_deleted += result.changes;
      }
    }

    logger.info(`Retention policy applied: ${total_deleted} logs deleted`, { details });
    return { total_deleted, details };
  } catch (error) {
    logger.error('Error applying retention policy', error);
    return { total_deleted: 0, details: [] };
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