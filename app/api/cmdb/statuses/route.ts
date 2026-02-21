/**
 * CI Statuses API
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/adapter'
import { requireTenantUserContext } from '@/lib/tenant/request-guard'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { organizationId } = guard.auth!

    const statuses = await executeQuery<Record<string, unknown>>(`
      SELECT * FROM ci_statuses
      WHERE organization_id = ? OR organization_id IS NULL
      ORDER BY display_order ASC, name ASC
    `, [organizationId])

    return NextResponse.json({ success: true, statuses })
  } catch {
    // Return default statuses if table doesn't exist
    return NextResponse.json({
      success: true,
      statuses: [
        { id: 1, name: 'Ativo', color: '#10B981', is_operational: true },
        { id: 2, name: 'Inativo', color: '#6B7280', is_operational: false },
        { id: 3, name: 'Em Manutenção', color: '#F59E0B', is_operational: false },
        { id: 4, name: 'Com Falha', color: '#EF4444', is_operational: false },
        { id: 5, name: 'Aposentado', color: '#374151', is_operational: false },
        { id: 6, name: 'Em Estoque', color: '#3B82F6', is_operational: false },
        { id: 7, name: 'Encomendado', color: '#8B5CF6', is_operational: false }
      ]
    })
  }
}
