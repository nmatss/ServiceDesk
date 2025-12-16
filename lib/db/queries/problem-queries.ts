/**
 * Problem Management Queries
 * ITIL 4 Compliant - Supabase Ready
 */

import { getDatabase, executeQuery, executeQueryOne, executeRun, executeTransaction } from '../adapter';
import type {
  Problem,
  ProblemWithRelations,
  ProblemIncidentLink,
  ProblemIncidentLinkWithDetails,
  KnownError,
  KnownErrorWithRelations,
  ProblemActivity,
  ProblemActivityWithUser,
  RootCauseCategory,
  ProblemAttachment,
  CreateProblemInput,
  UpdateProblemInput,
  LinkIncidentInput,
  CreateKnownErrorInput,
  UpdateKnownErrorInput,
  AddActivityInput,
  ProblemFilters,
  KnownErrorFilters,
  ProblemSortOptions,
  PaginationOptions,
  PaginatedResult,
  ProblemStatistics,
  KnownErrorStatistics,
} from '../../types/problem';

// ============================================
// PROBLEM NUMBER GENERATOR
// ============================================

async function generateProblemNumber(organizationId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PRB-${year}-`;

  const result = await executeQueryOne<{ problem_number: string }>(
    `SELECT problem_number FROM problems
     WHERE organization_id = ? AND problem_number LIKE ?
     ORDER BY id DESC LIMIT 1`,
    [organizationId, `${prefix}%`]
  );

  let nextNumber = 1;
  if (result?.problem_number) {
    const currentNumber = parseInt(result.problem_number.replace(prefix, ''), 10);
    nextNumber = currentNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
}

async function generateKnownErrorNumber(organizationId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `KE-${year}-`;

  const result = await executeQueryOne<{ ke_number: string }>(
    `SELECT ke_number FROM known_errors
     WHERE organization_id = ? AND ke_number LIKE ?
     ORDER BY id DESC LIMIT 1`,
    [organizationId, `${prefix}%`]
  );

  let nextNumber = 1;
  if (result?.ke_number) {
    const currentNumber = parseInt(result.ke_number.replace(prefix, ''), 10);
    nextNumber = currentNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
}

// ============================================
// PROBLEM QUERIES
// ============================================

/**
 * Create a new problem
 */
export async function createProblem(
  organizationId: number,
  createdBy: number,
  input: CreateProblemInput
): Promise<Problem> {
  const problemNumber = await generateProblemNumber(organizationId);

  const result = await executeRun(
    `INSERT INTO problems (
      organization_id, problem_number, title, description,
      category_id, priority_id, impact, urgency,
      source_type, source_incident_id,
      assigned_to, assigned_group_id,
      symptoms, affected_services, affected_cis, business_impact,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      problemNumber,
      input.title,
      input.description,
      input.category_id || null,
      input.priority_id || null,
      input.impact || null,
      input.urgency || null,
      input.source_type || null,
      input.source_incident_id || null,
      input.assigned_to || null,
      input.assigned_group_id || null,
      input.symptoms ? JSON.stringify(input.symptoms) : null,
      input.affected_services ? JSON.stringify(input.affected_services) : null,
      input.affected_cis ? JSON.stringify(input.affected_cis) : null,
      input.business_impact || null,
      createdBy,
    ]
  );

  const problem = await getProblemById(organizationId, result.lastInsertRowid!);

  // Add creation activity
  await addProblemActivity(organizationId, result.lastInsertRowid!, createdBy, {
    activity_type: 'created',
    description: `Problem ${problemNumber} created`,
  });

  return problem!;
}

/**
 * Get problem by ID
 */
