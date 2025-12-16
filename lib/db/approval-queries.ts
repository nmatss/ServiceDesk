/**
 * Database queries for the Approval System
 * Complete CRUD operations and specialized queries
 */

import { getDb } from './index';
import { Approval, ApprovalHistory, CreateApproval, CreateApprovalHistory } from '../types/database';

/**
 * Create a new approval request
 */
export function createApproval(approval: Omit<CreateApproval, 'notification_sent' | 'escalation_level'>): Approval {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO approvals (
      entity_type, entity_id, approval_type, requested_by, assigned_to,
      assigned_group, status, priority, reason, approval_data,
      due_date, auto_approve_after
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    approval.entity_type,
    approval.entity_id,
    approval.approval_type,
    approval.requested_by,
    approval.assigned_to || null,
    approval.assigned_group || null,
    approval.status || 'pending',
    approval.priority || 'medium',
    approval.reason || null,
    approval.approval_data || null,
    approval.due_date || null,
    approval.auto_approve_after || null
  );

  return getApprovalById(result.lastInsertRowid as number)!;
}

/**
 * Get approval by ID
 */
export function getApprovalById(id: number): Approval | null {
  const db = getDb();

  return db.prepare(`
    SELECT * FROM approvals WHERE id = ?
  `).get(id) as Approval | null;
}

/**
 * Get approval with details (includes user information)
 */
export function getApprovalWithDetails(id: number): any {
  const db = getDb();

  return db.prepare(`
    SELECT
      a.*,
      u_req.name as requested_by_name,
      u_req.email as requested_by_email,
      u_ass.name as assigned_to_name,
      u_ass.email as assigned_to_email,
      u_app.name as approved_by_name,
      u_app.email as approved_by_email
    FROM approvals a
    LEFT JOIN users u_req ON a.requested_by = u_req.id
    LEFT JOIN users u_ass ON a.assigned_to = u_ass.id
    LEFT JOIN users u_app ON a.approved_by = u_app.id
    WHERE a.id = ?
  `).get(id);
}

/**
 * Get all pending approvals for a user
 */
export function getPendingApprovalsForUser(userId: number): Approval[] {
  const db = getDb();

  return db.prepare(`
    SELECT * FROM approvals
    WHERE assigned_to = ?
      AND status = 'pending'
    ORDER BY
      CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      created_at ASC
  `).all(userId) as Approval[];
}

/**
 * Get pending approvals with details
 */
export function getPendingApprovalsWithDetails(userId?: number): any[] {
  const db = getDb();

  let query = `
    SELECT
      a.*,
      u_req.name as requested_by_name,
      u_req.email as requested_by_email,
      u_ass.name as assigned_to_name,
      u_ass.email as assigned_to_email
    FROM approvals a
    LEFT JOIN users u_req ON a.requested_by = u_req.id
    LEFT JOIN users u_ass ON a.assigned_to = u_ass.id
    WHERE a.status = 'pending'
  `;

  if (userId) {
    query += ` AND a.assigned_to = ?`;
  }

  query += `
    ORDER BY
      CASE a.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      a.created_at ASC
  `;

  return userId
    ? db.prepare(query).all(userId)
    : db.prepare(query).all();
}

/**
 * Get approvals by entity
 */
export function getApprovalsByEntity(entityType: string, entityId: number): Approval[] {
  const db = getDb();

  return db.prepare(`
    SELECT * FROM approvals
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `).all(entityType, entityId) as Approval[];
}

/**
 * Update approval status
 */
