import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import SolutionSuggester from '@/lib/ai/solution-suggester';
import { db } from '@/lib/db/connection';
import { logger } from '@/lib/monitoring/logger';

const analyzeSentimentSchema = z.object({
  text: z.string().min(1, 'Text is required').max(5000, 'Text too long'),
  ticketId: z.number().optional(),
  includeHistory: z.boolean().default(true),
  autoAdjustPriority: z.boolean().default(false)
});

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validar entrada
    const body = await request.json();
    const { text, ticketId, includeHistory, autoAdjustPriority } =
      analyzeSentimentSchema.parse(body);

    const startTime = Date.now();

    // Buscar contexto do ticket se fornecido
    let ticketContext;
    let conversationHistory;

    if (ticketId) {
      const ticket = await db.get(`
        SELECT t.*, c.name as category, p.name as priority, p.level as priority_level,
               CAST((julianday('now') - julianday(t.created_at)) AS INTEGER) as days_open,
               COUNT(e.id) as escalation_level
        FROM tickets t
        JOIN categories c ON t.category_id = c.id
        JOIN priorities p ON t.priority_id = p.id
        LEFT JOIN escalations e ON t.id = e.ticket_id
        WHERE t.id = ?
        GROUP BY t.id
      `, [ticketId]);

      if (ticket) {
        ticketContext = {
          category: ticket.category,
          priority: ticket.priority,
          daysOpen: ticket.days_open,
          escalationLevel: ticket.escalation_level
        };

        // Buscar histórico de conversas se solicitado
        if (includeHistory) {
          const comments = await db.all(`
            SELECT content, created_at
            FROM comments
            WHERE ticket_id = ?
              AND is_internal = 0
            ORDER BY created_at DESC
            LIMIT 10
          `, [ticketId]);

          conversationHistory = comments.map(comment => ({
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
    const analysisId = await db.run(`
      INSERT INTO ai_suggestions (
        ticket_id, suggestion_type, content, reasoning
      ) VALUES (?, ?, ?, ?)
    `, [
      ticketId || null,
      'sentiment_analysis',
      JSON.stringify({
        sentiment: sentimentAnalysis.sentiment,
        sentimentScore: sentimentAnalysis.sentimentScore,
        frustrationLevel: sentimentAnalysis.frustrationLevel,
        emotionalUrgency: sentimentAnalysis.emotionalUrgency,
        immediateAttentionRequired: sentimentAnalysis.immediateAttentionRequired
      }),
      `Sentiment analysis: ${sentimentAnalysis.sentiment} (${sentimentAnalysis.sentimentScore})`
    ]);

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
        const targetPriority = await db.get(`
          SELECT id, name FROM priorities WHERE level = ?
        `, [targetPriorityLevel]);

        if (targetPriority && targetPriority.id !== ticketContext?.priority_id) {
          // Atualizar prioridade do ticket
          await db.run(`
            UPDATE tickets SET priority_id = ? WHERE id = ?
          `, [targetPriority.id, ticketId]);

          // Criar escalação automática
          await db.run(`
            INSERT INTO escalations (ticket_id, escalation_type, reason)
            VALUES (?, ?, ?)
          `, [
            ticketId,
            'sentiment_analysis',
            `Prioridade ajustada automaticamente devido ao sentimento ${sentimentAnalysis.sentiment} detectado`
          ]);

          // Criar notificação para agentes
          await db.run(`
            INSERT INTO notifications (
              user_id, ticket_id, type, title, message
            )
            SELECT u.id, ?, 'ticket_escalated', ?, ?
            FROM users u
            WHERE u.role IN ('agent', 'admin', 'manager')
              AND u.is_active = 1
          `, [
            ticketId,
            'Ticket escalado por análise de sentimento',
            `O ticket #${ticketId} foi escalado automaticamente devido ao sentimento negativo detectado`
          ]);

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
        await db.run(`
          INSERT INTO notifications (
            user_id, ticket_id, type, title, message
          )
          SELECT u.id, ?, 'urgent_attention', ?, ?
          FROM users u
          WHERE u.role IN ('agent', 'admin', 'manager')
            AND u.is_active = 1
        `, [
          ticketId,
          'Atenção imediata necessária',
          `Análise de sentimento detectou urgência emocional crítica no ticket #${ticketId || 'novo'}`
        ]);
      } catch (error) {
        logger.warn('Failed to create urgent attention notification', error);
      }
    }

    // Log da operação
    logger.info(`Sentiment analysis completed in ${sentimentAnalysis.processingTimeMs}ms`);

    // Auditoria
    await db.run(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      session.user.id,
      'ai_suggestion',
      analysisId.lastID,
      'analyze_sentiment',
      JSON.stringify({
        ticketId,
        sentiment: sentimentAnalysis.sentiment,
        frustrationLevel: sentimentAnalysis.frustrationLevel,
        priorityAdjusted,
        immediateAttention: sentimentAnalysis.immediateAttentionRequired
      }),
      request.headers.get('x-forwarded-for') || 'unknown'
    ]);

    return NextResponse.json({
      success: true,
      analysis: {
        id: analysisId.lastID,
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
        conversationHistoryLength: conversationHistory?.length || 0
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
        { error: 'Invalid input', details: error.errors },
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
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticketId');
    const period = searchParams.get('period') || '30'; // days

    if (ticketId) {
      // Buscar análises de sentimento para um ticket específico
      const analyses = await db.all(`
        SELECT * FROM ai_suggestions
        WHERE ticket_id = ? AND suggestion_type = 'sentiment_analysis'
        ORDER BY created_at DESC
      `, [ticketId]);

      return NextResponse.json({ analyses });
    } else {
      // Buscar estatísticas de análise de sentimento
      const stats = await db.get(`
        SELECT
          COUNT(*) as total_analyses,
          COUNT(CASE WHEN content LIKE '%"sentiment":"positive"%' THEN 1 END) as positive_count,
          COUNT(CASE WHEN content LIKE '%"sentiment":"neutral"%' THEN 1 END) as neutral_count,
          COUNT(CASE WHEN content LIKE '%"sentiment":"negative"%' THEN 1 END) as negative_count,
          COUNT(CASE WHEN content LIKE '%"immediateAttentionRequired":true%' THEN 1 END) as urgent_count
        FROM ai_suggestions
        WHERE created_at >= datetime('now', '-' || ? || ' days')
          AND suggestion_type = 'sentiment_analysis'
      `, [period]);

      const frustrationStats = await db.all(`
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
        WHERE created_at >= datetime('now', '-' || ? || ' days')
          AND suggestion_type = 'sentiment_analysis'
        GROUP BY frustration_level
        ORDER BY count DESC
      `, [period]);

      const escalationStats = await db.get(`
        SELECT
          COUNT(*) as total_escalations,
          COUNT(CASE WHEN escalation_type = 'sentiment_analysis' THEN 1 END) as sentiment_escalations
        FROM escalations
        WHERE escalated_at >= datetime('now', '-' || ? || ' days')
      `, [period]);

      // Tendência de sentimento ao longo do tempo (últimos 7 dias)
      const sentimentTrend = await db.all(`
        SELECT
          DATE(created_at) as date,
          COUNT(CASE WHEN content LIKE '%"sentiment":"positive"%' THEN 1 END) as positive,
          COUNT(CASE WHEN content LIKE '%"sentiment":"neutral"%' THEN 1 END) as neutral,
          COUNT(CASE WHEN content LIKE '%"sentiment":"negative"%' THEN 1 END) as negative
        FROM ai_suggestions
        WHERE created_at >= datetime('now', '-7 days')
          AND suggestion_type = 'sentiment_analysis'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

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