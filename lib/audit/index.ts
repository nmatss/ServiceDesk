import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { AuditLog, CreateAuditLog, AuditLogWithDetails } from '../types/database';
import logger from '../monitoring/structured-logger';

/**
 * Registra uma acao no log de auditoria
 */
export async function logAuditAction(auditData: CreateAuditLog): Promise<AuditLog | null> {
  try {
    const result = await executeRun(`
      INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id,
        old_values, new_values, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      auditData.user_id || null,
      auditData.action,
      auditData.resource_type,
      auditData.resource_id || null,
      auditData.old_values || null,
      auditData.new_values || null,
      auditData.ip_address || null,
      auditData.user_agent || null
    ]);

    if (result.lastInsertRowid) {
      return await executeQueryOne<AuditLog>(
        'SELECT * FROM audit_logs WHERE id = ?',
        [result.lastInsertRowid]
      ) || null;
    }

    return null;
  } catch (error) {
    logger.error('Error logging audit action', error);
    return null;
  }
}

/**
 * Registra criacao de recurso
 */
export async function logCreate(
  userId: number,
  resourceType: string,
  resourceId: number,
  newValues: any,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    return await logAuditAction({
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
 * Registra atualizacao de recurso
 */
export async function logUpdate(
  userId: number,
  resourceType: string,
  resourceId: number,
  oldValues: any,
  newValues: any,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    return await logAuditAction({
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
 * Registra exclusao de recurso
 */
export async function logDelete(
  userId: number,
  resourceType: string,
  resourceId: number,
  oldValues: any,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    return await logAuditAction({
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
 * Registra visualizacao de recurso sensivel
 */
export async function logView(
  userId: number,
  resourceType: string,
  resourceId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    return await logAuditAction({
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
 * Registra login do usuario
 */
export async function logLogin(
  userId: number,
  ipAddress?: string,
  userAgent?: string,
  loginType: 'success' | 'failed' = 'success'
): Promise<boolean> {
  try {
    return await logAuditAction({
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
 * Registra logout do usuario
 */
export async function logLogout(
  userId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    return await logAuditAction({
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
 * Registra mudanca de senha
 */
export async function logPasswordChange(
  userId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    return await logAuditAction({
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
export async function logAccessDenied(
  userId: number | undefined,
  resourceType: string,
  resourceId?: number,
  reason?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    return await logAuditAction({
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
export async function getAuditLogs(options: {
  userId?: number;
  action?: string;
  resourceType?: string;
  resourceId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ logs: AuditLogWithDetails[]; total: number }> {
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
    const logs = await executeQuery<AuditLogWithDetails>(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    // Contar total
    const totalResult = await executeQueryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM audit_logs al
      ${whereClause}
    `, params);
    const total = totalResult?.total ?? 0;

    return { logs, total };
  } catch (error) {
    logger.error('Error getting audit logs', error);
    return { logs: [], total: 0 };
  }
}

/**
 * Registra falha de autenticacao
 */