export async function getProblemById(
  organizationId: number,
  problemId: number
): Promise<ProblemWithRelations | null> {
  const problem = await executeQueryOne<Problem>(
    `SELECT * FROM problems WHERE id = ? AND organization_id = ?`,
    [problemId, organizationId]
  );

  if (!problem) return null;

  // Fetch relations
  const [category, priority, assignee, assignedGroup, createdByUser, knownError] = await Promise.all([
    problem.category_id
      ? executeQueryOne<{ id: number; name: string; color: string | null }>(
          `SELECT id, name, color FROM categories WHERE id = ?`,
          [problem.category_id]
        )
      : null,
    problem.priority_id
      ? executeQueryOne<{ id: number; name: string; color: string | null; level: number }>(
          `SELECT id, name, color, level FROM priorities WHERE id = ?`,
          [problem.priority_id]
        )
      : null,
    problem.assigned_to
      ? executeQueryOne<{ id: number; name: string; email: string; avatar_url: string | null }>(
          `SELECT id, name, email, avatar_url FROM users WHERE id = ?`,
          [problem.assigned_to]
        )
      : null,
    problem.assigned_group_id
      ? executeQueryOne<{ id: number; name: string }>(
          `SELECT id, name FROM teams WHERE id = ?`,
          [problem.assigned_group_id]
        )
      : null,
    executeQueryOne<{ id: number; name: string; email: string }>(
      `SELECT id, name, email FROM users WHERE id = ?`,
      [problem.created_by]
    ),
    problem.known_error_id
      ? getKnownErrorById(organizationId, problem.known_error_id)
      : null,
  ]);

  return {
    ...problem,
    category: category || undefined,
    priority: priority || undefined,
    assignee: assignee || undefined,
    assigned_group: assignedGroup || undefined,
    created_by_user: createdByUser || undefined,
    known_error: knownError,
  };
}

/**
 * Get problem by number
 */
export async function getProblemByNumber(
  organizationId: number,
  problemNumber: string
): Promise<ProblemWithRelations | null> {
  const problem = await executeQueryOne<Problem>(
    `SELECT * FROM problems WHERE problem_number = ? AND organization_id = ?`,
    [problemNumber, organizationId]
  );

  if (!problem) return null;

  return getProblemById(organizationId, problem.id);
}

/**
 * Get problems list with filters and pagination
 */
