import {
  executeQuery,
  executeQueryOne,
  executeRun,
  executeTransaction,
  sqlDateDiff,
} from '../adapter';
import type {
  ServiceCategory,
  ServiceCatalogItem,
  ServiceCatalogItemWithDetails,
  ServiceRequest,
  ServiceRequestWithDetails,
  ServiceRequestApproval,
  ServiceRequestTask,
  CreateServiceCategory,
  CreateServiceCatalogItem,
  CreateServiceRequest,
  CreateServiceRequestApproval,
  CreateServiceRequestTask,
  UpdateServiceCategory,
} from '../../types/database';

// ============================================================================
// Request Number Generation
// ============================================================================

/**
 * Generate a unique service request number in format SR-YYYY-XXXXX
 */
export async function generateRequestNumber(
  organizationId: number
): Promise<string> {
  return executeTransaction(async (db) => {
    const year = new Date().getFullYear();
    const prefix = `SR-${year}-`;

    // Get the latest request number for this year
    const result = await db.get<{ request_number: string }>(
      `SELECT request_number FROM service_requests
       WHERE organization_id = ?
         AND request_number LIKE ?
       ORDER BY id DESC
       LIMIT 1`,
      [organizationId, `${prefix}%`]
    );

    let nextNumber = 1;
    if (result?.request_number) {
      const currentNumber = parseInt(result.request_number.replace(prefix, ''), 10);
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1;
      }
    }
    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  });
}

// ============================================================================
// Service Categories
// ============================================================================

/**
 * List all service categories for an organization
 */
export async function listServiceCategories(
  organizationId: number
): Promise<ServiceCategory[]> {
  return executeQuery<ServiceCategory>(
    `SELECT *
     FROM service_categories
     WHERE organization_id = ?
       AND is_active = 1
     ORDER BY display_order ASC, name ASC`,
    [organizationId]
  );
}

/**
 * Get service category by ID
 */
export async function getServiceCategoryById(
  organizationId: number,
  id: number
): Promise<ServiceCategory | null> {
  const result = await executeQueryOne<ServiceCategory>(
    `SELECT *
     FROM service_categories
     WHERE id = ?
       AND organization_id = ?`,
    [id, organizationId]
  );
  return result ?? null;
}

/**
 * Get service category by slug
 */
export async function getServiceCategoryBySlug(
  organizationId: number,
  slug: string
): Promise<ServiceCategory | null> {
  const result = await executeQueryOne<ServiceCategory>(
    `SELECT *
     FROM service_categories
     WHERE slug = ?
       AND organization_id = ?`,
    [slug, organizationId]
  );
  return result ?? null;
}

/**
 * Create a new service category
 */