export function updateApprovalStatus(
  id: number,
  status: 'approved' | 'rejected' | 'cancelled' | 'timeout',
  approvedBy: number,
  comments?: string,
  rejectionReason?: string
): void {
  const db = getDb();

  db.prepare(`
    UPDATE approvals
    SET status = ?,
        approved_by = ?,
        approved_at = CURRENT_TIMESTAMP,
        rejection_reason = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, approvedBy, rejectionReason || null, id);

  // Record in history
  createApprovalHistory({
    approval_id: id,
    action: status,
    performed_by: approvedBy,
    new_status: status,
    comment: comments || rejectionReason || undefined
  });
}

/**
 * Update approval - general update
 */
export function updateApproval(approval: Partial<Approval> & { id: number }): void {
  const db = getDb();

  const fields: string[] = [];
  const values: any[] = [];

  if (approval.assigned_to !== undefined) {
    fields.push('assigned_to = ?');
    values.push(approval.assigned_to);
  }
  if (approval.status !== undefined) {
    fields.push('status = ?');
    values.push(approval.status);
  }
  if (approval.priority !== undefined) {
    fields.push('priority = ?');
    values.push(approval.priority);
  }
  if (approval.due_date !== undefined) {
    fields.push('due_date = ?');
    values.push(approval.due_date);
  }
  if (approval.escalation_level !== undefined) {
    fields.push('escalation_level = ?');
    values.push(approval.escalation_level);
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(approval.id);

  if (fields.length > 1) {
    db.prepare(`
      UPDATE approvals
      SET ${fields.join(', ')}
      WHERE id = ?
    `).run(...values);
  }
}

/**
 * Delegate approval to another user
 */
export function delegateApproval(
  id: number,
  fromUserId: number,
  toUserId: number,
  reason?: string
): void {
  const db = getDb();

  db.prepare(`
    UPDATE approvals
    SET assigned_to = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND assigned_to = ?
  `).run(toUserId, id, fromUserId);

  // Record delegation in history
  createApprovalHistory({
    approval_id: id,
    action: 'delegated',
    performed_by: fromUserId,
    comment: reason || undefined,
    metadata: JSON.stringify({
      delegated_from: fromUserId,
      delegated_to: toUserId
    })
  });
}

/**
 * Create approval history entry
 */
export function createApprovalHistory(history: CreateApprovalHistory): void {
  const db = getDb();

  db.prepare(`
    INSERT INTO approval_history (
      approval_id, action, performed_by, previous_status,
      new_status, comment, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    history.approval_id,
    history.action,
    history.performed_by || null,
    history.previous_status || null,
    history.new_status || null,
    history.comment || null,
    history.metadata || null
  );
}

/**
 * Get approval history
 */
export function getApprovalHistory(approvalId: number): ApprovalHistory[] {
  const db = getDb();

  return db.prepare(`
    SELECT
      ah.*,
      u.name as performed_by_name,
      u.email as performed_by_email
    FROM approval_history ah
    LEFT JOIN users u ON ah.performed_by = u.id
    WHERE ah.approval_id = ?
    ORDER BY ah.created_at DESC
  `).all(approvalId) as ApprovalHistory[];
}

/**
 * Create approval token for link-based approval
 */
export function createApprovalToken(approvalId: number, token: string, expiresAt: Date): number {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO approval_tokens (approval_id, token, expires_at)
    VALUES (?, ?, ?)
  `).run(approvalId, token, expiresAt.toISOString());

  return result.lastInsertRowid as number;
}

/**
 * Get approval by token
 */
export function getApprovalByToken(token: string): any | null {
  const db = getDb();

  return db.prepare(`
    SELECT
      a.*,
      at.token,
      at.expires_at as token_expires_at,
      at.used_at as token_used_at,
      u_req.name as requested_by_name,
      u_req.email as requested_by_email
    FROM approval_tokens at
    JOIN approvals a ON at.approval_id = a.id
    LEFT JOIN users u_req ON a.requested_by = u_req.id
    WHERE at.token = ?
      AND at.used_at IS NULL
      AND at.expires_at > datetime('now')
  `).get(token);
}

/**
 * Mark token as used
 */
export function markTokenAsUsed(token: string, ipAddress?: string, userAgent?: string): void {
  const db = getDb();

  db.prepare(`
    UPDATE approval_tokens
    SET used_at = CURRENT_TIMESTAMP,
        ip_address = ?,
        user_agent = ?
    WHERE token = ?
  `).run(ipAddress || null, userAgent || null, token);
}

/**
 * Get expired approvals that haven't been auto-approved
 */
export function getExpiredApprovalsForAutoApprove(): Approval[] {
  const db = getDb();

  return db.prepare(`
    SELECT * FROM approvals
    WHERE status = 'pending'
      AND auto_approve_after IS NOT NULL
      AND auto_approve_after < datetime('now')
  `).all() as Approval[];
}

/**
 * Get approvals approaching timeout
 */
export function getApprovalsApproachingTimeout(hoursBeforeTimeout: number = 2): Approval[] {
  const db = getDb();

  return db.prepare(`
    SELECT * FROM approvals
    WHERE status = 'pending'
      AND due_date IS NOT NULL
      AND due_date > datetime('now')
      AND due_date < datetime('now', '+${hoursBeforeTimeout} hours')
      AND escalation_level = 0
  `).all() as Approval[];
}

/**
 * Escalate approval
 */
export function escalateApproval(id: number, newAssignedTo: number, reason: string): void {
  const db = getDb();

  const approval = getApprovalById(id);
  if (!approval) return;

  db.prepare(`
    UPDATE approvals
    SET assigned_to = ?,
        escalation_level = escalation_level + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newAssignedTo, id);

  // Record escalation
  createApprovalHistory({
    approval_id: id,
    action: 'escalated',
    performed_by: undefined,
    comment: reason,
    metadata: JSON.stringify({
      previous_assignee: approval.assigned_to,
      new_assignee: newAssignedTo,
      escalation_level: (approval.escalation_level || 0) + 1
    })
  });
}