export async function getProblems(
  organizationId: number,
  filters: ProblemFilters = {},
  sort: ProblemSortOptions = { field: 'created_at', direction: 'desc' },
  pagination: PaginationOptions = { page: 1, limit: 20 }
): Promise<PaginatedResult<ProblemWithRelations>> {
  const conditions: string[] = ['p.organization_id = ?'];
  const params: unknown[] = [organizationId];

  // Apply filters
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(`p.status IN (${filters.status.map(() => '?').join(', ')})`);
      params.push(...filters.status);
    } else {
      conditions.push('p.status = ?');
      params.push(filters.status);
    }
  }

  if (filters.category_id) {
    conditions.push('p.category_id = ?');
    params.push(filters.category_id);
  }

  if (filters.priority_id) {
    conditions.push('p.priority_id = ?');
    params.push(filters.priority_id);
  }

  if (filters.impact) {
    if (Array.isArray(filters.impact)) {
      conditions.push(`p.impact IN (${filters.impact.map(() => '?').join(', ')})`);
      params.push(...filters.impact);
    } else {
      conditions.push('p.impact = ?');
      params.push(filters.impact);
    }
  }

  if (filters.assigned_to) {
    conditions.push('p.assigned_to = ?');
    params.push(filters.assigned_to);
  }

  if (filters.assigned_group_id) {
    conditions.push('p.assigned_group_id = ?');
    params.push(filters.assigned_group_id);
  }

  if (filters.has_workaround !== undefined) {
    conditions.push(filters.has_workaround ? 'p.workaround IS NOT NULL' : 'p.workaround IS NULL');
  }

  if (filters.has_known_error !== undefined) {
    conditions.push(filters.has_known_error ? 'p.known_error_id IS NOT NULL' : 'p.known_error_id IS NULL');
  }

  if (filters.source_type) {
    conditions.push('p.source_type = ?');
    params.push(filters.source_type);
  }

  if (filters.created_by) {
    conditions.push('p.created_by = ?');
    params.push(filters.created_by);
  }

  if (filters.created_after) {
    conditions.push('p.created_at >= ?');
    params.push(filters.created_after);
  }

  if (filters.created_before) {
    conditions.push('p.created_at <= ?');
    params.push(filters.created_before);
  }

  if (filters.search) {
    conditions.push('(p.title LIKE ? OR p.description LIKE ? OR p.problem_number LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.join(' AND ');

  // Sort mapping
  const sortFieldMap: Record<string, string> = {
    created_at: 'p.created_at',
    updated_at: 'p.updated_at',
    priority: 'pr.level',
    incident_count: 'p.incident_count',
    status: 'p.status',
  };
  const sortField = sortFieldMap[sort.field] || 'p.created_at';
  const sortDirection = sort.direction.toUpperCase();

  // Count total
  const countResult = await executeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM problems p WHERE ${whereClause}`,
    params
  );
  const total = countResult?.total || 0;

  // Calculate pagination
  const offset = (pagination.page - 1) * pagination.limit;
  const totalPages = Math.ceil(total / pagination.limit);

  // Fetch problems
  const problems = await executeQuery<Problem>(
    `SELECT p.* FROM problems p
     LEFT JOIN priorities pr ON p.priority_id = pr.id
     WHERE ${whereClause}
     ORDER BY ${sortField} ${sortDirection}
     LIMIT ? OFFSET ?`,
    [...params, pagination.limit, offset]
  );

  // Fetch relations for each problem
  const problemsWithRelations = await Promise.all(
    problems.map((p) => getProblemById(organizationId, p.id))
  );

  return {
    data: problemsWithRelations.filter((p): p is ProblemWithRelations => p !== null),
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages,
    hasNext: pagination.page < totalPages,
    hasPrev: pagination.page > 1,
  };
}

/**
 * Update a problem
 */
export async function updateProblem(
  organizationId: number,
  problemId: number,
  userId: number,
  input: UpdateProblemInput
): Promise<ProblemWithRelations | null> {
  const currentProblem = await getProblemById(organizationId, problemId);
  if (!currentProblem) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  // Track changes for activity log
  const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

  if (input.title !== undefined && input.title !== currentProblem.title) {
    updates.push('title = ?');
    params.push(input.title);
    changes.push({ field: 'title', oldValue: currentProblem.title, newValue: input.title });
  }

  if (input.description !== undefined && input.description !== currentProblem.description) {
    updates.push('description = ?');
    params.push(input.description);
  }

  if (input.status !== undefined && input.status !== currentProblem.status) {
    updates.push('status = ?');
    params.push(input.status);
    changes.push({ field: 'status', oldValue: currentProblem.status, newValue: input.status });

    // Set timestamps based on status
    if (input.status === 'root_cause_identified' && !currentProblem.identified_at) {
      updates.push('identified_at = CURRENT_TIMESTAMP');
    }
    if (input.status === 'resolved' && !currentProblem.resolved_at) {
      updates.push('resolved_at = CURRENT_TIMESTAMP');
    }
    if (input.status === 'closed' && !currentProblem.closed_at) {
      updates.push('closed_at = CURRENT_TIMESTAMP');
      updates.push('closed_by = ?');
      params.push(userId);
    }
  }

  if (input.category_id !== undefined) {
    updates.push('category_id = ?');
    params.push(input.category_id);
  }

  if (input.priority_id !== undefined) {
    updates.push('priority_id = ?');
    params.push(input.priority_id);
    changes.push({ field: 'priority', oldValue: currentProblem.priority_id, newValue: input.priority_id });
  }

  if (input.impact !== undefined) {
    updates.push('impact = ?');
    params.push(input.impact);
  }

  if (input.urgency !== undefined) {
    updates.push('urgency = ?');
    params.push(input.urgency);
  }

  if (input.root_cause !== undefined) {
    updates.push('root_cause = ?');
    params.push(input.root_cause);
    if (input.root_cause && !currentProblem.root_cause) {
      changes.push({ field: 'root_cause', oldValue: null, newValue: 'Root cause identified' });
    }
  }

  if (input.root_cause_category !== undefined) {
    updates.push('root_cause_category = ?');
    params.push(input.root_cause_category);
  }

  if (input.symptoms !== undefined) {
    updates.push('symptoms = ?');
    params.push(JSON.stringify(input.symptoms));
  }

  if (input.workaround !== undefined) {
    updates.push('workaround = ?');
    params.push(input.workaround);
    if (input.workaround && !currentProblem.workaround) {
      changes.push({ field: 'workaround', oldValue: null, newValue: 'Workaround added' });
    }
  }

  if (input.workaround_effectiveness !== undefined) {
    updates.push('workaround_effectiveness = ?');
    params.push(input.workaround_effectiveness);
  }

  if (input.permanent_fix !== undefined) {
    updates.push('permanent_fix = ?');
    params.push(input.permanent_fix);
  }

  if (input.assigned_to !== undefined) {
    updates.push('assigned_to = ?');
    params.push(input.assigned_to);
    changes.push({ field: 'assigned_to', oldValue: currentProblem.assigned_to, newValue: input.assigned_to });
  }

  if (input.assigned_group_id !== undefined) {
    updates.push('assigned_group_id = ?');
    params.push(input.assigned_group_id);
  }

  if (input.business_impact !== undefined) {
    updates.push('business_impact = ?');
    params.push(input.business_impact);
  }

  if (input.affected_services !== undefined) {
    updates.push('affected_services = ?');
    params.push(JSON.stringify(input.affected_services));
  }

  if (input.affected_cis !== undefined) {
    updates.push('affected_cis = ?');
    params.push(JSON.stringify(input.affected_cis));
  }

  if (input.affected_users_count !== undefined) {
    updates.push('affected_users_count = ?');
    params.push(input.affected_users_count);
  }

  if (updates.length === 0) {
    return currentProblem;
  }

  params.push(problemId, organizationId);

  await executeRun(
    `UPDATE problems SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
    params
  );

  // Log activities for significant changes
  for (const change of changes) {
    let activityType: string = 'status_changed';
    let description = `${change.field} changed`;

    if (change.field === 'status') {
      activityType = change.newValue === 'resolved' ? 'resolved' :
                     change.newValue === 'closed' ? 'closed' :
                     change.newValue === 'new' && change.oldValue === 'closed' ? 'reopened' :
                     'status_changed';
      description = `Status changed from ${change.oldValue} to ${change.newValue}`;
    } else if (change.field === 'assigned_to') {
      activityType = 'assigned';
      description = change.newValue ? `Assigned to user #${change.newValue}` : 'Unassigned';
    } else if (change.field === 'root_cause') {
      activityType = 'root_cause_updated';
      description = 'Root cause identified';
    } else if (change.field === 'workaround') {
      activityType = 'workaround_added';
      description = 'Workaround added';
    }

    await addProblemActivity(organizationId, problemId, userId, {
      activity_type: activityType as any,
      description,
      old_value: String(change.oldValue || ''),
      new_value: String(change.newValue || ''),
    });
  }

  return getProblemById(organizationId, problemId);
}

