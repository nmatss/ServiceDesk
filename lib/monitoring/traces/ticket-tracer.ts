/**
 * Traces customizados para operações de ticket
 */

import { ddTracer } from '../datadog-tracer';
import { logger } from '../logger';

// Span type from OpenTelemetry
type Span = {
  setAttribute(key: string, value: string | number | boolean): void;
};

/**
 * Trace de criação de ticket
 */
export async function traceCreateTicket(
  userId: number,
  organizationId: number,
  ticketData: any,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'ticket.create',
    async (span: Span) => {
      span.setAttribute('ticket.operation', 'create');
      span.setAttribute('ticket.user_id', userId);
      span.setAttribute('ticket.organization_id', organizationId);
      span.setAttribute('ticket.category_id', ticketData.category_id);
      span.setAttribute('ticket.priority_id', ticketData.priority_id);
      span.setAttribute('ticket.status_id', ticketData.status_id);
      span.setAttribute('resource.name', 'POST /api/tickets');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('ticket.id', result.id);
        span.setAttribute('ticket.created', true);
        span.setAttribute('duration_ms', duration);

        logger.userAction('Ticket created', userId, {
          ticket_id: result.id,
          organization_id: organizationId,
          category_id: ticketData.category_id,
          priority_id: ticketData.priority_id,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('ticket.created', false);
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('Ticket creation failed', error, {
          user_id: userId,
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de atualização de ticket
 */
export async function traceUpdateTicket(
  ticketId: number,
  userId: number,
  organizationId: number,
  updates: any,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'ticket.update',
    async (span: Span) => {
      span.setAttribute('ticket.operation', 'update');
      span.setAttribute('ticket.id', ticketId);
      span.setAttribute('ticket.user_id', userId);
      span.setAttribute('ticket.organization_id', organizationId);
      span.setAttribute('resource.name', `PATCH /api/tickets/${ticketId}`);

      // Adicionar campos modificados
      const modifiedFields = Object.keys(updates);
      span.setAttribute('ticket.modified_fields', modifiedFields.join(','));
      span.setAttribute('ticket.modified_count', modifiedFields.length);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('ticket.updated', true);
        span.setAttribute('duration_ms', duration);

        logger.userAction('Ticket updated', userId, {
          ticket_id: ticketId,
          organization_id: organizationId,
          modified_fields: modifiedFields,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('ticket.updated', false);
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('Ticket update failed', error, {
          ticket_id: ticketId,
          user_id: userId,
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de busca de tickets
 */
export async function traceGetTickets(
  organizationId: number,
  filters: any,
  fn: () => Promise<any[]>
): Promise<any[]> {
  return await ddTracer.trace(
    'ticket.list',
    async (span: Span) => {
      span.setAttribute('ticket.operation', 'list');
      span.setAttribute('ticket.organization_id', organizationId);
      span.setAttribute('resource.name', 'GET /api/tickets');

      // Adicionar filtros aplicados
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          span.setAttribute(`ticket.filter.${key}`, String(value));
        });
      }

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('ticket.count', result.length);
        span.setAttribute('duration_ms', duration);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('Ticket list failed', error, {
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de busca de ticket por ID
 */
export async function traceGetTicketById(
  ticketId: number,
  organizationId: number,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'ticket.get',
    async (span: Span) => {
      span.setAttribute('ticket.operation', 'get');
      span.setAttribute('ticket.id', ticketId);
      span.setAttribute('ticket.organization_id', organizationId);
      span.setAttribute('resource.name', `GET /api/tickets/${ticketId}`);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('ticket.found', !!result);
        span.setAttribute('duration_ms', duration);

        if (result) {
          span.setAttribute('ticket.status_id', result.status_id);
          span.setAttribute('ticket.priority_id', result.priority_id);
          span.setAttribute('ticket.category_id', result.category_id);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('ticket.found', false);
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('Ticket get failed', error, {
          ticket_id: ticketId,
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de atribuição de ticket
 */
export async function traceAssignTicket(
  ticketId: number,
  userId: number,
  assignedTo: number,
  organizationId: number,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'ticket.assign',
    async (span: Span) => {
      span.setAttribute('ticket.operation', 'assign');
      span.setAttribute('ticket.id', ticketId);
      span.setAttribute('ticket.user_id', userId);
      span.setAttribute('ticket.assigned_to', assignedTo);
      span.setAttribute('ticket.organization_id', organizationId);
      span.setAttribute('resource.name', `POST /api/tickets/${ticketId}/assign`);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('ticket.assigned', true);
        span.setAttribute('duration_ms', duration);

        logger.userAction('Ticket assigned', userId, {
          ticket_id: ticketId,
          assigned_to: assignedTo,
          organization_id: organizationId,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('ticket.assigned', false);
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('Ticket assignment failed', error, {
          ticket_id: ticketId,
          user_id: userId,
          assigned_to: assignedTo,
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de resolução de ticket
 */
export async function traceResolveTicket(
  ticketId: number,
  userId: number,
  organizationId: number,
  resolution: string,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'ticket.resolve',
    async (span: Span) => {
      span.setAttribute('ticket.operation', 'resolve');
      span.setAttribute('ticket.id', ticketId);
      span.setAttribute('ticket.user_id', userId);
      span.setAttribute('ticket.organization_id', organizationId);
      span.setAttribute('resource.name', `POST /api/tickets/${ticketId}/resolve`);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('ticket.resolved', true);
        span.setAttribute('duration_ms', duration);

        // Calcular tempo de resolução
        if (result.created_at) {
          const createdAt = new Date(result.created_at).getTime();
          const resolvedAt = Date.now();
          const resolutionTime = resolvedAt - createdAt;
          span.setAttribute('ticket.resolution_time_ms', resolutionTime);
        }

        logger.userAction('Ticket resolved', userId, {
          ticket_id: ticketId,
          organization_id: organizationId,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('ticket.resolved', false);
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('Ticket resolution failed', error, {
          ticket_id: ticketId,
          user_id: userId,
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de adição de comentário
 */
export async function traceAddComment(
  ticketId: number,
  userId: number,
  organizationId: number,
  isInternal: boolean,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'ticket.comment.add',
    async (span: Span) => {
      span.setAttribute('ticket.operation', 'add_comment');
      span.setAttribute('ticket.id', ticketId);
      span.setAttribute('ticket.user_id', userId);
      span.setAttribute('ticket.organization_id', organizationId);
      span.setAttribute('comment.is_internal', isInternal);
      span.setAttribute('resource.name', `POST /api/tickets/${ticketId}/comments`);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('comment.id', result.id);
        span.setAttribute('comment.added', true);
        span.setAttribute('duration_ms', duration);

        logger.userAction('Comment added to ticket', userId, {
          ticket_id: ticketId,
          comment_id: result.id,
          organization_id: organizationId,
          is_internal: isInternal,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('comment.added', false);
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('Comment addition failed', error, {
          ticket_id: ticketId,
          user_id: userId,
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de busca de tickets por usuário
 */
export async function traceGetUserTickets(
  userId: number,
  organizationId: number,
  fn: () => Promise<any[]>
): Promise<any[]> {
  return await ddTracer.trace(
    'ticket.user_tickets',
    async (span: Span) => {
      span.setAttribute('ticket.operation', 'user_tickets');
      span.setAttribute('ticket.user_id', userId);
      span.setAttribute('ticket.organization_id', organizationId);
      span.setAttribute('resource.name', `GET /api/tickets/user/${userId}`);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('ticket.count', result.length);
        span.setAttribute('duration_ms', duration);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('error.message', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.error('User tickets fetch failed', error, {
          user_id: userId,
          organization_id: organizationId,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}