export async function createServiceCategory(
  organizationId: number,
  input: CreateServiceCategory
): Promise<ServiceCategory> {
  const now = new Date().toISOString();

  const result = await executeRun(
    `INSERT INTO service_categories (
      name, slug, description, icon, color,
      parent_category_id, display_order, is_public, is_active,
      organization_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.slug,
      input.description || null,
      input.icon || null,
      input.color || null,
      input.parent_category_id || null,
      input.display_order || 0,
      input.is_public !== false ? 1 : 0,
      input.is_active !== false ? 1 : 0,
      organizationId,
      now,
      now,
    ]
  );

  const id = result.lastInsertRowid!;
  const category = await getServiceCategoryById(organizationId, id);
  if (!category) {
    throw new Error('Failed to retrieve created service category');
  }

  return category;
}

/**
 * Update a service category
 */
export async function updateServiceCategory(
  id: number,
  input: UpdateServiceCategory
): Promise<ServiceCategory> {
  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: any[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.slug !== undefined) {
    updates.push('slug = ?');
    values.push(input.slug);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }
  if (input.icon !== undefined) {
    updates.push('icon = ?');
    values.push(input.icon);
  }
  if (input.color !== undefined) {
    updates.push('color = ?');
    values.push(input.color);
  }
  if (input.parent_category_id !== undefined) {
    updates.push('parent_category_id = ?');
    values.push(input.parent_category_id);
  }
  if (input.display_order !== undefined) {
    updates.push('display_order = ?');
    values.push(input.display_order);
  }
  if (input.is_public !== undefined) {
    updates.push('is_public = ?');
    values.push(input.is_public ? 1 : 0);
  }
  if (input.is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(input.is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await executeRun(
    `UPDATE service_categories SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  // Get organization_id from existing record
  const existing = await executeQueryOne<{ organization_id: number }>(
    'SELECT organization_id FROM service_categories WHERE id = ?',
    [id]
  );

  if (!existing) {
    throw new Error('Service category not found');
  }

  const updated = await getServiceCategoryById(existing.organization_id, id);
  if (!updated) {
    throw new Error('Failed to retrieve updated service category');
  }

  return updated;
}

/**
 * Delete a service category (soft delete)
 */
export async function deleteServiceCategory(id: number): Promise<void> {
  await executeRun(
    `UPDATE service_categories SET is_active = 0, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), id]
  );
}

// ============================================================================
// Service Catalog Items
// ============================================================================

interface CatalogItemFilters {
  category_id?: number;
  is_published?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * List service catalog items with optional filters
 */
export async function listServiceCatalogItems(
  organizationId: number,
  filters?: CatalogItemFilters
): Promise<ServiceCatalogItem[]> {
  const conditions: string[] = ['sci.organization_id = ?'];
  const values: any[] = [organizationId];

  if (filters?.category_id) {
    conditions.push('sci.category_id = ?');
    values.push(filters.category_id);
  }

  if (filters?.is_published !== undefined) {
    conditions.push('sci.is_published = ?');
    values.push(filters.is_published ? 1 : 0);
  }

  if (filters?.search) {
    conditions.push('(sci.name LIKE ? OR sci.short_description LIKE ? OR sci.description LIKE ?)');
    const searchPattern = `%${filters.search}%`;
    values.push(searchPattern, searchPattern, searchPattern);
  }

  conditions.push('sci.is_active = 1');

  let sql = `
    SELECT sci.*
    FROM service_catalog_items sci
    WHERE ${conditions.join(' AND ')}
    ORDER BY sci.display_order ASC, sci.name ASC
  `;

  if (filters?.limit) {
    sql += ` LIMIT ?`;
    values.push(filters.limit);

    if (filters?.offset) {
      sql += ` OFFSET ?`;
      values.push(filters.offset);
    }
  }

  return executeQuery<ServiceCatalogItem>(sql, values);
}

/**
 * Get service catalog item by ID with full details
 */
export async function getServiceCatalogItemById(
  organizationId: number,
  id: number
): Promise<ServiceCatalogItemWithDetails | null> {
  const result = await executeQueryOne<ServiceCatalogItemWithDetails>(
    `SELECT
      sci.*,
      sc.name as category_name,
      sc.slug as category_slug,
      sp.name as sla_policy_name,
      sp.response_time_minutes,
      sp.resolution_time_minutes,
      t.name as fulfillment_team_name
    FROM service_catalog_items sci
    LEFT JOIN service_categories sc ON sci.category_id = sc.id
    LEFT JOIN sla_policies sp ON sci.sla_policy_id = sp.id
    LEFT JOIN teams t ON sci.fulfillment_team_id = t.id
    WHERE sci.id = ?
      AND sci.organization_id = ?`,
    [id, organizationId]
  );
  return result ?? null;
}

/**
 * Get service catalog item by slug
 */
export async function getServiceCatalogItemBySlug(
  organizationId: number,
  slug: string
): Promise<ServiceCatalogItemWithDetails | null> {
  const result = await executeQueryOne<ServiceCatalogItemWithDetails>(
    `SELECT
      sci.*,
      sc.name as category_name,
      sc.slug as category_slug,
      sp.name as sla_policy_name,
      sp.response_time_minutes,
      sp.resolution_time_minutes,
      t.name as fulfillment_team_name
    FROM service_catalog_items sci
    LEFT JOIN service_categories sc ON sci.category_id = sc.id
    LEFT JOIN sla_policies sp ON sci.sla_policy_id = sp.id
    LEFT JOIN teams t ON sci.fulfillment_team_id = t.id
    WHERE sci.slug = ?
      AND sci.organization_id = ?`,
    [slug, organizationId]
  );
  return result ?? null;
}

/**
 * Create a new service catalog item
 */
export async function createServiceCatalogItem(
  organizationId: number,
  userId: number,
  input: CreateServiceCatalogItem
): Promise<ServiceCatalogItem> {
  const now = new Date().toISOString();

  // Note: Schema uses approval_levels, estimated_time_minutes, cost, is_published
  // but TypeScript interface uses different field names (approval_workflow_id, etc.)
  // Using 'any' type assertion for schema-specific fields
  const inputAny = input as any;

  const result = await executeRun(
    `INSERT INTO service_catalog_items (
      name, slug, short_description, description,
      category_id, organization_id, icon, image_url, display_order,
      form_schema, default_priority_id, default_category_id,
      sla_policy_id, fulfillment_team_id, requires_approval,
      approval_levels, estimated_time_minutes, cost,
      is_published, is_active, request_count,
      avg_fulfillment_time, satisfaction_rating, tags,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.slug,
      input.short_description || null,
      input.description || null,
      input.category_id || null,
      organizationId,
      input.icon || null,
      input.image_url || null,
      input.display_order || 0,
      input.form_schema ? JSON.stringify(input.form_schema) : null,
      input.default_priority_id || null,
      input.default_category_id || null,
      input.sla_policy_id || null,
      input.fulfillment_team_id || null,
      input.requires_approval ? 1 : 0,
      inputAny.approval_levels || 1,
      inputAny.estimated_time_minutes || null,
      inputAny.cost || null,
      inputAny.is_published !== false ? 1 : 0,
      input.is_active !== false ? 1 : 0,
      0, // request_count
      null, // avg_fulfillment_time
      null, // satisfaction_rating
      input.tags ? JSON.stringify(input.tags) : null,
      userId,
      now,
      now,
    ]
  );

  const id = result.lastInsertRowid!;
  const item = await getServiceCatalogItemById(organizationId, id);
  if (!item) {
    throw new Error('Failed to retrieve created catalog item');
  }

  return item;
}

/**
 * Update a service catalog item
 */
export async function updateServiceCatalogItem(
  organizationId: number,
  id: number,
  input: Partial<CreateServiceCatalogItem>
): Promise<ServiceCatalogItem> {
  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: any[] = [];

  // Note: Schema uses approval_levels, estimated_time_minutes, cost, is_published
  // but TypeScript interface uses different field names
  const inputAny = input as any;

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.slug !== undefined) {
    updates.push('slug = ?');
    values.push(input.slug);
  }
  if (input.short_description !== undefined) {
    updates.push('short_description = ?');
    values.push(input.short_description);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }
  if (input.category_id !== undefined) {
    updates.push('category_id = ?');
    values.push(input.category_id);
  }
  if (input.icon !== undefined) {
    updates.push('icon = ?');
    values.push(input.icon);
  }
  if (input.image_url !== undefined) {
    updates.push('image_url = ?');
    values.push(input.image_url);
  }
  if (input.display_order !== undefined) {
    updates.push('display_order = ?');
    values.push(input.display_order);
  }
  if (input.form_schema !== undefined) {
    updates.push('form_schema = ?');
    values.push(input.form_schema ? JSON.stringify(input.form_schema) : null);
  }
  if (input.default_priority_id !== undefined) {
    updates.push('default_priority_id = ?');
    values.push(input.default_priority_id);
  }
  if (input.default_category_id !== undefined) {
    updates.push('default_category_id = ?');
    values.push(input.default_category_id);
  }
  if (input.sla_policy_id !== undefined) {
    updates.push('sla_policy_id = ?');
    values.push(input.sla_policy_id);
  }
  if (input.fulfillment_team_id !== undefined) {
    updates.push('fulfillment_team_id = ?');
    values.push(input.fulfillment_team_id);
  }
  if (input.requires_approval !== undefined) {
    updates.push('requires_approval = ?');
    values.push(input.requires_approval ? 1 : 0);
  }
  if (inputAny.approval_levels !== undefined) {
    updates.push('approval_levels = ?');
    values.push(inputAny.approval_levels);
  }
  if (inputAny.estimated_time_minutes !== undefined) {
    updates.push('estimated_time_minutes = ?');
    values.push(inputAny.estimated_time_minutes);
  }
  if (inputAny.cost !== undefined) {
    updates.push('cost = ?');
    values.push(inputAny.cost);
  }
  if (inputAny.is_published !== undefined) {
    updates.push('is_published = ?');
    values.push(inputAny.is_published ? 1 : 0);
  }
  if (input.is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(input.is_active ? 1 : 0);
  }
  if (input.tags !== undefined) {
    updates.push('tags = ?');
    values.push(input.tags ? JSON.stringify(input.tags) : null);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  values.push(organizationId);

  await executeRun(
    `UPDATE service_catalog_items SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
    values
  );

  const updated = await getServiceCatalogItemById(organizationId, id);
  if (!updated) {
    throw new Error('Failed to retrieve updated catalog item');
  }

  return updated;
}

/**
 * Delete a service catalog item (soft delete)
 */
export async function deleteServiceCatalogItem(
  organizationId: number,
  id: number
): Promise<void> {
  await executeRun(
    `UPDATE service_catalog_items
     SET is_active = 0, is_published = 0, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [new Date().toISOString(), id, organizationId]
  );
}

/**
 * Increment request count for a catalog item
 */
export async function incrementCatalogItemRequestCount(
  catalogItemId: number
): Promise<void> {
  await executeRun(
    `UPDATE service_catalog_items
     SET request_count = request_count + 1,
         updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), catalogItemId]
  );
}

// ============================================================================
// Service Requests
// ============================================================================

interface ServiceRequestFilters {
  status?: string;
  requester_id?: number;
  catalog_item_id?: number;
  approval_status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Create a new service request
 */
export async function createServiceRequest(
  organizationId: number,
  requesterId: number,
  input: CreateServiceRequest
): Promise<ServiceRequest> {
  const now = new Date().toISOString();

  // Generate request number
  const requestNumber = await generateRequestNumber(organizationId);

  // Note: tenant_id exists in schema but not in TypeScript interface
  const inputAny = input as any;

  const result = await executeRun(
    `INSERT INTO service_requests (
      request_number, catalog_item_id, ticket_id,
      requester_id, requester_name, requester_email, requester_department,
      on_behalf_of_id, form_data, justification, requested_date,
      status, approval_status, organization_id, tenant_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      requestNumber,
      input.catalog_item_id,
      input.ticket_id || null,
      requesterId,
      input.requester_name,
      input.requester_email,
      input.requester_department || null,
      input.on_behalf_of_id || null,
      input.form_data ? JSON.stringify(input.form_data) : null,
      input.justification || null,
      now, // requested_date
      'submitted', // status
      'pending', // approval_status
      organizationId,
      inputAny.tenant_id || null,
      now,
      now,
    ]
  );

  const id = result.lastInsertRowid!;

  // Increment catalog item request count
  await incrementCatalogItemRequestCount(input.catalog_item_id);

  const request = await getServiceRequestById(organizationId, id);
  if (!request) {
    throw new Error('Failed to retrieve created service request');
  }

  return request;
}

/**
 * Get service request by ID with full details
 */
export async function getServiceRequestById(
  organizationId: number,
  id: number
): Promise<ServiceRequestWithDetails | null> {
  const request = await executeQueryOne<ServiceRequestWithDetails>(
    `SELECT
      sr.*,
      sci.name as catalog_item_name,
      sci.slug as catalog_item_slug,
      sci.icon as catalog_item_icon,
      u.name as requester_name_full,
      u.email as requester_email_full
    FROM service_requests sr
    LEFT JOIN service_catalog_items sci ON sr.catalog_item_id = sci.id
    LEFT JOIN users u ON sr.requester_id = u.id
    WHERE sr.id = ?
      AND sr.organization_id = ?`,
    [id, organizationId]
  );

  if (!request) {
    return null;
  }

  // Get approvals
  const approvals = await executeQuery<ServiceRequestApproval>(
    `SELECT * FROM service_request_approvals
     WHERE service_request_id = ?
     ORDER BY approval_level ASC`,
    [id]
  );

  // Get tasks
  const tasks = await executeQuery<ServiceRequestTask>(
    `SELECT * FROM service_request_tasks
     WHERE service_request_id = ?
     ORDER BY task_order ASC`,
    [id]
  );

  return {
    ...request,
    approvals,
    tasks,
  };
}

/**
 * List service requests with optional filters
 */
export async function listServiceRequests(
  organizationId: number,
  filters?: ServiceRequestFilters
): Promise<ServiceRequest[]> {
  const conditions: string[] = ['sr.organization_id = ?'];
  const values: any[] = [organizationId];

  if (filters?.status) {
    conditions.push('sr.status = ?');
    values.push(filters.status);
  }

  if (filters?.requester_id) {
    conditions.push('sr.requester_id = ?');
    values.push(filters.requester_id);
  }

  if (filters?.catalog_item_id) {
    conditions.push('sr.catalog_item_id = ?');
    values.push(filters.catalog_item_id);
  }

  if (filters?.approval_status) {
    conditions.push('sr.approval_status = ?');
    values.push(filters.approval_status);
  }

  let sql = `
    SELECT sr.*
    FROM service_requests sr
    WHERE ${conditions.join(' AND ')}
    ORDER BY sr.requested_date DESC
  `;

  if (filters?.limit) {
    sql += ` LIMIT ?`;
    values.push(filters.limit);

    if (filters?.offset) {
      sql += ` OFFSET ?`;
      values.push(filters.offset);
    }
  }

  return executeQuery<ServiceRequest>(sql, values);
}

/**
 * Update service request status
 */
export async function updateServiceRequestStatus(
  organizationId: number,
  id: number,
  status: string,
  userId?: number
): Promise<ServiceRequest> {
  const now = new Date().toISOString();
  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const values: any[] = [status, now];

  if (status === 'fulfilled' && userId) {
    updates.push('fulfilled_by = ?', 'fulfilled_at = ?');
    values.push(userId, now);
  }

  if (status === 'cancelled' && userId) {
    updates.push('cancelled_by = ?', 'cancelled_at = ?');
    values.push(userId, now);
  }

  values.push(id, organizationId);

  await executeRun(
    `UPDATE service_requests
     SET ${updates.join(', ')}
     WHERE id = ? AND organization_id = ?`,
    values
  );

  const updated = await getServiceRequestById(organizationId, id);
  if (!updated) {
    throw new Error('Failed to retrieve updated service request');
  }

  return updated;
}

/**
 * Approve a service request
 */
export async function approveServiceRequest(
  organizationId: number,
  id: number,
  approverId: number,
  comments?: string
): Promise<ServiceRequest> {
  const now = new Date().toISOString();

  await executeTransaction(async (db) => {
    // Update the service request approval status
    await db.run(
      `UPDATE service_requests
       SET approval_status = 'approved',
           approved_by = ?,
           approved_at = ?,
           updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [approverId, now, now, id, organizationId]
    );

    // Create or update approval record
    const existingApproval = await db.get<ServiceRequestApproval>(
      `SELECT * FROM service_request_approvals
       WHERE service_request_id = ? AND approver_id = ?`,
      [id, approverId]
    );

    if (existingApproval) {
      await db.run(
        `UPDATE service_request_approvals
         SET status = 'approved',
             decision_at = ?,
             comments = ?,
             updated_at = ?
         WHERE id = ?`,
        [now, comments || null, now, existingApproval.id]
      );
    } else {
      await db.run(
        `INSERT INTO service_request_approvals (
          service_request_id, approval_level, approver_id,
          status, decision_at, comments, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, 1, approverId, 'approved', now, comments || null, now, now]
      );
    }
  });

  const updated = await getServiceRequestById(organizationId, id);
  if (!updated) {
    throw new Error('Failed to retrieve updated service request');
  }

  return updated;
}