/**
 * Delete a problem
 */
export async function deleteProblem(
  organizationId: number,
  problemId: number
): Promise<boolean> {
  const result = await executeRun(
    `DELETE FROM problems WHERE id = ? AND organization_id = ?`,
    [problemId, organizationId]
  );
  return result.changes > 0;
}

// ============================================
// PROBLEM INCIDENT LINKS
// ============================================

/**
 * Link an incident to a problem
 */
export async function linkIncidentToProblem(
  organizationId: number,
  problemId: number,
  userId: number,
  input: LinkIncidentInput
): Promise<ProblemIncidentLink> {
  const result = await executeRun(
    `INSERT INTO problem_incidents (
      organization_id, problem_id, ticket_id,
      relationship_type, linked_by, notes
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      problemId,
      input.ticket_id,
      input.relationship_type || 'caused_by',
      userId,
      input.notes || null,
    ]
  );

  // Add activity
  await addProblemActivity(organizationId, problemId, userId, {
    activity_type: 'incident_linked',
    description: `Incident #${input.ticket_id} linked to this problem`,
    metadata: { ticket_id: input.ticket_id, relationship_type: input.relationship_type },
  });

  const link = await executeQueryOne<ProblemIncidentLink>(
    `SELECT * FROM problem_incidents WHERE id = ?`,
    [result.lastInsertRowid]
  );

  return link!;
}

/**
 * Unlink an incident from a problem
 */
export async function unlinkIncidentFromProblem(
  organizationId: number,
  problemId: number,
  ticketId: number
): Promise<boolean> {
  const result = await executeRun(
    `DELETE FROM problem_incidents
     WHERE problem_id = ? AND ticket_id = ? AND organization_id = ?`,
    [problemId, ticketId, organizationId]
  );
  return result.changes > 0;
}

/**
 * Get incidents linked to a problem
 */
export async function getProblemIncidents(
  organizationId: number,
  problemId: number
): Promise<ProblemIncidentLinkWithDetails[]> {
  const links = await executeQuery<ProblemIncidentLink>(
    `SELECT * FROM problem_incidents
     WHERE problem_id = ? AND organization_id = ?
     ORDER BY linked_at DESC`,
    [problemId, organizationId]
  );

  const linksWithDetails = await Promise.all(
    links.map(async (link) => {
      const [ticket, linkedByUser] = await Promise.all([
        executeQueryOne<{
          id: number;
          ticket_number: string;
          title: string;
          status: string;
          priority: string | null;
          created_at: string;
        }>(
          `SELECT t.id, t.ticket_number, t.title, s.name as status, p.name as priority, t.created_at
           FROM tickets t
           LEFT JOIN statuses s ON t.status_id = s.id
           LEFT JOIN priorities p ON t.priority_id = p.id
           WHERE t.id = ?`,
          [link.ticket_id]
        ),
        executeQueryOne<{ id: number; name: string }>(
          `SELECT id, name FROM users WHERE id = ?`,
          [link.linked_by]
        ),
      ]);

      return {
        ...link,
        ticket: ticket || undefined,
        linked_by_user: linkedByUser || undefined,
      };
    })
  );

  return linksWithDetails;
}