/**
 * Get approval statistics for a user
 */
export function getApprovalStatsForUser(userId: number, days: number = 30): any {
  const db = getDb();

  return db.prepare(`
    SELECT
      COUNT(*) as total_approvals,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
      COUNT(CASE WHEN status = 'timeout' THEN 1 END) as timeout,
      AVG(
        CASE WHEN approved_at IS NOT NULL
        THEN (julianday(approved_at) - julianday(created_at)) * 24 * 60
        END
      ) as avg_approval_time_minutes
    FROM approvals
    WHERE assigned_to = ?
      AND created_at >= datetime('now', '-${days} days')
  `).get(userId);
}

/**
 * Get all approvals with pagination
 */
export function getApprovalsWithPagination(
  page: number = 1,
  limit: number = 20,
  filters?: {
    status?: string;
    priority?: string;
    assignedTo?: number;
    requestedBy?: number;
    entityType?: string;
  }
): { approvals: any[]; total: number; page: number; totalPages: number } {
  const db = getDb();
  const offset = (page - 1) * limit;

  let whereConditions: string[] = [];
  let params: any[] = [];

  if (filters?.status) {
    whereConditions.push('a.status = ?');
    params.push(filters.status);
  }
  if (filters?.priority) {
    whereConditions.push('a.priority = ?');
    params.push(filters.priority);
  }
  if (filters?.assignedTo) {
    whereConditions.push('a.assigned_to = ?');
    params.push(filters.assignedTo);
  }
  if (filters?.requestedBy) {
    whereConditions.push('a.requested_by = ?');
    params.push(filters.requestedBy);
  }
  if (filters?.entityType) {
    whereConditions.push('a.entity_type = ?');
    params.push(filters.entityType);
  }

  const whereClause = whereConditions.length > 0
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  // Get total count
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM approvals a ${whereClause}
  `).get(...params) as { count: number };

  // Get approvals with details
  const approvals = db.prepare(`
    SELECT
      a.*,
      u_req.name as requested_by_name,
      u_req.email as requested_by_email,
      u_ass.name as assigned_to_name,
      u_ass.email as assigned_to_email,
      u_app.name as approved_by_name,
      u_app.email as approved_by_email
    FROM approvals a
    LEFT JOIN users u_req ON a.requested_by = u_req.id
    LEFT JOIN users u_ass ON a.assigned_to = u_ass.id
    LEFT JOIN users u_app ON a.approved_by = u_app.id
    ${whereClause}
    ORDER BY
      CASE a.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return {
    approvals,
    total: total.count,
    page,
    totalPages: Math.ceil(total.count / limit)
  };
}

/**
 * Clean up expired tokens
 */
export function cleanupExpiredTokens(): number {
  const db = getDb();

  const result = db.prepare(`
    DELETE FROM approval_tokens
    WHERE expires_at < datetime('now')
  `).run();

  return result.changes;
}
