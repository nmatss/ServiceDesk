import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getAllSLAPolicies, createSLAPolicy, getSLAMetrics } from '@/lib/sla';
import { CreateSLAPolicy } from '@/lib/types/database';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// GET - Listar todas as políticas de SLA ou métricas
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    if (!ADMIN_ROLES.includes(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'metrics';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (action === 'metrics' || action === 'overview') {
      const metrics = await getSLAMetrics(startDate || undefined, endDate || undefined);
      const sla = metrics
        ? {
            ...metrics,
            response_sla_rate: (metrics as unknown as Record<string, unknown>).response_sla_rate ?? metrics.response_compliance_percentage ?? 0,
            resolution_sla_rate: (metrics as unknown as Record<string, unknown>).resolution_sla_rate ?? metrics.resolution_compliance_percentage ?? 0,
          }
        : metrics;
      return NextResponse.json({
        success: true,
        metrics,
        sla
      });
    }

    // Lista políticas de SLA
    const policies = getAllSLAPolicies();

    return NextResponse.json({
      success: true,
      policies,
      sla: policies
    });
  } catch (error) {
    logger.error('Error in SLA API', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar nova política de SLA
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, context, response } = requireTenantUserContext(request);
    if (response) return response;

    if (!ADMIN_ROLES.includes(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      priority_id,
      category_id,
      response_time_minutes,
      resolution_time_minutes,
      escalation_time_minutes: _escalation_time_minutes,
      business_hours_only,
      is_active,
    } = body;

    if (!name || !priority_id || !response_time_minutes || !resolution_time_minutes) {
      return NextResponse.json({
        error: 'Campos obrigatórios: name, priority_id, response_time_minutes, resolution_time_minutes'
      }, { status: 400 });
    }

    const policyData: CreateSLAPolicy = {
      name,
      description,
      priority_id: parseInt(priority_id),
      category_id: category_id ? parseInt(category_id) : undefined,
      response_time_hours: Math.ceil(parseInt(response_time_minutes) / 60),
      resolution_time_hours: Math.ceil(parseInt(resolution_time_minutes) / 60),
      business_hours_only: business_hours_only === true,
      is_active: is_active !== false,
      organization_id: context.tenant.id
    };

    const policy = createSLAPolicy(policyData);

    if (!policy) {
      return NextResponse.json({ error: 'Erro ao criar política de SLA' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      policy
    });
  } catch (error) {
    logger.error('Error creating SLA policy', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