/**
 * Get problems linked to an incident
 */
export async function getIncidentProblems(
  organizationId: number,
  ticketId: number
): Promise<ProblemWithRelations[]> {
  const links = await executeQuery<{ problem_id: number }>(
    `SELECT problem_id FROM problem_incidents
     WHERE ticket_id = ? AND organization_id = ?`,
    [ticketId, organizationId]
  );

  const problems = await Promise.all(
    links.map((link) => getProblemById(organizationId, link.problem_id))
  );

  return problems.filter((p): p is ProblemWithRelations => p !== null);
}

// ============================================
// KNOWN ERROR (KEDB) QUERIES
// ============================================

/**
 * Create a known error
 */
export async function createKnownError(
  organizationId: number,
  createdBy: number,
  input: CreateKnownErrorInput
): Promise<KnownError> {
  const keNumber = await generateKnownErrorNumber(organizationId);

  const result = await executeRun(
    `INSERT INTO known_errors (
      organization_id, ke_number, title, description,
      problem_id, symptoms, root_cause, workaround,
      workaround_instructions, permanent_fix_status, permanent_fix_eta,
      affected_cis, affected_services, affected_versions,
      is_public, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      keNumber,
      input.title,
      input.description,
      input.problem_id || null,
      JSON.stringify(input.symptoms),
      input.root_cause,
      input.workaround,
      input.workaround_instructions || null,
      input.permanent_fix_status || 'pending',
      input.permanent_fix_eta || null,
      input.affected_cis ? JSON.stringify(input.affected_cis) : null,
      input.affected_services ? JSON.stringify(input.affected_services) : null,
      input.affected_versions ? JSON.stringify(input.affected_versions) : null,
      input.is_public ? 1 : 0,
      createdBy,
    ]
  );

  // If linked to problem, update the problem
  if (input.problem_id) {
    await executeRun(
      `UPDATE problems SET known_error_id = ? WHERE id = ? AND organization_id = ?`,
      [result.lastInsertRowid, input.problem_id, organizationId]
    );

    await addProblemActivity(organizationId, input.problem_id, createdBy, {
      activity_type: 'known_error_created',
      description: `Known Error ${keNumber} created from this problem`,
      metadata: { known_error_id: result.lastInsertRowid },
    });
  }

  const knownError = await executeQueryOne<KnownError>(
    `SELECT * FROM known_errors WHERE id = ?`,
    [result.lastInsertRowid]
  );

  return knownError!;
}

/**
 * Get known error by ID
 */
export async function getKnownErrorById(
  organizationId: number,
  knownErrorId: number
): Promise<KnownErrorWithRelations | null> {
  const ke = await executeQueryOne<KnownError>(
    `SELECT * FROM known_errors WHERE id = ? AND organization_id = ?`,
    [knownErrorId, organizationId]
  );

  if (!ke) return null;

  const [problem, createdByUser, reviewedByUser] = await Promise.all([
    ke.problem_id ? getProblemById(organizationId, ke.problem_id) : null,
    executeQueryOne<{ id: number; name: string; email: string }>(
      `SELECT id, name, email FROM users WHERE id = ?`,
      [ke.created_by]
    ),
    ke.reviewed_by
      ? executeQueryOne<{ id: number; name: string }>(
          `SELECT id, name FROM users WHERE id = ?`,
          [ke.reviewed_by]
        )
      : null,
  ]);

  return {
    ...ke,
    problem: problem,
    created_by_user: createdByUser || undefined,
    reviewed_by_user: reviewedByUser,
  };
}

/**
 * Get known errors list
 */
export async function getKnownErrors(
  organizationId: number,
  filters: KnownErrorFilters = {},
  pagination: PaginationOptions = { page: 1, limit: 20 }
): Promise<PaginatedResult<KnownErrorWithRelations>> {
  const conditions: string[] = ['organization_id = ?'];
  const params: unknown[] = [organizationId];

  if (filters.is_active !== undefined) {
    conditions.push('is_active = ?');
    params.push(filters.is_active ? 1 : 0);
  }

  if (filters.is_public !== undefined) {
    conditions.push('is_public = ?');
    params.push(filters.is_public ? 1 : 0);
  }

  if (filters.permanent_fix_status) {
    if (Array.isArray(filters.permanent_fix_status)) {
      conditions.push(`permanent_fix_status IN (${filters.permanent_fix_status.map(() => '?').join(', ')})`);
      params.push(...filters.permanent_fix_status);
    } else {
      conditions.push('permanent_fix_status = ?');
      params.push(filters.permanent_fix_status);
    }
  }

  if (filters.problem_id) {
    conditions.push('problem_id = ?');
    params.push(filters.problem_id);
  }

  if (filters.search) {
    conditions.push('(title LIKE ? OR description LIKE ? OR ke_number LIKE ? OR symptoms LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.join(' AND ');

  // Count total
  const countResult = await executeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM known_errors WHERE ${whereClause}`,
    params
  );
  const total = countResult?.total || 0;

  // Calculate pagination
  const offset = (pagination.page - 1) * pagination.limit;
  const totalPages = Math.ceil(total / pagination.limit);

  // Fetch known errors
  const knownErrors = await executeQuery<KnownError>(
    `SELECT * FROM known_errors
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pagination.limit, offset]
  );

  // Fetch relations for each
  const knownErrorsWithRelations = await Promise.all(
    knownErrors.map((ke) => getKnownErrorById(organizationId, ke.id))
  );

  return {
    data: knownErrorsWithRelations.filter((ke): ke is KnownErrorWithRelations => ke !== null),
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages,
    hasNext: pagination.page < totalPages,
    hasPrev: pagination.page > 1,
  };
}

/**
 * Update known error
 */
export async function updateKnownError(
  organizationId: number,
  knownErrorId: number,
  input: UpdateKnownErrorInput
): Promise<KnownErrorWithRelations | null> {
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

  if (input.symptoms !== undefined) {
    updates.push('symptoms = ?');
    params.push(JSON.stringify(input.symptoms));
  }

  if (input.root_cause !== undefined) {
    updates.push('root_cause = ?');
    params.push(input.root_cause);
  }

  if (input.workaround !== undefined) {
    updates.push('workaround = ?');
    params.push(input.workaround);
  }

  if (input.workaround_instructions !== undefined) {
    updates.push('workaround_instructions = ?');
    params.push(input.workaround_instructions);
  }

  if (input.permanent_fix_status !== undefined) {
    updates.push('permanent_fix_status = ?');
    params.push(input.permanent_fix_status);
  }

  if (input.permanent_fix_eta !== undefined) {
    updates.push('permanent_fix_eta = ?');
    params.push(input.permanent_fix_eta);
  }

  if (input.permanent_fix_notes !== undefined) {
    updates.push('permanent_fix_notes = ?');
    params.push(input.permanent_fix_notes);
  }

  if (input.affected_cis !== undefined) {
    updates.push('affected_cis = ?');
    params.push(JSON.stringify(input.affected_cis));
  }

  if (input.affected_services !== undefined) {
    updates.push('affected_services = ?');
    params.push(JSON.stringify(input.affected_services));
  }

  if (input.affected_versions !== undefined) {
    updates.push('affected_versions = ?');
    params.push(JSON.stringify(input.affected_versions));
  }

  if (input.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(input.is_active ? 1 : 0);
  }

  if (input.is_public !== undefined) {
    updates.push('is_public = ?');
    params.push(input.is_public ? 1 : 0);
  }

  if (updates.length === 0) {
    return getKnownErrorById(organizationId, knownErrorId);
  }

  params.push(knownErrorId, organizationId);

  await executeRun(
    `UPDATE known_errors SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
    params
  );

  return getKnownErrorById(organizationId, knownErrorId);
}

