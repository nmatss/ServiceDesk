import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger';

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

    const priorities = await executeQuery(`
      SELECT id, name, level, color, created_at, updated_at
      FROM priorities
      WHERE tenant_id = ?
      ORDER BY level
    `, [auth.organizationId])

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