/**
 * Reject a service request
 */
export async function rejectServiceRequest(
  organizationId: number,
  id: number,
  approverId: number,
  comments?: string
): Promise<ServiceRequest> {
  const now = new Date().toISOString();

  await executeTransaction(async (db) => {
    // Update the service request approval status and overall status
    await db.run(
      `UPDATE service_requests
       SET approval_status = 'rejected',
           status = 'cancelled',
           approved_by = ?,
           approved_at = ?,
           cancelled_by = ?,
           cancelled_at = ?,
           cancellation_reason = ?,
           updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [approverId, now, approverId, now, comments || 'Rejected by approver', now, id, organizationId]
    );

    // Create or update approval record
    const existingApproval = await db.get<ServiceRequestApproval>(
      `SELECT * FROM service_request_approvals
       WHERE service_request_id = ? AND approver_id = ?`,
      [id, approverId]
    );

    if (existingApproval) {
      await db.run(
        `UPDATE service_request_approvals
         SET status = 'rejected',
             decision_at = ?,
             comments = ?,
             updated_at = ?
         WHERE id = ?`,
        [now, comments || null, now, existingApproval.id]
      );
    } else {
      await db.run(
        `INSERT INTO service_request_approvals (
          service_request_id, approval_level, approver_id,
          status, decision_at, comments, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, 1, approverId, 'rejected', now, comments || null, now, now]
      );
    }
  });

  const updated = await getServiceRequestById(organizationId, id);
  if (!updated) {
    throw new Error('Failed to retrieve updated service request');
  }

  return updated;
}