/**
 * Increment known error reference count
 */
export async function incrementKnownErrorReference(
  organizationId: number,
  knownErrorId: number
): Promise<void> {
  await executeRun(
    `UPDATE known_errors SET times_referenced = times_referenced + 1
     WHERE id = ? AND organization_id = ?`,
    [knownErrorId, organizationId]
  );
}

/**
 * Search known errors by symptoms
 */
export async function searchKnownErrorsBySymptoms(
  organizationId: number,
  searchTerms: string[]
): Promise<KnownErrorWithRelations[]> {
  const conditions = searchTerms.map(() => 'symptoms LIKE ?');
  const params = [
    organizationId,
    ...searchTerms.map((term) => `%${term}%`),
  ];

  const knownErrors = await executeQuery<KnownError>(
    `SELECT * FROM known_errors
     WHERE organization_id = ? AND is_active = 1 AND (${conditions.join(' OR ')})
     ORDER BY times_referenced DESC
     LIMIT 10`,
    params
  );

  const results = await Promise.all(
    knownErrors.map((ke) => getKnownErrorById(organizationId, ke.id))
  );

  return results.filter((ke): ke is KnownErrorWithRelations => ke !== null);
}

// ============================================
// PROBLEM ACTIVITIES
// ============================================

/**
 * Add activity to problem
 */
