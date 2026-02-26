import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)

    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    // SECURITY: Require authentication for updating categories
    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    // Only admins can update categories
    if (!['super_admin', 'tenant_admin', 'admin'].includes(userContext.role)) {
      return NextResponse.json(
        { error: 'Permissão insuficiente' },
        { status: 403 }
      )
    }

    const { id: idParam } = await params
    const id = parseInt(idParam)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      )
    }

    // Verify category exists and belongs to tenant
    const existing = await executeQueryOne(`
      SELECT * FROM categories WHERE id = ? AND tenant_id = ?
    `, [id, tenantContext.id])

    if (!existing) {
      return NextResponse.json(
        { error: 'Categoria não encontrada' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, description, color } = body

    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []

    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }
    if (color !== undefined) {
      updates.push('color = ?')
      values.push(color)
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: true,
        category: existing
      })
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id, tenantContext.id)

    await executeRun(`
      UPDATE categories
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, values)

    const category = await executeQueryOne(`
      SELECT * FROM categories WHERE id = ?
    `, [id])

    return NextResponse.json({
      success: true,
      category
    })
  } catch (error) {
    logger.error('Error updating category', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar categoria' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)

    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    // SECURITY: Require authentication for deleting categories
    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    // Only admins can delete categories
    if (!['super_admin', 'tenant_admin', 'admin'].includes(userContext.role)) {
      return NextResponse.json(
        { error: 'Permissão insuficiente' },
        { status: 403 }
      )
    }

    const { id: idParam } = await params
    const id = parseInt(idParam)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      )
    }

    // Check if category has tickets
    const ticketCount = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE category_id = ?
    `, [id]) || { count: 0 }

    if (ticketCount.count > 0) {
      return NextResponse.json(
        { error: `Não é possível deletar. ${ticketCount.count} ticket(s) usando esta categoria.` },
        { status: 400 }
      )
    }

    const result = await executeRun(`
      DELETE FROM categories
      WHERE id = ? AND tenant_id = ?
    `, [id, tenantContext.id])

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Categoria não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Categoria deletada com sucesso'
    })
  } catch (error) {
    logger.error('Error deleting category', error)
    return NextResponse.json(
      { error: 'Erro ao deletar categoria' },
      { status: 500 }
    )
  }
}
