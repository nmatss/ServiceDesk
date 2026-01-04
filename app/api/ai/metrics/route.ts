/**
 * AI Metrics API
 * Comprehensive metrics and analytics for AI model performance
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';
import AITrainingSystem from '@/lib/ai/training-system';
import AIModelManager from '@/lib/ai/model-manager';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET /api/ai/metrics
 * Get comprehensive AI performance metrics
 *
 * Query parameters:
 * - period?: 'hour' | 'day' | 'week' | 'month' | 'all' (default: 'day')
 * - modelVersion?: string (specific model version)
 * - organizationId?: number
 * - includeDetails?: boolean (default: false)
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_CLASSIFY);
  if (rateLimitResponse) return rateLimitResponse;

  const startTime = Date.now();

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
    const period = searchParams.get('period') || 'day';
    const modelVersion = searchParams.get('modelVersion');
    const organizationId = searchParams.get('organizationId');
    const includeDetails = searchParams.get('includeDetails') === 'true';

    // Calculate time window
    const timeWindow = getTimeWindow(period);

    // Initialize managers
    const trainingSystem = new AITrainingSystem(db);
    const modelManager = new AIModelManager(db);
    await modelManager.initialize();

    // Get classification metrics
    const classificationMetrics = await getClassificationMetrics(
      timeWindow,
      modelVersion,
      organizationId
    );

    // Get suggestion metrics
    const suggestionMetrics = await getSuggestionMetrics(
      timeWindow,
      modelVersion,
      organizationId
    );

    // Get model performance metrics
    const performanceMetrics = await trainingSystem.calculatePerformanceMetrics(
      modelVersion || 'current',
      organizationId ? parseInt(organizationId) : undefined
    );

    // Get cost and efficiency metrics
    const costMetrics = await getCostMetrics(
      timeWindow,
      modelVersion
    );

    // Get training data quality metrics
    const dataQualityMetrics = await trainingSystem.getDataQualityStats();

    // Get active models
    const activeModels = await modelManager.getAllModels();
    const activeModelsList = activeModels.filter(m => m.status === 'active');

    // Calculate overall system health
    const systemHealth = calculateSystemHealth({
      classification: classificationMetrics,
      suggestions: suggestionMetrics,
      performance: performanceMetrics,
      cost: costMetrics
    });

    const response = {
      success: true,
      period: {
        type: period,
        start: timeWindow,
        end: new Date().toISOString()
      },
      metrics: {
        classification: classificationMetrics,
        suggestions: suggestionMetrics,
        performance: performanceMetrics,
        cost: costMetrics,
        dataQuality: dataQualityMetrics
      },
      models: {
        active: activeModelsList.length,
        total: activeModels.length,
        list: includeDetails ? activeModelsList : undefined
      },
      systemHealth,
      processingTime: Date.now() - startTime
    };

    return NextResponse.json(response);

  } catch (error: any) {
    logger.error('AI Metrics Error', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve metrics' },
      { status: 500 }
    );
  }
}

/**
 * Get classification metrics for a time period
 */
async function getClassificationMetrics(
  timeWindow: string,
  modelVersion?: string | null,
  organizationId?: string | null
) {
  const whereClause = buildWhereClause(timeWindow, modelVersion, organizationId);

  const stats = db.prepare(
    `SELECT
      COUNT(*) as total_classifications,
      COUNT(CASE WHEN was_accepted = 1 THEN 1 END) as accepted,
      COUNT(CASE WHEN was_accepted = 0 THEN 1 END) as rejected,
      COUNT(CASE WHEN corrected_category_id IS NOT NULL THEN 1 END) as corrected,
      AVG(confidence_score) as avg_confidence,
      AVG(processing_time_ms) as avg_processing_time,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens
    FROM ai_classifications
    ${whereClause}`
  ).get() as any;

  // Get distribution by category
  const categoryDistribution = db.prepare(
    `SELECT
      c.name as category,
      COUNT(*) as count,
      COUNT(CASE WHEN was_accepted = 1 THEN 1 END) as accepted
    FROM ai_classifications ac
    LEFT JOIN categories c ON ac.suggested_category_id = c.id
    ${whereClause}
    GROUP BY c.name
    ORDER BY count DESC
    LIMIT 10`
  ).all();

  // Get distribution by priority
  const priorityDistribution = db.prepare(
    `SELECT
      p.name as priority,
      COUNT(*) as count,
      COUNT(CASE WHEN was_accepted = 1 THEN 1 END) as accepted
    FROM ai_classifications ac
    LEFT JOIN priorities p ON ac.suggested_priority_id = p.id
    ${whereClause}
    GROUP BY p.name
    ORDER BY count DESC`
  ).all();

  const accuracy = stats.total_classifications > 0
    ? stats.accepted / stats.total_classifications
    : 0;

  const correctionRate = stats.total_classifications > 0
    ? stats.corrected / stats.total_classifications
    : 0;

  return {
    totalClassifications: stats.total_classifications || 0,
    accepted: stats.accepted || 0,
    rejected: stats.rejected || 0,
    corrected: stats.corrected || 0,
    accuracy,
    correctionRate,
    avgConfidence: stats.avg_confidence || 0,
    avgProcessingTime: stats.avg_processing_time || 0,
    totalInputTokens: stats.total_input_tokens || 0,
    totalOutputTokens: stats.total_output_tokens || 0,
    categoryDistribution,
    priorityDistribution
  };
}