/**
 * Fulfill a service request
 */
export async function fulfillServiceRequest(
  organizationId: number,
  id: number,
  userId: number
): Promise<ServiceRequest> {
  return updateServiceRequestStatus(organizationId, id, 'fulfilled', userId);
}

/**
 * Cancel a service request
 */
export async function cancelServiceRequest(
  organizationId: number,
  id: number,
  userId: number,
  reason?: string
): Promise<ServiceRequest> {
  const now = new Date().toISOString();

  await executeRun(
    `UPDATE service_requests
     SET status = 'cancelled',
         cancelled_by = ?,
         cancelled_at = ?,
         cancellation_reason = ?,
         updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [userId, now, reason || null, now, id, organizationId]
  );

  const updated = await getServiceRequestById(organizationId, id);
  if (!updated) {
    throw new Error('Failed to retrieve updated service request');
  }

  return updated;
}

// ============================================================================
// Service Request Tasks
// ============================================================================

/**
 * Create a service request task
 */
export async function createServiceRequestTask(
  serviceRequestId: number,
  input: CreateServiceRequestTask
): Promise<ServiceRequestTask> {
  const now = new Date().toISOString();

  const result = await executeRun(
    `INSERT INTO service_request_tasks (
      service_request_id, task_order, title, description,
      assigned_to, assigned_team_id, status, estimated_minutes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      serviceRequestId,
      input.task_order || 1,
      input.title,
      input.description || null,
      input.assigned_to || null,
      input.assigned_team_id || null,
      'pending', // status
      input.estimated_minutes || null,
      now,
      now,
    ]
  );

  const id = result.lastInsertRowid!;
  const task = await executeQueryOne<ServiceRequestTask>(
    'SELECT * FROM service_request_tasks WHERE id = ?',
    [id]
  );

  if (!task) {
    throw new Error('Failed to retrieve created service request task');
  }

  return task;
}

