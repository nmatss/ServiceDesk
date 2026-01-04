/**
 * Detailed Analytics API
 *
 * Comprehensive analytics with multiple metrics and time ranges.
 *
 * @module app/api/analytics/detailed/route
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// ========================================
// GET - Get detailed analytics
// ========================================

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ANALYTICS);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);
    const organizationId = parseInt(searchParams.get('organizationId') || '1');
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, 1y
    const metrics = searchParams.get('metrics')?.split(',') || ['all'];

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const result: Record<string, any> = {
      period,
      startDate: startDateStr,
      endDate: endDateStr,
      generatedAt: new Date().toISOString(),
    };

    // ========================================
    // TICKET METRICS
    // ========================================
    if (metrics.includes('all') || metrics.includes('tickets')) {
      // Overall ticket stats
      const ticketStats = db.prepare(`
        SELECT
          COUNT(*) as total_tickets,
          SUM(CASE WHEN status_id = (SELECT id FROM statuses WHERE name = 'open' LIMIT 1) THEN 1 ELSE 0 END) as open_tickets,
          SUM(CASE WHEN status_id = (SELECT id FROM statuses WHERE name = 'in-progress' LIMIT 1) THEN 1 ELSE 0 END) as in_progress_tickets,
          SUM(CASE WHEN status_id = (SELECT id FROM statuses WHERE name = 'resolved' LIMIT 1) THEN 1 ELSE 0 END) as resolved_tickets,
          SUM(CASE WHEN status_id = (SELECT id FROM statuses WHERE name = 'closed' LIMIT 1) THEN 1 ELSE 0 END) as closed_tickets,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as new_in_period,
          SUM(CASE WHEN resolved_at >= ? THEN 1 ELSE 0 END) as resolved_in_period
        FROM tickets
        WHERE organization_id = ?
      `).get(startDateStr, startDateStr, organizationId) as any;

      // Tickets by priority
      const ticketsByPriority = db.prepare(`
        SELECT
          p.name as priority,
          COUNT(*) as count,
          SUM(CASE WHEN t.status_id NOT IN (
            SELECT id FROM statuses WHERE name IN ('resolved', 'closed')
          ) THEN 1 ELSE 0 END) as open_count
        FROM tickets t
        JOIN priorities p ON t.priority_id = p.id
        WHERE t.organization_id = ?
        GROUP BY p.id
        ORDER BY p.level DESC
      `).all(organizationId);

      // Tickets by category
      const ticketsByCategory = db.prepare(`
        SELECT
          c.name as category,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM tickets WHERE organization_id = ?), 1) as percentage
        FROM tickets t
        JOIN categories c ON t.category_id = c.id
        WHERE t.organization_id = ?
        GROUP BY c.id
        ORDER BY count DESC
        LIMIT 10
      `).all(organizationId, organizationId);

      // Tickets trend (daily)
      const ticketsTrend = db.prepare(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as created,
          SUM(CASE WHEN resolved_at IS NOT NULL AND DATE(resolved_at) = DATE(created_at) THEN 1 ELSE 0 END) as resolved_same_day
        FROM tickets
        WHERE organization_id = ? AND created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date
      `).all(organizationId, startDateStr);

      result.tickets = {
        overview: ticketStats,
        byPriority: ticketsByPriority,
        byCategory: ticketsByCategory,
        trend: ticketsTrend,
      };
    }

    // ========================================
    // SLA METRICS
    // ========================================
    if (metrics.includes('all') || metrics.includes('sla')) {
      // SLA compliance
      const slaCompliance = db.prepare(`
        SELECT
          COUNT(*) as total_tracked,
          SUM(CASE WHEN response_met = 1 THEN 1 ELSE 0 END) as response_met,
          SUM(CASE WHEN resolution_met = 1 THEN 1 ELSE 0 END) as resolution_met,
          ROUND(AVG(CASE WHEN response_met = 1 THEN 100.0 ELSE 0 END), 1) as response_compliance_rate,
          ROUND(AVG(CASE WHEN resolution_met = 1 THEN 100.0 ELSE 0 END), 1) as resolution_compliance_rate
        FROM sla_tracking st
        JOIN tickets t ON st.ticket_id = t.id
        WHERE t.organization_id = ? AND t.created_at >= ?
      `).get(organizationId, startDateStr) as any;

      // SLA by priority
      const slaByPriority = db.prepare(`
        SELECT
          p.name as priority,
          COUNT(*) as total,
          ROUND(AVG(CASE WHEN st.response_met = 1 THEN 100.0 ELSE 0 END), 1) as response_rate,
          ROUND(AVG(CASE WHEN st.resolution_met = 1 THEN 100.0 ELSE 0 END), 1) as resolution_rate
        FROM sla_tracking st
        JOIN tickets t ON st.ticket_id = t.id
        JOIN priorities p ON t.priority_id = p.id
        WHERE t.organization_id = ? AND t.created_at >= ?
        GROUP BY p.id
        ORDER BY p.level DESC
      `).all(organizationId, startDateStr);

      // Average response/resolution times
      const slaTimes = db.prepare(`
        SELECT
          AVG(CASE WHEN first_response_at IS NOT NULL
            THEN (julianday(first_response_at) - julianday(t.created_at)) * 24
            ELSE NULL END) as avg_first_response_hours,
          AVG(CASE WHEN t.resolved_at IS NOT NULL
            THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24
            ELSE NULL END) as avg_resolution_hours
        FROM tickets t
        LEFT JOIN sla_tracking st ON t.id = st.ticket_id
        WHERE t.organization_id = ? AND t.created_at >= ?
      `).get(organizationId, startDateStr) as any;

      result.sla = {
        compliance: slaCompliance,
        byPriority: slaByPriority,
        averageTimes: {
          firstResponseHours: slaTimes?.avg_first_response_hours ? Math.round(slaTimes.avg_first_response_hours * 10) / 10 : null,
          resolutionHours: slaTimes?.avg_resolution_hours ? Math.round(slaTimes.avg_resolution_hours * 10) / 10 : null,
        },
      };
    }

    // ========================================
    // AGENT METRICS
    // ========================================
    if (metrics.includes('all') || metrics.includes('agents')) {
      // Agent performance
      const agentPerformance = db.prepare(`
        SELECT
          u.id,
          u.name,
          u.email,
          COUNT(t.id) as total_assigned,
          SUM(CASE WHEN t.status_id IN (
            SELECT id FROM statuses WHERE name IN ('resolved', 'closed')
          ) THEN 1 ELSE 0 END) as resolved_count,
          SUM(CASE WHEN t.status_id = (SELECT id FROM statuses WHERE name = 'open' LIMIT 1) THEN 1 ELSE 0 END) as open_count,
          ROUND(AVG(CASE WHEN t.resolved_at IS NOT NULL
            THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24
            ELSE NULL END), 1) as avg_resolution_hours,
          COUNT(DISTINCT DATE(t.resolved_at)) as active_days
        FROM users u
        LEFT JOIN tickets t ON u.id = t.assigned_to AND t.created_at >= ?
        WHERE u.organization_id = ? AND u.role IN ('admin', 'agent')
        GROUP BY u.id
        HAVING total_assigned > 0
        ORDER BY resolved_count DESC
      `).all(startDateStr, organizationId);

      // Team workload distribution
      const workloadDistribution = db.prepare(`
        SELECT
          CASE
            WHEN assigned_to IS NULL THEN 'Unassigned'
            ELSE (SELECT name FROM users WHERE id = t.assigned_to)
          END as assignee,
          COUNT(*) as ticket_count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM tickets WHERE organization_id = ? AND created_at >= ?), 1) as percentage
        FROM tickets t
        WHERE t.organization_id = ? AND t.created_at >= ?
        GROUP BY assigned_to
        ORDER BY ticket_count DESC
      `).all(organizationId, startDateStr, organizationId, startDateStr);

      result.agents = {
        performance: agentPerformance,
        workloadDistribution,
      };
    }

    // ========================================
    // CUSTOMER SATISFACTION
    // ========================================
    if (metrics.includes('all') || metrics.includes('satisfaction')) {
      // This would normally come from surveys/feedback
      // For now, we'll calculate based on resolution times and SLA compliance
      const satisfactionMetrics = db.prepare(`
        SELECT
          COUNT(*) as total_resolved,
          SUM(CASE WHEN st.resolution_met = 1 THEN 1 ELSE 0 END) as within_sla,
          AVG(CASE WHEN t.resolved_at IS NOT NULL
            THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24
            ELSE NULL END) as avg_resolution_hours
        FROM tickets t
        LEFT JOIN sla_tracking st ON t.id = st.ticket_id
        WHERE t.organization_id = ?
          AND t.status_id IN (SELECT id FROM statuses WHERE name IN ('resolved', 'closed'))
          AND t.resolved_at >= ?
      `).get(organizationId, startDateStr) as any;

      // Calculate estimated CSAT based on SLA compliance and resolution time
      const slaRate = satisfactionMetrics?.total_resolved > 0
        ? (satisfactionMetrics.within_sla / satisfactionMetrics.total_resolved) * 100
        : 0;
      const estimatedCSAT = Math.min(100, Math.max(0, slaRate * 0.8 + 20)); // Simplified formula

      result.satisfaction = {
        metrics: satisfactionMetrics,
        estimatedCSAT: Math.round(estimatedCSAT * 10) / 10,
        slaComplianceRate: Math.round(slaRate * 10) / 10,
      };
    }

    // ========================================
    // KNOWLEDGE BASE METRICS
    // ========================================
    if (metrics.includes('all') || metrics.includes('knowledge')) {
      const kbMetrics = db.prepare(`
        SELECT
          COUNT(*) as total_articles,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published_articles,
          SUM(views) as total_views,
          SUM(helpful_count) as total_helpful,
          SUM(not_helpful_count) as total_not_helpful,
          AVG(CASE WHEN helpful_count + not_helpful_count > 0
            THEN helpful_count * 100.0 / (helpful_count + not_helpful_count)
            ELSE NULL END) as avg_helpfulness_rate
        FROM kb_articles
        WHERE organization_id = ?
      `).get(organizationId) as any;

      const topArticles = db.prepare(`
        SELECT
          id,
          title,
          slug,
          views,
          helpful_count,
          not_helpful_count
        FROM kb_articles
        WHERE organization_id = ? AND status = 'published'
        ORDER BY views DESC
        LIMIT 10
      `).all(organizationId);

      result.knowledgeBase = {
        overview: kbMetrics,
        topArticles,
      };
    }

    // ========================================
    // CHANNEL METRICS
    // ========================================
    if (metrics.includes('all') || metrics.includes('channels')) {
      const channelMetrics = db.prepare(`
        SELECT
          COALESCE(source, 'portal') as channel,
          COUNT(*) as ticket_count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM tickets WHERE organization_id = ?), 1) as percentage,
          AVG(CASE WHEN resolved_at IS NOT NULL
            THEN (julianday(resolved_at) - julianday(created_at)) * 24
            ELSE NULL END) as avg_resolution_hours
        FROM tickets
        WHERE organization_id = ? AND created_at >= ?
        GROUP BY source
        ORDER BY ticket_count DESC
      `).all(organizationId, organizationId, startDateStr);

      result.channels = channelMetrics;
    }

    // ========================================
    // HOURLY DISTRIBUTION
    // ========================================
    if (metrics.includes('all') || metrics.includes('distribution')) {
      // Hourly distribution
      const hourlyDistribution = db.prepare(`
        SELECT
          CAST(strftime('%H', created_at) AS INTEGER) as hour,
          COUNT(*) as count
        FROM tickets
        WHERE organization_id = ? AND created_at >= ?
        GROUP BY hour
        ORDER BY hour
      `).all(organizationId, startDateStr);

      // Day of week distribution
      const dayOfWeekDistribution = db.prepare(`
        SELECT
          CAST(strftime('%w', created_at) AS INTEGER) as day_of_week,
          COUNT(*) as count
        FROM tickets
        WHERE organization_id = ? AND created_at >= ?
        GROUP BY day_of_week
        ORDER BY day_of_week
      `).all(organizationId, startDateStr);

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const formattedDayDistribution = (dayOfWeekDistribution as any[]).map(d => ({
        day: dayNames[d.day_of_week],
        dayIndex: d.day_of_week,
        count: d.count,
      }));

      result.distribution = {
        hourly: hourlyDistribution,
        dayOfWeek: formattedDayDistribution,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching detailed analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