export async function addProblemActivity(
  organizationId: number,
  problemId: number,
  userId: number,
  input: AddActivityInput
): Promise<ProblemActivity> {
  const result = await executeRun(
    `INSERT INTO problem_activities (
      organization_id, problem_id, activity_type,
      description, old_value, new_value, metadata,
      is_internal, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      problemId,
      input.activity_type,
      input.description,
      input.old_value || null,
      input.new_value || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.is_internal !== false ? 1 : 0,
      userId,
    ]
  );

  const activity = await executeQueryOne<ProblemActivity>(
    `SELECT * FROM problem_activities WHERE id = ?`,
    [result.lastInsertRowid]
  );

  return activity!;
}

/**
 * Get problem activities
 */
export async function getProblemActivities(
  organizationId: number,
  problemId: number,
  includeInternal: boolean = true
): Promise<ProblemActivityWithUser[]> {
  const condition = includeInternal ? '' : ' AND is_internal = 0';

  const activities = await executeQuery<ProblemActivity>(
    `SELECT * FROM problem_activities
     WHERE problem_id = ? AND organization_id = ?${condition}
     ORDER BY created_at DESC`,
    [problemId, organizationId]
  );

  const activitiesWithUsers = await Promise.all(
    activities.map(async (activity) => {
      const user = await executeQueryOne<{ id: number; name: string; avatar_url: string | null }>(
        `SELECT id, name, avatar_url FROM users WHERE id = ?`,
        [activity.created_by]
      );

      return {
        ...activity,
        user: user || undefined,
      };
    })
  );

  return activitiesWithUsers;
}

// ============================================
// ROOT CAUSE CATEGORIES
// ============================================

/**
 * Get root cause categories
 */
export async function getRootCauseCategories(
  organizationId: number
): Promise<RootCauseCategory[]> {
  return executeQuery<RootCauseCategory>(
    `SELECT * FROM root_cause_categories
     WHERE organization_id = ? AND is_active = 1
     ORDER BY sort_order, name`,
    [organizationId]
  );
}

/**
 * Create root cause category
 */
export async function createRootCauseCategory(
  organizationId: number,
  name: string,
  code: string,
  description?: string,
  parentId?: number
): Promise<RootCauseCategory> {
  const result = await executeRun(
    `INSERT INTO root_cause_categories (organization_id, name, code, description, parent_id)
     VALUES (?, ?, ?, ?, ?)`,
    [organizationId, name, code, description || null, parentId || null]
  );

  const category = await executeQueryOne<RootCauseCategory>(
    `SELECT * FROM root_cause_categories WHERE id = ?`,
    [result.lastInsertRowid]
  );

  return category!;
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get problem statistics
 */
export async function getProblemStatistics(
  organizationId: number
): Promise<ProblemStatistics> {
  const [
    total,
    byStatus,
    byImpact,
    byCategory,
    avgTimeToIdentify,
    avgTimeToResolve,
    totalIncidents,
    knownErrorsCount,
    createdThisMonth,
    resolvedThisMonth,
  ] = await Promise.all([
    // Total problems
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM problems WHERE organization_id = ?`,
      [organizationId]
    ),

    // By status
    executeQuery<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM problems
       WHERE organization_id = ? GROUP BY status`,
      [organizationId]
    ),

    // By impact
    executeQuery<{ impact: string; count: number }>(
      `SELECT impact, COUNT(*) as count FROM problems
       WHERE organization_id = ? AND impact IS NOT NULL GROUP BY impact`,
      [organizationId]
    ),

    // By category
    executeQuery<{ category_id: number; category_name: string; count: number }>(
      `SELECT p.category_id, c.name as category_name, COUNT(*) as count
       FROM problems p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.organization_id = ? AND p.category_id IS NOT NULL
       GROUP BY p.category_id`,
      [organizationId]
    ),

    // Average time to identify
    executeQueryOne<{ avg: number | null }>(
      `SELECT AVG(time_to_identify_hours) as avg FROM problems
       WHERE organization_id = ? AND time_to_identify_hours IS NOT NULL`,
      [organizationId]
    ),

    // Average time to resolve
    executeQueryOne<{ avg: number | null }>(
      `SELECT AVG(time_to_resolve_hours) as avg FROM problems
       WHERE organization_id = ? AND time_to_resolve_hours IS NOT NULL`,
      [organizationId]
    ),

    // Total incidents linked
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM problem_incidents WHERE organization_id = ?`,
      [organizationId]
    ),

    // Known errors created
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM known_errors WHERE organization_id = ?`,
      [organizationId]
    ),

    // Created this month
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM problems
       WHERE organization_id = ?
       AND created_at >= date('now', 'start of month')`,
      [organizationId]
    ),

    // Resolved this month
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM problems
       WHERE organization_id = ?
       AND resolved_at >= date('now', 'start of month')`,
      [organizationId]
    ),
  ]);

  const statusMap: Record<string, number> = {
    new: 0,
    investigation: 0,
    root_cause_identified: 0,
    known_error: 0,
    resolved: 0,
    closed: 0,
  };
  byStatus.forEach((s) => {
    statusMap[s.status] = s.count;
  });

  const impactMap: Record<string, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  byImpact.forEach((i) => {
    impactMap[i.impact] = i.count;
  });

  return {
    total: total?.count || 0,
    by_status: statusMap as any,
    by_impact: impactMap as any,
    by_category: byCategory,
    average_time_to_identify: avgTimeToIdentify?.avg || null,
    average_time_to_resolve: avgTimeToResolve?.avg || null,
    total_incidents_linked: totalIncidents?.count || 0,
    known_errors_created: knownErrorsCount?.count || 0,
    problems_created_this_month: createdThisMonth?.count || 0,
    problems_resolved_this_month: resolvedThisMonth?.count || 0,
  };
}

/**
 * Get known error statistics
 */
export async function getKnownErrorStatistics(
  organizationId: number
): Promise<KnownErrorStatistics> {
  const [total, active, publicCount, byFixStatus, totalReferenced, recentlyAdded] = await Promise.all([
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM known_errors WHERE organization_id = ?`,
      [organizationId]
    ),
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM known_errors WHERE organization_id = ? AND is_active = 1`,
      [organizationId]
    ),
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM known_errors WHERE organization_id = ? AND is_public = 1`,
      [organizationId]
    ),
    executeQuery<{ status: string; count: number }>(
      `SELECT permanent_fix_status as status, COUNT(*) as count
       FROM known_errors WHERE organization_id = ? GROUP BY permanent_fix_status`,
      [organizationId]
    ),
    executeQueryOne<{ total: number }>(
      `SELECT SUM(times_referenced) as total FROM known_errors WHERE organization_id = ?`,
      [organizationId]
    ),
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM known_errors
       WHERE organization_id = ? AND created_at >= date('now', '-7 days')`,
      [organizationId]
    ),
  ]);

  const fixStatusMap: Record<string, number> = {
    pending: 0,
    planned: 0,
    in_progress: 0,
    completed: 0,
    wont_fix: 0,
  };
  byFixStatus.forEach((s) => {
    fixStatusMap[s.status] = s.count;
  });

  return {
    total: total?.count || 0,
    active: active?.count || 0,
    public: publicCount?.count || 0,
    by_fix_status: fixStatusMap as any,
    total_times_referenced: totalReferenced?.total || 0,
    recently_added: recentlyAdded?.count || 0,
  };
}

// ============================================
// EXPORT ALL
// ============================================

export const problemQueries = {
  // Problem CRUD
  createProblem,
  getProblemById,
  getProblemByNumber,
  getProblems,
  updateProblem,
  deleteProblem,

  // Problem-Incident links
  linkIncidentToProblem,
  unlinkIncidentFromProblem,
  getProblemIncidents,
  getIncidentProblems,

  // Known Errors
  createKnownError,
  getKnownErrorById,
  getKnownErrors,
  updateKnownError,
  incrementKnownErrorReference,
  searchKnownErrorsBySymptoms,

  // Activities
  addProblemActivity,
  getProblemActivities,

  // Root Cause Categories
  getRootCauseCategories,
  createRootCauseCategory,

  // Statistics
  getProblemStatistics,
  getKnownErrorStatistics,

  // Number generators
  generateProblemNumber,
  generateKnownErrorNumber,
};

export default problemQueries;
