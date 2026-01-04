/**
 * Comprehensive Audit Logging System
 *
 * Logs all critical security and business operations:
 * - Authentication events (login, logout, failures)
 * - Authorization changes (role updates, permissions)
 * - Data modifications (create, update, delete)
 * - Administrative actions
 * - Security events (failed auth, suspicious activity)
 * - File operations
 * - API access
 */

import db from '@/lib/db/connection';
import logger from '@/lib/monitoring/structured-logger';
import { NextRequest } from 'next/server';

/**
 * Audit event types
 */
export enum AuditEventType {
  // Authentication
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILURE = 'auth.login.failure',
  LOGOUT = 'auth.logout',
  PASSWORD_CHANGE = 'auth.password.change',
  PASSWORD_RESET = 'auth.password.reset',
  MFA_ENABLED = 'auth.mfa.enabled',
  MFA_DISABLED = 'auth.mfa.disabled',
  MFA_VERIFY_SUCCESS = 'auth.mfa.verify.success',
  MFA_VERIFY_FAILURE = 'auth.mfa.verify.failure',

  // Authorization
  ROLE_CHANGE = 'authz.role.change',
  PERMISSION_GRANT = 'authz.permission.grant',
  PERMISSION_REVOKE = 'authz.permission.revoke',
  ACCESS_DENIED = 'authz.access.denied',

  // User Management
  USER_CREATE = 'user.create',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  USER_SUSPEND = 'user.suspend',
  USER_ACTIVATE = 'user.activate',

  // Ticket Operations
  TICKET_CREATE = 'ticket.create',
  TICKET_UPDATE = 'ticket.update',
  TICKET_DELETE = 'ticket.delete',
  TICKET_ASSIGN = 'ticket.assign',
  TICKET_CLOSE = 'ticket.close',
  TICKET_REOPEN = 'ticket.reopen',

  // Data Operations
  DATA_EXPORT = 'data.export',
  DATA_IMPORT = 'data.import',
  DATA_DELETE = 'data.delete',
  BULK_UPDATE = 'data.bulk_update',

  // File Operations
  FILE_UPLOAD = 'file.upload',
  FILE_DOWNLOAD = 'file.download',
  FILE_DELETE = 'file.delete',

  // Configuration Changes
  CONFIG_UPDATE = 'config.update',
  SETTINGS_CHANGE = 'settings.change',
  INTEGRATION_ADD = 'integration.add',
  INTEGRATION_REMOVE = 'integration.remove',

  // Security Events
  SUSPICIOUS_ACTIVITY = 'security.suspicious',
  RATE_LIMIT_EXCEEDED = 'security.rate_limit',
  INVALID_TOKEN = 'security.invalid_token',
  CSRF_VIOLATION = 'security.csrf_violation',
  SQL_INJECTION_ATTEMPT = 'security.sql_injection',
  XSS_ATTEMPT = 'security.xss',

  // API Events
  API_KEY_CREATE = 'api.key.create',
  API_KEY_REVOKE = 'api.key.revoke',
  WEBHOOK_CALL = 'api.webhook.call',
  WEBHOOK_FAILURE = 'api.webhook.failure',

  // Administrative
  ADMIN_ACTION = 'admin.action',
  SYSTEM_CONFIG = 'system.config',
  MAINTENANCE_MODE = 'system.maintenance',
}

/**
 * Audit severity levels
 */
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id?: number;
  tenant_id: number;
  user_id?: number;
  event_type: AuditEventType;
  severity: AuditSeverity;
  entity_type?: string;
  entity_id?: number;
  action: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  request_id?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

/**
 * Initialize audit logs table
 */
export function initializeAuditLogTable(): void {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        user_id INTEGER,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        entity_type TEXT,
        entity_id INTEGER,
        action TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT NOT NULL,
        user_agent TEXT,
        request_id TEXT,
        session_id TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `).run();

    // Create indexes for efficient querying
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant
      ON audit_logs(tenant_id, created_at DESC)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user
      ON audit_logs(user_id, created_at DESC)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type
      ON audit_logs(event_type, created_at DESC)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_severity
      ON audit_logs(severity, created_at DESC)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
      ON audit_logs(entity_type, entity_id, created_at DESC)
    `).run();

    logger.info('Audit logs table initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize audit logs table', error);
    throw error;
  }
}

/**
 * Log audit event
 */