/**
 * Get suggestion metrics for a time period
 */
async function getSuggestionMetrics(
  timeWindow: string,
  modelVersion?: string | null,
  organizationId?: string | null
) {
  const whereClause = buildWhereClause(timeWindow, modelVersion, organizationId);

  const stats = db.prepare(
    `SELECT
      COUNT(*) as total_suggestions,
      COUNT(CASE WHEN was_used = 1 THEN 1 END) as used,
      COUNT(CASE WHEN was_helpful = 1 THEN 1 END) as helpful,
      COUNT(CASE WHEN was_helpful = 0 THEN 1 END) as not_helpful,
      AVG(confidence_score) as avg_confidence
    FROM ai_suggestions
    ${whereClause}`
  ).get() as any;

  // Get distribution by type
  const typeDistribution = db.prepare(
    `SELECT
      suggestion_type,
      COUNT(*) as count,
      COUNT(CASE WHEN was_used = 1 THEN 1 END) as used,
      COUNT(CASE WHEN was_helpful = 1 THEN 1 END) as helpful
    FROM ai_suggestions
    ${whereClause}
    GROUP BY suggestion_type
    ORDER BY count DESC`
  ).all();

  const usageRate = stats.total_suggestions > 0
    ? stats.used / stats.total_suggestions
    : 0;

  const helpfulnessRate = (stats.helpful + stats.not_helpful) > 0
    ? stats.helpful / (stats.helpful + stats.not_helpful)
    : 0;

  return {
    totalSuggestions: stats.total_suggestions || 0,
    used: stats.used || 0,
    helpful: stats.helpful || 0,
    notHelpful: stats.not_helpful || 0,
    usageRate,
    helpfulnessRate,
    avgConfidence: stats.avg_confidence || 0,
    typeDistribution
  };
}

/**
 * Get cost and efficiency metrics
 */
async function getCostMetrics(
  timeWindow: string,
  modelVersion?: string | null
) {
  const whereClause = buildWhereClause(timeWindow, modelVersion);

  const stats = db.prepare(
    `SELECT
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      COUNT(*) as total_operations,
      AVG(processing_time_ms) as avg_processing_time,
      MIN(processing_time_ms) as min_processing_time,
      MAX(processing_time_ms) as max_processing_time
    FROM ai_classifications
    ${whereClause}`
  ).get() as any;

  // Cost calculation (approximate based on OpenAI pricing)
  const inputCostPer1M = 0.15; // $0.15 per 1M input tokens (gpt-4o)
  const outputCostPer1M = 0.60; // $0.60 per 1M output tokens (gpt-4o)

  const totalInputCost = (stats.total_input_tokens || 0) * (inputCostPer1M / 1_000_000);
  const totalOutputCost = (stats.total_output_tokens || 0) * (outputCostPer1M / 1_000_000);
  const totalCost = totalInputCost + totalOutputCost;

  const avgCostPerOperation = stats.total_operations > 0
    ? totalCost / stats.total_operations
    : 0;

  return {
    totalInputTokens: stats.total_input_tokens || 0,
    totalOutputTokens: stats.total_output_tokens || 0,
    totalTokens: (stats.total_input_tokens || 0) + (stats.total_output_tokens || 0),
    totalCostUSD: totalCost,
    avgCostPerOperation,
    totalOperations: stats.total_operations || 0,
    avgProcessingTime: stats.avg_processing_time || 0,
    minProcessingTime: stats.min_processing_time || 0,
    maxProcessingTime: stats.max_processing_time || 0
  };
}

