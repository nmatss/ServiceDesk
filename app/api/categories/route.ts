import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Enable caching for this route - static lookup data
export const dynamic = 'force-static'
export const revalidate = 1800 // 30 minutes

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Get tenant context from middleware
    const tenantContext = getTenantContextFromRequest(request)

    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    // Query categories with tenant isolation
    const categories = db.prepare(`
      SELECT id, name, description, color, created_at, updated_at
      FROM categories
      WHERE tenant_id = ?
      ORDER BY name
    `).all(tenantContext.id)

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
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { name, description, color } = body

    if (!name || !color) {
      return NextResponse.json(
        { error: 'Nome e cor são obrigatórios' },
        { status: 400 }
      )
    }

    const result = db.prepare(`
      INSERT INTO categories (name, description, color, tenant_id)
      VALUES (?, ?, ?, ?)
    `).run(name, description || null, color, tenantContext.id)

    const category = db.prepare(`
      SELECT * FROM categories WHERE id = ?
    `).get(result.lastInsertRowid)

    return NextResponse.json({
      success: true,
      category
    }, { status: 201 })
  } catch (error) {
    logger.error('Error creating category', error)
    return NextResponse.json(
      { error: 'Erro ao criar categoria' },
      { status: 500 }
    )
  }
}