export function logAuditEvent(entry: AuditLogEntry): void {
  try {
    db.prepare(`
      INSERT INTO audit_logs (
        tenant_id, user_id, event_type, severity, entity_type, entity_id,
        action, old_values, new_values, ip_address, user_agent,
        request_id, session_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.tenant_id,
      entry.user_id || null,
      entry.event_type,
      entry.severity,
      entry.entity_type || null,
      entry.entity_id || null,
      entry.action,
      entry.old_values ? JSON.stringify(entry.old_values) : null,
      entry.new_values ? JSON.stringify(entry.new_values) : null,
      entry.ip_address,
      entry.user_agent || null,
      entry.request_id || null,
      entry.session_id || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null
    );

    // Also log to structured logger for real-time monitoring
    logger.info('Audit event', {
      ...entry,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to log audit event', { entry, error });
    // Don't throw - audit logging should never break the main flow
  }
}

/**
 * Extract request metadata from NextRequest
 */
export function extractRequestMetadata(request: NextRequest): {
  ip_address: string;
  user_agent: string;
  request_id?: string;
} {
  const ip_address =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown';

  const user_agent = request.headers.get('user-agent') || 'unknown';
  const request_id = request.headers.get('x-request-id') || undefined;

  return { ip_address, user_agent, request_id };
}

/**
 * Helper functions for common audit events
 */

export function logLoginSuccess(
  tenantId: number,
  userId: number,
  request: NextRequest
): void {
  const metadata = extractRequestMetadata(request);
  logAuditEvent({
    tenant_id: tenantId,
    user_id: userId,
    event_type: AuditEventType.LOGIN_SUCCESS,
    severity: AuditSeverity.INFO,
    action: 'User logged in successfully',
    ...metadata,
  });
}

export function logLoginFailure(
  tenantId: number,
  email: string,
  reason: string,
  request: NextRequest
): void {
  const metadata = extractRequestMetadata(request);
  logAuditEvent({
    tenant_id: tenantId,
    event_type: AuditEventType.LOGIN_FAILURE,
    severity: AuditSeverity.WARNING,
    action: 'Login attempt failed',
    metadata: { email, reason },
    ...metadata,
  });
}

export function logPasswordChange(
  tenantId: number,
  userId: number,
  request: NextRequest
): void {
  const metadata = extractRequestMetadata(request);
  logAuditEvent({
    tenant_id: tenantId,
    user_id: userId,
    event_type: AuditEventType.PASSWORD_CHANGE,
    severity: AuditSeverity.INFO,
    action: 'User changed password',
    ...metadata,
  });
}

export function logRoleChange(
  tenantId: number,
  adminUserId: number,
  targetUserId: number,
  oldRole: string,
  newRole: string,
  request: NextRequest
): void {
  const metadata = extractRequestMetadata(request);
  logAuditEvent({
    tenant_id: tenantId,
    user_id: adminUserId,
    event_type: AuditEventType.ROLE_CHANGE,
    severity: AuditSeverity.WARNING,
    entity_type: 'user',
    entity_id: targetUserId,
    action: 'User role changed',
    old_values: { role: oldRole },
    new_values: { role: newRole },
    ...metadata,
  });
}

export function logDataExport(
  tenantId: number,
  userId: number,
  exportType: string,
  recordCount: number,
  request: NextRequest
): void {
  const metadata = extractRequestMetadata(request);
  logAuditEvent({
    tenant_id: tenantId,
    user_id: userId,
    event_type: AuditEventType.DATA_EXPORT,
    severity: AuditSeverity.WARNING,
    action: `Exported ${exportType} data`,
    metadata: { export_type: exportType, record_count: recordCount },
    ...metadata,
  });
}

export function logFileUpload(
  tenantId: number,
  userId: number,
  filename: string,
  fileSize: number,
  entityType: string,
  entityId: number,
  request: NextRequest
): void {
  const metadata = extractRequestMetadata(request);
  logAuditEvent({
    tenant_id: tenantId,
    user_id: userId,
    event_type: AuditEventType.FILE_UPLOAD,
    severity: AuditSeverity.INFO,
    entity_type: entityType,
    entity_id: entityId,
    action: 'File uploaded',
    metadata: { filename, file_size: fileSize },
    ...metadata,
  });
}

export function logSuspiciousActivity(
  tenantId: number,
  userId: number | undefined,
  activityType: string,
  details: Record<string, unknown>,
  request: NextRequest
): void {
  const metadata = extractRequestMetadata(request);
  logAuditEvent({
    tenant_id: tenantId,
    user_id: userId,
    event_type: AuditEventType.SUSPICIOUS_ACTIVITY,
    severity: AuditSeverity.CRITICAL,
    action: `Suspicious activity detected: ${activityType}`,
    metadata: details,
    ...metadata,
  });
}

export function logAccessDenied(
  tenantId: number,
  userId: number | undefined,
  resource: string,
  reason: string,
  request: NextRequest
): void {
  const metadata = extractRequestMetadata(request);
  logAuditEvent({
    tenant_id: tenantId,
    user_id: userId,
    event_type: AuditEventType.ACCESS_DENIED,
    severity: AuditSeverity.WARNING,
    action: 'Access denied',
    metadata: { resource, reason },
    ...metadata,
  });
}

export function logWebhookCall(
  tenantId: number,
  webhookUrl: string,
  success: boolean,
  responseStatus?: number,
  error?: string
): void {
  logAuditEvent({
    tenant_id: tenantId,
    event_type: success ? AuditEventType.WEBHOOK_CALL : AuditEventType.WEBHOOK_FAILURE,
    severity: success ? AuditSeverity.INFO : AuditSeverity.ERROR,
    action: `Webhook ${success ? 'succeeded' : 'failed'}`,
    metadata: { webhook_url: webhookUrl, response_status: responseStatus, error },
    ip_address: 'system',
    user_agent: 'webhook-caller',
  });
}

export function logCSRFViolation(
  tenantId: number,
  userId: number | undefined,
  request: NextRequest
): void {
  const metadata = extractRequestMetadata(request);
  logAuditEvent({
    tenant_id: tenantId,
    user_id: userId,
    event_type: AuditEventType.CSRF_VIOLATION,
    severity: AuditSeverity.CRITICAL,
    action: 'CSRF token validation failed',
    metadata: {
      path: request.nextUrl.pathname,
      method: request.method,
    },
    ...metadata,
  });
}

/**
 * Query audit logs
 */
export interface AuditLogQuery {
  tenant_id: number;
  user_id?: number;
  event_type?: AuditEventType;
  severity?: AuditSeverity;
  entity_type?: string;
  entity_id?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export function queryAuditLogs(query: AuditLogQuery): AuditLogEntry[] {
  try {
    let sql = 'SELECT * FROM audit_logs WHERE tenant_id = ?';
    const params: unknown[] = [query.tenant_id];

    if (query.user_id) {
      sql += ' AND user_id = ?';
      params.push(query.user_id);
    }

    if (query.event_type) {
      sql += ' AND event_type = ?';
      params.push(query.event_type);
    }

    if (query.severity) {
      sql += ' AND severity = ?';
      params.push(query.severity);
    }

    if (query.entity_type) {
      sql += ' AND entity_type = ?';
      params.push(query.entity_type);
    }

    if (query.entity_id) {
      sql += ' AND entity_id = ?';
      params.push(query.entity_id);
    }

    if (query.start_date) {
      sql += ' AND created_at >= ?';
      params.push(query.start_date);
    }

    if (query.end_date) {
      sql += ' AND created_at <= ?';
      params.push(query.end_date);
    }

    sql += ' ORDER BY created_at DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    if (query.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }

    const rows = db.prepare(sql).all(...params) as AuditLogEntry[];

    // Parse JSON fields
    return rows.map(row => ({
      ...row,
      old_values: row.old_values ? JSON.parse(row.old_values as unknown as string) : undefined,
      new_values: row.new_values ? JSON.parse(row.new_values as unknown as string) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as unknown as string) : undefined,
    }));
  } catch (error) {
    logger.error('Failed to query audit logs', { query, error });
    return [];
  }
}

/**
 * Get audit log statistics
 */
export function getAuditLogStats(
  tenantId: number,
  startDate: string,
  endDate: string
): {
  total_events: number;
  by_severity: Record<string, number>;
  by_event_type: Record<string, number>;
  by_user: Array<{ user_id: number; count: number }>;
  timeline: Array<{ date: string; count: number }>;
} {
  try {
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs
      WHERE tenant_id = ? AND created_at BETWEEN ? AND ?
    `).get(tenantId, startDate, endDate) as { count: number };

    const bySeverity = db.prepare(`
      SELECT severity, COUNT(*) as count FROM audit_logs
      WHERE tenant_id = ? AND created_at BETWEEN ? AND ?
      GROUP BY severity
    `).all(tenantId, startDate, endDate) as Array<{ severity: string; count: number }>;

    const byEventType = db.prepare(`
      SELECT event_type, COUNT(*) as count FROM audit_logs
      WHERE tenant_id = ? AND created_at BETWEEN ? AND ?
      GROUP BY event_type
      ORDER BY count DESC
      LIMIT 20
    `).all(tenantId, startDate, endDate) as Array<{ event_type: string; count: number }>;

    const byUser = db.prepare(`
      SELECT user_id, COUNT(*) as count FROM audit_logs
      WHERE tenant_id = ? AND created_at BETWEEN ? AND ? AND user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT 10
    `).all(tenantId, startDate, endDate) as Array<{ user_id: number; count: number }>;

    const timeline = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count FROM audit_logs
      WHERE tenant_id = ? AND created_at BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(tenantId, startDate, endDate) as Array<{ date: string; count: number }>;

    return {
      total_events: total.count,
      by_severity: Object.fromEntries(bySeverity.map(r => [r.severity, r.count])),
      by_event_type: Object.fromEntries(byEventType.map(r => [r.event_type, r.count])),
      by_user: byUser,
      timeline,
    };
  } catch (error) {
    logger.error('Failed to get audit log stats', { tenantId, startDate, endDate, error });
    throw error;
  }
}

/**
 * Cleanup old audit logs (for compliance retention policies)
 */
export function cleanupOldAuditLogs(
  tenantId: number,
  retentionDays: number = 365
): number {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = db.prepare(`
      DELETE FROM audit_logs
      WHERE tenant_id = ? AND created_at < ?
    `).run(tenantId, cutoffDate.toISOString());

    logger.info('Old audit logs cleaned up', {
      tenantId,
      retentionDays,
      deletedCount: result.changes,
    });

    return result.changes;
  } catch (error) {
    logger.error('Failed to cleanup old audit logs', { tenantId, retentionDays, error });
    return 0;
  }
}