/**
 * Build WHERE clause for queries
 */
function buildWhereClause(
  timeWindow: string,
  modelVersion?: string | null,
  organizationId?: string | null
): string {
  const conditions: string[] = ['1=1'];

  if (timeWindow && timeWindow !== 'all') {
    conditions.push(`created_at >= '${timeWindow}'`);
  }

  if (modelVersion) {
    conditions.push(`model_name = '${modelVersion}'`);
  }

  if (organizationId) {
    conditions.push(`organization_id = ${organizationId}`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

/**
 * Get time window based on period
 */
function getTimeWindow(period: string): string {
  const now = new Date();

  switch (period) {
    case 'hour':
      now.setHours(now.getHours() - 1);
      break;
    case 'day':
      now.setDate(now.getDate() - 1);
      break;
    case 'week':
      now.setDate(now.getDate() - 7);
      break;
    case 'month':
      now.setMonth(now.getMonth() - 1);
      break;
    case 'all':
      return '';
    default:
      now.setDate(now.getDate() - 1);
  }

  return now.toISOString();
}

/**
 * Calculate overall system health score
 */
function calculateSystemHealth(metrics: any): {
  score: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Check classification accuracy
  if (metrics.classification.accuracy < 0.85) {
    score -= 20;
    issues.push(`Low classification accuracy: ${(metrics.classification.accuracy * 100).toFixed(1)}%`);
    recommendations.push('Review training data and consider model retraining');
  }

  // Check suggestion usage rate
  if (metrics.suggestions.usageRate < 0.5) {
    score -= 15;
    issues.push(`Low suggestion usage: ${(metrics.suggestions.usageRate * 100).toFixed(1)}%`);
    recommendations.push('Improve suggestion relevance or adjust confidence thresholds');
  }

  // Check processing time
  if (metrics.cost.avgProcessingTime > 5000) {
    score -= 10;
    issues.push(`High processing time: ${metrics.cost.avgProcessingTime.toFixed(0)}ms`);
    recommendations.push('Optimize model configuration or increase compute resources');
  }

  // Check confidence scores
  if (metrics.classification.avgConfidence < 0.7) {
    score -= 15;
    issues.push(`Low confidence scores: ${(metrics.classification.avgConfidence * 100).toFixed(1)}%`);
    recommendations.push('Collect more training data for edge cases');
  }

  // Check correction rate
  if (metrics.classification.correctionRate > 0.2) {
    score -= 10;
    issues.push(`High correction rate: ${(metrics.classification.correctionRate * 100).toFixed(1)}%`);
    recommendations.push('Analyze common correction patterns and retrain model');
  }

  // Determine status
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (score >= 85) {
    status = 'healthy';
  } else if (score >= 60) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return { score, status, issues, recommendations };
}

/**
 * POST /api/ai/metrics
 * Record custom metrics or trigger metric calculations
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_CLASSIFY);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'calculate':
        // Trigger metric calculation
        const trainingSystem = new AITrainingSystem(db);
        const metrics = await trainingSystem.calculatePerformanceMetrics();

        return NextResponse.json({
          success: true,
          metrics,
          message: 'Metrics calculated successfully'
        });

      case 'export':
        // Export metrics data
        const period = body.period || 'month';
        const timeWindow = getTimeWindow(period);

        const exportData = {
          generatedAt: new Date().toISOString(),
          period: { type: period, start: timeWindow },
          classification: await getClassificationMetrics(timeWindow),
          suggestions: await getSuggestionMetrics(timeWindow),
          cost: await getCostMetrics(timeWindow)
        };

        return new NextResponse(JSON.stringify(exportData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename=ai-metrics-${period}-${Date.now()}.json`
          }
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: calculate, export' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    logger.error('AI Metrics POST Error', error);
    return NextResponse.json(
      { error: error.message || 'Operation failed' },
      { status: 500 }
    );
  }
}
