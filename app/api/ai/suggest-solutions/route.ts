import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import SolutionSuggester from '@/lib/ai/solution-suggester';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger';
import { verifyToken } from '@/lib/auth/auth-service';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

const suggestSolutionsSchema = z.object({
  ticketId: z.number().optional(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  category: z.string().min(1, 'Category is required'),
  priority: z.string().min(1, 'Priority is required'),
  maxKnowledgeArticles: z.number().min(1).max(10).default(5),
  maxSimilarTickets: z.number().min(1).max(10).default(5),
  includeUserContext: z.boolean().default(true)
});

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting para AI solution suggestions
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_SUGGEST);
  if (rateLimitResponse) return rateLimitResponse;
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

    // Validar entrada
    const body = await request.json();
    const {
      ticketId,
      title,
      description,
      category,
      priority,
      maxKnowledgeArticles,
      maxSimilarTickets,
      includeUserContext
    } = suggestSolutionsSchema.parse(body);

    // Buscar artigos relevantes da knowledge base usando busca textual
    const queryText = `${title} ${description}`;

    // Busca textual para artigos da knowledge base
    const knowledgeArticles = await executeQuery<any>(`
      SELECT id, title, summary, content
      FROM kb_articles
      WHERE is_published = 1
        AND (
          LOWER(title) LIKE LOWER(?) OR
          LOWER(content) LIKE LOWER(?) OR
          LOWER(search_keywords) LIKE LOWER(?)
        )
      ORDER BY
        CASE WHEN LOWER(title) LIKE LOWER(?) THEN 1 ELSE 2 END,
        helpful_votes DESC
      LIMIT ?
    `, [`%${queryText}%`,
      `%${queryText}%`,
      `%${queryText}%`,
      `%${title}%`,
      maxKnowledgeArticles]);

    // Buscar tickets similares resolvidos via busca textual
    const similarTickets = await executeQuery<any>(`
      SELECT t.id, t.title, t.description,
             GROUP_CONCAT(c.content, ' | ') as resolution
      FROM tickets t
      LEFT JOIN comments c ON t.id = c.ticket_id
        AND c.is_internal = 0
        AND c.created_at >= COALESCE(t.resolved_at, datetime('now'))
      WHERE t.resolved_at IS NOT NULL
        AND t.id != COALESCE(?, 0)
        AND (
          LOWER(t.title) LIKE LOWER(?) OR
          LOWER(t.description) LIKE LOWER(?)
        )
      GROUP BY t.id, t.title, t.description
      ORDER BY t.resolved_at DESC
      LIMIT ?
    `, [ticketId, `%${title}%`, `%${description}%`, maxSimilarTickets]);

    // Buscar contexto do usuário se solicitado
    let userContext;
    if (includeUserContext && user.id) {
      try {
        const userTickets = await executeQuery<any>(`
          SELECT c.name as category, COUNT(*) as count
          FROM tickets t
          JOIN categories c ON t.category_id = c.id
          WHERE t.user_id = ?
            AND t.created_at >= datetime('now', '-90 days')
          GROUP BY c.name
          ORDER BY count DESC
          LIMIT 5
        `, [user.id]);

        userContext = {
          role: user.role,
          previousIssues: userTickets.map((ticket: any) => ticket.category)
        };
      } catch (error) {
        logger.warn('Failed to fetch user context', error);
      }
    }

    // Gerar sugestões usando IA
    const suggestions = await SolutionSuggester.suggestSolutions(
      { title, description, category, priority },
      knowledgeArticles,
      similarTickets,
      userContext
    );

    // Salvar sugestão no banco de dados
    const suggestionId = (await executeRun(`
      INSERT INTO ai_suggestions (
        ticket_id, suggestion_type, content, confidence_score,
        model_name, source_type, source_references, reasoning
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [ticketId || null,
      'solution',
      JSON.stringify(suggestions.primarySolution),
      suggestions.confidenceScore,
      suggestions.modelName,
      'hybrid',
      JSON.stringify({
        knowledgeArticles: suggestions.knowledgeBaseReferences,
        similarTickets: similarTickets.map((t: any) => t.id)
      }),
      'AI-generated solution based on knowledge base and similar tickets'])).lastInsertRowid;

    // Log da operação
    logger.info(`Solution suggestion completed for "${title}" in ${suggestions.processingTimeMs}ms`);

    // Auditoria
    await executeRun(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [user.id,
      'ai_suggestion',
      suggestionId,
      'suggest_solution',
      JSON.stringify({
        ticketId,
        title,
        confidence: suggestions.confidenceScore,
        knowledgeArticlesCount: knowledgeArticles.length,
        similarTicketsCount: similarTickets.length
      }),
      request.headers.get('x-forwarded-for') || 'unknown']);

    return NextResponse.json({
      success: true,
      suggestion: {
        id: suggestionId,
        primarySolution: suggestions.primarySolution,
        alternativeSolutions: suggestions.alternativeSolutions,
        escalationTriggers: suggestions.escalationTriggers,
        preventiveMeasures: suggestions.preventiveMeasures,
        confidenceScore: suggestions.confidenceScore,
        requiresSpecialist: suggestions.requiresSpecialist
      },
      sources: {
        knowledgeArticles: knowledgeArticles.map((kb: any) => ({
          id: kb.id,
          title: kb.title,
          relevanceScore: kb.relevanceScore || 0.5
        })),
        similarTickets: similarTickets.map((ticket: any) => ({
          id: ticket.id,
          title: ticket.title,
          similarityScore: ticket.similarityScore || 0.5
        }))
      },
      metadata: {
        processingTimeMs: suggestions.processingTimeMs,
        modelName: suggestions.modelName,
        inputTokens: suggestions.inputTokens,
        outputTokens: suggestions.outputTokens,
        userContextUsed: !!userContext,
        vectorSearchUsed: knowledgeArticles.some(kb => kb.relevanceScore)
      }
    });

  } catch (error) {
    logger.error('AI Solution Suggestion API error', error);

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

    if (ticketId) {
      // Buscar sugestões para um ticket específico
      const suggestions = await executeQuery<any>(`
        SELECT * FROM ai_suggestions
        WHERE ticket_id = ?
        ORDER BY created_at DESC
      `, [ticketId]);

      return NextResponse.json({ suggestions });
    } else {
      // Buscar estatísticas de sugestões
      const stats = await executeQueryOne<any>(`
        SELECT
          COUNT(*) as total_suggestions,
          AVG(confidence_score) as avg_confidence,
          COUNT(CASE WHEN was_used = 1 THEN 1 END) as used_count,
          COUNT(CASE WHEN was_helpful = 1 THEN 1 END) as helpful_count,
          COUNT(CASE WHEN was_helpful = 0 THEN 1 END) as not_helpful_count
        FROM ai_suggestions
        WHERE created_at >= datetime('now', '-30 days')
          AND suggestion_type = 'solution'
      `);

      const sourceStats = await executeQuery<any>(`
        SELECT
          source_type,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence
        FROM ai_suggestions
        WHERE created_at >= datetime('now', '-30 days')
          AND suggestion_type = 'solution'
        GROUP BY source_type
        ORDER BY count DESC
      `);

      return NextResponse.json({
        stats: {
          ...stats,
          helpfulness_rate: stats.helpful_count / (stats.helpful_count + stats.not_helpful_count) || 0,
          usage_rate: stats.used_count / stats.total_suggestions || 0
        },
        sourceStats
      });
    }

  } catch (error) {
    logger.error('AI Solution Suggestion GET API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}