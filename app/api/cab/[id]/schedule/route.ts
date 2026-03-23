/**
 * CAB Meeting Schedule API
 *
 * POST /api/cab/[id]/schedule - Create or schedule a CAB meeting
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
import { createCABMeeting, getCABConfigurationById } from '@/lib/db/queries/cab-queries';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const featureGate = await requireFeature(auth!.organizationId, 'itil', 'full');
    if (featureGate) return featureGate;

    const { id } = await params;
    const cabId = parseInt(id, 10);
    if (isNaN(cabId)) {
      return apiError('ID invalido', 400);
    }

    // Verify CAB configuration exists and belongs to the organization
    const cabConfig = await getCABConfigurationById(auth!.organizationId, cabId);
    if (!cabConfig) {
      return apiError('Configuracao CAB nao encontrada', 404);
    }

    const body = await request.json();
    const { scheduled_date, duration_minutes, location, notes } = body;

    if (!scheduled_date || typeof scheduled_date !== 'string') {
      return apiError('scheduled_date e obrigatorio', 400);
    }

    // Validate date
    const date = new Date(scheduled_date);
    if (isNaN(date.getTime())) {
      return apiError('scheduled_date invalido', 400);
    }

    const result = await createCABMeeting(
      auth!.organizationId,
      cabId,
      auth!.userId,
      {
        cab_id: cabId,
        title: `Reuniao CAB - ${cabConfig.name}`,
        scheduled_date,
        meeting_date: scheduled_date,
        meeting_type: 'regular',
        status: 'scheduled',
        agenda: notes || undefined,
      }
    );

    return apiSuccess(result);
  } catch (error) {
    return apiError('Erro ao agendar reuniao CAB', 500);
  }
}
