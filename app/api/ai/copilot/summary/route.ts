/**
 * AI Copilot — Ticket Summary endpoint
 *
 * Generates a structured summary of a ticket including all comments
 * and activities, built entirely from database data (no external AI).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { isPrivileged } from '@/lib/auth/roles';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const summarySchema = z.object({
  ticket_id: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_SUGGEST);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    if (!isPrivileged(auth.role)) {
      return apiError('Permissão insuficiente', 403);
    }

    const body = await request.json();
    const { ticket_id } = summarySchema.parse(body);
    const orgId = auth.organizationId;

    // Fetch ticket
    const ticket = await executeQueryOne<Record<string, unknown>>(
      `SELECT t.id, t.title, t.description, t.created_at, t.updated_at,
              c.name AS category_name,
              p.name AS priority_name,
              s.name AS status_name,
              u.name AS user_name,
              a.name AS assigned_name
       FROM tickets t
       JOIN categories c ON t.category_id = c.id
       JOIN priorities p ON t.priority_id = p.id
       JOIN statuses  s ON t.status_id  = s.id
       JOIN users     u ON t.user_id    = u.id
       LEFT JOIN users a ON t.assigned_to = a.id
       WHERE t.id = ? AND t.organization_id = ?`,
      [ticket_id, orgId],
    );

    if (!ticket) {
      return apiError('Ticket não encontrado', 404);
    }

    // Fetch comments
    const comments = await executeQuery<Record<string, unknown>>(
      `SELECT co.content, co.is_internal, co.created_at,
              u.name AS author_name, u.role AS author_role
       FROM comments co
       JOIN users u ON co.user_id = u.id
       JOIN tickets t ON co.ticket_id = t.id AND t.organization_id = ?
       WHERE co.ticket_id = ?
       ORDER BY co.created_at ASC`,
      [orgId, ticket_id],
    );

    // Fetch activities
    const activities = await executeQuery<Record<string, unknown>>(
      `SELECT ta.action, ta.description, ta.created_at,
              u.name AS actor_name
       FROM ticket_activities ta
       LEFT JOIN users u ON ta.user_id = u.id
       WHERE ta.ticket_id = ?
       ORDER BY ta.created_at ASC
       LIMIT 50`,
      [ticket_id],
    );

    // Build timeline events
    const timelineEvents: Array<{ date: string; event: string; actor: string }> = [];

    // Opening
    timelineEvents.push({
      date: ticket.created_at as string,
      event: `Ticket aberto: "${ticket.title}"`,
      actor: ticket.user_name as string,
    });

    // Activities
    for (const act of activities) {
      timelineEvents.push({
        date: act.created_at as string,
        event: (act.description as string) || (act.action as string) || 'Atividade registrada',
        actor: (act.actor_name as string) || 'Sistema',
      });
    }

    // Key comments (first, last, and any with notable length)
    const publicComments = comments.filter((c) => !c.is_internal);
    if (publicComments.length > 0) {
      timelineEvents.push({
        date: publicComments[0].created_at as string,
        event: `Primeira resposta: "${((publicComments[0].content as string) || '').slice(0, 120)}..."`,
        actor: publicComments[0].author_name as string,
      });
    }
    if (publicComments.length > 1) {
      const last = publicComments[publicComments.length - 1];
      timelineEvents.push({
        date: last.created_at as string,
        event: `Última interação: "${((last.content as string) || '').slice(0, 120)}..."`,
        actor: last.author_name as string,
      });
    }

    // Sort timeline by date
    timelineEvents.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Calculate metrics
    const daysOpen = Math.floor(
      (Date.now() - new Date(ticket.created_at as string).getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalComments = comments.length;
    const internalComments = comments.filter((c) => c.is_internal).length;

    // Determine current status explanation
    const statusName = ((ticket.status_name as string) || '').toLowerCase();
    let statusExplanation = '';
    if (statusName === 'aberto' || statusName === 'open') {
      statusExplanation = 'O ticket está aberto e aguardando atendimento.';
    } else if (statusName === 'em andamento' || statusName === 'in_progress' || statusName === 'em progresso') {
      statusExplanation = 'O ticket está sendo trabalhado pela equipe de suporte.';
    } else if (statusName === 'aguardando' || statusName === 'pending' || statusName === 'aguardando cliente') {
      statusExplanation = 'O ticket aguarda retorno ou informação adicional do solicitante.';
    } else if (statusName === 'resolvido' || statusName === 'resolved') {
      statusExplanation = 'O ticket foi resolvido e aguarda confirmação do solicitante.';
    } else if (statusName === 'fechado' || statusName === 'closed') {
      statusExplanation = 'O ticket está fechado e encerrado.';
    } else {
      statusExplanation = `Status atual: ${ticket.status_name}`;
    }

    // Recommended next step
    let nextStep = 'Acompanhar progresso e atualizar solicitante.';
    if (totalComments === 0) {
      nextStep = 'Enviar primeira resposta ao solicitante o mais rápido possível.';
    } else if (daysOpen > 7 && statusName !== 'resolvido' && statusName !== 'fechado') {
      nextStep = 'Ticket aberto há mais de 7 dias — considerar escalar ou priorizar.';
    } else if (statusName === 'aguardando' || statusName === 'pending') {
      nextStep = 'Aguardando retorno do solicitante. Se não houver resposta em 48h, fazer follow-up.';
    }

    const summary = {
      ticket_id,
      problem: ticket.title as string,
      description: ((ticket.description as string) || '').slice(0, 500),
      category: ticket.category_name as string,
      priority: ticket.priority_name as string,
      status: ticket.status_name as string,
      status_explanation: statusExplanation,
      opened_by: ticket.user_name as string,
      assigned_to: (ticket.assigned_name as string) || 'Não atribuído',
      days_open: daysOpen,
      total_comments: totalComments,
      internal_comments: internalComments,
      timeline: timelineEvents.slice(0, 15),
      recommended_next_step: nextStep,
      generated_at: new Date().toISOString(),
    };

    return apiSuccess(summary);
  } catch (err) {
    logger.error('AI Copilot Summary error', err);

    if (err instanceof z.ZodError) {
      return apiError('Dados inválidos', 400, 'VALIDATION_ERROR');
    }

    return apiError('Erro interno do servidor', 500);
  }
}
