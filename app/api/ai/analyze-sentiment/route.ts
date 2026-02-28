import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import SolutionSuggester from '@/lib/ai/solution-suggester';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
const analyzeSentimentSchema = z.object({
  text: z.string().min(1, 'Text is required').max(5000, 'Text too long'),
  ticketId: z.number().optional(),
  includeHistory: z.boolean().default(true),
  autoAdjustPriority: z.boolean().default(false)
});

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_CLASSIFY);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;
    const organizationId = auth.organizationId;

    // Validar entrada
    const body = await request.json();
    const { text, ticketId, includeHistory, autoAdjustPriority } =
      analyzeSentimentSchema.parse(body);

    // Buscar contexto do ticket se fornecido
    let ticketContext: {
      category: string;
      priority: string;
      priority_level: number;
      priority_id: number;
      daysOpen: number;
      escalationLevel: number;
    } | undefined;
    let conversationHistory;

    if (ticketId) {
      const ticket = await executeQueryOne<any>(`
        SELECT t.*, c.name as category, p.name as priority, p.level as priority_level,
               COUNT(e.id) as escalation_level
        FROM tickets t
        JOIN categories c ON t.category_id = c.id
        JOIN priorities p ON t.priority_id = p.id
        LEFT JOIN escalations e ON t.id = e.ticket_id
        WHERE t.id = ? AND t.organization_id = ?
        GROUP BY t.id
      `, [ticketId, organizationId]);

      if (ticket) {
        // Calculate days open in JS instead of SQLite julianday()
        const createdAt = new Date(ticket.created_at);
        const daysOpen = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        ticketContext = {
          category: ticket.category,
          priority: ticket.priority,
          priority_level: ticket.priority_level,
          priority_id: ticket.priority_id,
          daysOpen,
          escalationLevel: ticket.escalation_level
        };

        // Buscar histórico de conversas se solicitado
        if (includeHistory) {
          const comments = await executeQuery<any>(`
            SELECT c.content, c.created_at
            FROM comments c
            JOIN tickets t ON c.ticket_id = t.id AND t.organization_id = ?
            WHERE c.ticket_id = ?
              AND c.is_internal = 0
            ORDER BY c.created_at DESC
            LIMIT 10
          `, [organizationId, ticketId]);

          conversationHistory = comments.map((comment: any) => ({
            message: comment.content,
            timestamp: comment.created_at
          }));
        }
      }
    }

    // Analisar sentimento usando IA
    const sentimentAnalysis = await SolutionSuggester.analyzeSentiment(
      text,
      conversationHistory,
      ticketContext
    );

    // Salvar análise no banco de dados
    const analysisResult = await executeRun(`
      INSERT INTO ai_suggestions (
        ticket_id, suggestion_type, content, reasoning
      ) VALUES (?, ?, ?, ?)
    `, [ticketId || null,
      'sentiment_analysis',
      JSON.stringify({
        sentiment: sentimentAnalysis.sentiment,
        sentimentScore: sentimentAnalysis.sentimentScore,
        frustrationLevel: sentimentAnalysis.frustrationLevel,
        emotionalUrgency: sentimentAnalysis.emotionalUrgency,
        immediateAttentionRequired: sentimentAnalysis.immediateAttentionRequired
      }),
      `Sentiment analysis: ${sentimentAnalysis.sentiment} (${sentimentAnalysis.sentimentScore})`]);
    const analysisId = analysisResult.lastInsertRowid;

    // Auto-ajustar prioridade se solicitado e necessário
    let priorityAdjusted = false;
    let newPriority;

    if (autoAdjustPriority && ticketId && sentimentAnalysis.priorityAdjustmentNeeded) {
      try {
        // Determinar nova prioridade baseada no sentimento
        let targetPriorityLevel = ticketContext?.priority_level || 2;

        if (sentimentAnalysis.frustrationLevel === 'critical' ||
            sentimentAnalysis.immediateAttentionRequired) {
          targetPriorityLevel = 4; // Crítica
        } else if (sentimentAnalysis.frustrationLevel === 'high') {
          targetPriorityLevel = Math.max(3, targetPriorityLevel); // Alta
        } else if (sentimentAnalysis.frustrationLevel === 'medium') {
          targetPriorityLevel = Math.max(2, targetPriorityLevel); // Média
        }

        // Buscar prioridade correspondente
        const targetPriority = await executeQueryOne<any>(`
          SELECT id, name FROM priorities WHERE level = ?
        `, [targetPriorityLevel]);

        if (targetPriority && targetPriority.id !== ticketContext?.priority_id) {
          // Atualizar prioridade do ticket (scoped by org)
          await executeRun(`
            UPDATE tickets SET priority_id = ? WHERE id = ? AND organization_id = ?
          `, [targetPriority.id, ticketId, organizationId]);

          // Criar escalação automática
          await executeRun(`
            INSERT INTO escalations (ticket_id, escalation_type, reason)
            VALUES (?, ?, ?)
          `, [ticketId,
            'sentiment_analysis',
            `Prioridade ajustada automaticamente devido ao sentimento ${sentimentAnalysis.sentiment} detectado`]);

          // Criar notificação para agentes (scoped by org)
          await executeRun(`
            INSERT INTO notifications (
              user_id, ticket_id, type, title, message
            )
            SELECT u.id, ?, 'ticket_escalated', ?, ?
            FROM users u
            WHERE u.role IN ('agent', 'admin', 'manager')
              AND u.is_active = 1
              AND u.organization_id = ?
          `, [ticketId,
            'Ticket escalado por análise de sentimento',
            `O ticket #${ticketId} foi escalado automaticamente devido ao sentimento negativo detectado`,
            organizationId]);

          priorityAdjusted = true;
          newPriority = {
            id: targetPriority.id,
            name: targetPriority.name,
            level: targetPriorityLevel
          };
        }
      } catch (error) {
        logger.warn('Failed to auto-adjust priority', error);
      }
    }

    // Criar alerta se atenção imediata for necessária
    if (sentimentAnalysis.immediateAttentionRequired) {
      try {
        await executeRun(`
          INSERT INTO notifications (
            user_id, ticket_id, type, title, message
          )
          SELECT u.id, ?, 'urgent_attention', ?, ?
          FROM users u
          WHERE u.role IN ('agent', 'admin', 'manager')
            AND u.is_active = 1
            AND u.organization_id = ?
        `, [ticketId,
          'Atenção imediata necessária',
          `Análise de sentimento detectou urgência emocional crítica no ticket #${ticketId || 'novo'}`,
          organizationId]);
      } catch (error) {
        logger.warn('Failed to create urgent attention notification', error);
      }
    }

    // Log da operação
    logger.info(`Sentiment analysis completed in ${sentimentAnalysis.processingTimeMs}ms`);

    // Auditoria
    await executeRun(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [auth.userId,
      'ai_suggestion',
      analysisId,
      'analyze_sentiment',
      JSON.stringify({
        ticketId,
        sentiment: sentimentAnalysis.sentiment,
        frustrationLevel: sentimentAnalysis.frustrationLevel,
        priorityAdjusted,
        immediateAttention: sentimentAnalysis.immediateAttentionRequired
      }),
      request.headers.get('x-forwarded-for') || 'unknown']);

    return NextResponse.json({
      success: true,
      analysis: {
        id: analysisId,
        sentiment: sentimentAnalysis.sentiment,
        sentimentScore: sentimentAnalysis.sentimentScore,
        frustrationLevel: sentimentAnalysis.frustrationLevel,
        emotionalUrgency: sentimentAnalysis.emotionalUrgency,
        escalationIndicators: sentimentAnalysis.escalationIndicators,
        keyPhrases: sentimentAnalysis.keyPhrases,
        recommendedResponseTone: sentimentAnalysis.recommendedResponseTone,
        priorityAdjustmentNeeded: sentimentAnalysis.priorityAdjustmentNeeded,
        immediateAttentionRequired: sentimentAnalysis.immediateAttentionRequired,
        confidenceScore: sentimentAnalysis.confidenceScore
      },
      actions: {
        priorityAdjusted,
        newPriority,
        urgentNotificationSent: sentimentAnalysis.immediateAttentionRequired
      },
      context: {
        ticketId,
        hasTicketContext: !!ticketContext,
        conversationHistoryLength: (conversationHistory || []).length
      },
      metadata: {
        processingTimeMs: sentimentAnalysis.processingTimeMs,
        analyzedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('AI Sentiment Analysis API error', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_CLASSIFY);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const organizationId = guard.auth.organizationId;

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticketId');
    const period = searchParams.get('period') || '30'; // days

    // Compute date window in JS
    const periodDays = parseInt(period, 10) || 30;
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    if (ticketId) {
      // Buscar análises de sentimento para um ticket específico (scoped by org)
      const analyses = await executeQuery<any>(`
        SELECT s.* FROM ai_suggestions s
        JOIN tickets t ON s.ticket_id = t.id AND t.organization_id = ?
        WHERE s.ticket_id = ? AND s.suggestion_type = 'sentiment_analysis'
        ORDER BY s.created_at DESC
      `, [organizationId, ticketId]);

      return NextResponse.json({ analyses });
    } else {
      // Buscar estatísticas de análise de sentimento
      const stats = await executeQueryOne<any>(`
        SELECT
          COUNT(*) as total_analyses,
          COUNT(CASE WHEN content LIKE '%"sentiment":"positive"%' THEN 1 END) as positive_count,
          COUNT(CASE WHEN content LIKE '%"sentiment":"neutral"%' THEN 1 END) as neutral_count,
          COUNT(CASE WHEN content LIKE '%"sentiment":"negative"%' THEN 1 END) as negative_count,
          COUNT(CASE WHEN content LIKE '%"immediateAttentionRequired":true%' THEN 1 END) as urgent_count
        FROM ai_suggestions
        WHERE created_at >= ?
          AND suggestion_type = 'sentiment_analysis'
      `, [periodStart]);

      const frustrationStats = await executeQuery<any>(`
        SELECT
          CASE
            WHEN content LIKE '%"frustrationLevel":"low"%' THEN 'low'
            WHEN content LIKE '%"frustrationLevel":"medium"%' THEN 'medium'
            WHEN content LIKE '%"frustrationLevel":"high"%' THEN 'high'
            WHEN content LIKE '%"frustrationLevel":"critical"%' THEN 'critical'
            ELSE 'unknown'
          END as frustration_level,
          COUNT(*) as count
        FROM ai_suggestions
        WHERE created_at >= ?
          AND suggestion_type = 'sentiment_analysis'
        GROUP BY frustration_level
        ORDER BY count DESC
      `, [periodStart]);

      const escalationStats = await executeQueryOne<any>(`
        SELECT
          COUNT(*) as total_escalations,
          COUNT(CASE WHEN escalation_type = 'sentiment_analysis' THEN 1 END) as sentiment_escalations
        FROM escalations
        WHERE escalated_at >= ?
      `, [periodStart]);

      // Tendência de sentimento ao longo do tempo (últimos 7 dias)
      const sentimentTrend = await executeQuery<any>(`
        SELECT
          DATE(created_at) as date,
          COUNT(CASE WHEN content LIKE '%"sentiment":"positive"%' THEN 1 END) as positive,
          COUNT(CASE WHEN content LIKE '%"sentiment":"neutral"%' THEN 1 END) as neutral,
          COUNT(CASE WHEN content LIKE '%"sentiment":"negative"%' THEN 1 END) as negative
        FROM ai_suggestions
        WHERE created_at >= ?
          AND suggestion_type = 'sentiment_analysis'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [sevenDaysAgo]);

      return NextResponse.json({
        stats: {
          ...stats,
          sentiment_distribution: {
            positive: stats.positive_count / stats.total_analyses || 0,
            neutral: stats.neutral_count / stats.total_analyses || 0,
            negative: stats.negative_count / stats.total_analyses || 0
          },
          urgent_rate: stats.urgent_count / stats.total_analyses || 0
        },
        frustrationStats,
        escalationStats: {
          ...escalationStats,
          sentiment_escalation_rate: escalationStats.sentiment_escalations / escalationStats.total_escalations || 0
        },
        sentimentTrend
      });
    }

  } catch (error) {
    logger.error('AI Sentiment Analysis GET API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
