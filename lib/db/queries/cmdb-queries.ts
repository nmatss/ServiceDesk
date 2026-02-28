/**
 * CMDB (Configuration Management Database) Queries
 * ITIL 4 Compliant - Adapter Pattern
 */

import { executeQuery, executeQueryOne, executeRun, executeTransaction, sqlCastDate, sqlCurrentDate, sqlDateAdd } from '../adapter';
import type {
  CIType,
  CIStatus,
  CIRelationshipType,
  ConfigurationItem,
  ConfigurationItemWithDetails,
  CIRelationship,
  CIRelationshipWithDetails,
  CIHistory,
  CITicketLink,
  CreateCIType,
  CreateCIStatus,
  CreateConfigurationItem,
  CreateCIRelationshipType,
  CreateCIRelationship,
  CreateCIHistory,
  CreateCITicketLink,
  UpdateCIType,
  UpdateConfigurationItem,
  UpdateCIRelationship,
  User,
  Team,
} from '../../types/database';

// ============================================
// CI NUMBER GENERATOR
// ============================================

/**
 * Generate CI number in format CI-YYYY-XXXXX
 */
export async function generateCINumber(organizationId: number): Promise<string> {
  return executeTransaction(async (db) => {
    const year = new Date().getFullYear();
    const prefix = `CI-${year}-`;

    const result = await db.get<{ ci_number: string }>(
      `SELECT ci_number FROM configuration_items
       WHERE organization_id = ? AND ci_number LIKE ?
       ORDER BY id DESC LIMIT 1`,
      [organizationId, `${prefix}%`]
    );

    let nextNumber = 1;
    if (result?.ci_number) {
      const currentNumber = parseInt(result.ci_number.replace(prefix, ''), 10);
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
  });
}

// ============================================
// CI TYPE QUERIES
// ============================================

/**
 * List all CI types
 */
export async function listCITypes(organizationId?: number): Promise<CIType[]> {
  if (organizationId !== undefined) {
    return executeQuery<CIType>(
      `SELECT * FROM ci_types
       WHERE organization_id = ? AND is_active = 1
       ORDER BY name`,
      [organizationId]
    );
  }

  return executeQuery<CIType>(
    `SELECT * FROM ci_types
     WHERE is_active = 1
     ORDER BY name`
  );
}

/**
 * Create a new CI type
 */
export async function createCIType(input: CreateCIType): Promise<CIType> {
  // Note: Schema has organization_id but TypeScript interface doesn't
  const inputAny = input as any;

  const result = await executeRun(
    `INSERT INTO ci_types (
      name, description, icon, color, parent_type_id,
      attributes_schema, is_active, organization_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.description || null,
      input.icon,
      input.color,
      input.parent_type_id || null,
      input.attributes_schema || null,
      input.is_active !== false ? 1 : 0,
      inputAny.organization_id || 1,
    ]
  );

  const ciType = await executeQueryOne<CIType>(
    `SELECT * FROM ci_types WHERE id = ?`,
    [result.lastInsertRowid]
  );

  return ciType!;
}

/**
 * Update a CI type
 */
export async function updateCIType(id: number, input: UpdateCIType): Promise<CIType | null> {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    params.push(input.name);
  }

  if (input.description !== undefined) {
    updates.push('description = ?');
    params.push(input.description);
  }

  if (input.icon !== undefined) {
    updates.push('icon = ?');
    params.push(input.icon);
  }

  if (input.color !== undefined) {
    updates.push('color = ?');
    params.push(input.color);
  }

  if (input.parent_type_id !== undefined) {
    updates.push('parent_type_id = ?');
    params.push(input.parent_type_id);
  }

  if (input.attributes_schema !== undefined) {
    updates.push('attributes_schema = ?');
    params.push(input.attributes_schema);
  }

  if (input.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(input.is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    const result = await executeQueryOne<CIType>(
      `SELECT * FROM ci_types WHERE id = ?`,
      [id]
    );
    return result ?? null;
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  await executeRun(
    `UPDATE ci_types SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  const result = await executeQueryOne<CIType>(
    `SELECT * FROM ci_types WHERE id = ?`,
    [id]
  );
  return result ?? null;
}

// ============================================
// CI STATUS QUERIES
// ============================================

/**
 * List all CI statuses.
 * NOTE: ci_statuses is a global lookup table with no organization_id column.
 * This is intentional -- statuses are shared across all organizations.
 */
export async function listCIStatuses(): Promise<CIStatus[]> {
  return executeQuery<CIStatus>(
    `SELECT * FROM ci_statuses ORDER BY name`
  );
}

/**
 * Create a new CI status
 */
export async function createCIStatus(input: CreateCIStatus): Promise<CIStatus> {
  const result = await executeRun(
    `INSERT INTO ci_statuses (
      name, description, color, is_operational
    ) VALUES (?, ?, ?, ?)`,
    [
      input.name,
      input.description || null,
      input.color,
      input.is_operational !== false ? 1 : 0,
    ]
  );

  const ciStatus = await executeQueryOne<CIStatus>(
    `SELECT * FROM ci_statuses WHERE id = ?`,
    [result.lastInsertRowid]
  );

  return ciStatus!;
}

// ============================================
// CI RELATIONSHIP TYPE QUERIES
// ============================================

/**
 * List all CI relationship types.
 * NOTE: ci_relationship_types is a global lookup table with no organization_id column.
 * This is intentional -- relationship types are shared across all organizations.
 */
export async function listCIRelationshipTypes(): Promise<CIRelationshipType[]> {
  return executeQuery<CIRelationshipType>(
    `SELECT * FROM ci_relationship_types
     WHERE is_active = 1
     ORDER BY name`
  );
}

// ============================================
// CONFIGURATION ITEM QUERIES
// ============================================

/**
 * Create a new configuration item
 */
export async function createConfigurationItem(
  organizationId: number,
  userId: number,
  input: CreateConfigurationItem
): Promise<ConfigurationItem> {
  const ciNumber = await generateCINumber(organizationId);

  // Note: tenant_id exists in schema but not in TypeScript interface
  const inputAny = input as any;

  return executeTransaction(async (db) => {
    const result = await db.run(
      `INSERT INTO configuration_items (
        ci_number, name, description, ci_type_id, status_id,
        organization_id, tenant_id, owner_id, managed_by_team_id,
        vendor, manufacturer, location, environment, data_center,
        rack_position, purchase_date, installation_date, warranty_expiry,
        end_of_life_date, retirement_date, serial_number, asset_tag,
        ip_address, mac_address, hostname, os_version, business_service,
        criticality, business_impact, recovery_time_objective,
        recovery_point_objective, custom_attributes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ciNumber,
        input.name,
        input.description || null,
        input.ci_type_id,
        input.status_id,
        organizationId,
        inputAny.tenant_id || null,
        input.owner_id || null,
        input.managed_by_team_id || null,
        input.vendor || null,
        input.manufacturer || null,
        input.location || null,
        input.environment || null,
        input.data_center || null,
        input.rack_position || null,
        input.purchase_date || null,
        input.installation_date || null,
        input.warranty_expiry || null,
        input.end_of_life_date || null,
        input.retirement_date || null,
        input.serial_number || null,
        input.asset_tag || null,
        input.ip_address || null,
        input.mac_address || null,
        input.hostname || null,
        input.os_version || null,
        input.business_service || null,
        input.criticality || null,
        input.business_impact || null,
        input.recovery_time_objective || null,
        input.recovery_point_objective || null,
        input.custom_attributes || null,
        userId,
      ]
    );

    // Create history entry
    await db.run(
      `INSERT INTO ci_history (
        ci_id, action, changed_by, change_reason
      ) VALUES (?, 'created', ?, ?)`,
      [result.lastInsertRowid, userId, 'CI created']
    );

    const ci = await db.get<ConfigurationItem>(
      `SELECT * FROM configuration_items WHERE id = ?`,
      [result.lastInsertRowid]
    );

    return ci!;
  });
}

/**
 * Get configuration item by ID with related data
 */
export async function getConfigurationItemById(
  organizationId: number,
  id: number
): Promise<ConfigurationItemWithDetails | null> {
  const ci = await executeQueryOne<ConfigurationItem>(
    `SELECT * FROM configuration_items
     WHERE id = ? AND organization_id = ?`,
    [id, organizationId]
  );

  if (!ci) return null;

  // Fetch related data
  const [ciType, status, owner, team] = await Promise.all([
    executeQueryOne<CIType>(
      `SELECT * FROM ci_types WHERE id = ?`,
      [ci.ci_type_id]
    ),
    executeQueryOne<CIStatus>(
      `SELECT * FROM ci_statuses WHERE id = ?`,
      [ci.status_id]
    ),
    ci.owner_id
      ? executeQueryOne<User>(
          `SELECT id, name, email, role, avatar_url FROM users WHERE id = ?`,
          [ci.owner_id]
        )
      : null,
    ci.managed_by_team_id
      ? executeQueryOne<Team>(
          `SELECT * FROM teams WHERE id = ?`,
          [ci.managed_by_team_id]
        )
      : null,
  ]);

  return {
    ...ci,
    ci_type: ciType || undefined,
    status: status || undefined,
    owner: owner || undefined,
    managed_by_team: team || undefined,
  };
}

/**
 * List configuration items with filters and pagination
 */
export async function listConfigurationItems(
  organizationId: number,
  filters: {
    ci_type_id?: number;
    status_id?: number;
    environment?: string;
    criticality?: string;
    search?: string;
  } = {},
  pagination: { page: number; limit: number } = { page: 1, limit: 20 }
): Promise<{ data: ConfigurationItemWithDetails[]; total: number; page: number; limit: number; totalPages: number }> {
  const conditions: string[] = ['organization_id = ?'];
  const params: unknown[] = [organizationId];

  // Apply filters
  if (filters.ci_type_id) {
    conditions.push('ci_type_id = ?');
    params.push(filters.ci_type_id);
  }

  if (filters.status_id) {
    conditions.push('status_id = ?');
    params.push(filters.status_id);
  }

  if (filters.environment) {
    conditions.push('environment = ?');
    params.push(filters.environment);
  }

  if (filters.criticality) {
    conditions.push('criticality = ?');
    params.push(filters.criticality);
  }

  if (filters.search) {
    conditions.push('(name LIKE ? OR description LIKE ? OR ci_number LIKE ? OR hostname LIKE ? OR ip_address LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.join(' AND ');

  // Count total
  const countResult = await executeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM configuration_items WHERE ${whereClause}`,
    params
  );
  const total = countResult?.total || 0;

  // Calculate pagination
  const offset = (pagination.page - 1) * pagination.limit;
  const totalPages = Math.ceil(total / pagination.limit);

  // Fetch CIs with JOINs to avoid N+1
  const cisRaw = await executeQuery<any>(
    `SELECT ci.*,
       ct.id as ci_type__id, ct.name as ci_type__name, ct.description as ci_type__description,
       ct.icon as ci_type__icon, ct.color as ci_type__color,
       cs.id as status__id, cs.name as status__name, cs.description as status__description,
       cs.color as status__color, cs.is_operational as status__is_operational,
       u.id as owner__id, u.name as owner__name, u.email as owner__email, u.role as owner__role, u.avatar_url as owner__avatar_url,
       t.id as team__id, t.name as team__name
     FROM configuration_items ci
     LEFT JOIN ci_types ct ON ci.ci_type_id = ct.id
     LEFT JOIN ci_statuses cs ON ci.status_id = cs.id
     LEFT JOIN users u ON ci.owner_id = u.id
     LEFT JOIN teams t ON ci.managed_by_team_id = t.id
     WHERE ${whereClause}
     ORDER BY ci.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pagination.limit, offset]
  );

  // Map flat JOIN results to nested ConfigurationItemWithDetails shape
  const cisWithDetails: ConfigurationItemWithDetails[] = cisRaw.map((row: any) => {
    const { ci_type__id, ci_type__name, ci_type__description, ci_type__icon, ci_type__color,
            status__id, status__name, status__description, status__color, status__is_operational,
            owner__id, owner__name, owner__email, owner__role, owner__avatar_url,
            team__id, team__name,
            ...ciFields } = row;

    return {
      ...ciFields,
      ci_type: ci_type__id ? { id: ci_type__id, name: ci_type__name, description: ci_type__description, icon: ci_type__icon, color: ci_type__color } : undefined,
      status: status__id ? { id: status__id, name: status__name, description: status__description, color: status__color, is_operational: status__is_operational } : undefined,
      owner: owner__id ? { id: owner__id, name: owner__name, email: owner__email, role: owner__role, avatar_url: owner__avatar_url } : undefined,
      managed_by_team: team__id ? { id: team__id, name: team__name } : undefined,
    } as ConfigurationItemWithDetails;
  });

  return {
    data: cisWithDetails,
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages,
  };
}

/**
 * Update a configuration item
 */
export async function updateConfigurationItem(
  organizationId: number,
  id: number,
  userId: number,
  input: UpdateConfigurationItem
): Promise<ConfigurationItemWithDetails | null> {
  return executeTransaction(async (db) => {
    // Get current CI for history
    const currentCI = await db.get<ConfigurationItem>(
      `SELECT * FROM configuration_items WHERE id = ? AND organization_id = ?`,
      [id, organizationId]
    );

    if (!currentCI) return null;

    const updates: string[] = [];
    const params: unknown[] = [];
    const historyEntries: Array<{ field: string; oldValue: string; newValue: string }> = [];

    // Helper to track changes
    const trackChange = (field: string, oldValue: any, newValue: any) => {
      if (oldValue !== newValue) {
        historyEntries.push({
          field,
          oldValue: String(oldValue || ''),
          newValue: String(newValue || ''),
        });
      }
    };

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
      trackChange('name', currentCI.name, input.name);
    }

    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description);
      trackChange('description', currentCI.description, input.description);
    }

    if (input.ci_type_id !== undefined) {
      updates.push('ci_type_id = ?');
      params.push(input.ci_type_id);
      trackChange('ci_type_id', currentCI.ci_type_id, input.ci_type_id);
    }

    if (input.status_id !== undefined) {
      updates.push('status_id = ?');
      params.push(input.status_id);
      trackChange('status_id', currentCI.status_id, input.status_id);
    }

    if (input.owner_id !== undefined) {
      updates.push('owner_id = ?');
      params.push(input.owner_id);
      trackChange('owner_id', currentCI.owner_id, input.owner_id);
    }

    if (input.managed_by_team_id !== undefined) {
      updates.push('managed_by_team_id = ?');
      params.push(input.managed_by_team_id);
      trackChange('managed_by_team_id', currentCI.managed_by_team_id, input.managed_by_team_id);
    }

    if (input.vendor !== undefined) {
      updates.push('vendor = ?');
      params.push(input.vendor);
      trackChange('vendor', currentCI.vendor, input.vendor);
    }

    if (input.manufacturer !== undefined) {
      updates.push('manufacturer = ?');
      params.push(input.manufacturer);
      trackChange('manufacturer', currentCI.manufacturer, input.manufacturer);
    }

    if (input.location !== undefined) {
      updates.push('location = ?');
      params.push(input.location);
      trackChange('location', currentCI.location, input.location);
    }

    if (input.environment !== undefined) {
      updates.push('environment = ?');
      params.push(input.environment);
      trackChange('environment', currentCI.environment, input.environment);
    }

    if (input.data_center !== undefined) {
      updates.push('data_center = ?');
      params.push(input.data_center);
      trackChange('data_center', currentCI.data_center, input.data_center);
    }

    if (input.rack_position !== undefined) {
      updates.push('rack_position = ?');
      params.push(input.rack_position);
      trackChange('rack_position', currentCI.rack_position, input.rack_position);
    }

    if (input.serial_number !== undefined) {
      updates.push('serial_number = ?');
      params.push(input.serial_number);
      trackChange('serial_number', currentCI.serial_number, input.serial_number);
    }

    if (input.asset_tag !== undefined) {
      updates.push('asset_tag = ?');
      params.push(input.asset_tag);
      trackChange('asset_tag', currentCI.asset_tag, input.asset_tag);
    }

    if (input.ip_address !== undefined) {
      updates.push('ip_address = ?');
      params.push(input.ip_address);
      trackChange('ip_address', currentCI.ip_address, input.ip_address);
    }

    if (input.mac_address !== undefined) {
      updates.push('mac_address = ?');
      params.push(input.mac_address);
      trackChange('mac_address', currentCI.mac_address, input.mac_address);
    }

    if (input.hostname !== undefined) {
      updates.push('hostname = ?');
      params.push(input.hostname);
      trackChange('hostname', currentCI.hostname, input.hostname);
    }

    if (input.os_version !== undefined) {
      updates.push('os_version = ?');
      params.push(input.os_version);
      trackChange('os_version', currentCI.os_version, input.os_version);
    }

    if (input.business_service !== undefined) {
      updates.push('business_service = ?');
      params.push(input.business_service);
      trackChange('business_service', currentCI.business_service, input.business_service);
    }

    if (input.criticality !== undefined) {
      updates.push('criticality = ?');
      params.push(input.criticality);
      trackChange('criticality', currentCI.criticality, input.criticality);
    }

    if (input.business_impact !== undefined) {
      updates.push('business_impact = ?');
      params.push(input.business_impact);
      trackChange('business_impact', currentCI.business_impact, input.business_impact);
    }

    if (input.recovery_time_objective !== undefined) {
      updates.push('recovery_time_objective = ?');
      params.push(input.recovery_time_objective);
      trackChange('recovery_time_objective', currentCI.recovery_time_objective, input.recovery_time_objective);
    }

    if (input.recovery_point_objective !== undefined) {
      updates.push('recovery_point_objective = ?');
      params.push(input.recovery_point_objective);
      trackChange('recovery_point_objective', currentCI.recovery_point_objective, input.recovery_point_objective);
    }

    if (input.custom_attributes !== undefined) {
      updates.push('custom_attributes = ?');
      params.push(input.custom_attributes);
      trackChange('custom_attributes', currentCI.custom_attributes, input.custom_attributes);
    }

    if (updates.length === 0) {
      return getConfigurationItemById(organizationId, id);
    }

    updates.push('updated_by = ?');
    params.push(userId);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, organizationId);

    await db.run(
      `UPDATE configuration_items SET ${updates.join(', ')}
       WHERE id = ? AND organization_id = ?`,
      params
    );

    // Create history entries for each changed field
    for (const change of historyEntries) {
      await db.run(
        `INSERT INTO ci_history (
          ci_id, action, field_name, old_value, new_value, changed_by
        ) VALUES (?, 'updated', ?, ?, ?, ?)`,
        [id, change.field, change.oldValue, change.newValue, userId]
      );
    }

    return getConfigurationItemById(organizationId, id);
  });
}

/**
 * Delete a configuration item (soft delete by setting status to Retired)
 */
export async function deleteConfigurationItem(
  organizationId: number,
  id: number,
  userId?: number,
  hardDelete: boolean = false
): Promise<boolean> {
  if (hardDelete) {
    // Hard delete - remove from database
    const result = await executeRun(
      `DELETE FROM configuration_items WHERE id = ? AND organization_id = ?`,
      [id, organizationId]
    );
    return result.changes > 0;
  } else {
    // Soft delete - set status to Retired
    const retiredStatus = await executeQueryOne<CIStatus>(
      `SELECT id FROM ci_statuses WHERE name = 'Retired' LIMIT 1`
    );

    if (!retiredStatus) {
      throw new Error('Retired status not found in ci_statuses');
    }

    const result = await executeRun(
      `UPDATE configuration_items
       SET status_id = ?, retirement_date = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [retiredStatus.id, userId || null, id, organizationId]
    );

    if (result.changes > 0 && userId) {
      await executeRun(
        `INSERT INTO ci_history (
          ci_id, action, changed_by, change_reason
        ) VALUES (?, 'deleted', ?, 'CI retired/deleted')`,
        [id, userId]
      );
    }

    return result.changes > 0;
  }
}

// ============================================
// CI RELATIONSHIP QUERIES
// ============================================

/**
 * Add a relationship between two CIs
 */
export async function addCIRelationship(
  userId: number,
  input: CreateCIRelationship
): Promise<CIRelationship> {
  return executeTransaction(async (db) => {
    const result = await db.run(
      `INSERT INTO ci_relationships (
        source_ci_id, target_ci_id, relationship_type_id,
        description, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.source_ci_id,
        input.target_ci_id,
        input.relationship_type_id,
        input.description || null,
        input.is_active !== false ? 1 : 0,
        userId,
      ]
    );

    // Create history entries for both CIs
    await Promise.all([
      db.run(
        `INSERT INTO ci_history (
          ci_id, action, new_value, changed_by, change_reason
        ) VALUES (?, 'relationship_added', ?, ?, 'Relationship added')`,
        [input.source_ci_id, String(input.target_ci_id), userId]
      ),
      db.run(
        `INSERT INTO ci_history (
          ci_id, action, new_value, changed_by, change_reason
        ) VALUES (?, 'relationship_added', ?, ?, 'Relationship added')`,
        [input.target_ci_id, String(input.source_ci_id), userId]
      ),
    ]);

    const relationship = await db.get<CIRelationship>(
      `SELECT * FROM ci_relationships WHERE id = ?`,
      [result.lastInsertRowid]
    );

    return relationship!;
  });
}

/**
 * Remove a relationship between CIs (scoped to organization via configuration_items)
 */
export async function removeCIRelationship(
  organizationId: number,
  userId: number,
  relationshipId: number
): Promise<boolean> {
  return executeTransaction(async (db) => {
    // Get relationship details before deleting, verify org scope
    const relationship = await db.get<CIRelationship>(
      `SELECT r.* FROM ci_relationships r
       JOIN configuration_items ci ON r.source_ci_id = ci.id
       WHERE r.id = ? AND ci.organization_id = ?`,
      [relationshipId, organizationId]
    );

    if (!relationship) return false;

    // Delete the relationship
    const result = await db.run(
      `DELETE FROM ci_relationships WHERE id = ?`,
      [relationshipId]
    );

    if (result.changes > 0) {
      // Create history entries
      await Promise.all([
        db.run(
          `INSERT INTO ci_history (
            ci_id, action, old_value, changed_by, change_reason
          ) VALUES (?, 'relationship_removed', ?, ?, 'Relationship removed')`,
          [relationship.source_ci_id, String(relationship.target_ci_id), userId]
        ),
        db.run(
          `INSERT INTO ci_history (
            ci_id, action, old_value, changed_by, change_reason
          ) VALUES (?, 'relationship_removed', ?, ?, 'Relationship removed')`,
          [relationship.target_ci_id, String(relationship.source_ci_id), userId]
        ),
      ]);
    }

    return result.changes > 0;
  });
}

/**
 * List all relationships for a CI (both as source and target)
 */
export async function listCIRelationships(ciId: number): Promise<CIRelationshipWithDetails[]> {
  const rows = await executeQuery<any>(
    `SELECT r.*,
       src.id as source__id, src.name as source__name, src.ci_number as source__ci_number,
       src.ci_type_id as source__ci_type_id, src.status_id as source__status_id,
       src.organization_id as source__organization_id,
       tgt.id as target__id, tgt.name as target__name, tgt.ci_number as target__ci_number,
       tgt.ci_type_id as target__ci_type_id, tgt.status_id as target__status_id,
       tgt.organization_id as target__organization_id,
       rt.id as rt__id, rt.name as rt__name, rt.description as rt__description
     FROM ci_relationships r
     LEFT JOIN configuration_items src ON r.source_ci_id = src.id
     LEFT JOIN configuration_items tgt ON r.target_ci_id = tgt.id
     LEFT JOIN ci_relationship_types rt ON r.relationship_type_id = rt.id
     WHERE (r.source_ci_id = ? OR r.target_ci_id = ?) AND r.is_active = 1
     ORDER BY r.created_at DESC`,
    [ciId, ciId]
  );

  return rows.map((row: any) => {
    const {
      source__id, source__name, source__ci_number, source__ci_type_id,
      source__status_id, source__organization_id,
      target__id, target__name, target__ci_number, target__ci_type_id,
      target__status_id, target__organization_id,
      rt__id, rt__name, rt__description,
      ...relFields
    } = row;

    return {
      ...relFields,
      source_ci: source__id ? {
        id: source__id, name: source__name, ci_number: source__ci_number,
        ci_type_id: source__ci_type_id, status_id: source__status_id,
        organization_id: source__organization_id,
      } as ConfigurationItem : undefined,
      target_ci: target__id ? {
        id: target__id, name: target__name, ci_number: target__ci_number,
        ci_type_id: target__ci_type_id, status_id: target__status_id,
        organization_id: target__organization_id,
      } as ConfigurationItem : undefined,
      relationship_type: rt__id ? {
        id: rt__id, name: rt__name, description: rt__description,
      } as CIRelationshipType : undefined,
    };
  });
}

// ============================================
// CI HISTORY QUERIES
// ============================================

/**
 * Get audit history for a CI (scoped to organization via configuration_items)
 */
export async function getCIHistory(
  organizationId: number,
  ciId: number,
  limit: number = 100
): Promise<CIHistory[]> {
  return executeQuery<CIHistory>(
    `SELECT ch.* FROM ci_history ch
     JOIN configuration_items ci ON ch.ci_id = ci.id
     WHERE ch.ci_id = ? AND ci.organization_id = ?
     ORDER BY ch.created_at DESC
     LIMIT ?`,
    [ciId, organizationId, limit]
  );
}

// ============================================
// CI-TICKET LINK QUERIES
// ============================================

/**
 * Link a CI to a ticket
 */
export async function addCITicketLink(
  userId: number,
  input: CreateCITicketLink
): Promise<CITicketLink> {
  const result = await executeRun(
    `INSERT INTO ci_ticket_links (
      ci_id, ticket_id, link_type, notes, created_by
    ) VALUES (?, ?, ?, ?, ?)`,
    [
      input.ci_id,
      input.ticket_id,
      input.link_type,
      input.notes || null,
      userId,
    ]
  );

  const link = await executeQueryOne<CITicketLink>(
    `SELECT * FROM ci_ticket_links WHERE id = ?`,
    [result.lastInsertRowid]
  );

  return link!;
}

/**
 * Remove a CI-ticket link (scoped to organization via configuration_items)
 */
export async function removeCITicketLink(
  organizationId: number,
  linkId: number
): Promise<boolean> {
  // Verify the link belongs to a CI in the organization before deleting
  const link = await executeQueryOne<CITicketLink>(
    `SELECT ctl.* FROM ci_ticket_links ctl
     JOIN configuration_items ci ON ctl.ci_id = ci.id
     WHERE ctl.id = ? AND ci.organization_id = ?`,
    [linkId, organizationId]
  );
  if (!link) return false;

  const result = await executeRun(
    `DELETE FROM ci_ticket_links WHERE id = ?`,
    [linkId]
  );
  return result.changes > 0;
}

/**
 * List all ticket links for a CI (scoped to organization via configuration_items)
 */
export async function listCITicketLinks(
  organizationId: number,
  ciId: number
): Promise<CITicketLink[]> {
  return executeQuery<CITicketLink>(
    `SELECT ctl.* FROM ci_ticket_links ctl
     JOIN configuration_items ci ON ctl.ci_id = ci.id
     WHERE ctl.ci_id = ? AND ci.organization_id = ?
     ORDER BY ctl.created_at DESC`,
    [ciId, organizationId]
  );
}

// ============================================
// IMPACT ANALYSIS
// ============================================

/**
 * Analyze impact of a CI by finding all dependent CIs
 * Uses recursive graph traversal up to 3 levels deep
 */
export async function getImpactAnalysis(
  organizationId: number,
  ciId: number
): Promise<{
  ci: ConfigurationItem;
  direct_dependencies: ConfigurationItem[];
  indirect_dependencies: ConfigurationItem[];
  total_affected: number;
  critical_services: ConfigurationItem[];
}> {
  const ci = await executeQueryOne<ConfigurationItem>(
    `SELECT * FROM configuration_items WHERE id = ? AND organization_id = ?`,
    [ciId, organizationId]
  );

  if (!ci) {
    throw new Error(`CI with ID ${ciId} not found`);
  }

  const visitedIds = new Set<number>([ciId]);
  const directDeps: ConfigurationItem[] = [];
  const indirectDeps: ConfigurationItem[] = [];

  // Helper function to get dependent CIs (CIs that depend on the given CI)
  const getDependentCIs = async (targetId: number): Promise<number[]> => {
    const relationships = await executeQuery<{ source_ci_id: number }>(
      `SELECT DISTINCT source_ci_id FROM ci_relationships
       WHERE target_ci_id = ? AND is_active = 1`,
      [targetId]
    );
    return relationships.map((r) => r.source_ci_id);
  };

  // Level 1: Direct dependencies
  const level1Ids = await getDependentCIs(ciId);
  for (const id of level1Ids) {
    if (!visitedIds.has(id)) {
      visitedIds.add(id);
      const dependentCI = await executeQueryOne<ConfigurationItem>(
        `SELECT * FROM configuration_items WHERE id = ?`,
        [id]
      );
      if (dependentCI) {
        directDeps.push(dependentCI);
      }
    }
  }

  // Level 2 & 3: Indirect dependencies
  const processLevel = async (currentLevelIds: number[]) => {
    const nextLevelIds: number[] = [];
    for (const id of currentLevelIds) {
      const deps = await getDependentCIs(id);
      for (const depId of deps) {
        if (!visitedIds.has(depId)) {
          visitedIds.add(depId);
          nextLevelIds.push(depId);
          const dependentCI = await executeQueryOne<ConfigurationItem>(
            `SELECT * FROM configuration_items WHERE id = ?`,
            [depId]
          );
          if (dependentCI) {
            indirectDeps.push(dependentCI);
          }
        }
      }
    }
    return nextLevelIds;
  };

  // Process level 2
  const level2Ids = await processLevel(level1Ids);

  // Process level 3
  await processLevel(level2Ids);

  // Find critical services (CIs with criticality = 'critical' or 'high')
  const criticalServices = [...directDeps, ...indirectDeps].filter(
    (ci) => ci.criticality === 'critical' || ci.criticality === 'high'
  );

  return {
    ci,
    direct_dependencies: directDeps,
    indirect_dependencies: indirectDeps,
    total_affected: directDeps.length + indirectDeps.length,
    critical_services: criticalServices,
  };
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get CMDB statistics for an organization
 */
export async function getCMDBStatistics(
  organizationId: number
): Promise<{
  total_cis: number;
  by_type: Array<{ type_id: number; type_name: string; count: number }>;
  by_status: Array<{ status_id: number; status_name: string; count: number }>;
  by_environment: Record<string, number>;
  by_criticality: Record<string, number>;
  operational_cis: number;
  non_operational_cis: number;
  expiring_warranties: number;
  end_of_life_soon: number;
}> {
  const [
    totalResult,
    byType,
    byStatus,
    byEnvironment,
    byCriticality,
    operationalCount,
    expiringWarranties,
    endOfLifeSoon,
  ] = await Promise.all([
    // Total CIs
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM configuration_items
       WHERE organization_id = ?`,
      [organizationId]
    ),

    // By type
    executeQuery<{ type_id: number; type_name: string; count: number }>(
      `SELECT ci.ci_type_id as type_id, ct.name as type_name, COUNT(*) as count
       FROM configuration_items ci
       LEFT JOIN ci_types ct ON ci.ci_type_id = ct.id
       WHERE ci.organization_id = ?
       GROUP BY ci.ci_type_id`,
      [organizationId]
    ),

    // By status
    executeQuery<{ status_id: number; status_name: string; count: number }>(
      `SELECT ci.status_id, cs.name as status_name, COUNT(*) as count
       FROM configuration_items ci
       LEFT JOIN ci_statuses cs ON ci.status_id = cs.id
       WHERE ci.organization_id = ?
       GROUP BY ci.status_id`,
      [organizationId]
    ),

    // By environment
    executeQuery<{ environment: string; count: number }>(
      `SELECT environment, COUNT(*) as count
       FROM configuration_items
       WHERE organization_id = ? AND environment IS NOT NULL
       GROUP BY environment`,
      [organizationId]
    ),

    // By criticality
    executeQuery<{ criticality: string; count: number }>(
      `SELECT criticality, COUNT(*) as count
       FROM configuration_items
       WHERE organization_id = ? AND criticality IS NOT NULL
       GROUP BY criticality`,
      [organizationId]
    ),

    // Operational CIs (with operational status)
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM configuration_items ci
       JOIN ci_statuses cs ON ci.status_id = cs.id
       WHERE ci.organization_id = ? AND cs.is_operational = 1`,
      [organizationId]
    ),

    // Expiring warranties (within 90 days)
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM configuration_items
       WHERE organization_id = ?
       AND warranty_expiry IS NOT NULL
       AND ${sqlCastDate('warranty_expiry')} BETWEEN ${sqlCurrentDate()} AND ${sqlDateAdd(90)}`,
      [organizationId]
    ),

    // End of life soon (within 180 days)
    executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM configuration_items
       WHERE organization_id = ?
       AND end_of_life_date IS NOT NULL
       AND ${sqlCastDate('end_of_life_date')} BETWEEN ${sqlCurrentDate()} AND ${sqlDateAdd(180)}`,
      [organizationId]
    ),
  ]);

  const environmentMap: Record<string, number> = {};
  byEnvironment.forEach((e) => {
    if (e.environment) {
      environmentMap[e.environment] = e.count;
    }
  });

  const criticalityMap: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  byCriticality.forEach((c) => {
    if (c.criticality) {
      criticalityMap[c.criticality] = c.count;
    }
  });

  const total = totalResult?.count || 0;
  const operational = operationalCount?.count || 0;

  return {
    total_cis: total,
    by_type: byType,
    by_status: byStatus,
    by_environment: environmentMap,
    by_criticality: criticalityMap,
    operational_cis: operational,
    non_operational_cis: total - operational,
    expiring_warranties: expiringWarranties?.count || 0,
    end_of_life_soon: endOfLifeSoon?.count || 0,
  };
}

// ============================================
// EXPORT ALL
// ============================================

export const cmdbQueries = {
  // CI Number Generator
  generateCINumber,

  // CI Types
  listCITypes,
  createCIType,
  updateCIType,

  // CI Statuses
  listCIStatuses,
  createCIStatus,

  // CI Relationship Types
  listCIRelationshipTypes,

  // Configuration Items
  createConfigurationItem,
  getConfigurationItemById,
  listConfigurationItems,
  updateConfigurationItem,
  deleteConfigurationItem,

  // Relationships
  addCIRelationship,
  removeCIRelationship,
  listCIRelationships,

  // History
  getCIHistory,

  // Ticket Links
  addCITicketLink,
  removeCITicketLink,
  listCITicketLinks,

  // Impact Analysis
  getImpactAnalysis,

  // Statistics
  getCMDBStatistics,
};

export default cmdbQueries;
