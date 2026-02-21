/**
 * AI Feedback API
 * Endpoint for submitting feedback on AI operations to improve model performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { createTrainingSystem } from '@/lib/ai/factories';
import { verifyToken } from '@/lib/auth/auth-service';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * POST /api/ai/feedback
 * Submit feedback for AI operations
 *
 * Body parameters:
 * - operationType: 'classification' | 'suggestion' | 'sentiment'
 * - operationId: number (ID of the AI operation)
 * - feedback: 'positive' | 'negative'
 * - correctedCategory?: string
 * - correctedPriority?: string
 * - comment?: string
 * - wasHelpful?: boolean
 * - wasUsed?: boolean
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_CLASSIFY);
  if (rateLimitResponse) return rateLimitResponse;

  const startTime = Date.now();

  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      operationType,
      operationId,
      feedback,
      correctedCategory,
      correctedPriority,
      comment,
      wasHelpful,
      wasUsed
    } = body;

    // Validate required fields
    if (!operationType || !operationId || !feedback) {
      return NextResponse.json(
        { error: 'Missing required fields: operationType, operationId, feedback' },
        { status: 400 }
      );
    }

    const trainingSystem = createTrainingSystem();

    switch (operationType) {
      case 'classification':
        // Process classification feedback
        await trainingSystem.processFeedback(
          operationId,
          feedback,
          correctedCategory,
          correctedPriority,
          payload.id
        );

        // Update classification record with feedback
        await executeRun(`UPDATE ai_classifications SET
            was_accepted = ?,
            feedback_by = ?,
            feedback_at = CURRENT_TIMESTAMP,
            corrected_category_id = (
              SELECT id FROM categories WHERE name = ? LIMIT 1
            )
          WHERE id = ?`, [feedback === 'positive' ? 1 : 0,
          payload.id,
          correctedCategory || null,
          operationId]);

        break;

      case 'suggestion':
        // Process suggestion feedback
        await executeRun(`UPDATE ai_suggestions SET
            was_used = ?,
            was_helpful = ?,
            feedback_comment = ?,
            feedback_by = ?,
            feedback_at = CURRENT_TIMESTAMP,
            used_by = ?,
            used_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE used_at END
          WHERE id = ?`, [wasUsed ? 1 : 0,
          wasHelpful !== undefined ? (wasHelpful ? 1 : 0) : null,
          comment || null,
          payload.id,
          wasUsed ? payload.id : null,
          wasUsed ? 1 : 0,
          operationId]);

        // If suggestion was not helpful, add to training data
        if (wasHelpful === false) {
          const suggestion = await executeQueryOne('SELECT * FROM ai_suggestions WHERE id = ?', [operationId]);

          if (suggestion && (suggestion as any).ticket_id) {
            const ticket = await executeQueryOne('SELECT title, description FROM tickets WHERE id = ?', [(suggestion as any).ticket_id]);

            if (ticket) {
              await trainingSystem.addTrainingData(
                `${(ticket as any).title}\n${(ticket as any).description}`,
                { needsImprovement: true, originalSuggestion: (suggestion as any).content },
                { suggestion: (suggestion as any).content, wasHelpful: false },
                'suggestion',
                0.3, // Low quality score for rejected suggestions
                true,
                'user'
              );
            }
          }
        }

        break;

      case 'sentiment':
        // Process sentiment analysis feedback
        await executeRun(`INSERT INTO ai_feedback (
            operation_type, operation_id, feedback_type,
            feedback_comment, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, ['sentiment',
          operationId,
          feedback,
          comment || null,
          payload.id]);

        break;

      default:
        return NextResponse.json(
          { error: 'Invalid operationType. Use: classification, suggestion, sentiment' },
          { status: 400 }
        );
    }

    // Log the feedback submission
    logger.info('AI Feedback Submitted', {
      userId: payload.id,
      operationType,
      operationId,
      feedback,
      processingTime: Date.now() - startTime
    });

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      processingTime: Date.now() - startTime
    });

  } catch (error: any) {
    logger.error('AI Feedback Error', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/feedback
 * Get feedback statistics and analysis
 *
 * Query parameters:
 * - operationType?: 'classification' | 'suggestion' | 'sentiment'
 * - dateFrom?: ISO date string
 * - dateTo?: ISO date string
 * - limit?: number (default: 100)
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_CLASSIFY);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const operationType = searchParams.get('operationType');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query based on operation type
    let stats;

    if (!operationType || operationType === 'classification') {
      // Get classification feedback stats
      const params = [dateFrom, dateTo].filter(Boolean);
      stats = await executeQueryOne(`SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN was_accepted = 1 THEN 1 END) as accepted,
          COUNT(CASE WHEN was_accepted = 0 THEN 1 END) as rejected,
          COUNT(CASE WHEN feedback_by IS NOT NULL THEN 1 END) as with_feedback,
          AVG(confidence_score) as avg_confidence,
          COUNT(CASE WHEN corrected_category_id IS NOT NULL THEN 1 END) as corrections
        FROM ai_classifications
        WHERE 1=1
          ${dateFrom ? 'AND created_at >= ?' : ''}
          ${dateTo ? 'AND created_at <= ?' : ''}`, params);

      // Get breakdown by model
      const byModel = await executeQuery(`SELECT
          model_name,
          COUNT(*) as total,
          COUNT(CASE WHEN was_accepted = 1 THEN 1 END) as accepted,
          AVG(confidence_score) as avg_confidence
        FROM ai_classifications
        WHERE 1=1
          ${dateFrom ? 'AND created_at >= ?' : ''}
          ${dateTo ? 'AND created_at <= ?' : ''}
        GROUP BY model_name
        ORDER BY total DESC`, params);

      (stats as any).byModel = byModel;
    }

    if (!operationType || operationType === 'suggestion') {
      // Get suggestion feedback stats
      const params = [dateFrom, dateTo].filter(Boolean);
      const suggestionStats = await executeQueryOne(`SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN was_used = 1 THEN 1 END) as used,
          COUNT(CASE WHEN was_helpful = 1 THEN 1 END) as helpful,
          COUNT(CASE WHEN was_helpful = 0 THEN 1 END) as not_helpful,
          AVG(confidence_score) as avg_confidence
        FROM ai_suggestions
        WHERE 1=1
          ${dateFrom ? 'AND created_at >= ?' : ''}
          ${dateTo ? 'AND created_at <= ?' : ''}`, params);

      if (operationType === 'suggestion') {
        stats = suggestionStats;
      } else if (stats) {
        (stats as any).suggestions = suggestionStats;
      }
    }

    // Calculate overall metrics
    const s = stats as any;
    const overallMetrics = {
      accuracyRate: s?.total > 0 ? (s.accepted / s.total) : 0,
      feedbackRate: s?.total > 0 ? (s.with_feedback / s.total) : 0,
      correctionRate: s?.total > 0 ? (s.corrections / s.total) : 0,
      usageRate: s?.suggestions?.total > 0 ? (s.suggestions.used / s.suggestions.total) : 0,
      helpfulnessRate: s?.suggestions?.total > 0 ? (s.suggestions.helpful / (s.suggestions.helpful + s.suggestions.not_helpful || 1)) : 0
    };

    return NextResponse.json({
      success: true,
      stats,
      overallMetrics,
      period: {
        from: dateFrom || 'all_time',
        to: dateTo || 'now'
      }
    });

  } catch (error: any) {
    logger.error('AI Feedback GET Error', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve feedback' },
      { status: 500 }
    );
  }
}
