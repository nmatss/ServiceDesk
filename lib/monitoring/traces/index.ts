/**
 * Central de traces customizados
 * Exporta todos os tracers organizados por domínio
 */

// Tracer principal
export { ddTracer, DatadogTracer, Trace, TraceSync } from '../datadog-tracer';
export type { SpanAttributes, TraceContext } from '../datadog-tracer';

// Tracers de autenticação
export {
  traceLogin,
  traceRegister,
  traceVerifyToken,
  traceHashPassword,
  traceVerifyPassword,
  traceGenerateToken,
  traceSSOAuthentication,
  traceMFAVerification,
} from './auth-tracer';

// Tracers de ticket
export {
  traceCreateTicket,
  traceUpdateTicket,
  traceGetTickets,
  traceGetTicketById,
  traceAssignTicket,
  traceResolveTicket,
  traceAddComment,
  traceGetUserTickets,
} from './ticket-tracer';

// Tracers de SLA
export {
  traceCreateSLATracking,
  traceCheckSLACompliance,
  traceUpdateSLAResponse,
  traceUpdateSLAResolution,
  traceGetSLABreaches,
  traceGetUpcomingSLABreaches,
  traceCalculateSLAMetrics,
  traceSLAEscalation,
  traceSLATrendAnalysis,
} from './sla-tracer';

// Tracers de banco de dados
export {
  traceQuery,
  traceTransaction,
  traceInsert,
  traceUpdate,
  traceDelete,
  traceSelect,
  traceConnect,
  traceMigration,
  traceIndexOperation,
  traceVacuum,
  traceBackup,
} from './database-tracer';

// Helpers para trace de APIs
export async function traceAPICall<T>(
  method: string,
  path: string,
  fn: () => Promise<T>,
  attributes: Record<string, any> = {}
): Promise<T> {
  const { ddTracer } = await import('../datadog-tracer');

  return await ddTracer.trace(
    `api.${method.toLowerCase()}`,
    async (span) => {
      span.setAttribute('http.method', method);
      span.setAttribute('http.route', path);
      span.setAttribute('resource.name', `${method} ${path}`);

      Object.entries(attributes).forEach(([key, value]) => {
        if (value !== undefined) {
          span.setAttribute(key, value);
        }
      });

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('http.status_code', 200);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('http.status_code', 500);
        span.setAttribute('error.message', (error as Error).message);

        throw error;
      }
    }
  );
}

// Helper para trace de background jobs
export async function traceBackgroundJob<T>(
  jobName: string,
  jobData: any,
  fn: () => Promise<T>
): Promise<T> {
  const { ddTracer } = await import('../datadog-tracer');

  return await ddTracer.trace(
    `job.${jobName}`,
    async (span) => {
      span.setAttribute('job.name', jobName);
      span.setAttribute('job.data', JSON.stringify(jobData));
      span.setAttribute('resource.name', `Background Job: ${jobName}`);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('job.success', true);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('job.success', false);
        span.setAttribute('error.message', (error as Error).message);

        throw error;
      }
    }
  );
}

// Helper para trace de cache
export async function traceCacheOperation<T>(
  operation: 'get' | 'set' | 'delete' | 'clear',
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const { ddTracer } = await import('../datadog-tracer');

  return await ddTracer.trace(
    `cache.${operation}`,
    async (span) => {
      span.setAttribute('cache.operation', operation);
      span.setAttribute('cache.key', key);
      span.setAttribute('resource.name', `Cache ${operation}: ${key}`);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('cache.hit', operation === 'get' && !!result);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('error.message', (error as Error).message);

        throw error;
      }
    }
  );
}

// Helper para trace de external API
export async function traceExternalAPI<T>(
  serviceName: string,
  method: string,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const { ddTracer } = await import('../datadog-tracer');

  return await ddTracer.trace(
    `external.${serviceName}`,
    async (span) => {
      span.setAttribute('external.service', serviceName);
      span.setAttribute('external.method', method);
      span.setAttribute('external.endpoint', endpoint);
      span.setAttribute('resource.name', `${serviceName}: ${method} ${endpoint}`);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('external.success', true);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('external.success', false);
        span.setAttribute('error.message', (error as Error).message);

        throw error;
      }
    }
  );
}

export default {
  traceAPICall,
  traceBackgroundJob,
  traceCacheOperation,
  traceExternalAPI,
};
