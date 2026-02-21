/**
 * Problem Management Queries
 * ITIL 4 Compliant - Supabase Ready
 */

import { getDatabase, executeQuery, executeQueryOne, executeRun, executeTransaction, sqlStartOfMonth, sqlDateSub } from '../adapter';
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
      organization_id, tenant_id, problem_number, title, description,
      category_id, priority_id, impact, urgency,
      root_cause_category_id,
      assigned_to, assigned_team_id,
      affected_services,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      organizationId,
      problemNumber,
      input.title,
      input.description,
      input.category_id || null,
      input.priority_id || null,
      input.impact || null,
      input.urgency || null,
      input.root_cause_category_id || null,
      input.assigned_to || null,
      input.assigned_team_id || null,
      input.affected_services ? JSON.stringify(input.affected_services) : null,
      createdBy,
    ]
  );

  const problem = await getProblemById(organizationId, result.lastInsertRowid!);

  // Add creation activity
  await addProblemActivity(organizationId, result.lastInsertRowid!, createdBy, {
    activity_type: 'note',
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
    problem.assigned_team_id
      ? executeQueryOne<{ id: number; name: string }>(
          `SELECT id, name FROM teams WHERE id = ?`,
          [problem.assigned_team_id]
        )
      : null,
    executeQueryOne<{ id: number; name: string; email: string }>(
      `SELECT id, name, email FROM users WHERE id = ?`,
      [problem.created_by]
    ),
    // Look up known_error by problem_id (known_errors references problems, not vice versa)
    executeQueryOne<KnownError>(
      `SELECT * FROM known_errors WHERE problem_id = ? AND organization_id = ? LIMIT 1`,
      [problemId, organizationId]
    ),
  ]);

  const knownErrorWithRelations = knownError
    ? await getKnownErrorById(organizationId, knownError.id)
    : null;

  return {
    ...problem,
    category: category || undefined,
    priority: priority || undefined,
    assignee: assignee || undefined,
    assigned_group: assignedGroup || undefined,
    created_by_user: createdByUser || undefined,
    known_error: knownErrorWithRelations,
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
      if (filters.status.length > 0) {
        conditions.push(`p.status IN (${filters.status.map(() => '?').join(', ')})`);
        params.push(...filters.status);
      }
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
      if (filters.impact.length > 0) {
        conditions.push(`p.impact IN (${filters.impact.map(() => '?').join(', ')})`);
        params.push(...filters.impact);
      }
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
    conditions.push('p.assigned_team_id = ?');
    params.push(filters.assigned_group_id);
  }

  if (filters.has_workaround !== undefined) {
    conditions.push(filters.has_workaround ? 'p.workaround IS NOT NULL' : 'p.workaround IS NULL');
  }

  if (filters.has_known_error !== undefined) {
    if (filters.has_known_error) {
      conditions.push('EXISTS (SELECT 1 FROM known_errors ke WHERE ke.problem_id = p.id)');
    } else {
      conditions.push('NOT EXISTS (SELECT 1 FROM known_errors ke WHERE ke.problem_id = p.id)');
    }
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

  // Fetch problems with JOINs to avoid N+1
  const problemsWithRelations = await executeQuery<any>(
    `SELECT p.*,
       pr.id as priority__id, pr.name as priority__name, pr.color as priority__color, pr.level as priority__level,
       cat.id as category__id, cat.name as category__name, cat.color as category__color,
       assignee.id as assignee__id, assignee.name as assignee__name, assignee.email as assignee__email, assignee.avatar_url as assignee__avatar_url,
       team.id as assigned_group__id, team.name as assigned_group__name,
       creator.id as creator__id, creator.name as creator__name, creator.email as creator__email
     FROM problems p
     LEFT JOIN priorities pr ON p.priority_id = pr.id
     LEFT JOIN categories cat ON p.category_id = cat.id
     LEFT JOIN users assignee ON p.assigned_to = assignee.id
     LEFT JOIN teams team ON p.assigned_team_id = team.id
     LEFT JOIN users creator ON p.created_by = creator.id
     WHERE ${whereClause}
     ORDER BY ${sortField} ${sortDirection}
     LIMIT ? OFFSET ?`,
    [...params, pagination.limit, offset]
  );

  // Map flat JOIN results to nested ProblemWithRelations shape
  const mappedProblems: ProblemWithRelations[] = problemsWithRelations.map((row: any) => {
    const { priority__id, priority__name, priority__color, priority__level,
            category__id, category__name, category__color,
            assignee__id, assignee__name, assignee__email, assignee__avatar_url,
            assigned_group__id, assigned_group__name,
            creator__id, creator__name, creator__email,
            ...problemFields } = row;

    return {
      ...problemFields,
      category: category__id ? { id: category__id, name: category__name, color: category__color } : undefined,
      priority: priority__id ? { id: priority__id, name: priority__name, color: priority__color, level: priority__level } : undefined,
      assignee: assignee__id ? { id: assignee__id, name: assignee__name, email: assignee__email, avatar_url: assignee__avatar_url } : undefined,
      assigned_group: assigned_group__id ? { id: assigned_group__id, name: assigned_group__name } : undefined,
      created_by_user: creator__id ? { id: creator__id, name: creator__name, email: creator__email } : undefined,
    } as ProblemWithRelations;
  });

  return {
    data: mappedProblems,
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
    if (input.status === 'resolved' && !currentProblem.resolution_date) {
      updates.push('resolution_date = CURRENT_TIMESTAMP');
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
    updates.push('root_cause_category_id = ?');
    params.push(input.root_cause_category);
  }

  if (input.workaround !== undefined) {
    updates.push('workaround = ?');
    params.push(input.workaround);
    if (input.workaround && !currentProblem.workaround) {
      changes.push({ field: 'workaround', oldValue: null, newValue: 'Workaround added' });
    }
  }

  if (input.resolution !== undefined) {
    updates.push('resolution = ?');
    params.push(input.resolution);
  }

  if (input.assigned_to !== undefined) {
    updates.push('assigned_to = ?');
    params.push(input.assigned_to);
    changes.push({ field: 'assigned_to', oldValue: currentProblem.assigned_to, newValue: input.assigned_to });
  }

  if (input.assigned_group_id !== undefined) {
    updates.push('assigned_team_id = ?');
    params.push(input.assigned_group_id);
  }

  if (input.affected_services !== undefined) {
    updates.push('affected_services = ?');
    params.push(JSON.stringify(input.affected_services));
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
  // Map change fields to valid problem_activities.type CHECK values:
  // 'note','status_change','assignment','escalation','rca_update','workaround','resolution','attachment','link'
  for (const change of changes) {
    let activityType: string = 'status_change';
    let description = `${change.field} changed`;

    if (change.field === 'status') {
      activityType = change.newValue === 'resolved' ? 'resolution' : 'status_change';
      description = `Status changed from ${change.oldValue} to ${change.newValue}`;
    } else if (change.field === 'assigned_to') {
      activityType = 'assignment';
      description = change.newValue ? `Assigned to user #${change.newValue}` : 'Unassigned';
    } else if (change.field === 'root_cause') {
      activityType = 'rca_update';
      description = 'Root cause identified';
    } else if (change.field === 'workaround') {
      activityType = 'workaround';
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
    `INSERT INTO problem_incident_links (
      problem_id, ticket_id, linked_by,
      link_type, notes
    ) VALUES (?, ?, ?, ?, ?)`,
    [
      problemId,
      input.ticket_id,
      userId,
      input.relationship_type || 'caused_by',
      input.notes || null,
    ]
  );

  // Add activity
  await addProblemActivity(organizationId, problemId, userId, {
    activity_type: 'link',
    description: `Incident #${input.ticket_id} linked to this problem`,
  });

  const link = await executeQueryOne<ProblemIncidentLink>(
    `SELECT * FROM problem_incident_links WHERE id = ?`,
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
    `DELETE FROM problem_incident_links
     WHERE problem_id = ? AND ticket_id = ?`,
    [problemId, ticketId]
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
    `SELECT * FROM problem_incident_links
     WHERE problem_id = ?
     ORDER BY created_at DESC`,
    [problemId]
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
          `SELECT t.id, ('TKT-' || CAST(t.id AS TEXT)) as ticket_number, t.title, s.name as status, p.name as priority, t.created_at
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
    `SELECT problem_id FROM problem_incident_links
     WHERE ticket_id = ?`,
    [ticketId]
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
      organization_id, tenant_id, ke_number, title, description,
      problem_id, symptoms, root_cause, workaround,
      permanent_fix, status, affected_cis,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      organizationId,
      keNumber,
      input.title,
      input.description,
      input.problem_id || null,
      input.symptoms ? JSON.stringify(input.symptoms) : null,
      input.root_cause,
      input.workaround,
      input.permanent_fix || null,
      input.status || 'active',
      input.affected_cis ? JSON.stringify(input.affected_cis) : null,
      createdBy,
    ]
  );

  // If linked to problem, add activity
  if (input.problem_id) {
    await addProblemActivity(organizationId, input.problem_id, createdBy, {
      activity_type: 'note',
      description: `Known Error ${keNumber} created from this problem`,
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

  const [problem, createdByUser] = await Promise.all([
    ke.problem_id ? getProblemById(organizationId, ke.problem_id) : null,
    executeQueryOne<{ id: number; name: string; email: string }>(
      `SELECT id, name, email FROM users WHERE id = ?`,
      [ke.created_by]
    ),
  ]);

  return {
    ...ke,
    problem: problem,
    created_by_user: createdByUser || undefined,
    reviewed_by_user: null,
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

  if (input.permanent_fix !== undefined) {
    updates.push('permanent_fix = ?');
    params.push(input.permanent_fix);
  }

  if (input.status !== undefined) {
    updates.push('status = ?');
    params.push(input.status);
  }

  if (input.affected_cis !== undefined) {
    updates.push('affected_cis = ?');
    params.push(JSON.stringify(input.affected_cis));
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
 * Increment known error reference count (no-op: times_referenced column does not exist)
 */
export async function incrementKnownErrorReference(
  _organizationId: number,
  _knownErrorId: number
): Promise<void> {
  // times_referenced column does not exist in the known_errors schema
  // This function is kept as a no-op to avoid breaking callers
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
     WHERE organization_id = ? AND (${conditions.join(' OR ')})
     ORDER BY created_at DESC
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
      problem_id, type,
      description, old_value, new_value,
      is_internal, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      problemId,
      input.activity_type,
      input.description,
      input.old_value || null,
      input.new_value || null,
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
     WHERE problem_id = ?${condition}
     ORDER BY created_at DESC`,
    [problemId]
  );

  const activitiesWithUsers = await Promise.all(
    activities.map(async (activity) => {
      const user = await executeQueryOne<{ id: number; name: string; avatar_url: string | null }>(
        `SELECT id, name, avatar_url FROM users WHERE id = ?`,
        [activity.user_id]
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
     ORDER BY name`,
    [organizationId]
  );
}

/**
 * Create root cause category
 */
export async function createRootCauseCategory(
  organizationId: number,
  name: string,
  _code: string,
  description?: string,
  parentId?: number
): Promise<RootCauseCategory> {
  const result = await executeRun(
    `INSERT INTO root_cause_categories (organization_id, name, description, parent_id)
     VALUES (?, ?, ?, ?)`,
    [organizationId, name, description || null, parentId || null]
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

    // Total incidents linked (join via problems to scope by org)
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM problem_incident_links pil
       INNER JOIN problems p ON pil.problem_id = p.id
       WHERE p.organization_id = ?`,
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
       AND created_at >= ${sqlStartOfMonth()}`,
      [organizationId]
    ),

    // Resolved this month
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM problems
       WHERE organization_id = ?
       AND resolution_date >= ${sqlStartOfMonth()}`,
      [organizationId]
    ),
  ]);

  const statusMap: Record<string, number> = {
    open: 0,
    identified: 0,
    root_cause_analysis: 0,
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
    average_time_to_identify: null,
    average_time_to_resolve: null,
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
  const [total, byStatus, recentlyAdded] = await Promise.all([
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM known_errors WHERE organization_id = ?`,
      [organizationId]
    ),
    executeQuery<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count
       FROM known_errors WHERE organization_id = ? GROUP BY status`,
      [organizationId]
    ),
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM known_errors
       WHERE organization_id = ? AND created_at >= ${sqlDateSub(7)}`,
      [organizationId]
    ),
  ]);

  const statusMap: Record<string, number> = {};
  byStatus.forEach((s) => {
    statusMap[s.status] = s.count;
  });

  return {
    total: total?.count || 0,
    active: 0,
    public: 0,
    by_fix_status: statusMap as any,
    total_times_referenced: 0,
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
