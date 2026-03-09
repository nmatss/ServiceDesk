/**
 * Database queries for the Approval System
 * Complete CRUD operations and specialized queries
 */

import { executeQuery, executeQueryOne, executeRun, sqlNow, sqlDateSub, sqlDateDiff } from './adapter';
import { getDatabaseType } from './config';
import { Approval, ApprovalHistory, CreateApproval, CreateApprovalHistory } from '../types/database';

/**
 * Create a new approval request
 */
export async function createApproval(approval: Omit<CreateApproval, 'notification_sent' | 'escalation_level'>): Promise<Approval> {
  const result = await executeRun(`
    INSERT INTO approvals (
      entity_type, entity_id, approval_type, requested_by, assigned_to,
      assigned_group, status, priority, reason, approval_data,
      due_date, auto_approve_after
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
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
  ]);

  return (await getApprovalById(result.lastInsertRowid as number))!;
}

/**
 * Get approval by ID
 */
export async function getApprovalById(id: number): Promise<Approval | null> {
  const result = await executeQueryOne<Approval>(`
    SELECT * FROM approvals WHERE id = ?
  `, [id]);

  return result || null;
}

/**
 * Get approval with details (includes user information)
 */
export async function getApprovalWithDetails(id: number): Promise<any> {
  return await executeQueryOne(`
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
  `, [id]);
}

/**
 * Get all pending approvals for a user
 */
export async function getPendingApprovalsForUser(userId: number): Promise<Approval[]> {
  return await executeQuery<Approval>(`
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
  `, [userId]);
}

/**
 * Get pending approvals with details
 */
export async function getPendingApprovalsWithDetails(userId?: number): Promise<any[]> {
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

  const params: any[] = [];

  if (userId) {
    query += ` AND a.assigned_to = ?`;
    params.push(userId);
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

  return await executeQuery(query, params);
}

/**
 * Get approvals by entity
 */
export async function getApprovalsByEntity(entityType: string, entityId: number): Promise<Approval[]> {
  return await executeQuery<Approval>(`
    SELECT * FROM approvals
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `, [entityType, entityId]);
}

/**
 * Update approval status
 */
export async function updateApprovalStatus(
  id: number,
  status: 'approved' | 'rejected' | 'cancelled' | 'timeout',
  approvedBy: number,
  comments?: string,
  rejectionReason?: string
): Promise<void> {
  await executeRun(`
    UPDATE approvals
    SET status = ?,
        approved_by = ?,
        approved_at = CURRENT_TIMESTAMP,
        rejection_reason = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [status, approvedBy, rejectionReason || null, id]);

  // Record in history
  await createApprovalHistory({
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
export async function updateApproval(approval: Partial<Approval> & { id: number }): Promise<void> {
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
    await executeRun(`
      UPDATE approvals
      SET ${fields.join(', ')}
      WHERE id = ?
    `, values);
  }
}

/**
 * Delegate approval to another user
 */
export async function delegateApproval(
  id: number,
  fromUserId: number,
  toUserId: number,
  reason?: string
): Promise<void> {
  await executeRun(`
    UPDATE approvals
    SET assigned_to = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND assigned_to = ?
  `, [toUserId, id, fromUserId]);

  // Record delegation in history
  await createApprovalHistory({
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
export async function createApprovalHistory(history: CreateApprovalHistory): Promise<void> {
  await executeRun(`
    INSERT INTO approval_history (
      approval_id, action, performed_by, previous_status,
      new_status, comment, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    history.approval_id,
    history.action,
    history.performed_by || null,
    history.previous_status || null,
    history.new_status || null,
    history.comment || null,
    history.metadata || null
  ]);
}

/**
 * Get approval history
 */
export async function getApprovalHistory(approvalId: number): Promise<ApprovalHistory[]> {
  return await executeQuery<ApprovalHistory>(`
    SELECT
      ah.*,
      u.name as performed_by_name,
      u.email as performed_by_email
    FROM approval_history ah
    LEFT JOIN users u ON ah.performed_by = u.id
    WHERE ah.approval_id = ?
    ORDER BY ah.created_at DESC
  `, [approvalId]);
}

/**
 * Create approval token for link-based approval
 */
export async function createApprovalToken(approvalId: number, token: string, expiresAt: Date): Promise<number> {
  const result = await executeRun(`
    INSERT INTO approval_tokens (approval_id, token, expires_at)
    VALUES (?, ?, ?)
  `, [approvalId, token, expiresAt.toISOString()]);

  return result.lastInsertRowid as number;
}

/**
 * Get approval by token
 */
export async function getApprovalByToken(token: string): Promise<any | null> {
  const result = await executeQueryOne(`
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
      AND at.expires_at > ${sqlNow()}
  `, [token]);

  return result || null;
}

/**
 * Mark token as used
 */
export async function markTokenAsUsed(token: string, ipAddress?: string, userAgent?: string): Promise<void> {
  await executeRun(`
    UPDATE approval_tokens
    SET used_at = CURRENT_TIMESTAMP,
        ip_address = ?,
        user_agent = ?
    WHERE token = ?
  `, [ipAddress || null, userAgent || null, token]);
}

/**
 * Get expired approvals that haven't been auto-approved
 */
export async function getExpiredApprovalsForAutoApprove(): Promise<Approval[]> {
  return await executeQuery<Approval>(`
    SELECT * FROM approvals
    WHERE status = 'pending'
      AND auto_approve_after IS NOT NULL
      AND auto_approve_after < ${sqlNow()}
  `);
}

/**
 * Get approvals approaching timeout
 */
export async function getApprovalsApproachingTimeout(hoursBeforeTimeout: number = 2): Promise<Approval[]> {
  const dbType = getDatabaseType();
  const addHoursExpr = dbType === 'postgresql'
    ? `due_date < NOW() + INTERVAL '${hoursBeforeTimeout} hours'`
    : `due_date < datetime('now', '+${hoursBeforeTimeout} hours')`;

  return await executeQuery<Approval>(`
    SELECT * FROM approvals
    WHERE status = 'pending'
      AND due_date IS NOT NULL
      AND due_date > ${sqlNow()}
      AND ${addHoursExpr}
      AND escalation_level = 0
  `);
}

/**
 * Escalate approval
 */
export async function escalateApproval(id: number, newAssignedTo: number, reason: string): Promise<void> {
  const approval = await getApprovalById(id);
  if (!approval) return;

  await executeRun(`
    UPDATE approvals
    SET assigned_to = ?,
        escalation_level = escalation_level + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [newAssignedTo, id]);

  // Record escalation
  await createApprovalHistory({
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
export async function getApprovalStatsForUser(userId: number, days: number = 30): Promise<any> {
  return await executeQueryOne(`
    SELECT
      COUNT(*) as total_approvals,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
      COUNT(CASE WHEN status = 'timeout' THEN 1 END) as timeout,
      AVG(
        CASE WHEN approved_at IS NOT NULL
        THEN ${sqlDateDiff('approved_at', 'created_at')} * 24 * 60
        END
      ) as avg_approval_time_minutes
    FROM approvals
    WHERE assigned_to = ?
      AND created_at >= ${sqlDateSub(days)}
  `, [userId]);
}

/**
 * Get all approvals with pagination
 */
export async function getApprovalsWithPagination(
  page: number = 1,
  limit: number = 20,
  filters?: {
    status?: string;
    priority?: string;
    assignedTo?: number;
    requestedBy?: number;
    entityType?: string;
  }
): Promise<{ approvals: any[]; total: number; page: number; totalPages: number }> {
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
  const total = await executeQueryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM approvals a ${whereClause}
  `, params);

  // Get approvals with details
  const approvals = await executeQuery(`
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
  `, [...params, limit, offset]);

  const totalCount = total?.count ?? 0;

  return {
    approvals,
    total: totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit)
  };
}

/**
 * Clean up expired tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await executeRun(`
    DELETE FROM approval_tokens
    WHERE expires_at < ${sqlNow()}
  `);

  return result.changes;
}