/**
 * Update a service request task
 */
export async function updateServiceRequestTask(
  taskId: number,
  input: Partial<CreateServiceRequestTask> & {
    status?: string;
    completed_at?: string;
    completion_notes?: string;
    actual_minutes?: number;
  }
): Promise<ServiceRequestTask> {
  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: any[] = [];

  if (input.title !== undefined) {
    updates.push('title = ?');
    values.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }
  if (input.assigned_to !== undefined) {
    updates.push('assigned_to = ?');
    values.push(input.assigned_to);
  }
  if (input.assigned_team_id !== undefined) {
    updates.push('assigned_team_id = ?');
    values.push(input.assigned_team_id);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    values.push(input.status);

    if (input.status === 'in_progress') {
      updates.push('started_at = ?');
      values.push(now);
    }

    if (input.status === 'completed') {
      updates.push('completed_at = ?');
      values.push(now);
    }
  }
  if (input.completion_notes !== undefined) {
    updates.push('completion_notes = ?');
    values.push(input.completion_notes);
  }
  if (input.estimated_minutes !== undefined) {
    updates.push('estimated_minutes = ?');
    values.push(input.estimated_minutes);
  }
  if (input.actual_minutes !== undefined) {
    updates.push('actual_minutes = ?');
    values.push(input.actual_minutes);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(taskId);

  await executeRun(
    `UPDATE service_request_tasks SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  const updated = await executeQueryOne<ServiceRequestTask>(
    'SELECT * FROM service_request_tasks WHERE id = ?',
    [taskId]
  );

  if (!updated) {
    throw new Error('Failed to retrieve updated service request task');
  }

  return updated;
}

/**
 * List tasks for a service request
 */
export async function listServiceRequestTasks(
  serviceRequestId: number
): Promise<ServiceRequestTask[]> {
  return executeQuery<ServiceRequestTask>(
    `SELECT * FROM service_request_tasks
     WHERE service_request_id = ?
     ORDER BY task_order ASC`,
    [serviceRequestId]
  );
}

/**
 * Delete a service request task
 */
export async function deleteServiceRequestTask(taskId: number): Promise<void> {
  await executeRun('DELETE FROM service_request_tasks WHERE id = ?', [taskId]);
}

// ============================================================================
// Service Request Approvals
// ============================================================================

/**
 * Create a service request approval
 */
export async function createServiceRequestApproval(
  serviceRequestId: number,
  input: CreateServiceRequestApproval
): Promise<ServiceRequestApproval> {
  const now = new Date().toISOString();

  const result = await executeRun(
    `INSERT INTO service_request_approvals (
      service_request_id, approval_level, approver_id,
      approver_role, status, due_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      serviceRequestId,
      input.approval_level,
      input.approver_id,
      input.approver_role || null,
      'pending', // status
      input.due_date || null,
      now,
      now,
    ]
  );

  const id = result.lastInsertRowid!;
  const approval = await executeQueryOne<ServiceRequestApproval>(
    'SELECT * FROM service_request_approvals WHERE id = ?',
    [id]
  );

  if (!approval) {
    throw new Error('Failed to retrieve created service request approval');
  }

  return approval;
}

/**
 * List approvals for a service request
 */
export async function listServiceRequestApprovals(
  serviceRequestId: number
): Promise<ServiceRequestApproval[]> {
  return executeQuery<ServiceRequestApproval>(
    `SELECT * FROM service_request_approvals
     WHERE service_request_id = ?
     ORDER BY approval_level ASC`,
    [serviceRequestId]
  );
}

// ============================================================================
// Catalog Statistics
// ============================================================================

interface CatalogStatistics {
  total_items: number;
  published_items: number;
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  fulfilled_requests: number;
  cancelled_requests: number;
  avg_fulfillment_time_minutes: number | null;
  avg_satisfaction_rating: number | null;
  popular_items: Array<{
    id: number;
    name: string;
    request_count: number;
    avg_fulfillment_time: number | null;
    satisfaction_rating: number | null;
  }>;
  requests_by_status: Array<{
    status: string;
    count: number;
  }>;
}

/**
 * Get catalog statistics for an organization
 */
export async function getCatalogStatistics(
  organizationId: number
): Promise<CatalogStatistics> {
  // Get item counts
  const itemStats = await executeQueryOne<{
    total_items: number;
    published_items: number;
  }>(
    `SELECT
      COUNT(*) as total_items,
      SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END) as published_items
    FROM service_catalog_items
    WHERE organization_id = ? AND is_active = 1`,
    [organizationId]
  );

  // Get request counts by status
  const requestStats = await executeQueryOne<{
    total_requests: number;
    pending_requests: number;
    approved_requests: number;
    rejected_requests: number;
    fulfilled_requests: number;
    cancelled_requests: number;
  }>(
    `SELECT
      COUNT(*) as total_requests,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
      SUM(CASE WHEN approval_status = 'approved' THEN 1 ELSE 0 END) as approved_requests,
      SUM(CASE WHEN approval_status = 'rejected' THEN 1 ELSE 0 END) as rejected_requests,
      SUM(CASE WHEN status = 'fulfilled' THEN 1 ELSE 0 END) as fulfilled_requests,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_requests
    FROM service_requests
    WHERE organization_id = ?`,
    [organizationId]
  );

  // Get average fulfillment time and satisfaction rating
  const avgStats = await executeQueryOne<{
    avg_fulfillment_time_minutes: number | null;
    avg_satisfaction_rating: number | null;
  }>(
    `SELECT
      AVG(
        CASE WHEN fulfilled_at IS NOT NULL AND requested_date IS NOT NULL
        THEN ${sqlDateDiff('fulfilled_at', 'requested_date')} * 24 * 60
        ELSE NULL END
      ) as avg_fulfillment_time_minutes,
      AVG(satisfaction_rating) as avg_satisfaction_rating
    FROM service_requests
    WHERE organization_id = ? AND status = 'fulfilled'`,
    [organizationId]
  );

  // Get popular items
  const popularItems = await executeQuery<{
    id: number;
    name: string;
    request_count: number;
    avg_fulfillment_time: number | null;
    satisfaction_rating: number | null;
  }>(
    `SELECT
      id,
      name,
      request_count,
      avg_fulfillment_time,
      satisfaction_rating
    FROM service_catalog_items
    WHERE organization_id = ?
      AND is_active = 1
      AND request_count > 0
    ORDER BY request_count DESC
    LIMIT 10`,
    [organizationId]
  );

  // Get requests by status
  const requestsByStatus = await executeQuery<{
    status: string;
    count: number;
  }>(
    `SELECT status, COUNT(*) as count
    FROM service_requests
    WHERE organization_id = ?
    GROUP BY status
    ORDER BY count DESC`,
    [organizationId]
  );

  return {
    total_items: itemStats?.total_items || 0,
    published_items: itemStats?.published_items || 0,
    total_requests: requestStats?.total_requests || 0,
    pending_requests: requestStats?.pending_requests || 0,
    approved_requests: requestStats?.approved_requests || 0,
    rejected_requests: requestStats?.rejected_requests || 0,
    fulfilled_requests: requestStats?.fulfilled_requests || 0,
    cancelled_requests: requestStats?.cancelled_requests || 0,
    avg_fulfillment_time_minutes: avgStats?.avg_fulfillment_time_minutes || null,
    avg_satisfaction_rating: avgStats?.avg_satisfaction_rating || null,
    popular_items: popularItems,
    requests_by_status: requestsByStatus,
  };
}
