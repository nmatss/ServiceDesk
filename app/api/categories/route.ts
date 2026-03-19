import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger';
import { isAdmin } from '@/lib/auth/roles';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Dynamic route - needs request cookies/headers for tenant resolution
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, context, response: authResponse } = requireTenantUserContext(request)
    if (authResponse) return authResponse

    // Query categories with tenant isolation
    const categories = await executeQuery(`
      SELECT id, name, description, color, created_at, updated_at
      FROM categories
      WHERE tenant_id = ?
      ORDER BY name
    `, [auth.organizationId])

    // Add cache control headers
    const response = NextResponse.json({
      success: true,
      categories
    })

    response.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600')

    return response
  } catch (error) {
    logger.error('Error fetching categories', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, context, response } = requireTenantUserContext(request)
    if (response) return response

    // Only admins can create categories
    if (!isAdmin(auth.role)) {
      return NextResponse.json(
        { success: false, error: 'Permissão insuficiente' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, color } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Nome é obrigatório' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ success: false, error: 'Nome deve ter no máximo 100 caracteres' }, { status: 400 });
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
      return NextResponse.json({ success: false, error: 'Descrição deve ser texto' }, { status: 400 });
    }
    if (typeof description === 'string' && description.length > 500) {
      return NextResponse.json({ success: false, error: 'Descrição deve ter no máximo 500 caracteres' }, { status: 400 });
    }

    if (!color) {
      return NextResponse.json(
        { success: false, error: 'Cor é obrigatória' },
        { status: 400 }
      )
    }

    const result = await executeRun(`
      INSERT INTO categories (name, description, color, tenant_id)
      VALUES (?, ?, ?, ?)
    `, [name, description || null, color, auth.organizationId])

    const category = await executeQueryOne(`
      SELECT * FROM categories WHERE id = ?
    `, [result.lastInsertRowid])

    return NextResponse.json({
      success: true,
      category
    }, { status: 201 })
  } catch (error) {
    logger.error('Error creating category', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar categoria' },
      { status: 500 }
    )
  }
}

