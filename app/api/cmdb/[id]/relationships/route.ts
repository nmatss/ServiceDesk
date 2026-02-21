/**
 * CI Relationships API
 *
 * Manages relationships between Configuration Items in the CMDB.
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter'
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger'
import { z } from 'zod'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
const createRelationshipSchema = z.object({
  child_ci_id: z.number().int().positive(),
  relationship_type_id: z.number().int().positive(),
  is_critical_path: z.boolean().default(false),
  notes: z.string().optional()
})

/**
 * GET /api/cmdb/[id]/relationships - List CI Relationships
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

    // Verify CI exists and belongs to organization
    const ci = await executeQueryOne<{ id: number }>(
      `SELECT id FROM configuration_items WHERE id = ? AND organization_id = ?`,
      [ciId, organizationId]
    )

    if (!ci) {
      return NextResponse.json(
        { success: false, error: 'Item de configuração não encontrado' },
        { status: 404 }
      )
    }

    // Get outgoing relationships (this CI is parent)
    const outgoing = await executeQuery<Record<string, unknown>>(`
      SELECT
        r.*,
        rt.name as relationship_type,
        rt.reverse_name,
        ci.id as related_ci_id,
        ci.ci_number as related_ci_number,
        ci.name as related_ci_name,
        ct.name as related_ci_type,
        ct.icon as related_ci_icon,
        cs.name as related_ci_status,
        cs.color as related_ci_status_color
      FROM ci_relationships r
      LEFT JOIN ci_relationship_types rt ON r.relationship_type_id = rt.id
      LEFT JOIN configuration_items ci ON r.child_ci_id = ci.id
      LEFT JOIN ci_types ct ON ci.ci_type_id = ct.id
      LEFT JOIN ci_statuses cs ON ci.status_id = cs.id
      WHERE r.parent_ci_id = ?
    `, [ciId])

    // Get incoming relationships (this CI is child)
    const incoming = await executeQuery<Record<string, unknown>>(`
      SELECT
        r.*,
        rt.name as relationship_type,
        rt.reverse_name,
        ci.id as related_ci_id,
        ci.ci_number as related_ci_number,
        ci.name as related_ci_name,
        ct.name as related_ci_type,
        ct.icon as related_ci_icon,
        cs.name as related_ci_status,
        cs.color as related_ci_status_color
      FROM ci_relationships r
      LEFT JOIN ci_relationship_types rt ON r.relationship_type_id = rt.id
      LEFT JOIN configuration_items ci ON r.parent_ci_id = ci.id
      LEFT JOIN ci_types ct ON ci.ci_type_id = ct.id
      LEFT JOIN ci_statuses cs ON ci.status_id = cs.id
      WHERE r.child_ci_id = ?
    `, [ciId])

    // Get available relationship types
    const relationshipTypes = await executeQuery<Record<string, unknown>>(`
      SELECT * FROM ci_relationship_types WHERE organization_id = ? OR organization_id IS NULL
    `, [organizationId])

    return NextResponse.json({
      success: true,
      outgoing_relationships: outgoing,
      incoming_relationships: incoming,
      relationship_types: relationshipTypes
    })
  } catch (error) {
    logger.error('Error fetching CI relationships', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar relacionamentos' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cmdb/[id]/relationships - Create CI Relationship
 */
