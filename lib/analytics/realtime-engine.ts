/**
 * Real-Time Analytics Engine - Server-Side
 *
 * WebSocket-based streaming analytics with Redis pub/sub integration
 * Provides real-time KPI calculation, metric aggregation, and cache invalidation
 */

import { Server as SocketIOServer } from 'socket.io';
import { createClient } from 'redis';
import { db } from '@/lib/db/connection';
import { logger } from '../monitoring/logger';

// Re-export types for client usage
export interface RealtimeMetrics {
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

export interface KPISummaryData {
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

export interface SLAPerformanceData {
  date: string;
  total_tickets: number;
  response_met: number;
  resolution_met: number;
  avg_response_time: number;
  avg_resolution_time: number;
  response_sla_rate: number;
  resolution_sla_rate: number;
}

export interface AgentPerformanceData {
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

export interface VolumeData {
  date: string;
  created: number;
  resolved: number;
  high_priority: number;
  forecasted_created?: number;
  forecasted_resolved?: number;
}

export interface AlertData {
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

export interface CustomMetricsData {
  [key: string]: {
    value: number;
    label: string;
    change?: number;
    target?: number;
    unit?: string;
    trend?: 'up' | 'down' | 'stable';
  };
}

export interface AnomalyData {
  date: string;
  ticket_count: number;
  high_priority_count: number;
  avg_tickets: number;
  avg_high_priority: number;
  anomaly_type: 'high_volume' | 'high_priority_spike' | 'normal';
  severity: number; // 1-5 scale
}

export interface ForecastingData {
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

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'disconnected';

// ============================================================================
// Server-Side Engine Types
// ============================================================================

export interface MetricSubscription {
  userId: string;
  metrics: string[];
  filters?: Record<string, any>;
  interval?: number; // ms
}

export interface AggregationConfig {
  metric: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  groupBy?: string[];
  timeWindow?: number; // seconds
}

export interface CacheStrategy {
  key: string;
  ttl: number; // seconds
  invalidateOn: string[]; // event types that trigger invalidation
}

export interface RealtimeMetric {
  type: 'kpi' | 'ticket' | 'sla' | 'agent' | 'custom';
  name: string;
  value: number | string | object;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// Real-Time Engine Class (Server-Side)
// ============================================================================

export class RealtimeAnalyticsEngine {
  private io: SocketIOServer | null = null;
  private redisClient: ReturnType<typeof createClient> | null = null;
  private redisPubClient: ReturnType<typeof createClient> | null = null;
  private redisSubClient: ReturnType<typeof createClient> | null = null;
  private subscriptions: Map<string, MetricSubscription> = new Map();
  private intervalTimers: Map<string, NodeJS.Timeout> = new Map();
  private metricCache: Map<string, { value: any; timestamp: Date }> = new Map();

  /**
   * Initialize the real-time analytics engine
   */
  async initialize(io: SocketIOServer, redisUrl?: string) {
    this.io = io;

    // Initialize Redis clients if URL provided
    if (redisUrl) {
      await this.initializeRedis(redisUrl);
    }

    // Setup Socket.IO event handlers
    this.setupSocketHandlers();

    logger.info('[RealtimeEngine] Initialized successfully');
  }

