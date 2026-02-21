import { NextRequest, NextResponse } from 'next/server'
import { getTenantManager } from '@/lib/tenant/manager'
import { logger } from '@/lib/monitoring/logger';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant

    const tenantManager = getTenantManager()
    const teams = tenantManager.getTeamsByTenant(tenantContext.id)

    return NextResponse.json({
      success: true,
      teams
    })
  } catch (error) {
    logger.error('Error fetching teams', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, {
      requireRoles: ['super_admin', 'tenant_admin'],
    })
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant

    const tenantManager = getTenantManager()
    const data = await request.json()

    // Validate required fields
    if (!data.name || !data.slug || !data.team_type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, slug, team_type' },
        { status: 400 }
      )
    }

    // Create team
    const teamId = tenantManager.createTeam({
      tenant_id: tenantContext.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      team_type: data.team_type,
      specializations: data.specializations || [],
      capabilities: data.capabilities || [],
      icon: data.icon || 'UsersIcon',
      color: data.color || '#3B82F6',
      manager_id: data.manager_id,
      sla_response_time: data.sla_response_time
    })

    // Get the created team
    const team = tenantManager.getTeamById(teamId, tenantContext.id)

    return NextResponse.json({
      success: true,
      team,
      message: 'Team created successfully'
    })
  } catch (error) {
    logger.error('Error creating team', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create team' },
      { status: 500 }
    )
  }
}