export async function POST(
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
    const parentCiId = parseInt(id)
    if (isNaN(parentCiId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const data = createRelationshipSchema.parse(body)

    // Verify parent CI exists
    const parentCI = await executeQueryOne<{ id: number }>(
      `SELECT id FROM configuration_items WHERE id = ? AND organization_id = ?`,
      [parentCiId, organizationId]
    )

    if (!parentCI) {
      return NextResponse.json(
        { success: false, error: 'Item de configuração pai não encontrado' },
        { status: 404 }
      )
    }

    // Verify child CI exists
    const childCI = await executeQueryOne<{ id: number }>(
      `SELECT id FROM configuration_items WHERE id = ? AND organization_id = ?`,
      [data.child_ci_id, organizationId]
    )

    if (!childCI) {
      return NextResponse.json(
        { success: false, error: 'Item de configuração filho não encontrado' },
        { status: 404 }
      )
    }

    // Check for duplicate relationship
    const existing = await executeQueryOne<{ id: number }>(`
      SELECT id FROM ci_relationships
      WHERE parent_ci_id = ? AND child_ci_id = ? AND relationship_type_id = ?
    `, [parentCiId, data.child_ci_id, data.relationship_type_id])

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Este relacionamento já existe' },
        { status: 400 }
      )
    }

    // Prevent self-relationship
    if (parentCiId === data.child_ci_id) {
      return NextResponse.json(
        { success: false, error: 'Um CI não pode ter relacionamento consigo mesmo' },
        { status: 400 }
      )
    }

    // Create relationship
    const result = await executeRun(`
      INSERT INTO ci_relationships (
        parent_ci_id, child_ci_id, relationship_type_id, is_critical_path, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      parentCiId,
      data.child_ci_id,
      data.relationship_type_id,
      data.is_critical_path ? 1 : 0,
      data.notes || null,
      userId
    ])

    // Log in history for both CIs
    await executeRun(`
      INSERT INTO ci_history (ci_id, action, changes, changed_by)
      VALUES (?, 'relationship_added', ?, ?)
    `, [parentCiId, JSON.stringify({ child_ci_id: data.child_ci_id }), userId])

    await executeRun(`
      INSERT INTO ci_history (ci_id, action, changes, changed_by)
      VALUES (?, 'relationship_added', ?, ?)
    `, [data.child_ci_id, JSON.stringify({ parent_ci_id: parentCiId }), userId])

    // Get created relationship
    const relationship = await executeQueryOne<Record<string, unknown>>(`
      SELECT
        r.*,
        rt.name as relationship_type,
        rt.reverse_name
      FROM ci_relationships r
      LEFT JOIN ci_relationship_types rt ON r.relationship_type_id = rt.id
      WHERE r.id = ?
    `, [result.lastInsertRowid])

    logger.info(`CI relationship created: ${parentCiId} -> ${data.child_ci_id} by user ${userId}`)

    return NextResponse.json({
      success: true,
      relationship,
      message: 'Relacionamento criado com sucesso'
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }
    logger.error('Error creating CI relationship', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar relacionamento' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cmdb/[id]/relationships - Delete CI Relationship
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

    const { searchParams } = new URL(request.url)
    const relationshipId = parseInt(searchParams.get('relationship_id') || '')

    if (isNaN(relationshipId)) {
      return NextResponse.json(
        { success: false, error: 'ID do relacionamento é obrigatório' },
        { status: 400 }
      )
    }

    // Get the relationship
    const relationship = await executeQueryOne<{ parent_ci_id: number; child_ci_id: number; organization_id: number }>(`
      SELECT r.*, ci.organization_id
      FROM ci_relationships r
      LEFT JOIN configuration_items ci ON r.parent_ci_id = ci.id
      WHERE r.id = ? AND (r.parent_ci_id = ? OR r.child_ci_id = ?)
    `, [relationshipId, ciId, ciId])

    if (!relationship) {
      return NextResponse.json(
        { success: false, error: 'Relacionamento não encontrado' },
        { status: 404 }
      )
    }

    if (relationship.organization_id !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Permissão negada' },
        { status: 403 }
      )
    }

    // Delete relationship
    await executeRun(`DELETE FROM ci_relationships WHERE id = ?`, [relationshipId])

    // Log in history
    await executeRun(`
      INSERT INTO ci_history (ci_id, action, changes, changed_by)
      VALUES (?, 'relationship_removed', ?, ?)
    `, [relationship.parent_ci_id, JSON.stringify({ child_ci_id: relationship.child_ci_id }), userId])

    await executeRun(`
      INSERT INTO ci_history (ci_id, action, changes, changed_by)
      VALUES (?, 'relationship_removed', ?, ?)
    `, [relationship.child_ci_id, JSON.stringify({ parent_ci_id: relationship.parent_ci_id }), userId])

    logger.info(`CI relationship deleted: ${relationshipId} by user ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Relacionamento excluído com sucesso'
    })
  } catch (error) {
    logger.error('Error deleting CI relationship', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao excluir relacionamento' },
      { status: 500 }
    )
  }
}