  /**
   * Initialize Redis pub/sub clients
   */
  private async initializeRedis(redisUrl: string) {
    try {
      // Main client for general operations
      this.redisClient = createClient({ url: redisUrl });
      await this.redisClient.connect();

      // Pub client for publishing metrics
      this.redisPubClient = createClient({ url: redisUrl });
      await this.redisPubClient.connect();

      // Sub client for subscribing to metrics
      this.redisSubClient = createClient({ url: redisUrl });
      await this.redisSubClient.connect();

      // Subscribe to metric channels
      await this.redisSubClient.subscribe('analytics:metrics', (message) => {
        this.handleRedisMetric(JSON.parse(message));
      });

      logger.info('[RealtimeEngine] Redis clients connected');
    } catch (error) {
      logger.error('[RealtimeEngine] Redis initialization failed', error);
      // Continue without Redis - fallback to in-memory only
    }
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.info(`[RealtimeEngine] Client connected: ${socket.id}`);

      // Subscribe to metrics
      socket.on('subscribe:metrics', (subscription: MetricSubscription) => {
        this.handleSubscription(socket.id, subscription);
      });

      // Unsubscribe from metrics
      socket.on('unsubscribe:metrics', () => {
        this.handleUnsubscription(socket.id);
      });

      // Request immediate metric update
      socket.on('request:metric', async (metricName: string) => {
        const metric = await this.calculateMetric(metricName);
        socket.emit('metric:update', metric);
      });

      // Cleanup on disconnect
      socket.on('disconnect', () => {
        this.handleUnsubscription(socket.id);
        logger.info(`[RealtimeEngine] Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Handle metric subscription
   */
  private handleSubscription(socketId: string, subscription: MetricSubscription) {
    // Store subscription
    this.subscriptions.set(socketId, subscription);

    // Clear existing timer if any
    const existingTimer = this.intervalTimers.get(socketId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Setup periodic metric updates
    const interval = subscription.interval || 5000; // Default 5 seconds
    const timer = setInterval(async () => {
      const metrics = await this.gatherMetrics(subscription);
      this.emitToSocket(socketId, 'metrics:update', metrics);
    }, interval);

    this.intervalTimers.set(socketId, timer);

    // Send immediate first update
    this.gatherMetrics(subscription).then((metrics) => {
      this.emitToSocket(socketId, 'metrics:update', metrics);
    });

    logger.info(`[RealtimeEngine] Subscription created for ${socketId}`);
  }

  /**
   * Handle metric unsubscription
   */
  private handleUnsubscription(socketId: string) {
    // Clear interval timer
    const timer = this.intervalTimers.get(socketId);
    if (timer) {
      clearInterval(timer);
      this.intervalTimers.delete(socketId);
    }

    // Remove subscription
    this.subscriptions.delete(socketId);

    logger.info(`[RealtimeEngine] Subscription removed for ${socketId}`);
  }

  /**
   * Gather metrics based on subscription
   */
  private async gatherMetrics(subscription: MetricSubscription): Promise<RealtimeMetric[]> {
    const metrics: RealtimeMetric[] = [];

    for (const metricName of subscription.metrics) {
      const metric = await this.calculateMetric(metricName, subscription.filters);
      metrics.push(metric);
    }

    return metrics;
  }

  /**
   * Calculate specific metric with caching
   */
  private async calculateMetric(
    metricName: string,
    filters?: Record<string, any>
  ): Promise<RealtimeMetric> {
    // Check cache first
    const cacheKey = `${metricName}:${JSON.stringify(filters || {})}`;
    const cached = this.metricCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp.getTime() < 3000) {
      return cached.value;
    }

    // Calculate metric based on type
    let metric: RealtimeMetric;

    switch (metricName) {
      case 'active_tickets':
        metric = await this.calculateActiveTickets(filters);
        break;
      case 'sla_compliance':
        metric = await this.calculateSLACompliance(filters);
        break;
      case 'avg_resolution_time':
        metric = await this.calculateAvgResolutionTime(filters);
        break;
      case 'agent_workload':
        metric = await this.calculateAgentWorkload(filters);
        break;
      case 'ticket_velocity':
        metric = await this.calculateTicketVelocity(filters);
        break;
      case 'customer_satisfaction':
        metric = await this.calculateCustomerSatisfaction(filters);
        break;
      default:
        metric = {
          type: 'custom',
          name: metricName,
          value: 0,
          timestamp: new Date(),
          metadata: { error: 'Unknown metric' }
        };
    }

    // Cache the result
    this.metricCache.set(cacheKey, { value: metric, timestamp: new Date() });

    return metric;
  }

  // ============================================================================
  // Metric Calculation Methods
  // ============================================================================

  private async calculateActiveTickets(filters?: Record<string, any>): Promise<RealtimeMetric> {
    const row = db.prepare(`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE status_id IN (
        SELECT id FROM statuses WHERE name IN ('open', 'in_progress')
      )
    `).get() as { count: number };

    return {
      type: 'kpi',
      name: 'active_tickets',
      value: row.count,
      timestamp: new Date(),
      metadata: { filters }
    };
  }

  private async calculateSLACompliance(filters?: Record<string, any>): Promise<RealtimeMetric> {
    const row = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_violated = 0 THEN 1 ELSE 0 END) as compliant
      FROM sla_tracking
      WHERE created_at >= datetime('now', '-30 days')
    `).get() as { total: number; compliant: number };

    const compliance = row.total > 0 ? (row.compliant / row.total) * 100 : 100;

    return {
      type: 'sla',
      name: 'sla_compliance',
      value: Math.round(compliance * 100) / 100,
      timestamp: new Date(),
      metadata: { total: row.total, compliant: row.compliant, filters }
    };
  }

  private async calculateAvgResolutionTime(filters?: Record<string, any>): Promise<RealtimeMetric> {
    const row = db.prepare(`
      SELECT AVG(
        CAST((julianday(updated_at) - julianday(created_at)) * 24 AS INTEGER)
      ) as avg_hours
      FROM tickets
      WHERE status_id = (SELECT id FROM statuses WHERE name = 'resolved')
        AND updated_at >= datetime('now', '-30 days')
    `).get() as { avg_hours: number | null };

    return {
      type: 'kpi',
      name: 'avg_resolution_time',
      value: Math.round(row.avg_hours || 0),
      timestamp: new Date(),
      metadata: { unit: 'hours', filters }
    };
  }

  private async calculateAgentWorkload(filters?: Record<string, any>): Promise<RealtimeMetric> {
    const rows = db.prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(t.id) as active_tickets
      FROM users u
      LEFT JOIN tickets t ON t.assigned_to = u.id
        AND t.status_id IN (
          SELECT id FROM statuses WHERE name IN ('open', 'in_progress')
        )
      WHERE u.role IN ('admin', 'agent')
      GROUP BY u.id, u.name
      ORDER BY active_tickets DESC
    `).all() as Array<{ id: number; name: string; active_tickets: number }>;

    return {
      type: 'agent',
      name: 'agent_workload',
      value: rows,
      timestamp: new Date(),
      metadata: { agent_count: rows.length, filters }
    };
  }

  private async calculateTicketVelocity(filters?: Record<string, any>): Promise<RealtimeMetric> {
    const row = db.prepare(`
      SELECT
        COUNT(*) as created_today,
        (SELECT COUNT(*) FROM tickets WHERE date(created_at) = date('now', '-1 day')) as created_yesterday
      FROM tickets
      WHERE date(created_at) = date('now')
    `).get() as { created_today: number; created_yesterday: number };

    const velocity = row.created_yesterday > 0
      ? ((row.created_today - row.created_yesterday) / row.created_yesterday) * 100
      : 0;

    return {
      type: 'kpi',
      name: 'ticket_velocity',
      value: Math.round(velocity * 100) / 100,
      timestamp: new Date(),
      metadata: {
        created_today: row.created_today,
        created_yesterday: row.created_yesterday,
        filters
      }
    };
  }

  private async calculateCustomerSatisfaction(filters?: Record<string, any>): Promise<RealtimeMetric> {
    // Mock implementation - would integrate with actual CSAT survey data
    const mockScore = 4.2 + (Math.random() * 0.3 - 0.15);

    return {
      type: 'kpi',
      name: 'customer_satisfaction',
      value: Math.round(mockScore * 100) / 100,
      timestamp: new Date(),
      metadata: { scale: '1-5', filters }
    };
  }

  // ============================================================================
  // Publishing & Broadcasting
  // ============================================================================

  /**
   * Publish metric update to all subscribers
   */
  async publishMetric(metric: RealtimeMetric) {
    // Invalidate cache for this metric
    this.invalidateCache(metric.name);

    // Publish to Redis if available
    if (this.redisPubClient) {
      await this.redisPubClient.publish('analytics:metrics', JSON.stringify(metric));
    }

    // Broadcast to Socket.IO clients
    this.broadcastMetric(metric);
  }

  /**
   * Handle metric received from Redis
   */
  private handleRedisMetric(metric: RealtimeMetric) {
    // Broadcast to all connected clients
    this.broadcastMetric(metric);
  }

  /**
   * Broadcast metric to relevant Socket.IO clients
   */
  private broadcastMetric(metric: RealtimeMetric) {
    if (!this.io) return;

    // Find subscriptions interested in this metric
    this.subscriptions.forEach((subscription, socketId) => {
      if (subscription.metrics.includes(metric.name)) {
        this.emitToSocket(socketId, 'metric:update', metric);
      }
    });
  }

  /**
   * Emit to specific socket
   */
  private emitToSocket(socketId: string, event: string, data: any) {
    if (!this.io) return;
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Invalidate cache for specific metric
   */
  invalidateCache(metricName: string) {
    const keysToDelete: string[] = [];

    this.metricCache.forEach((_, key) => {
      if (key.startsWith(`${metricName}:`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.metricCache.delete(key));

    logger.info(`[RealtimeEngine] Invalidated cache for ${metricName} (${keysToDelete.length} entries)`);
  }

  /**
   * Invalidate all cache
   */
  invalidateAllCache() {
    this.metricCache.clear();
    logger.info('[RealtimeEngine] All cache invalidated');
  }

  /**
   * Trigger cache invalidation based on event
   */
  async onEvent(eventType: string, data?: any) {
    const cacheStrategies: Record<string, string[]> = {
      'ticket:created': ['active_tickets', 'ticket_velocity'],
      'ticket:updated': ['active_tickets', 'agent_workload'],
      'ticket:resolved': ['avg_resolution_time', 'sla_compliance'],
      'sla:violated': ['sla_compliance'],
      'agent:assigned': ['agent_workload']
    };

    const metricsToInvalidate = cacheStrategies[eventType] || [];

    metricsToInvalidate.forEach(metric => {
      this.invalidateCache(metric);
    });

    // Auto-recalculate and broadcast updated metrics
    for (const metricName of metricsToInvalidate) {
      const metric = await this.calculateMetric(metricName);
      await this.publishMetric(metric);
    }
  }

  // ============================================================================
  // Aggregation Pipeline
  // ============================================================================

  /**
   * Aggregate metrics based on configuration
   */
  async aggregate(config: AggregationConfig): Promise<any[]> {
    const { metric, aggregation, groupBy, timeWindow } = config;

    let sql = `
      SELECT
        ${groupBy ? groupBy.join(', ') + ',' : ''}
        ${aggregation.toUpperCase()}(value) as aggregated_value,
        COUNT(*) as count
      FROM analytics_daily_metrics
      WHERE metric_name = ?
    `;

    if (timeWindow) {
      sql += ` AND date >= datetime('now', '-${timeWindow} seconds')`;
    }

    if (groupBy && groupBy.length > 0) {
      sql += ` GROUP BY ${groupBy.join(', ')}`;
    }

    sql += ' ORDER BY date DESC LIMIT 100';

    const rows = db.prepare(sql).all(metric);
    return rows as any[];
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    // Clear all timers
    this.intervalTimers.forEach(timer => clearInterval(timer));
    this.intervalTimers.clear();

    // Clear subscriptions
    this.subscriptions.clear();

    // Disconnect Redis clients
    if (this.redisClient) await this.redisClient.quit();
    if (this.redisPubClient) await this.redisPubClient.quit();
    if (this.redisSubClient) await this.redisSubClient.quit();

    logger.info('[RealtimeEngine] Shutdown complete');
  }
}

// Singleton instance
export const realtimeEngine = new RealtimeAnalyticsEngine();

// ============================================================================
// Client-Side Hook
// ============================================================================

interface RealtimeEngineConfig {
  refreshInterval: number;
  autoReconnect: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  enableForecasting?: boolean;
  enableAnomalyDetection?: boolean;
}

// Import for client-side usage
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export function useRealtimeEngine(config: RealtimeEngineConfig) {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());

  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) return;

    try {
      socketRef.current = io('/api/realtime', {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        autoConnect: true
      });

      socketRef.current.on('connect', () => {
        setIsConnected(true);
        setConnectionQuality('excellent');
        setLastError(null);
        reconnectAttemptsRef.current = 0;

        // Start ping monitoring
        startPingMonitoring();

        logger.info('Real-time engine connected');
      });

      socketRef.current.on('disconnect', (reason) => {
        setIsConnected(false);
        setConnectionQuality('disconnected');
        logger.info('Real-time engine disconnected', reason);

        if (config.autoReconnect && reason === 'io server disconnect') {
          scheduleReconnect();
        }
      });

      socketRef.current.on('connect_error', (error) => {
        setLastError(error.message);
        setConnectionQuality('disconnected');

        if (config.autoReconnect) {
          scheduleReconnect();
        }
      });

      // Listen for real-time data updates
      socketRef.current.on('metrics_update', (data: RealtimeMetrics) => {
        setMetrics({
          ...data,
          timestamp: new Date()
        });
      });

      socketRef.current.on('alert', (alert: AlertData) => {
        setMetrics(prev => prev ? {
          ...prev,
          alerts: [alert, ...(prev.alerts || [])].slice(0, 50) // Keep last 50 alerts
        } : null);
      });

      socketRef.current.on('pong', (latency: number) => {
        updateConnectionQuality(latency);
      });

    } catch (error) {
      setLastError((error as Error).message);
      setConnectionQuality('disconnected');
    }
  }, [config.autoReconnect]);

  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsConnected(false);
    setConnectionQuality('disconnected');
  }, []);

  const scheduleReconnect = useCallback(() => {
    const maxAttempts = config.maxReconnectAttempts || 5;
    const delay = config.reconnectDelay || 1000;

    if (reconnectAttemptsRef.current < maxAttempts) {
      reconnectAttemptsRef.current++;

      setTimeout(() => {
        logger.info(`Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxAttempts})`);
        connect();
      }, delay * Math.pow(2, reconnectAttemptsRef.current - 1)); // Exponential backoff
    }
  }, [config.maxReconnectAttempts, config.reconnectDelay, connect]);

  const startPingMonitoring = useCallback(() => {
    if (pingIntervalRef.current) return;

    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        const startTime = Date.now();
        socketRef.current.emit('ping', startTime);
      }
    }, 5000); // Ping every 5 seconds
  }, []);

  const updateConnectionQuality = useCallback((latency: number) => {
    if (latency < 100) {
      setConnectionQuality('excellent');
    } else if (latency < 300) {
      setConnectionQuality('good');
    } else {
      setConnectionQuality('poor');
    }
  }, []);

  const subscribe = useCallback((dataType: string) => {
    if (!subscriptions.has(dataType)) {
      setSubscriptions(prev => new Set(prev.add(dataType)));

      if (socketRef.current?.connected) {
        socketRef.current.emit('subscribe', { dataType });
      }
    }
  }, [subscriptions]);

  const unsubscribe = useCallback((dataType: string) => {
    if (subscriptions.has(dataType)) {
      setSubscriptions(prev => {
        const newSet = new Set(prev);
        newSet.delete(dataType);
        return newSet;
      });

      if (socketRef.current?.connected) {
        socketRef.current.emit('unsubscribe', { dataType });
      }
    }
  }, [subscriptions]);

  const refreshData = useCallback(async (forceRefresh = false) => {
    try {
      const params = new URLSearchParams({
        subscriptions: Array.from(subscriptions).join(','),
        enableForecasting: String(config.enableForecasting || false),
        enableAnomalyDetection: String(config.enableAnomalyDetection || false),
        forceRefresh: String(forceRefresh)
      });

      const response = await fetch(`/api/analytics/realtime?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setMetrics({
        ...data,
        timestamp: new Date()
      });

      setLastError(null);
    } catch (error) {
      setLastError((error as Error).message);
      logger.error('Failed to refresh data', error);
    }
  }, [subscriptions, config.enableForecasting, config.enableAnomalyDetection]);

