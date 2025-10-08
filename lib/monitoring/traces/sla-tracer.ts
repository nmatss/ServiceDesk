/**
 * Traces customizados para operações de SLA
 */

import { ddTracer, SpanAttributes } from '../datadog-tracer';
import { logger } from '../logger';

/**
 * Trace de criação de SLA tracking
 */
export async function traceCreateSLATracking(
  ticketId: number,
  slaPolicy: any,
  organizationId: number,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'sla.create_tracking',
    async (span) => {
      span.setAttribute('sla.operation', 'create_tracking');
      span.setAttribute('sla.ticket_id', ticketId);
      span.setAttribute('sla.policy_id', slaPolicy.id);
      span.setAttribute('sla.policy_name', slaPolicy.name);
      span.setAttribute('sla.organization_id', organizationId);
      span.setAttribute('sla.response_time_minutes', slaPolicy.response_time_minutes);
      span.setAttribute('sla.resolution_time_minutes', slaPolicy.resolution_time_minutes);
      span.setAttribute('resource.name', 'SLA Tracking Creation');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('sla.tracking_id', result.id);
        span.setAttribute('sla.created', true);
        span.setAttribute('duration_ms', duration);

        logger.info('SLA tracking created', {
          ticket_id: ticketId,
          sla_policy_id: slaPolicy.id,
          organization_id: organizationId,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('sla.created', false);
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('SLA tracking creation failed', error, {
          ticket_id: ticketId,
          sla_policy_id: slaPolicy.id,
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de verificação de SLA
 */
export async function traceCheckSLACompliance(
  ticketId: number,
  slaTrackingId: number,
  organizationId: number,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'sla.check_compliance',
    async (span) => {
      span.setAttribute('sla.operation', 'check_compliance');
      span.setAttribute('sla.ticket_id', ticketId);
      span.setAttribute('sla.tracking_id', slaTrackingId);
      span.setAttribute('sla.organization_id', organizationId);
      span.setAttribute('resource.name', 'SLA Compliance Check');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('sla.response_met', result.response_met);
        span.setAttribute('sla.resolution_met', result.resolution_met);
        span.setAttribute('sla.is_breached', result.is_breached);
        span.setAttribute('duration_ms', duration);

        if (result.response_time_minutes) {
          span.setAttribute('sla.response_time_minutes', result.response_time_minutes);
        }

        if (result.resolution_time_minutes) {
          span.setAttribute('sla.resolution_time_minutes', result.resolution_time_minutes);
        }

        // Log breach se ocorreu
        if (result.is_breached) {
          logger.warn('SLA breach detected', {
            ticket_id: ticketId,
            sla_tracking_id: slaTrackingId,
            organization_id: organizationId,
            response_met: result.response_met,
            resolution_met: result.resolution_met,
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('SLA compliance check failed', error, {
          ticket_id: ticketId,
          sla_tracking_id: slaTrackingId,
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de atualização de SLA (resposta)
 */
export async function traceUpdateSLAResponse(
  ticketId: number,
  slaTrackingId: number,
  organizationId: number,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'sla.update_response',
    async (span) => {
      span.setAttribute('sla.operation', 'update_response');
      span.setAttribute('sla.ticket_id', ticketId);
      span.setAttribute('sla.tracking_id', slaTrackingId);
      span.setAttribute('sla.organization_id', organizationId);
      span.setAttribute('resource.name', 'SLA Response Update');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('sla.response_met', result.response_met);
        span.setAttribute('sla.response_time_minutes', result.response_time_minutes || 0);
        span.setAttribute('duration_ms', duration);

        logger.info('SLA response updated', {
          ticket_id: ticketId,
          sla_tracking_id: slaTrackingId,
          organization_id: organizationId,
          response_met: result.response_met,
          response_time_minutes: result.response_time_minutes,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('SLA response update failed', error, {
          ticket_id: ticketId,
          sla_tracking_id: slaTrackingId,
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de atualização de SLA (resolução)
 */
export async function traceUpdateSLAResolution(
  ticketId: number,
  slaTrackingId: number,
  organizationId: number,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'sla.update_resolution',
    async (span) => {
      span.setAttribute('sla.operation', 'update_resolution');
      span.setAttribute('sla.ticket_id', ticketId);
      span.setAttribute('sla.tracking_id', slaTrackingId);
      span.setAttribute('sla.organization_id', organizationId);
      span.setAttribute('resource.name', 'SLA Resolution Update');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('sla.resolution_met', result.resolution_met);
        span.setAttribute('sla.resolution_time_minutes', result.resolution_time_minutes || 0);
        span.setAttribute('duration_ms', duration);

        logger.info('SLA resolution updated', {
          ticket_id: ticketId,
          sla_tracking_id: slaTrackingId,
          organization_id: organizationId,
          resolution_met: result.resolution_met,
          resolution_time_minutes: result.resolution_time_minutes,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('SLA resolution update failed', error, {
          ticket_id: ticketId,
          sla_tracking_id: slaTrackingId,
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de busca de breaches
 */
export async function traceGetSLABreaches(
  organizationId: number,
  fn: () => Promise<any[]>
): Promise<any[]> {
  return await ddTracer.trace(
    'sla.get_breaches',
    async (span) => {
      span.setAttribute('sla.operation', 'get_breaches');
      span.setAttribute('sla.organization_id', organizationId);
      span.setAttribute('resource.name', 'GET /api/sla/breaches');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('sla.breaches_count', result.length);
        span.setAttribute('duration_ms', duration);

        // Contar por tipo de breach
        const responseBreaches = result.filter((b: any) => !b.response_met).length;
        const resolutionBreaches = result.filter((b: any) => !b.resolution_met).length;

        span.setAttribute('sla.response_breaches', responseBreaches);
        span.setAttribute('sla.resolution_breaches', resolutionBreaches);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('SLA breaches fetch failed', error, {
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de busca de SLAs próximos ao breach
 */
export async function traceGetUpcomingSLABreaches(
  organizationId: number,
  thresholdMinutes: number,
  fn: () => Promise<any[]>
): Promise<any[]> {
  return await ddTracer.trace(
    'sla.get_upcoming_breaches',
    async (span) => {
      span.setAttribute('sla.operation', 'get_upcoming_breaches');
      span.setAttribute('sla.organization_id', organizationId);
      span.setAttribute('sla.threshold_minutes', thresholdMinutes);
      span.setAttribute('resource.name', 'GET /api/sla/upcoming-breaches');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('sla.upcoming_breaches_count', result.length);
        span.setAttribute('duration_ms', duration);

        // Calcular tempo médio até breach
        if (result.length > 0) {
          const avgMinutesUntilBreach = result.reduce((sum: number, b: any) => {
            const minMinutes = Math.min(
              b.minutes_until_response_breach || Infinity,
              b.minutes_until_resolution_breach || Infinity
            );
            return sum + (minMinutes === Infinity ? 0 : minMinutes);
          }, 0) / result.length;

          span.setAttribute('sla.avg_minutes_until_breach', Math.round(avgMinutesUntilBreach));
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('Upcoming SLA breaches fetch failed', error, {
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de cálculo de métricas de SLA
 */
export async function traceCalculateSLAMetrics(
  organizationId: number,
  period: string,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'sla.calculate_metrics',
    async (span) => {
      span.setAttribute('sla.operation', 'calculate_metrics');
      span.setAttribute('sla.organization_id', organizationId);
      span.setAttribute('sla.period', period);
      span.setAttribute('resource.name', 'SLA Metrics Calculation');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('sla.total_tickets', result.total_tickets || 0);
        span.setAttribute('sla.response_compliance_rate', result.response_compliance_rate || 0);
        span.setAttribute('sla.resolution_compliance_rate', result.resolution_compliance_rate || 0);
        span.setAttribute('sla.avg_response_time', result.avg_response_time || 0);
        span.setAttribute('sla.avg_resolution_time', result.avg_resolution_time || 0);
        span.setAttribute('duration_ms', duration);

        logger.info('SLA metrics calculated', {
          organization_id: organizationId,
          period,
          total_tickets: result.total_tickets,
          response_compliance_rate: result.response_compliance_rate,
          resolution_compliance_rate: result.resolution_compliance_rate,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('SLA metrics calculation failed', error, {
          organization_id: organizationId,
          period,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de escalonamento de SLA
 */
export async function traceSLAEscalation(
  ticketId: number,
  slaTrackingId: number,
  organizationId: number,
  escalationLevel: number,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'sla.escalation',
    async (span) => {
      span.setAttribute('sla.operation', 'escalation');
      span.setAttribute('sla.ticket_id', ticketId);
      span.setAttribute('sla.tracking_id', slaTrackingId);
      span.setAttribute('sla.organization_id', organizationId);
      span.setAttribute('sla.escalation_level', escalationLevel);
      span.setAttribute('resource.name', 'SLA Escalation');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('sla.escalation_complete', true);
        span.setAttribute('duration_ms', duration);

        logger.warn('SLA escalation triggered', {
          ticket_id: ticketId,
          sla_tracking_id: slaTrackingId,
          organization_id: organizationId,
          escalation_level: escalationLevel,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('sla.escalation_complete', false);
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('SLA escalation failed', error, {
          ticket_id: ticketId,
          sla_tracking_id: slaTrackingId,
          organization_id: organizationId,
          escalation_level: escalationLevel,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de análise de tendências de SLA
 */
export async function traceSLATrendAnalysis(
  organizationId: number,
  period: string,
  fn: () => Promise<any[]>
): Promise<any[]> {
  return await ddTracer.trace(
    'sla.trend_analysis',
    async (span) => {
      span.setAttribute('sla.operation', 'trend_analysis');
      span.setAttribute('sla.organization_id', organizationId);
      span.setAttribute('sla.period', period);
      span.setAttribute('resource.name', 'SLA Trend Analysis');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('sla.data_points', result.length);
        span.setAttribute('duration_ms', duration);

        // Calcular tendência geral
        if (result.length >= 2) {
          const firstPoint = result[0];
          const lastPoint = result[result.length - 1];

          const responseRateTrend = lastPoint.response_sla_rate - firstPoint.response_sla_rate;
          const resolutionRateTrend = lastPoint.resolution_sla_rate - firstPoint.resolution_sla_rate;

          span.setAttribute('sla.response_rate_trend', responseRateTrend);
          span.setAttribute('sla.resolution_rate_trend', resolutionRateTrend);
          span.setAttribute('sla.trend_improving', responseRateTrend >= 0 && resolutionRateTrend >= 0);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('SLA trend analysis failed', error, {
          organization_id: organizationId,
          period,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}
