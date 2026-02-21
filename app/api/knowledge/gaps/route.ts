/**
 * Content Gap Analysis API
 * Identifies topics that need knowledge base articles
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/monitoring/logger';
import { executeQuery, getDbType } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, {
      requireRoles: ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'],
    })
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const minTickets = parseInt(searchParams.get('minTickets') || '5');

    // Find topics with many tickets but few articles
    const gaps = await analyzeContentGaps(tenantContext.id, days, minTickets);

    return NextResponse.json({
      success: true,
      gaps,
      analyzed_period_days: days,
      min_ticket_threshold: minTickets
    });
  } catch (error) {
    logger.error('Error analyzing content gaps', error);
    return NextResponse.json(
      { error: 'Failed to analyze content gaps' },
      { status: 500 }
    );
  }
}

/**
 * Analyze content gaps
 */
async function analyzeContentGaps(tenantId: number, days: number, minTickets: number) {
  try {
    // Get ticket topics without articles
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const dbType = getDbType();
    const sampleTitlesAgg = dbType === 'postgresql'
      ? "string_agg(DISTINCT SUBSTRING(t.title, 1, 50), ',')"
      : "GROUP_CONCAT(DISTINCT SUBSTR(t.title, 1, 50))";
    const resolutionExpr = "(CASE WHEN s.is_final = 1 OR s.is_final = TRUE THEN 1 ELSE 0 END)";

    const gaps = await executeQuery<any>(`
      SELECT
        c.id as category_id,
        c.name as category,
        COUNT(DISTINCT t.id) as ticket_count,
        COUNT(DISTINCT ka.id) as article_count,
        ${sampleTitlesAgg} as sample_titles,
        AVG(${resolutionExpr}) as resolution_rate,
        AVG(ss.rating) as avg_satisfaction
      FROM categories c
      LEFT JOIN tickets t ON c.id = t.category_id
        AND t.created_at >= ?
        AND t.tenant_id = ?
      LEFT JOIN kb_articles ka ON c.id = ka.category_id
        AND ka.status = 'published'
        AND (ka.tenant_id = ? OR ka.tenant_id IS NULL)
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN satisfaction_surveys ss ON t.id = ss.ticket_id
      WHERE c.tenant_id = ?
      GROUP BY c.id, c.name
      HAVING COUNT(DISTINCT t.id) >= ?
      ORDER BY (ticket_count - article_count) DESC, ticket_count DESC
      LIMIT 20
      `, [cutoffDate, tenantId, tenantId, tenantId, minTickets]);

    // Analyze each gap
    const analyzedGaps = gaps.map((gap: any) => {
      const impact = calculateImpact(gap);
      const priority = determinePriority(gap, impact);
      const suggestedTopics = extractTopics(gap.sample_titles);

      return {
        category_id: gap.category_id,
        category: gap.category,
        ticket_count: gap.ticket_count,
        article_count: gap.article_count || 0,
        gap_size: gap.ticket_count - (gap.article_count || 0),
        resolution_rate: Math.round((gap.resolution_rate || 0) * 100),
        avg_satisfaction: gap.avg_satisfaction ? gap.avg_satisfaction.toFixed(1) : 'N/A',
        priority,
        impact,
        suggested_topics: suggestedTopics,
        recommended_templates: recommendTemplates(gap)
      };
    });

    return analyzedGaps;
  } catch (error) {
    logger.error('Error in analyzeContentGaps', error);
    throw error;
  }
}

/**
 * Calculate impact score
 */
function calculateImpact(gap: any): number {
  let impact = 0;

  // Volume impact (40 points)
  const ticketCount = gap.ticket_count || 0;
  if (ticketCount >= 50) impact += 40;
  else if (ticketCount >= 20) impact += 30;
  else if (ticketCount >= 10) impact += 20;
  else impact += 10;

  // Resolution rate impact (30 points)
  const resolutionRate = gap.resolution_rate || 0;
  if (resolutionRate < 0.5) impact += 30; // Low resolution = high impact
  else if (resolutionRate < 0.7) impact += 20;
  else impact += 10;

  // Satisfaction impact (30 points)
  const satisfaction = gap.avg_satisfaction || 0;
  if (satisfaction > 0) {
    if (satisfaction < 3) impact += 30; // Low satisfaction = high impact
    else if (satisfaction < 4) impact += 20;
    else impact += 10;
  } else {
    impact += 15; // No data = medium impact
  }

  return impact;
}

/**
 * Determine priority level
 */
function determinePriority(gap: any, impact: number): 'critical' | 'high' | 'medium' | 'low' {
  const articleCount = gap.article_count || 0;
  const ticketCount = gap.ticket_count || 0;

  if (articleCount === 0 && ticketCount >= 20 && impact >= 70) {
    return 'critical';
  } else if (articleCount === 0 && ticketCount >= 10) {
    return 'high';
  } else if (articleCount < 2 && ticketCount >= 15) {
    return 'high';
  } else if (impact >= 60) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Extract common topics from titles
 */
function extractTopics(sampleTitles: string): string[] {
  if (!sampleTitles) return [];

  const titles = sampleTitles.split(',');
  const wordFrequency: Record<string, number> = {};

  // Stop words to exclude
  const stopWords = new Set([
    'how', 'to', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'for',
    'with', 'about', 'as', 'by', 'is', 'are', 'was', 'were', 'be', 'been',
    'not', 'can', 'could', 'should', 'would', 'my', 'your', 'our'
  ]);

  // Extract words and count frequency
  titles.forEach(title => {
    const words = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    words.forEach(word => {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    });
  });

  // Get top topics
  return Object.entries(wordFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1));
}

/**
 * Recommend article templates
 */
function recommendTemplates(gap: any): string[] {
  const templates: string[] = [];
  const ticketCount = gap.ticket_count || 0;
  const resolutionRate = gap.resolution_rate || 0;
  const satisfaction = gap.avg_satisfaction || 0;

  // FAQ for high volume
  if (ticketCount >= 15) {
    templates.push('faq');
  }

  // Troubleshooting for low resolution rate
  if (resolutionRate < 0.7) {
    templates.push('troubleshooting');
  }

  // How-to for general coverage
  templates.push('how_to');

  // Quick fix for common issues
  if (ticketCount >= 20 && satisfaction < 4) {
    templates.push('quick_fix');
  }

  return templates;
}
