/**
 * CMDB Configuration Item API - Individual CI Operations
 *
 * Provides endpoints for managing individual Configuration Items.
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter'
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger'
import { z } from 'zod'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Validation schema for CI updates
const updateCISchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  ci_type_id: z.number().int().positive().optional(),
  status_id: z.number().int().positive().optional(),
  owner_id: z.number().int().positive().optional().nullable(),
  managed_by_team_id: z.number().int().positive().optional().nullable(),
  vendor: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  environment: z.enum(['production', 'staging', 'development', 'test', 'dr']).optional().nullable(),
  data_center: z.string().optional().nullable(),
  rack_position: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  asset_tag: z.string().optional().nullable(),
  ip_address: z.string().optional().nullable(),
  mac_address: z.string().optional().nullable(),
  hostname: z.string().optional().nullable(),
  os_version: z.string().optional().nullable(),
  business_service: z.string().optional().nullable(),
  criticality: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  business_impact: z.string().optional().nullable(),
  recovery_time_objective: z.number().int().optional().nullable(),
  recovery_point_objective: z.number().int().optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  installation_date: z.string().optional().nullable(),
  warranty_expiry: z.string().optional().nullable(),
  end_of_life_date: z.string().optional().nullable(),
  custom_attributes: z.record(z.string(), z.any()).optional()
})

/**
 * GET /api/cmdb/[id] - Get Configuration Item Details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { organizationId } = guard.auth!

    const { id } = await params
    const ciId = parseInt(id)
    if (isNaN(ciId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Get CI with related data
    const ci = await executeQueryOne<Record<string, unknown>>(`
      SELECT
        ci.*,
        ct.name as ci_type_name,
        ct.icon as ci_type_icon,
        ct.color as ci_type_color,
        cs.name as status_name,
        cs.color as status_color,
        cs.is_operational,
        u.name as owner_name,
        u.email as owner_email,
        t.name as team_name
      FROM configuration_items ci
      LEFT JOIN ci_types ct ON ci.ci_type_id = ct.id
      LEFT JOIN ci_statuses cs ON ci.status_id = cs.id
      LEFT JOIN users u ON ci.owner_id = u.id
      LEFT JOIN teams t ON ci.managed_by_team_id = t.id
      WHERE ci.id = ? AND ci.organization_id = ?
    `, [ciId, organizationId])

    if (!ci) {
      return NextResponse.json(
        { success: false, error: 'Item de configuração não encontrado' },
        { status: 404 }
      )
    }

    // Get relationships
    const relationships = await executeQuery<Record<string, unknown>>(`
      SELECT
        r.*,
        rt.name as relationship_type_name,
        rt.reverse_name,
        ci_parent.name as parent_name,
        ci_parent.ci_number as parent_ci_number,
        ci_child.name as child_name,
        ci_child.ci_number as child_ci_number
      FROM ci_relationships r
      LEFT JOIN ci_relationship_types rt ON r.relationship_type_id = rt.id
      LEFT JOIN configuration_items ci_parent ON r.parent_ci_id = ci_parent.id
      LEFT JOIN configuration_items ci_child ON r.child_ci_id = ci_child.id
      WHERE r.parent_ci_id = ? OR r.child_ci_id = ?
    `, [ciId, ciId])

    // Get recent history
    const history = await executeQuery<Record<string, unknown>>(`
      SELECT
        h.*,
        u.name as changed_by_name
      FROM ci_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.ci_id = ?
      ORDER BY h.changed_at DESC
      LIMIT 20
    `, [ciId])

    // Get linked tickets
    const linkedTickets = await executeQuery<Record<string, unknown>>(`
      SELECT
        ctl.*,
        t.title as ticket_title,
        t.status as ticket_status,
        t.priority as ticket_priority
      FROM ci_ticket_links ctl
      LEFT JOIN tickets t ON ctl.ticket_id = t.id
      WHERE ctl.ci_id = ?
      ORDER BY ctl.linked_at DESC
      LIMIT 10
    `, [ciId])

    return NextResponse.json({
      success: true,
      configuration_item: ci,
      relationships,
      history,
      linked_tickets: linkedTickets
    })
  } catch (error) {
    logger.error('Error fetching configuration item', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar item de configuração' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/cmdb/[id] - Update Configuration Item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId, role } = guard.auth!

    // Check permissions
    if (!['admin', 'agent', 'manager'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Permissão negada' },
        { status: 403 }
      )
    }

    const { id } = await params
    const ciId = parseInt(id)
    if (isNaN(ciId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const data = updateCISchema.parse(body)

    // Check if CI exists
    const existingCI = await executeQueryOne<Record<string, unknown>>(
      `SELECT * FROM configuration_items WHERE id = ? AND organization_id = ?`,
      [ciId, organizationId]
    )

    if (!existingCI) {
      return NextResponse.json(
        { success: false, error: 'Item de configuração não encontrado' },
        { status: 404 }
      )
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: unknown[] = []
    const changes: Record<string, { old: unknown; new: unknown }> = {}

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        const dbValue = key === 'custom_attributes' ? JSON.stringify(value) : value
        updates.push(`${key} = ?`)
        values.push(dbValue)

        if (existingCI[key] !== value) {
          changes[key] = { old: existingCI[key], new: value }
        }
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhuma alteração fornecida' },
        { status: 400 }
      )
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(ciId, organizationId)

    await executeRun(`
      UPDATE configuration_items
      SET ${updates.join(', ')}
      WHERE id = ? AND organization_id = ?
    `, values)

    // Log changes in history
    if (Object.keys(changes).length > 0) {
      await executeRun(`
        INSERT INTO ci_history (ci_id, action, changes, changed_by)
        VALUES (?, 'updated', ?, ?)
      `, [ciId, JSON.stringify(changes), userId])
    }

    // Get updated CI
    const updatedCI = await executeQueryOne<Record<string, unknown>>(
      `SELECT * FROM configuration_items WHERE id = ?`,
      [ciId]
    )

    logger.info(`CI updated: ${ciId} by user ${userId}`)

    return NextResponse.json({
      success: true,
      configuration_item: updatedCI,
      message: 'Item de configuração atualizado com sucesso'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }
    logger.error('Error updating configuration item', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar item de configuração' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cmdb/[id] - Delete Configuration Item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId, role } = guard.auth!

    // Only admins can delete CIs
    if (role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Apenas administradores podem excluir itens de configuração' },
        { status: 403 }
      )
    }

    const { id } = await params
    const ciId = parseInt(id)
    if (isNaN(ciId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Check if CI exists
    const existingCI = await executeQueryOne<{ ci_number: string }>(
      `SELECT * FROM configuration_items WHERE id = ? AND organization_id = ?`,
      [ciId, organizationId]
    )

    if (!existingCI) {
      return NextResponse.json(
        { success: false, error: 'Item de configuração não encontrado' },
        { status: 404 }
      )
    }

    // Delete relationships first
    await executeRun(`DELETE FROM ci_relationships WHERE parent_ci_id = ? OR child_ci_id = ?`, [ciId, ciId])

    // Delete ticket links
    await executeRun(`DELETE FROM ci_ticket_links WHERE ci_id = ?`, [ciId])

    // Delete history
    await executeRun(`DELETE FROM ci_history WHERE ci_id = ?`, [ciId])

    // Delete CI
    await executeRun(`DELETE FROM configuration_items WHERE id = ?`, [ciId])

    logger.info(`CI deleted: ${existingCI.ci_number} by user ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Item de configuração excluído com sucesso'
    })
  } catch (error) {
    logger.error('Error deleting configuration item', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao excluir item de configuração' },
      { status: 500 }
    )
  }
}