export async function logAuthFailure(
  email: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    return await logAuditAction({
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
 * Registra autorizacao negada
 */
export async function logAuthorizationDenied(
  userId: number,
  resourceType: string,
  resourceId: number | undefined,
  requiredPermission: string,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    return await logAuditAction({
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
 * Registra acesso a dados sensiveis (PII)
 */
export async function logPIIAccess(
  userId: number,
  resourceType: string,
  resourceId: number,
  piiFields: string[],
  purpose: string,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    return await logAuditAction({
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
 * Registra mudanca de configuracao do sistema
 */
export async function logConfigChange(
  userId: number,
  configKey: string,
  oldValue: any,
  newValue: any,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    return await logAuditAction({
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
 * Registra violacao de seguranca
 */
export async function logSecurityViolation(
  userId: number | undefined,
  violationType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: any,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    return await logAuditAction({
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
 * Busca logs de auditoria de um recurso especifico
 */
export async function getResourceAuditHistory(
  resourceType: string,
  resourceId: number
): Promise<AuditLogWithDetails[]> {
  try {
    return await executeQuery<AuditLogWithDetails>(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.resource_type = ? AND al.resource_id = ?
      ORDER BY al.created_at DESC
    `, [resourceType, resourceId]);
  } catch (error) {
    logger.error('Error getting resource audit history', error);
    return [];
  }
}

/**
 * Busca estatisticas de auditoria
 */
export async function getAuditStats(days: number = 30): Promise<any> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    // Total de acoes por tipo
    const actionStats = await executeQuery<any>(`
      SELECT
        action,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= ?
      GROUP BY action
      ORDER BY count DESC
    `, [startDateStr]);

    // Acoes por tipo de recurso
    const resourceStats = await executeQuery<any>(`
      SELECT
        resource_type,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= ?
      GROUP BY resource_type
      ORDER BY count DESC
    `, [startDateStr]);

    // Usuarios mais ativos
    const activeUsers = await executeQuery<any>(`
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
    `, [startDateStr]);

    // Atividade por dia
    const dailyActivity = await executeQuery<any>(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [startDateStr]);

    // Tentativas de acesso negado
    const accessDeniedResult = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE action = 'access_denied' AND created_at >= ?
    `, [startDateStr]);

    // Logins falhados
    const failedLoginsResult = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE action = 'login_failed' AND created_at >= ?
    `, [startDateStr]);

    return {
      period_days: days,
      actions: actionStats,
      resources: resourceStats,
      active_users: activeUsers,
      daily_activity: dailyActivity,
      security: {
        access_denied: accessDeniedResult?.count ?? 0,
        failed_logins: failedLoginsResult?.count ?? 0
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
export async function cleanupOldAuditLogs(daysOld: number = 90): Promise<number> {
  try {
    if (daysOld < 30) {
      throw new Error('Cannot delete audit logs less than 30 days old');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await executeRun(`
      DELETE FROM audit_logs
      WHERE created_at < ?
    `, [cutoffDate.toISOString()]);

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
export async function exportAuditLogs(
  format: 'csv' | 'json',
  options: {
    userId?: number;
    action?: string;
    resourceType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}
): Promise<string> {
  try {
    const { logs } = await getAuditLogs({
      ...options,
      limit: options.limit || 10000 // Limite alto para exportacao
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
      'Usuario',
      'Email',
      'Acao',
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
export async function exportAuditLogsToCSV(options: {
  userId?: number;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
} = {}): Promise<string> {
  return exportAuditLogs('csv', options);
}

/**
 * Busca logs de auditoria por acao especifica
 */
export async function getAuditLogsByAction(
  action: string,
  limit: number = 100
): Promise<AuditLogWithDetails[]> {
  try {
    return await executeQuery<AuditLogWithDetails>(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.action = ?
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [action, limit]);
  } catch (error) {
    logger.error('Error getting audit logs by action', error);
    return [];
  }
}

/**
 * Busca logs de auditoria por usuario
 */
export async function getUserAuditHistory(
  userId: number,
  limit: number = 100
): Promise<AuditLogWithDetails[]> {
  try {
    return await executeQuery<AuditLogWithDetails>(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id = ?
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [userId, limit]);
  } catch (error) {
    logger.error('Error getting user audit history', error);
    return [];
  }
}

/**
 * Busca logs de seguranca (falhas de auth, acessos negados, violacoes)
 */
export async function getSecurityAuditLogs(
  startDate?: string,
  endDate?: string,
  limit: number = 100
): Promise<AuditLogWithDetails[]> {
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

    return await executeQuery<AuditLogWithDetails>(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [...params, limit]);
  } catch (error) {
    logger.error('Error getting security audit logs', error);
    return [];
  }
}

/**
 * Busca logs de acesso a PII (dados sensiveis)
 */
export async function getPIIAccessLogs(
  startDate?: string,
  endDate?: string,
  limit: number = 100
): Promise<AuditLogWithDetails[]> {
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

    return await executeQuery<AuditLogWithDetails>(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [...params, limit]);
  } catch (error) {
    logger.error('Error getting PII access logs', error);
    return [];
  }
}

/**
 * Busca logs de mudancas de configuracao
 */
export async function getConfigChangeLogs(
  startDate?: string,
  endDate?: string,
  limit: number = 100
): Promise<AuditLogWithDetails[]> {
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

    return await executeQuery<AuditLogWithDetails>(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [...params, limit]);
  } catch (error) {
    logger.error('Error getting config change logs', error);
    return [];
  }
}

/**
 * Obtem estatisticas de atividades suspeitas
 */
export async function getSuspiciousActivityStats(hours: number = 24): Promise<{
  failed_logins: number;
  access_denied: number;
  security_violations: number;
  unusual_activity_users: any[];
}> {
  try {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);
    const startDateStr = startDate.toISOString();

    // Contagem de falhas de login
    const failedLoginsResult = await executeQueryOne<{ failed_logins: number }>(`
      SELECT COUNT(*) as failed_logins
      FROM audit_logs
      WHERE action IN ('auth_failure', 'login_failed')
      AND created_at >= ?
    `, [startDateStr]);

    // Contagem de acessos negados
    const accessDeniedResult = await executeQueryOne<{ access_denied: number }>(`
      SELECT COUNT(*) as access_denied
      FROM audit_logs
      WHERE action IN ('access_denied', 'authorization_denied')
      AND created_at >= ?
    `, [startDateStr]);

    // Contagem de violacoes de seguranca
    const secViolationsResult = await executeQueryOne<{ security_violations: number }>(`
      SELECT COUNT(*) as security_violations
      FROM audit_logs
      WHERE action = 'security_violation'
      AND created_at >= ?
    `, [startDateStr]);

    // Usuarios com atividade incomum (muitas acoes)
    const unusual_activity_users = await executeQuery<any>(`
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
    `, [startDateStr]);

    return {
      failed_logins: failedLoginsResult?.failed_logins ?? 0,
      access_denied: accessDeniedResult?.access_denied ?? 0,
      security_violations: secViolationsResult?.security_violations ?? 0,
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
 * Configura politica de retencao de logs
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
 * Aplica politica de retencao de logs
 */
export async function applyRetentionPolicy(
  policies: AuditRetentionPolicy[] = DEFAULT_RETENTION_POLICIES
): Promise<{ total_deleted: number; details: any[] }> {
  try {
    const details: any[] = [];
    let total_deleted = 0;

    for (const policy of policies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

      let result;
      if (policy.action_type === 'default') {
        // Delete logs que nao se encaixam em outras politicas
        const specificActions = policies
          .filter(p => p.action_type !== 'default')
          .map(p => `'${p.action_type}'`)
          .join(',');

        result = await executeRun(`
          DELETE FROM audit_logs
          WHERE created_at < ?
          AND action NOT IN (${specificActions})
        `, [cutoffDate.toISOString()]);
      } else {
        result = await executeRun(`
          DELETE FROM audit_logs
          WHERE created_at < ?
          AND action = ?
        `, [cutoffDate.toISOString(), policy.action_type]);
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
export async function verifyAuditIntegrity(): Promise<{
  total_logs: number;
  missing_users: number;
  invalid_json: number;
  suspicious_activity: number;
}> {
  try {
    // Total de logs
    const totalResult = await executeQueryOne<{ total_logs: number }>(`
      SELECT COUNT(*) as total_logs FROM audit_logs
    `, []);

    // Logs com usuarios inexistentes
    const missingResult = await executeQueryOne<{ missing_users: number }>(`
      SELECT COUNT(*) as missing_users
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id IS NOT NULL AND u.id IS NULL
    `, []);

    // Logs com JSON invalido
    const logsWithJson = await executeQuery<any>(`
      SELECT id, old_values, new_values
      FROM audit_logs
      WHERE old_values IS NOT NULL OR new_values IS NOT NULL
    `, []);

    let invalidJson = 0;
    logsWithJson.forEach((log: any) => {
      try {
        if (log.old_values) JSON.parse(log.old_values);
        if (log.new_values) JSON.parse(log.new_values);
      } catch {
        invalidJson++;
      }
    });

    // Atividade suspeita (muitas acoes em pouco tempo)
    const suspiciousResult = await executeQueryOne<{ suspicious_activity: number }>(`
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
    `, []);

    return {
      total_logs: totalResult?.total_logs ?? 0,
      missing_users: missingResult?.missing_users ?? 0,
      invalid_json: invalidJson,
      suspicious_activity: suspiciousResult?.suspicious_activity ?? 0
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
