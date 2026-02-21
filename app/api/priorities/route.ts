import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/adapter';
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
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { success: false, error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const priorities = await executeQuery(`
      SELECT id, name, level, color, created_at, updated_at
      FROM priorities
      WHERE tenant_id = ?
      ORDER BY level
    `, [tenantContext.id])

    // Add cache control headers
    const response = NextResponse.json({
      success: true,
      priorities
    })

    response.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600')

    return response
  } catch (error) {
    logger.error('Error fetching priorities', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

