/**
 * AI Copilot — Unified endpoint
 *
 * Returns all copilot data for a ticket in a single call:
 * - Suggested response (template-based with KB fallback)
 * - Similar tickets (LIKE-based similarity)
 * - Relevant KB articles
 * - Sentiment analysis (keyword-based)
 * - Ticket summary
 * - Smart actions available
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, type SqlParam } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
import { isPrivileged } from '@/lib/auth/roles';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const copilotSchema = z.object({
  ticket_id: z.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Sentiment helpers (keyword-based, no external API needed)
// ---------------------------------------------------------------------------

const POSITIVE_WORDS = [
  'obrigado', 'obrigada', 'agradeço', 'excelente', 'ótimo', 'perfeito',
  'funcionou', 'resolvido', 'parabéns', 'satisfeito', 'maravilha', 'top',
  'bom', 'boa', 'legal', 'show', 'valeu', 'grato', 'grata',
];

const NEGATIVE_WORDS = [
  'urgente', 'frustrado', 'frustrada', 'insatisfeito', 'insatisfeita',
  'absurdo', 'inaceitável', 'péssimo', 'horrível', 'demora', 'lento',
  'problema', 'erro', 'falha', 'travou', 'parou', 'não funciona',
  'reclamação', 'indignado', 'indignada', 'raiva', 'pior', 'ruim',
  'desculpa', 'bravo', 'brava', 'irritado', 'irritada',
];

interface SentimentResult {
  label: 'positive' | 'neutral' | 'negative';
  score: number; // -1 to 1
  trend: 'improving' | 'stable' | 'declining';
}

function analyzeSentimentKeywords(texts: string[]): SentimentResult {
  if (texts.length === 0) {
    return { label: 'neutral', score: 0, trend: 'stable' };
  }

  const scores = texts.map((text) => {
    const lower = text.toLowerCase();
    let pos = 0;
    let neg = 0;
    for (const w of POSITIVE_WORDS) if (lower.includes(w)) pos++;
    for (const w of NEGATIVE_WORDS) if (lower.includes(w)) neg++;
    const total = pos + neg;
    if (total === 0) return 0;
    return (pos - neg) / total;
  });

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const label: SentimentResult['label'] =
    avgScore > 0.2 ? 'positive' : avgScore < -0.2 ? 'negative' : 'neutral';

  // Trend: compare first half vs second half
  let trend: SentimentResult['trend'] = 'stable';
  if (scores.length >= 2) {
    const mid = Math.floor(scores.length / 2);
    const firstHalf = scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondHalf = scores.slice(mid).reduce((a, b) => a + b, 0) / (scores.length - mid);
    if (secondHalf - firstHalf > 0.15) trend = 'improving';
    else if (firstHalf - secondHalf > 0.15) trend = 'declining';
  }

  return { label, score: Math.round(avgScore * 100) / 100, trend };
}

// ---------------------------------------------------------------------------
// Build a suggested response from KB article or ticket category
// ---------------------------------------------------------------------------

function buildSuggestedResponse(
  ticket: Record<string, unknown>,
  kbArticles: Array<Record<string, unknown>>,
  similarTickets: Array<Record<string, unknown>>,
): { text: string; confidence: number; source: string } {
  const categoryName = (ticket.category_name as string) || 'Geral';
  const userName = (ticket.user_name as string) || 'Cliente';

  // Priority 1: KB article match
  if (kbArticles.length > 0) {
    const article = kbArticles[0];
    const articleContent = (article.content as string || '').slice(0, 500);
    return {
      text:
        `Olá ${userName},\n\n` +
        `Obrigado por entrar em contato. Com base na sua solicitação na categoria "${categoryName}", ` +
        `encontramos um artigo que pode ajudar:\n\n` +
        `**${article.title}**\n${articleContent}${articleContent.length >= 500 ? '...' : ''}\n\n` +
        `Caso a solução acima não resolva, por favor nos informe para que possamos investigar mais a fundo.\n\n` +
        `Atenciosamente,\nEquipe de Suporte`,
      confidence: 78,
      source: 'knowledge_base',
    };
  }

  // Priority 2: Similar resolved ticket
  const resolvedTicket = similarTickets.find(
    (t) => (t.status_name as string)?.toLowerCase() === 'resolvido' ||
           (t.status_name as string)?.toLowerCase() === 'fechado'
  );
  if (resolvedTicket) {
    return {
      text:
        `Olá ${userName},\n\n` +
        `Obrigado por entrar em contato. Identificamos que um chamado semelhante (#${resolvedTicket.id}) ` +
        `já foi resolvido anteriormente na categoria "${categoryName}".\n\n` +
        `Vamos aplicar a mesma solução ao seu caso. Se precisar de algo mais, estamos à disposição.\n\n` +
        `Atenciosamente,\nEquipe de Suporte`,
      confidence: 65,
      source: 'similar_ticket',
    };
  }

  // Priority 3: Generic category-based template
  return {
    text:
      `Olá ${userName},\n\n` +
      `Obrigado por entrar em contato. Recebemos sua solicitação na categoria "${categoryName}" ` +
      `e já estamos analisando o caso.\n\n` +
      `Para que possamos agilizar o atendimento, por favor confirme os seguintes pontos:\n` +
      `1. Desde quando o problema ocorre?\n` +
      `2. Quais passos já foram tentados?\n` +
      `3. Há algum erro ou mensagem exibida?\n\n` +
      `Estamos à disposição.\n\n` +
      `Atenciosamente,\nEquipe de Suporte`,
    confidence: 45,
    source: 'template',
  };
}

// ---------------------------------------------------------------------------
// Determine available smart actions
// ---------------------------------------------------------------------------

interface SmartAction {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  reason?: string;
}

function getSmartActions(
  ticket: Record<string, unknown>,
  sentiment: SentimentResult,
): SmartAction[] {
  const statusName = ((ticket.status_name as string) || '').toLowerCase();
  const priorityName = ((ticket.priority_name as string) || '').toLowerCase();
  const isClosed = statusName === 'fechado' || statusName === 'resolvido';

  return [
    {
      key: 'escalate',
      label: 'Escalar',
      description: 'Escalar para nível superior',
      enabled: !isClosed && (sentiment.label === 'negative' || priorityName === 'crítica' || priorityName === 'alta'),
      reason: isClosed ? 'Ticket já encerrado' : undefined,
    },
    {
      key: 'merge',
      label: 'Merge com ticket',
      description: 'Mesclar com ticket duplicado',
      enabled: !isClosed,
      reason: isClosed ? 'Ticket já encerrado' : undefined,
    },
    {
      key: 'known_error',
      label: 'Marcar Erro Conhecido',
      description: 'Registrar como erro conhecido no ITIL',
      enabled: !isClosed,
      reason: isClosed ? 'Ticket já encerrado' : undefined,
    },
    {
      key: 'reclassify',
      label: 'Reclassificar',
      description: 'Alterar categoria ou prioridade',
      enabled: !isClosed,
      reason: isClosed ? 'Ticket já encerrado' : undefined,
    },
  ];
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_SUGGEST);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const featureGate = await requireFeature(auth.organizationId, 'ai', 'copilot');
    if (featureGate) return featureGate;

    if (!isPrivileged(auth.role)) {
      return apiError('Permissão insuficiente', 403);
    }

    const body = await request.json();
    const { ticket_id } = copilotSchema.parse(body);
    const orgId = auth.organizationId;

    // ---- 1. Fetch ticket with joins ----
    const ticket = await executeQueryOne<Record<string, unknown>>(
      `SELECT t.id, t.title, t.description, t.created_at, t.updated_at,
              t.user_id, t.assigned_to, t.status_id, t.priority_id, t.category_id,
              c.name AS category_name,
              p.name AS priority_name,
              s.name AS status_name,
              u.name AS user_name,
              u.email AS user_email,
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

    // ---- 2. Fetch comments ----
    const comments = await executeQuery<Record<string, unknown>>(
      `SELECT co.id, co.content, co.is_internal, co.created_at,
              u.name AS author_name, u.role AS author_role
       FROM comments co
       JOIN users u ON co.user_id = u.id
       JOIN tickets t ON co.ticket_id = t.id AND t.organization_id = ?
       WHERE co.ticket_id = ?
       ORDER BY co.created_at ASC`,
      [orgId, ticket_id],
    );

    // ---- 3. Similar tickets (keyword LIKE on first 3 significant words) ----
    const titleWords = ((ticket.title as string) || '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 3);

    let similarTickets: Record<string, unknown>[] = [];
    if (titleWords.length > 0) {
      const likeClauses = titleWords.map(() => "(LOWER(t.title) LIKE LOWER(?) ESCAPE '\\')");
      const likeParams: SqlParam[] = titleWords.map((w) => {
        const escaped = w.replace(/%/g, '\\%').replace(/_/g, '\\_');
        return `%${escaped}%`;
      });
      similarTickets = await executeQuery<Record<string, unknown>>(
        `SELECT t.id, t.title, s.name AS status_name, t.created_at, t.updated_at
         FROM tickets t
         JOIN statuses s ON t.status_id = s.id
         WHERE t.organization_id = ?
           AND t.id != ?
           AND (${likeClauses.join(' OR ')})
         ORDER BY t.updated_at DESC
         LIMIT 5`,
        [orgId, ticket_id, ...likeParams],
      );
    }

    // Compute match percentage based on how many keywords matched
    const similarWithScore = similarTickets.map((st) => {
      const stTitle = ((st.title as string) || '').toLowerCase();
      const matches = titleWords.filter((w) => stTitle.includes(w.toLowerCase())).length;
      return { ...st, match_pct: Math.round((matches / Math.max(titleWords.length, 1)) * 100) };
    });

    // ---- 4. Relevant KB articles ----
    const kbWords = titleWords.slice(0, 2);
    let kbArticles: Record<string, unknown>[] = [];
    if (kbWords.length > 0) {
      const isPostgres = getDatabaseType() === 'postgresql';
      const publishedVal = isPostgres ? 'TRUE' : '1';
      const kbLike = kbWords.map(() => "(LOWER(kb.title) LIKE LOWER(?) ESCAPE '\\' OR LOWER(kb.content) LIKE LOWER(?) ESCAPE '\\')");
      const kbParams: SqlParam[] = [];
      for (const w of kbWords) {
        const escaped = w.replace(/%/g, '\\%').replace(/_/g, '\\_');
        kbParams.push(`%${escaped}%`, `%${escaped}%`);
      }
      kbArticles = await executeQuery<Record<string, unknown>>(
        `SELECT kb.id, kb.title, kb.slug, kb.content, kb.helpful_votes, kb.view_count
         FROM kb_articles kb
         WHERE kb.is_published = ${publishedVal}
           AND (kb.organization_id = ? OR kb.organization_id IS NULL)
           AND (${kbLike.join(' OR ')})
         ORDER BY kb.helpful_votes DESC
         LIMIT 5`,
        [orgId, ...kbParams],
      );
    }

    // ---- 5. Sentiment analysis (keyword-based) ----
    const commentTexts = comments.map((c) => (c.content as string) || '');
    const sentiment = analyzeSentimentKeywords([
      (ticket.description as string) || '',
      ...commentTexts,
    ]);

    // ---- 6. Suggested response ----
    const suggestedResponse = buildSuggestedResponse(ticket, kbArticles, similarWithScore);

    // ---- 7. Smart actions ----
    const smartActions = getSmartActions(ticket, sentiment);

    // ---- 8. SLA info ----
    let slaInfo: Record<string, unknown> | null = null;
    try {
      const sla = await executeQueryOne<Record<string, unknown>>(
        `SELECT sl.response_time_hours, sl.resolution_time_hours,
                st.first_response_at, st.resolved_at, st.breached
         FROM sla_tracking st
         JOIN sla_policies sl ON st.sla_policy_id = sl.id
         WHERE st.ticket_id = ?
         LIMIT 1`,
        [ticket_id],
      );
      if (sla) {
        const createdAt = new Date(ticket.created_at as string);
        const resolutionHours = (sla.resolution_time_hours as number) || 24;
        const deadlineMs = createdAt.getTime() + resolutionHours * 60 * 60 * 1000;
        const remainingMs = deadlineMs - Date.now();
        slaInfo = {
          resolution_hours: resolutionHours,
          response_hours: (sla.response_time_hours as number) || 4,
          remaining_ms: remainingMs,
          remaining_label: remainingMs > 0
            ? `${Math.floor(remainingMs / 3600000)}h ${Math.floor((remainingMs % 3600000) / 60000)}m`
            : 'SLA expirado',
          breached: !!(sla.breached) || remainingMs <= 0,
          first_response_at: sla.first_response_at,
          resolved_at: sla.resolved_at,
        };
      }
    } catch {
      // SLA tracking table may not have data — graceful fallback
    }

    // ---- 9. Quick summary ----
    const commentCount = comments.length;
    const daysOpen = Math.floor(
      (Date.now() - new Date(ticket.created_at as string).getTime()) / (1000 * 60 * 60 * 24),
    );
    const summary = {
      problem: (ticket.title as string) || 'Sem título',
      description_preview: ((ticket.description as string) || '').slice(0, 300),
      days_open: daysOpen,
      comment_count: commentCount,
      internal_comments: comments.filter((c) => c.is_internal).length,
      status: ticket.status_name,
      priority: ticket.priority_name,
      category: ticket.category_name,
      assigned_to: ticket.assigned_name || 'Não atribuído',
      recommended_next_step: sentiment.label === 'negative'
        ? 'Priorizar resposta — sentimento negativo detectado'
        : commentCount === 0
          ? 'Enviar primeira resposta ao solicitante'
          : 'Acompanhar progresso e atualizar solicitante',
    };

    return apiSuccess({
      ticket_id,
      summary,
      suggested_response: suggestedResponse,
      similar_tickets: similarWithScore,
      kb_articles: kbArticles.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        helpful_votes: a.helpful_votes,
        view_count: a.view_count,
      })),
      sentiment,
      smart_actions: smartActions,
      sla: slaInfo,
    });
  } catch (err) {
    logger.error('AI Copilot error', err);

    if (err instanceof z.ZodError) {
      return apiError('Dados inválidos', 400, 'VALIDATION_ERROR');
    }

    return apiError('Erro interno do servidor', 500);
  }
}
