/**
 * Real-Time Analytics API Endpoint
 *
 * WebSocket endpoint for streaming metrics with Server-Sent Events fallback
 * Handles metric subscription management and real-time data delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeQueryOne, sqlCurrentDate, sqlCastDate, sqlDateSub, sqlStartOfMonth, sqlTrue } from '@/lib/db/adapter';
import { demandForecaster, anomalyDetector } from '@/lib/analytics/predictive';
import { logger } from '@/lib/monitoring/logger';
import { getFromCache, setCache } from '@/lib/cache/lru-cache';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// ============================================================================
// Types & Interfaces
// ============================================================================

interface MetricRequest {
  subscriptions?: string[];
  enableForecasting?: boolean;
  enableAnomalyDetection?: boolean;
  forceRefresh?: boolean;
}

interface RealtimeMetrics {
  timestamp: Date;
  kpiSummary?: KPISummaryData;
  slaData?: SLAPerformanceData[];
  agentData?: AgentPerformanceData[];
  volumeData?: VolumeData[];
  alerts?: AlertData[];
  customData?: CustomMetricsData;
  anomalies?: AnomalyData[];
  forecasting?: ForecastingData;
}

interface KPISummaryData {
  tickets_today: number;
  tickets_this_week: number;
  tickets_this_month: number;
  total_tickets: number;
  sla_response_met: number;
  sla_resolution_met: number;
  total_sla_tracked: number;
  avg_response_time: number;
  avg_resolution_time: number;
  fcr_rate: number;
  csat_score: number;
  csat_responses: number;
  active_agents: number;
  open_tickets: number;
  resolved_today: number;
  trends?: {
    tickets_change: number;
    sla_change: number;
    satisfaction_change: number;
    response_time_change: number;
  };
}

interface SLAPerformanceData {
  date: string;
  total_tickets: number;
  response_met: number;
  resolution_met: number;
  avg_response_time: number;
  avg_resolution_time: number;
  response_sla_rate: number;
  resolution_sla_rate: number;
}

interface AgentPerformanceData {
  id: number;
  name: string;
  email: string;
  assigned_tickets: number;
  resolved_tickets: number;
  resolution_rate: number;
  avg_response_time: number;
  avg_resolution_time: number;
  avg_satisfaction: number;
  satisfaction_responses: number;
  efficiency_score?: number;
  workload_status?: 'underutilized' | 'optimal' | 'overloaded';
}

interface VolumeData {
  date: string;
  created: number;
  resolved: number;
  high_priority: number;
  forecasted_created?: number;
  forecasted_resolved?: number;
}

interface AlertData {
  id: string;
  type: 'sla_breach' | 'high_volume' | 'agent_overload' | 'system_issue' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  affected_tickets?: number[];
  affected_agents?: number[];
  auto_actions?: string[];
  dismissible: boolean;
}

interface CustomMetricsData {
  [key: string]: {
    value: number;
    label: string;
    change?: number;
    target?: number;
    unit?: string;
    trend?: 'up' | 'down' | 'stable';
  };
}

interface AnomalyData {
  date: string;
  ticket_count: number;
  high_priority_count: number;
  avg_tickets: number;
  avg_high_priority: number;
  anomaly_type: 'high_volume' | 'high_priority_spike' | 'normal';
  severity: number;
}

interface ForecastingData {
  daily_forecast: {
    date: string;
    predicted_tickets: number;
    confidence_interval: [number, number];
    factors: string[];
  }[];
  agent_workload_forecast: {
    agent_id: number;
    predicted_load: number;
    recommended_action: 'reassign' | 'hire' | 'training' | 'optimal';
  }[];
  resource_recommendations: {
    type: 'staffing' | 'training' | 'technology';
    priority: 'low' | 'medium' | 'high';
    description: string;
    impact: string;
  }[];
}

// ============================================================================
// Cache Management (uses global LRU cache)
// ============================================================================

const CACHE_NAMESPACE = 'stats' as const;
const CACHE_TTL = 30; // 30 seconds

function getCachedData<T>(key: string): T | null {
  return getFromCache<T>(`realtime:${key}`, CACHE_NAMESPACE);
}

function setCachedData<T>(key: string, data: T): void {
  setCache(`realtime:${key}`, data, CACHE_TTL, CACHE_NAMESPACE);
}

// ============================================================================
// Data Collection Functions
// ============================================================================

async function getKPISummary(): Promise<KPISummaryData> {
  const cacheKey = 'kpi_summary';
  const cached = getCachedData<KPISummaryData>(cacheKey);
  if (cached) return cached;

  // Single CTE query consolidating all 12 sequential queries into 1 round-trip
  const result = await executeQueryOne<{
    tickets_today: number;
    tickets_week: number;
    tickets_month: number;
    total_tickets: number;
    tickets_yesterday: number;
    sla_total: number;
    sla_response_met: number;
    sla_resolution_met: number;
    avg_response: number;
    avg_resolution: number;
    sla_last_week_total: number;
    sla_last_week_response_met: number;
    active_agents: number;
    open_tickets: number;
    resolved_today: number;
  }>(`
    WITH ticket_counts AS (
      SELECT
        COUNT(CASE WHEN ${sqlCastDate('created_at')} = ${sqlCurrentDate()} THEN 1 END) as tickets_today,
        COUNT(CASE WHEN ${sqlCastDate('created_at')} >= ${sqlDateSub(7)} THEN 1 END) as tickets_week,
        COUNT(CASE WHEN ${sqlCastDate('created_at')} >= ${sqlStartOfMonth()} THEN 1 END) as tickets_month,
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN ${sqlCastDate('created_at')} = ${sqlDateSub(1)} THEN 1 END) as tickets_yesterday
      FROM tickets
    ),
    sla_current AS (
      SELECT
        COUNT(*) as sla_total,
        COALESCE(SUM(CASE WHEN response_sla_met = 1 THEN 1 ELSE 0 END), 0) as sla_response_met,
        COALESCE(SUM(CASE WHEN resolution_sla_met = 1 THEN 1 ELSE 0 END), 0) as sla_resolution_met
      FROM sla_tracking
    ),
    sla_times AS (
      SELECT
        COALESCE(AVG(response_time_minutes), 0) as avg_response,
        COALESCE(AVG(resolution_time_minutes), 0) as avg_resolution
      FROM sla_tracking
      WHERE created_at >= ${sqlDateSub(30)}
    ),
    sla_prev_week AS (
      SELECT
        COUNT(*) as sla_last_week_total,
        COALESCE(SUM(CASE WHEN response_sla_met = 1 THEN 1 ELSE 0 END), 0) as sla_last_week_response_met
      FROM sla_tracking
      WHERE created_at >= ${sqlDateSub(14)}
        AND created_at < ${sqlDateSub(7)}
    ),
    agents AS (
      SELECT COUNT(DISTINCT user_id) as active_agents
      FROM user_sessions
      WHERE is_active = ${sqlTrue()}
    ),
    open AS (
      SELECT COUNT(*) as open_tickets
      FROM tickets
      WHERE status_id IN (SELECT id FROM statuses WHERE name IN ('open', 'in_progress'))
    ),
    resolved AS (
      SELECT COUNT(*) as resolved_today
      FROM tickets
      WHERE status_id = (SELECT id FROM statuses WHERE name = 'resolved')
        AND ${sqlCastDate('updated_at')} = ${sqlCurrentDate()}
    )
    SELECT
      tc.tickets_today, tc.tickets_week, tc.tickets_month, tc.total_tickets, tc.tickets_yesterday,
      sc.sla_total, sc.sla_response_met, sc.sla_resolution_met,
      st.avg_response, st.avg_resolution,
      sp.sla_last_week_total, sp.sla_last_week_response_met,
      a.active_agents, o.open_tickets, r.resolved_today
    FROM ticket_counts tc, sla_current sc, sla_times st, sla_prev_week sp, agents a, open o, resolved r
  `);

  const r = result || {
    tickets_today: 0, tickets_week: 0, tickets_month: 0, total_tickets: 0, tickets_yesterday: 0,
    sla_total: 0, sla_response_met: 0, sla_resolution_met: 0,
    avg_response: 0, avg_resolution: 0,
    sla_last_week_total: 0, sla_last_week_response_met: 0,
    active_agents: 0, open_tickets: 0, resolved_today: 0,
  };

  const data: KPISummaryData = {
    tickets_today: r.tickets_today,
    tickets_this_week: r.tickets_week,
    tickets_this_month: r.tickets_month,
    total_tickets: r.total_tickets,
    sla_response_met: r.sla_response_met,
    sla_resolution_met: r.sla_resolution_met,
    total_sla_tracked: r.sla_total,
    avg_response_time: r.avg_response || 0,
    avg_resolution_time: r.avg_resolution || 0,
    fcr_rate: null as any,
    csat_score: null as any,
    csat_responses: 0,
    active_agents: r.active_agents,
    open_tickets: r.open_tickets,
    resolved_today: r.resolved_today,
    trends: {
      tickets_change: r.tickets_yesterday > 0
        ? ((r.tickets_today - r.tickets_yesterday) / r.tickets_yesterday) * 100
        : 0,
      sla_change: r.sla_last_week_total > 0 && r.sla_total > 0
        ? (((r.sla_response_met / r.sla_total) - (r.sla_last_week_response_met / r.sla_last_week_total)) * 100)
        : 0,
      satisfaction_change: null as any,
      response_time_change: null as any,
    },
  };

  setCachedData(cacheKey, data);
  return data;
}

async function getSLAPerformance(): Promise<SLAPerformanceData[]> {
  const cacheKey = 'sla_performance';
  const cached = getCachedData<SLAPerformanceData[]>(cacheKey);
  if (cached) return cached;

  const data = await executeQuery<any>(`
    SELECT
      ${sqlCastDate('st.created_at')} as date,
      COUNT(*) as total_tickets,
      SUM(CASE WHEN st.response_sla_met = 1 THEN 1 ELSE 0 END) as response_met,
      SUM(CASE WHEN st.resolution_sla_met = 1 THEN 1 ELSE 0 END) as resolution_met,
      AVG(st.response_time_minutes) as avg_response_time,
      AVG(st.resolution_time_minutes) as avg_resolution_time
    FROM sla_tracking st
    WHERE st.created_at >= ${sqlDateSub(30)}
    GROUP BY ${sqlCastDate('st.created_at')}
    ORDER BY date
  `);

  const result = data.map((row: any) => ({
    date: row.date,
    total_tickets: row.total_tickets,
    response_met: row.response_met,
    resolution_met: row.resolution_met,
    avg_response_time: row.avg_response_time || 0,
    avg_resolution_time: row.avg_resolution_time || 0,
    response_sla_rate: row.total_tickets > 0 ? (row.response_met / row.total_tickets) * 100 : 0,
    resolution_sla_rate: row.total_tickets > 0 ? (row.resolution_met / row.total_tickets) * 100 : 0,
  }));

  setCachedData(cacheKey, result);
  return result;
}

async function getAgentPerformance(): Promise<AgentPerformanceData[]> {
  const cacheKey = 'agent_performance';
  const cached = getCachedData<AgentPerformanceData[]>(cacheKey);
  if (cached) return cached;

  const data = await executeQuery<any>(`
    SELECT
      u.id,
      u.name,
      u.email,
      COUNT(DISTINCT CASE WHEN t.status_id IN (
        SELECT id FROM statuses WHERE name IN ('open', 'in_progress')
      ) THEN t.id END) as assigned_tickets,
      COUNT(DISTINCT CASE WHEN t.status_id = (
        SELECT id FROM statuses WHERE name = 'resolved'
      ) THEN t.id END) as resolved_tickets,
      AVG(CASE WHEN st.response_time_minutes IS NOT NULL THEN st.response_time_minutes END) as avg_response_time,
      AVG(CASE WHEN st.resolution_time_minutes IS NOT NULL THEN st.resolution_time_minutes END) as avg_resolution_time
    FROM users u
    LEFT JOIN tickets t ON t.assigned_to = u.id
    LEFT JOIN sla_tracking st ON st.ticket_id = t.id
    WHERE u.role IN ('admin', 'agent')
    GROUP BY u.id, u.name, u.email
    ORDER BY resolved_tickets DESC
  `);

  const result = data.map((row: any) => {
    const resolution_rate = row.assigned_tickets > 0
      ? (row.resolved_tickets / row.assigned_tickets) * 100
      : 0;

    let workload_status: 'underutilized' | 'optimal' | 'overloaded' = 'optimal';
    if (row.assigned_tickets < 3) workload_status = 'underutilized';
    else if (row.assigned_tickets > 15) workload_status = 'overloaded';

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      assigned_tickets: row.assigned_tickets,
      resolved_tickets: row.resolved_tickets,
      resolution_rate,
      avg_response_time: row.avg_response_time || 0,
      avg_resolution_time: row.avg_resolution_time || 0,
      avg_satisfaction: null as any, // TODO: calculate from satisfaction_surveys per agent
      satisfaction_responses: 0, // TODO: count from satisfaction_surveys per agent
      efficiency_score: Math.min(100, resolution_rate * 0.6 + (100 - Math.min(row.avg_resolution_time / 10, 100)) * 0.4),
      workload_status,
    };
  });

  setCachedData(cacheKey, result);
  return result;
}

async function getVolumeData(): Promise<VolumeData[]> {
  const cacheKey = 'volume_data';
  const cached = getCachedData<VolumeData[]>(cacheKey);
  if (cached) return cached;

  const data = await executeQuery<any>(`
    SELECT
      ${sqlCastDate('created_at')} as date,
      COUNT(*) as created,
      COUNT(CASE WHEN status_id = (SELECT id FROM statuses WHERE name = 'resolved') THEN 1 END) as resolved,
      COUNT(CASE WHEN priority_id IN (
        SELECT id FROM priorities WHERE name IN ('high', 'critical')
      ) THEN 1 END) as high_priority
    FROM tickets
    WHERE ${sqlCastDate('created_at')} >= ${sqlDateSub(30)}
    GROUP BY ${sqlCastDate('created_at')}
    ORDER BY date
  `);

  setCachedData(cacheKey, data);
  return data;
}

async function getActiveAlerts(): Promise<AlertData[]> {
  const alerts: AlertData[] = [];

  // Check for SLA breaches
  const slaBreach = await executeQueryOne<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM sla_tracking
    WHERE is_violated = 1
      AND created_at >= ${sqlDateSub(1)}
  `) || { count: 0 };

  if (slaBreach.count > 5) {
    alerts.push({
      id: `sla_breach_${Date.now()}`,
      type: 'sla_breach',
      severity: slaBreach.count > 10 ? 'high' : 'medium',
      title: 'Multiple SLA Breaches Detected',
      description: `${slaBreach.count} SLA violations in the last 24 hours`,
      timestamp: new Date(),
      dismissible: true,
    });
  }

  // Check for agent overload
  const overloadedAgents = await executeQueryOne<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM (
      SELECT assigned_to, COUNT(*) as ticket_count
      FROM tickets
      WHERE status_id IN (SELECT id FROM statuses WHERE name IN ('open', 'in_progress'))
        AND assigned_to IS NOT NULL
      GROUP BY assigned_to
      HAVING COUNT(*) > 15
    )
  `) || { count: 0 };

  if (overloadedAgents.count > 0) {
    alerts.push({
      id: `agent_overload_${Date.now()}`,
      type: 'agent_overload',
      severity: 'high',
      title: 'Agent Overload Detected',
      description: `${overloadedAgents.count} agents with excessive workload (>15 tickets)`,
      timestamp: new Date(),
      dismissible: true,
    });
  }

  return alerts;
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ANALYTICS);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const searchParams = request.nextUrl.searchParams;

    const params: MetricRequest = {
      subscriptions: searchParams.get('subscriptions')?.split(',') || [],
      enableForecasting: searchParams.get('enableForecasting') === 'true',
      enableAnomalyDetection: searchParams.get('enableAnomalyDetection') === 'true',
      forceRefresh: searchParams.get('forceRefresh') === 'true',
    };

    // Force cache clear if requested
    if (params.forceRefresh) {
      const { clearCache: clearLRU } = await import('@/lib/cache/lru-cache');
      clearLRU(CACHE_NAMESPACE);
    }

    const metrics: RealtimeMetrics = {
      timestamp: new Date(),
    };

    // Gather requested metrics in parallel (independent queries)
    const subscriptions = params.subscriptions || [];
    const all = subscriptions.length === 0;

    const [kpiSummary, slaData, agentData, volumeData, alerts] = await Promise.all([
      (all || subscriptions.includes('kpi')) ? getKPISummary() : undefined,
      (all || subscriptions.includes('sla')) ? getSLAPerformance() : undefined,
      (all || subscriptions.includes('agents')) ? getAgentPerformance() : undefined,
      (all || subscriptions.includes('volume')) ? getVolumeData() : undefined,
      (all || subscriptions.includes('alerts')) ? getActiveAlerts() : undefined,
    ]);

    if (kpiSummary) metrics.kpiSummary = kpiSummary;
    if (slaData) metrics.slaData = slaData;
    if (agentData) metrics.agentData = agentData;
    if (volumeData) metrics.volumeData = volumeData;
    if (alerts) metrics.alerts = alerts;

    // Add forecasting if enabled
    if (params.enableForecasting) {
      const forecasts = await demandForecaster.forecastDemand(7);
      metrics.forecasting = {
        daily_forecast: forecasts.map((f: any) => ({
          date: f.date,
          predicted_tickets: f.predicted_tickets,
          confidence_interval: [f.confidence_interval.lower, f.confidence_interval.upper],
          factors: ['seasonality', 'trend', 'historical_pattern'],
        })),
        agent_workload_forecast: [],
        resource_recommendations: [],
      };
    }

    // Add anomaly detection if enabled
    if (params.enableAnomalyDetection) {
      const anomalies = await anomalyDetector.detectAnomalies();
      metrics.anomalies = anomalies.map((a: any) => ({
        date: a.timestamp.toISOString().split('T')[0],
        ticket_count: a.actual_value,
        high_priority_count: 0,
        avg_tickets: a.expected_value,
        avg_high_priority: 0,
        anomaly_type: a.anomaly_type === 'spike' ? 'high_volume' : 'normal',
        severity: a.severity === 'high' ? 5 : 3,
      }));
    }

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error('[RealtimeAPI] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch real-time metrics' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Server-Sent Events Endpoint (Alternative to WebSocket)
// ============================================================================

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ANALYTICS);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { action, data } = body;

    if (action === 'invalidate_cache') {
      // Allow clients to trigger cache invalidation
      const { removeCachePattern, clearCache: clearLRU } = await import('@/lib/cache/lru-cache');
      if (data?.keys) {
        data.keys.forEach((key: string) => removeCachePattern(`realtime:${key}`, CACHE_NAMESPACE));
      } else {
        clearLRU(CACHE_NAMESPACE);
      }

      return NextResponse.json({ success: true, message: 'Cache invalidated' });
    }

    if (action === 'subscribe') {
      // Handle subscription registration (would store in database for persistent subscriptions)
      return NextResponse.json({
        success: true,
        subscription_id: `sub_${Date.now()}`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    logger.error('[RealtimeAPI] POST Error', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
