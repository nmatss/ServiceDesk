import db from '../db/connection';
import { logger } from '../monitoring/logger';

export interface AuditLogEntry {
  entityType: string;
  entityId: number;
  action: 'create' | 'update' | 'delete' | 'view' | 'export';
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  userId?: number;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  apiEndpoint?: string;
  organizationId: number;
}

export class AuditLogger {
  /**
   * Registra ação no audit log
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      db.prepare(`
        INSERT INTO audit_advanced (
          entity_type, entity_id, action,
          old_values, new_values,
          user_id, session_id, ip_address, user_agent,
          request_id, api_endpoint, organization_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.entityType,
        entry.entityId,
        entry.action,
        entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        entry.newValues ? JSON.stringify(entry.newValues) : null,
        entry.userId || null,
        entry.sessionId || null,
        entry.ipAddress || null,
        entry.userAgent || null,
        entry.requestId || null,
        entry.apiEndpoint || null,
        entry.organizationId
      );
    } catch (error) {
      logger.error('Audit log error', error);
    }
  }

  /**
   * Busca audit logs com filtros
   */
  async getLogs(filters: {
    organizationId: number;
    entityType?: string;
    entityId?: number;
    userId?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<any[]> {
    let query = `
      SELECT a.*, u.name as user_name, u.email as user_email
      FROM audit_advanced a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.organization_id = ?
    `;

    const params: any[] = [filters.organizationId];

    if (filters.entityType) {
      query += ` AND a.entity_type = ?`;
      params.push(filters.entityType);
    }

    if (filters.entityId) {
      query += ` AND a.entity_id = ?`;
      params.push(filters.entityId);
    }

    if (filters.userId) {
      query += ` AND a.user_id = ?`;
      params.push(filters.userId);
    }

    if (filters.action) {
      query += ` AND a.action = ?`;
      params.push(filters.action);
    }

    if (filters.startDate) {
      query += ` AND a.created_at >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND a.created_at <= ?`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY a.created_at DESC LIMIT ?`;
    params.push(filters.limit || 100);

    return db.prepare(query).all(...params);
  }

  /**
   * Exporta audit logs para compliance
   */
  async exportLogs(
    organizationId: number,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    return this.getLogs({
      organizationId,
      startDate,
      endDate,
      limit: 1000000
    });
  }
}

export const auditLogger = new AuditLogger();

// Decorator para auto-logging
export function AuditLog(entityType: string, action: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      // Log após execução bem-sucedida
      const [entityId, organizationId, userId] = args;

      await auditLogger.log({
        entityType,
        entityId,
        action: action as any,
        organizationId,
        userId
      });

      return result;
    };

    return descriptor;
  };
}
