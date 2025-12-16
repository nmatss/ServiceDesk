import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import SolutionSuggester from '@/lib/ai/solution-suggester';
import db from '@/lib/db/connection';
import { logger } from '@/lib/monitoring/logger';
import { verifyToken } from '@/lib/auth/sqlite-auth';

const generateResponseSchema = z.object({
  ticketId: z.number(),
  responseType: z.enum(['initial_response', 'follow_up', 'resolution', 'escalation']).default('initial_response'),
  tone: z.enum(['professional', 'friendly', 'technical', 'formal']).default('professional'),
  includeKnowledgeBase: z.boolean().default(true),
  maxKnowledgeArticles: z.number().min(1).max(5).default(3),
  customContext: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verificar permissões (apenas agentes e admins podem gerar respostas)
    if (!['agent', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validar entrada
    const body = await request.json();
    const {
      ticketId,
      responseType,
      tone,
      includeKnowledgeBase,
      maxKnowledgeArticles,
      customContext
    } = generateResponseSchema.parse(body);

        // Buscar dados do ticket
    const ticket = db.prepare(`
      SELECT t.*, c.name as category_name, p.name as priority_name,
             s.name as status_name, u.name as user_name, u.email as user_email
      FROM tickets t
      JOIN categories c ON t.category_id = c.id
      JOIN priorities p ON t.priority_id = p.id
      JOIN statuses s ON t.status_id = s.id
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `).get(ticketId) as any;

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Buscar histórico da conversa
    const conversationHistory = db.prepare(`
      SELECT c.content, c.is_internal, c.created_at,
             u.name as user_name, u.role
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = ?
      ORDER BY c.created_at ASC
    `).all(ticketId) as any[];

    // Formatar histórico para o AI
    const formattedHistory = conversationHistory.map(comment => ({
      user: comment.user_name,
      message: comment.content,
      timestamp: comment.created_at,
      isInternal: comment.is_internal
    }));

    // Buscar artigos relevantes da knowledge base
    let knowledgeBase: any[] = [];
    if (includeKnowledgeBase) {
      try {
        const queryText = `${ticket.title} ${ticket.description}`;

        knowledgeBase = db.prepare(`
          SELECT title, content
          FROM kb_articles
          WHERE is_published = 1
            AND (
              LOWER(title) LIKE LOWER(?) OR
              LOWER(content) LIKE LOWER(?) OR
              LOWER(search_keywords) LIKE LOWER(?)
            )
          ORDER BY helpful_votes DESC
          LIMIT ?
        `).all(
          `%${queryText}%`,
          `%${queryText}%`,
          `%${queryText}%`,
          maxKnowledgeArticles
        ) as any[];
      } catch (error) {
        logger.warn('Failed to fetch knowledge base articles', error);
      }
    }

    // Adicionar contexto customizado se fornecido
    if (customContext) {
      knowledgeBase.push({
        title: 'Contexto Adicional',
        content: customContext
      });
    }

    // Gerar resposta usando IA
    const responseGeneration = await SolutionSuggester.generateResponse(
      {
        title: ticket.title,
        description: ticket.description,
        category: ticket.category_name,
        priority: ticket.priority_name
      },
      formattedHistory,
      knowledgeBase,
      tone,
      responseType
    );

    // Salvar sugestão de resposta no banco
    const suggestionId = db.prepare(`
      INSERT INTO ai_suggestions (
        ticket_id, suggestion_type, content, confidence_score,
        model_name, source_type, reasoning
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      ticketId,
      'response',
      responseGeneration.responseText,
      0.85, // Placeholder confidence for response generation
      'gpt-4o-mini',
      'ai_model',
      `Generated ${responseType} response with ${tone} tone`
    );

    // Determinar se deve sugerir escalação baseado no contexto
    const shouldEscalate = responseGeneration.escalationNeeded ||
      ticket.priority_name.toLowerCase() === 'crítica' ||
      conversationHistory.length > 10 ||
      (ticket.created_at && new Date(ticket.created_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    // Log da operação
    logger.info(`Response generation completed for ticket ${ticketId} in ${responseGeneration.processingTimeMs}ms`);

    // Auditoria
    db.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      'ai_suggestion',
      suggestionId.lastInsertRowid,
      'generate_response',
      JSON.stringify({
        ticketId,
        responseType,
        tone,
        responseLength: responseGeneration.responseText.length,
        escalationNeeded: shouldEscalate
      }),
      request.headers.get('x-forwarded-for') || 'unknown'
    );

    return NextResponse.json({
      success: true,
      response: {
        id: suggestionId.lastInsertRowid,
        text: responseGeneration.responseText,
        type: responseGeneration.responseType,
        tone: responseGeneration.toneUsed,
        nextActions: responseGeneration.nextActions,
        escalationNeeded: shouldEscalate,
        estimatedResolutionTime: responseGeneration.estimatedResolutionTime,
        followUpInHours: responseGeneration.followUpInHours
      },
      context: {
        ticket: {
          id: ticket.id,
          title: ticket.title,
          category: ticket.category_name,
          priority: ticket.priority_name,
          status: ticket.status_name,
          userName: ticket.user_name
        },
        conversationLength: conversationHistory.length,
        knowledgeArticlesUsed: knowledgeBase.length,
        knowledgeBaseReferences: responseGeneration.knowledgeBaseReferences
      },
      metadata: {
        processingTimeMs: responseGeneration.processingTimeMs,
        inputTokens: responseGeneration.inputTokens,
        outputTokens: responseGeneration.outputTokens,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('AI Response Generation API error', error);

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
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticketId');
    const responseType = searchParams.get('type');

    if (ticketId) {
      // Buscar histórico de respostas geradas para um ticket
      let query = `
        SELECT * FROM ai_suggestions
        WHERE ticket_id = ? AND suggestion_type = 'response'
      `;
      const params = [ticketId];

      if (responseType) {
        query += ` AND content LIKE ?`;
        params.push(`%"responseType":"${responseType}"%`);
      }

      query += ` ORDER BY created_at DESC`;

      const responses = db.prepare(query).all(...params);

      return NextResponse.json({ responses });
    } else {
      // Buscar estatísticas de geração de respostas
      const stats = db.prepare(`
        SELECT
          COUNT(*) as total_responses,
          COUNT(CASE WHEN was_used = 1 THEN 1 END) as used_count,
          COUNT(CASE WHEN was_helpful = 1 THEN 1 END) as helpful_count,
          AVG(LENGTH(content)) as avg_response_length
        FROM ai_suggestions
        WHERE created_at >= datetime('now', '-30 days')
          AND suggestion_type = 'response'
      `).get() as any;

      const responseTypeStats = db.prepare(`
        SELECT
          CASE
            WHEN content LIKE '%"responseType":"initial_response"%' THEN 'initial_response'
            WHEN content LIKE '%"responseType":"follow_up"%' THEN 'follow_up'
            WHEN content LIKE '%"responseType":"resolution"%' THEN 'resolution'
            WHEN content LIKE '%"responseType":"escalation"%' THEN 'escalation'
            ELSE 'unknown'
          END as response_type,
          COUNT(*) as count
        FROM ai_suggestions
        WHERE created_at >= datetime('now', '-30 days')
          AND suggestion_type = 'response'
        GROUP BY response_type
        ORDER BY count DESC
      `).all() as any[];

      const toneStats = db.prepare(`
        SELECT
          CASE
            WHEN content LIKE '%"tone":"professional"%' THEN 'professional'
            WHEN content LIKE '%"tone":"friendly"%' THEN 'friendly'
            WHEN content LIKE '%"tone":"technical"%' THEN 'technical'
            WHEN content LIKE '%"tone":"formal"%' THEN 'formal'
            ELSE 'unknown'
          END as tone,
          COUNT(*) as count,
          AVG(CASE WHEN was_helpful = 1 THEN 1.0 ELSE 0.0 END) as helpfulness_rate
        FROM ai_suggestions
        WHERE created_at >= datetime('now', '-30 days')
          AND suggestion_type = 'response'
        GROUP BY tone
        ORDER BY count DESC
      `).all() as any[];

      return NextResponse.json({
        stats: {
          ...stats,
          usage_rate: stats.used_count / stats.total_responses || 0,
          helpfulness_rate: stats.helpful_count / stats.used_count || 0
        },
        responseTypeStats,
        toneStats
      });
    }

  } catch (error) {
    logger.error('AI Response Generation GET API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}