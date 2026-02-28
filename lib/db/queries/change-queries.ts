/**
 * Change Management Queries
 * ITIL 4 Compliant - Adapter Pattern
 */

import { executeQuery, executeQueryOne, executeRun, executeTransaction, sqlDateDiff } from '../adapter';
import type {
  ChangeType,
  ChangeRequest,
  ChangeRequestApproval,
  ChangeCalendar,
  ChangeRequestWithDetails,
  CreateChangeType,
  CreateChangeRequest,
  CreateChangeRequestApproval,
  CreateChangeCalendar,
  UpdateChangeRequest,
  User,
} from '../../types/database';

// ============================================
// CHANGE NUMBER GENERATOR
// ============================================

/**
 * Generate change request number in format CHG-YYYY-XXXXX
 */
export async function generateChangeNumber(organizationId: number): Promise<string> {
  return executeTransaction(async (db) => {
    const year = new Date().getFullYear();
    const prefix = `CHG-${year}-`;

    const result = await db.get<{ change_number: string }>(
      `SELECT change_number FROM change_requests
       WHERE organization_id = ? AND change_number LIKE ?
       ORDER BY id DESC LIMIT 1`,
      [organizationId, `${prefix}%`]
    );

    let nextNumber = 1;
    if (result?.change_number) {
      const currentNumber = parseInt(result.change_number.replace(prefix, ''), 10);
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
  });
}

// ============================================
// CHANGE REQUEST QUERIES
// ============================================

/**
 * Create a new change request
 */
export async function createChangeRequest(
  organizationId: number,
  requesterId: number,
  input: CreateChangeRequest
): Promise<ChangeRequest> {
  const changeNumber = await generateChangeNumber(organizationId);

  // Note: tenant_id exists in schema but not in TypeScript interface
  const inputAny = input as any;

  const result = await executeRun(
    `INSERT INTO change_requests (
      organization_id, tenant_id, change_number, title, description,
      change_type_id, category, priority, risk_level,
      risk_assessment, impact_assessment, reason_for_change,
      business_justification, implementation_plan, backout_plan,
      test_plan, communication_plan,
      requested_start_date, requested_end_date,
      requester_id, owner_id, implementer_id,
      approval_status, status, pir_required, affected_cis
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      inputAny.tenant_id || null,
      changeNumber,
      input.title,
      input.description,
      input.change_type_id || null,
      input.category || 'normal',
      input.priority || 'medium',
      input.risk_level || null,
      input.risk_assessment || null,
      input.impact_assessment || null,
      input.reason_for_change || null,
      input.business_justification || null,
      input.implementation_plan || null,
      input.backout_plan || null,
      input.test_plan || null,
      input.communication_plan || null,
      input.requested_start_date || null,
      input.requested_end_date || null,
      requesterId,
      input.owner_id || null,
      input.implementer_id || null,
      input.approval_status || 'pending',
      input.status || 'draft',
      input.pir_required !== false ? 1 : 0,
      input.affected_cis ? JSON.stringify(input.affected_cis) : null,
    ]
  );

  const change = await getChangeRequestById(organizationId, result.lastInsertRowid!);

  return change!;
}

/**
 * Get change request by ID with related data
 */
export async function getChangeRequestById(
  organizationId: number,
  id: number
): Promise<ChangeRequestWithDetails | null> {
  const change = await executeQueryOne<ChangeRequest>(
    `SELECT * FROM change_requests WHERE id = ? AND organization_id = ?`,
    [id, organizationId]
  );

  if (!change) return null;

  // Fetch relations
  const [changeType, requester, owner, implementer] = await Promise.all([
    change.change_type_id
      ? executeQueryOne<ChangeType>(
          `SELECT * FROM change_types WHERE id = ?`,
          [change.change_type_id]
        )
      : null,
    executeQueryOne<Pick<User, 'id' | 'name' | 'email' | 'avatar_url'>>(
      `SELECT id, name, email, avatar_url FROM users WHERE id = ?`,
      [change.requester_id]
    ),
    change.owner_id
      ? executeQueryOne<Pick<User, 'id' | 'name' | 'email' | 'avatar_url'>>(
          `SELECT id, name, email, avatar_url FROM users WHERE id = ?`,
          [change.owner_id]
        )
      : null,
    change.implementer_id
      ? executeQueryOne<Pick<User, 'id' | 'name' | 'email' | 'avatar_url'>>(
          `SELECT id, name, email, avatar_url FROM users WHERE id = ?`,
          [change.implementer_id]
        )
      : null,
  ]);

  return {
    ...change,
    change_type: changeType || undefined,
    requester: (requester as User | undefined) || undefined,
    owner: (owner as User | undefined) || undefined,
    implementer: (implementer as User | undefined) || undefined,
  };
}

/**
 * List change requests with filters and pagination
 */
export async function listChangeRequests(
  organizationId: number,
  filters: {
    status?: string | string[];
    priority?: string | string[];
    category?: string | string[];
    change_type_id?: number;
    requester_id?: number;
    owner_id?: number;
    approval_status?: string;
    search?: string;
  } = {},
  pagination: { page: number; limit: number } = { page: 1, limit: 20 }
): Promise<{ data: ChangeRequestWithDetails[]; total: number; page: number; limit: number; totalPages: number }> {
  const conditions: string[] = ['organization_id = ?'];
  const params: unknown[] = [organizationId];

  // Apply filters
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      if (filters.status.length > 0) {
        conditions.push(`status IN (${filters.status.map(() => '?').join(', ')})`);
        params.push(...filters.status);
      }
    } else {
      conditions.push('status = ?');
      params.push(filters.status);
    }
  }

  if (filters.priority) {
    if (Array.isArray(filters.priority)) {
      if (filters.priority.length > 0) {
        conditions.push(`priority IN (${filters.priority.map(() => '?').join(', ')})`);
        params.push(...filters.priority);
      }
    } else {
      conditions.push('priority = ?');
      params.push(filters.priority);
    }
  }

  if (filters.category) {
    if (Array.isArray(filters.category)) {
      if (filters.category.length > 0) {
        conditions.push(`category IN (${filters.category.map(() => '?').join(', ')})`);
        params.push(...filters.category);
      }
    } else {
      conditions.push('category = ?');
      params.push(filters.category);
    }
  }

  if (filters.change_type_id) {
    conditions.push('change_type_id = ?');
    params.push(filters.change_type_id);
  }

  if (filters.requester_id) {
    conditions.push('requester_id = ?');
    params.push(filters.requester_id);
  }

  if (filters.owner_id) {
    conditions.push('owner_id = ?');
    params.push(filters.owner_id);
  }

  if (filters.approval_status) {
    conditions.push('approval_status = ?');
    params.push(filters.approval_status);
  }

  if (filters.search) {
    conditions.push('(title LIKE ? OR description LIKE ? OR change_number LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.join(' AND ');

  // Count total
  const countResult = await executeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM change_requests WHERE ${whereClause}`,
    params
  );
  const total = countResult?.total || 0;

  // Calculate pagination
  const offset = (pagination.page - 1) * pagination.limit;
  const totalPages = Math.ceil(total / pagination.limit);

  // Fetch change requests with JOINs to avoid N+1
  const changesRaw = await executeQuery<any>(
    `SELECT cr.*,
       ct.id as change_type__id, ct.name as change_type__name, ct.description as change_type__description,
       ct.requires_cab_approval as change_type__requires_cab_approval, ct.default_risk_level as change_type__default_risk_level,
       ct.lead_time_days as change_type__lead_time_days, ct.is_active as change_type__is_active,
       req.id as requester__id, req.name as requester__name, req.email as requester__email, req.avatar_url as requester__avatar_url,
       own.id as owner__id, own.name as owner__name, own.email as owner__email, own.avatar_url as owner__avatar_url,
       imp.id as implementer__id, imp.name as implementer__name, imp.email as implementer__email, imp.avatar_url as implementer__avatar_url
     FROM change_requests cr
     LEFT JOIN change_types ct ON cr.change_type_id = ct.id
     LEFT JOIN users req ON cr.requester_id = req.id
     LEFT JOIN users own ON cr.owner_id = own.id
     LEFT JOIN users imp ON cr.implementer_id = imp.id
     WHERE ${whereClause}
     ORDER BY cr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pagination.limit, offset]
  );

  // Map flat JOIN results to nested ChangeRequestWithDetails shape
  const changesWithDetails: ChangeRequestWithDetails[] = changesRaw.map((row: any) => {
    const { change_type__id, change_type__name, change_type__description,
            change_type__requires_cab_approval, change_type__default_risk_level,
            change_type__lead_time_days, change_type__is_active,
            requester__id, requester__name, requester__email, requester__avatar_url,
            owner__id, owner__name, owner__email, owner__avatar_url,
            implementer__id, implementer__name, implementer__email, implementer__avatar_url,
            ...changeFields } = row;

    return {
      ...changeFields,
      change_type: change_type__id ? {
        id: change_type__id, name: change_type__name, description: change_type__description,
        requires_cab_approval: change_type__requires_cab_approval,
        default_risk_level: change_type__default_risk_level,
        lead_time_days: change_type__lead_time_days, is_active: change_type__is_active,
      } : undefined,
      requester: requester__id ? { id: requester__id, name: requester__name, email: requester__email, avatar_url: requester__avatar_url } as User : undefined,
      owner: owner__id ? { id: owner__id, name: owner__name, email: owner__email, avatar_url: owner__avatar_url } as User : undefined,
      implementer: implementer__id ? { id: implementer__id, name: implementer__name, email: implementer__email, avatar_url: implementer__avatar_url } as User : undefined,
    } as ChangeRequestWithDetails;
  });

  return {
    data: changesWithDetails,
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages,
  };
}

/**
 * Update a change request
 */
export async function updateChangeRequest(
  organizationId: number,
  id: number,
  input: UpdateChangeRequest
): Promise<ChangeRequestWithDetails | null> {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.title !== undefined) {
    updates.push('title = ?');
    params.push(input.title);
  }

  if (input.description !== undefined) {
    updates.push('description = ?');
    params.push(input.description);
  }

  if (input.change_type_id !== undefined) {
    updates.push('change_type_id = ?');
    params.push(input.change_type_id);
  }

  if (input.category !== undefined) {
    updates.push('category = ?');
    params.push(input.category);
  }

  if (input.priority !== undefined) {
    updates.push('priority = ?');
    params.push(input.priority);
  }

  if (input.risk_level !== undefined) {
    updates.push('risk_level = ?');
    params.push(input.risk_level);
  }

  if (input.risk_assessment !== undefined) {
    updates.push('risk_assessment = ?');
    params.push(input.risk_assessment);
  }

  if (input.impact_assessment !== undefined) {
    updates.push('impact_assessment = ?');
    params.push(input.impact_assessment);
  }

  if (input.reason_for_change !== undefined) {
    updates.push('reason_for_change = ?');
    params.push(input.reason_for_change);
  }

  if (input.business_justification !== undefined) {
    updates.push('business_justification = ?');
    params.push(input.business_justification);
  }

  if (input.implementation_plan !== undefined) {
    updates.push('implementation_plan = ?');
    params.push(input.implementation_plan);
  }

  if (input.backout_plan !== undefined) {
    updates.push('backout_plan = ?');
    params.push(input.backout_plan);
  }

  if (input.test_plan !== undefined) {
    updates.push('test_plan = ?');
    params.push(input.test_plan);
  }

  if (input.communication_plan !== undefined) {
    updates.push('communication_plan = ?');
    params.push(input.communication_plan);
  }

  if (input.requested_start_date !== undefined) {
    updates.push('requested_start_date = ?');
    params.push(input.requested_start_date);
  }

  if (input.requested_end_date !== undefined) {
    updates.push('requested_end_date = ?');
    params.push(input.requested_end_date);
  }

  if (input.actual_start_date !== undefined) {
    updates.push('actual_start_date = ?');
    params.push(input.actual_start_date);
  }

  if (input.actual_end_date !== undefined) {
    updates.push('actual_end_date = ?');
    params.push(input.actual_end_date);
  }

  if (input.owner_id !== undefined) {
    updates.push('owner_id = ?');
    params.push(input.owner_id);
  }

  if (input.implementer_id !== undefined) {
    updates.push('implementer_id = ?');
    params.push(input.implementer_id);
  }

  if (input.status !== undefined) {
    updates.push('status = ?');
    params.push(input.status);
  }

  if (input.approval_status !== undefined) {
    updates.push('approval_status = ?');
    params.push(input.approval_status);
  }

  if (input.approval_notes !== undefined) {
    updates.push('approval_notes = ?');
    params.push(input.approval_notes);
  }

  if (input.pir_required !== undefined) {
    updates.push('pir_required = ?');
    params.push(input.pir_required ? 1 : 0);
  }

  if (input.pir_completed !== undefined) {
    updates.push('pir_completed = ?');
    params.push(input.pir_completed ? 1 : 0);
  }

  if (input.pir_notes !== undefined) {
    updates.push('pir_notes = ?');
    params.push(input.pir_notes);
  }

  if (input.pir_success_rating !== undefined) {
    updates.push('pir_success_rating = ?');
    params.push(input.pir_success_rating);
  }

  if (input.affected_cis !== undefined) {
    updates.push('affected_cis = ?');
    params.push(input.affected_cis ? JSON.stringify(input.affected_cis) : null);
  }

  if (updates.length === 0) {
    return getChangeRequestById(organizationId, id);
  }

  params.push(id, organizationId);

  await executeRun(
    `UPDATE change_requests SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
    params
  );

  return getChangeRequestById(organizationId, id);
}

/**
 * Delete a change request
 */
export async function deleteChangeRequest(
  organizationId: number,
  id: number
): Promise<boolean> {
  const result = await executeRun(
    `DELETE FROM change_requests WHERE id = ? AND organization_id = ?`,
    [id, organizationId]
  );
  return result.changes > 0;
}

/**
 * Submit change request for approval (draft -> submitted)
 */
export async function submitChangeRequest(
  organizationId: number,
  id: number,
  userId: number
): Promise<ChangeRequestWithDetails | null> {
  await executeRun(
    `UPDATE change_requests SET status = 'submitted', updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ? AND status = 'draft'`,
    [id, organizationId]
  );

  return getChangeRequestById(organizationId, id);
}

/**
 * Approve change request
 */
export async function approveChangeRequest(
  organizationId: number,
  id: number,
  userId: number,
  notes?: string
): Promise<ChangeRequestWithDetails | null> {
  await executeRun(
    `UPDATE change_requests
     SET approval_status = 'approved',
         approved_by = ?,
         approved_at = CURRENT_TIMESTAMP,
         approval_notes = ?,
         status = 'approved',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [userId, notes || null, id, organizationId]
  );

  return getChangeRequestById(organizationId, id);
}

/**
 * Reject change request
 */
export async function rejectChangeRequest(
  organizationId: number,
  id: number,
  userId: number,
  notes?: string
): Promise<ChangeRequestWithDetails | null> {
  await executeRun(
    `UPDATE change_requests
     SET approval_status = 'rejected',
         approved_by = ?,
         approved_at = CURRENT_TIMESTAMP,
         approval_notes = ?,
         status = 'rejected',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [userId, notes || null, id, organizationId]
  );

  return getChangeRequestById(organizationId, id);
}

// ============================================
// CHANGE TYPE QUERIES
// ============================================

/**
 * List all change types for an organization
 */
export async function listChangeTypes(
  organizationId: number
): Promise<ChangeType[]> {
  return executeQuery<ChangeType>(
    `SELECT * FROM change_types
     WHERE organization_id = ? AND is_active = 1
     ORDER BY name`,
    [organizationId]
  );
}

/**
 * Create a new change type
 */
export async function createChangeType(
  organizationId: number,
  input: CreateChangeType
): Promise<ChangeType> {
  // Note: Schema has color field but TypeScript interface doesn't
  const inputAny = input as any;

  const result = await executeRun(
    `INSERT INTO change_types (
      organization_id, name, description, color,
      requires_cab_approval, default_risk_level, lead_time_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      input.name,
      input.description || null,
      inputAny.color || null,
      input.requires_cab_approval ? 1 : 0,
      input.default_risk_level || null,
      input.lead_time_days || 0,
    ]
  );

  const changeType = await executeQueryOne<ChangeType>(
    `SELECT * FROM change_types WHERE id = ?`,
    [result.lastInsertRowid]
  );

  return changeType!;
}

// ============================================
// CHANGE APPROVAL QUERIES (CAB)
// ============================================

/**
 * Add a CAB approval/vote for a change request
 */
export async function addChangeApproval(
  organizationId: number,
  changeRequestId: number,
  cabMemberId: number,
  vote: 'approve' | 'reject' | 'defer' | 'abstain',
  comments?: string
): Promise<ChangeRequestApproval> {
  // Verify the change request belongs to the organization
  const cr = await executeQueryOne<{ id: number }>(
    `SELECT id FROM change_requests WHERE id = ? AND organization_id = ?`,
    [changeRequestId, organizationId]
  );
  if (!cr) {
    throw new Error('Change request not found or access denied');
  }

  const result = await executeRun(
    `INSERT INTO change_request_approvals (
      change_request_id, cab_member_id, vote, voted_at, comments
    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)`,
    [changeRequestId, cabMemberId, vote, comments || null]
  );

  const approval = await executeQueryOne<ChangeRequestApproval>(
    `SELECT * FROM change_request_approvals WHERE id = ?`,
    [result.lastInsertRowid]
  );

  return approval!;
}

/**
 * List all approvals for a change request
 */
export async function listChangeApprovals(
  organizationId: number,
  changeRequestId: number
): Promise<ChangeRequestApproval[]> {
  return executeQuery<ChangeRequestApproval>(
    `SELECT ca.* FROM change_request_approvals ca
     JOIN change_requests cr ON ca.change_request_id = cr.id
     WHERE cr.organization_id = ? AND ca.change_request_id = ?
     ORDER BY ca.voted_at DESC`,
    [organizationId, changeRequestId]
  );
}

// ============================================
// CHANGE TASK QUERIES
// ============================================

/**
 * Change Task interface (not in database.ts yet)
 */
interface ChangeTask {
  id: number;
  change_request_id: number;
  title: string;
  description?: string;
  assignee_id?: number;
  assigned_team_id?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  task_order: number;
  estimated_minutes?: number;
  actual_minutes?: number;
  started_at?: string;
  completed_at?: string;
  completion_notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create a change task
 */
export async function createChangeTask(
  changeRequestId: number,
  input: {
    title: string;
    description?: string;
    assignee_id?: number;
    assigned_team_id?: number;
    task_order?: number;
    estimated_minutes?: number;
  }
): Promise<ChangeTask> {
  const result = await executeRun(
    `INSERT INTO change_tasks (
      change_request_id, title, description, assignee_id,
      assigned_team_id, task_order, estimated_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      changeRequestId,
      input.title,
      input.description || null,
      input.assignee_id || null,
      input.assigned_team_id || null,
      input.task_order || 0,
      input.estimated_minutes || null,
    ]
  );

  const task = await executeQueryOne<ChangeTask>(
    `SELECT * FROM change_tasks WHERE id = ?`,
    [result.lastInsertRowid]
  );

  return task!;
}

/**
 * List all tasks for a change request
 */
export async function listChangeTasks(
  organizationId: number,
  changeRequestId: number
): Promise<ChangeTask[]> {
  return executeQuery<ChangeTask>(
    `SELECT ct.* FROM change_tasks ct
     JOIN change_requests cr ON ct.change_request_id = cr.id
     WHERE cr.organization_id = ? AND ct.change_request_id = ?
     ORDER BY ct.task_order, ct.created_at`,
    [organizationId, changeRequestId]
  );
}

/**
 * Update a change task
 */
export async function updateChangeTask(
  organizationId: number,
  taskId: number,
  input: {
    title?: string;
    description?: string;
    assignee_id?: number;
    assigned_team_id?: number;
    status?: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
    task_order?: number;
    estimated_minutes?: number;
    actual_minutes?: number;
    started_at?: string;
    completed_at?: string;
    completion_notes?: string;
  }
): Promise<ChangeTask | null> {
  // Verify the task belongs to a change request in the organization
  const task = await executeQueryOne<ChangeTask>(
    `SELECT ct.* FROM change_tasks ct
     JOIN change_requests cr ON ct.change_request_id = cr.id
     WHERE ct.id = ? AND cr.organization_id = ?`,
    [taskId, organizationId]
  );
  if (!task) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.title !== undefined) {
    updates.push('title = ?');
    params.push(input.title);
  }

  if (input.description !== undefined) {
    updates.push('description = ?');
    params.push(input.description);
  }

  if (input.assignee_id !== undefined) {
    updates.push('assignee_id = ?');
    params.push(input.assignee_id);
  }

  if (input.assigned_team_id !== undefined) {
    updates.push('assigned_team_id = ?');
    params.push(input.assigned_team_id);
  }

  if (input.status !== undefined) {
    updates.push('status = ?');
    params.push(input.status);

    // Auto-set timestamps based on status
    if (input.status === 'in_progress' && !input.started_at) {
      updates.push('started_at = CURRENT_TIMESTAMP');
    }
    if (input.status === 'completed' && !input.completed_at) {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }
  }

  if (input.task_order !== undefined) {
    updates.push('task_order = ?');
    params.push(input.task_order);
  }

  if (input.estimated_minutes !== undefined) {
    updates.push('estimated_minutes = ?');
    params.push(input.estimated_minutes);
  }

  if (input.actual_minutes !== undefined) {
    updates.push('actual_minutes = ?');
    params.push(input.actual_minutes);
  }

  if (input.started_at !== undefined) {
    updates.push('started_at = ?');
    params.push(input.started_at);
  }

  if (input.completed_at !== undefined) {
    updates.push('completed_at = ?');
    params.push(input.completed_at);
  }

  if (input.completion_notes !== undefined) {
    updates.push('completion_notes = ?');
    params.push(input.completion_notes);
  }

  if (updates.length === 0) {
    return task;
  }

  params.push(taskId);

  await executeRun(
    `UPDATE change_tasks SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  const result = await executeQueryOne<ChangeTask>(
    `SELECT * FROM change_tasks WHERE id = ?`,
    [taskId]
  );
  return result ?? null;
}

// ============================================
// CHANGE CALENDAR QUERIES
// ============================================

/**
 * List change calendar events (blackout periods, freeze windows, etc.)
 */
export async function listChangeCalendarEvents(
  organizationId: number,
  startDate?: string,
  endDate?: string
): Promise<ChangeCalendar[]> {
  const conditions: string[] = ['organization_id = ?'];
  const params: unknown[] = [organizationId];

  if (startDate) {
    conditions.push('end_date >= ?');
    params.push(startDate);
  }

  if (endDate) {
    conditions.push('start_date <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.join(' AND ');

  return executeQuery<ChangeCalendar>(
    `SELECT * FROM change_calendar
     WHERE ${whereClause}
     ORDER BY start_date`,
    params
  );
}

/**
 * Create a change calendar event
 */
export async function createChangeCalendarEvent(
  organizationId: number,
  userId: number,
  input: CreateChangeCalendar
): Promise<ChangeCalendar> {
  const result = await executeRun(
    `INSERT INTO change_calendar (
      organization_id, name, description, start_date, end_date,
      type, severity, affected_environments, affected_change_types,
      is_recurring, recurrence_pattern, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      input.name,
      input.description || null,
      input.start_date,
      input.end_date,
      input.type || 'blackout',
      input.severity || 'soft',
      input.affected_environments || null,
      input.affected_change_types || null,
      input.is_recurring ? 1 : 0,
      input.recurrence_pattern || null,
      userId,
    ]
  );

  const event = await executeQueryOne<ChangeCalendar>(
    `SELECT * FROM change_calendar WHERE id = ?`,
    [result.lastInsertRowid]
  );

  return event!;
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get change statistics for an organization
 */
export async function getChangeStatistics(
  organizationId: number
): Promise<{
  total: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_type: Array<{ type_id: number; type_name: string; count: number }>;
  average_completion_time_hours: number | null;
  success_rate: number;
  pending_approvals: number;
}> {
  const [
    total,
    byStatus,
    byCategory,
    byType,
    avgCompletionTime,
    totalCompleted,
    totalSuccessful,
    pendingApprovals,
  ] = await Promise.all([
    // Total changes
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM change_requests WHERE organization_id = ?`,
      [organizationId]
    ),

    // By status
    executeQuery<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM change_requests
       WHERE organization_id = ? GROUP BY status`,
      [organizationId]
    ),

    // By category
    executeQuery<{ category: string; count: number }>(
      `SELECT category, COUNT(*) as count FROM change_requests
       WHERE organization_id = ? GROUP BY category`,
      [organizationId]
    ),

    // By type
    executeQuery<{ type_id: number; type_name: string; count: number }>(
      `SELECT cr.change_type_id as type_id, ct.name as type_name, COUNT(*) as count
       FROM change_requests cr
       LEFT JOIN change_types ct ON cr.change_type_id = ct.id
       WHERE cr.organization_id = ? AND cr.change_type_id IS NOT NULL
       GROUP BY cr.change_type_id`,
      [organizationId]
    ),

    // Average completion time (in hours)
    executeQueryOne<{ avg: number | null }>(
      `SELECT AVG(
         ${sqlDateDiff('actual_end_date', 'actual_start_date')} * 24
       ) as avg
       FROM change_requests
       WHERE organization_id = ?
       AND actual_start_date IS NOT NULL
       AND actual_end_date IS NOT NULL`,
      [organizationId]
    ),

    // Total completed changes
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM change_requests
       WHERE organization_id = ? AND status = 'completed'`,
      [organizationId]
    ),

    // Successful changes (PIR rating >= 3 or completed without issues)
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM change_requests
       WHERE organization_id = ?
       AND status = 'completed'
       AND (pir_success_rating >= 3 OR pir_success_rating IS NULL)`,
      [organizationId]
    ),

    // Pending approvals
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM change_requests
       WHERE organization_id = ? AND approval_status = 'pending'`,
      [organizationId]
    ),
  ]);

  const statusMap: Record<string, number> = {
    draft: 0,
    submitted: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    pending_assessment: 0,
    pending_cab: 0,
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    rolled_back: 0,
  };
  byStatus.forEach((s) => {
    statusMap[s.status] = s.count;
  });

  const categoryMap: Record<string, number> = {
    standard: 0,
    normal: 0,
    emergency: 0,
  };
  byCategory.forEach((c) => {
    categoryMap[c.category] = c.count;
  });

  const completedCount = totalCompleted?.count || 0;
  const successfulCount = totalSuccessful?.count || 0;
  const successRate = completedCount > 0 ? (successfulCount / completedCount) * 100 : 0;

  return {
    total: total?.count || 0,
    by_status: statusMap,
    by_category: categoryMap,
    by_type: byType,
    average_completion_time_hours: avgCompletionTime?.avg || null,
    success_rate: successRate,
    pending_approvals: pendingApprovals?.count || 0,
  };
}

// ============================================
// EXPORT ALL
// ============================================

export const changeQueries = {
  // Change Request CRUD
  generateChangeNumber,
  createChangeRequest,
  getChangeRequestById,
  listChangeRequests,
  updateChangeRequest,
  deleteChangeRequest,

  // Change Request Workflow
  submitChangeRequest,
  approveChangeRequest,
  rejectChangeRequest,

  // Change Types
  listChangeTypes,
  createChangeType,

  // Approvals
  addChangeApproval,
  listChangeApprovals,

  // Tasks
  createChangeTask,
  listChangeTasks,
  updateChangeTask,

  // Calendar
  listChangeCalendarEvents,
  createChangeCalendarEvent,

  // Statistics
  getChangeStatistics,
};

export default changeQueries;