  // Initialize connection
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Handle subscription changes
  useEffect(() => {
    if (socketRef.current?.connected) {
      Array.from(subscriptions).forEach(dataType => {
        socketRef.current?.emit('subscribe', { dataType });
      });
    }
  }, [subscriptions]);

  // Auto-refresh data
  useEffect(() => {
    if (!isConnected && subscriptions.size > 0) {
      const interval = setInterval(() => {
        refreshData();
      }, config.refreshInterval);

      return () => clearInterval(interval);
    }
  }, [isConnected, subscriptions.size, config.refreshInterval, refreshData]);

  // Initial data load
  useEffect(() => {
    if (subscriptions.size > 0) {
      refreshData(true);
    }
  }, [subscriptions.size, refreshData]);

  return {
    metrics,
    isConnected,
    connectionQuality,
    lastError,
    subscribe,
    unsubscribe,
    refreshData,
    connect,
    disconnect
  };
}

// Utility functions for data processing
export const calculateTrend = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

export const formatMetricValue = (value: number, unit?: string): string => {
  if (unit === 'percentage') {
    return `${value.toFixed(1)}%`;
  }
  if (unit === 'time') {
    if (value < 60) return `${value.toFixed(0)}m`;
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${hours}h ${minutes.toFixed(0)}m`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};

export const getMetricColor = (value: number, target?: number, inverted = false): string => {
  if (!target) return 'blue';

  const ratio = value / target;
  const isGood = inverted ? ratio < 0.8 : ratio > 0.8;
  const isOkay = inverted ? ratio < 1.2 : ratio > 0.6;

  if (isGood) return 'green';
  if (isOkay) return 'yellow';
  return 'red';
};

export const detectAnomalies = (data: number[], threshold = 2): boolean[] => {
  if (data.length < 3) return data.map(() => false);

  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);

  return data.map(value => Math.abs(value - mean) > threshold * stdDev);
};