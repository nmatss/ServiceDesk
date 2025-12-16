/**
 * Advanced Query Optimization for Enterprise Scale
 * Provides EXPLAIN ANALYZE, query plan optimization, and performance tracking
 */

import db from '../db/connection';
import logger from '../monitoring/structured-logger';

export interface QueryAnalysis {
  query: string;
  executionTime: number;
  scanCount: number;
  searchCount: number;
  temporaryTable: boolean;
  index: boolean;
  fullTableScan: boolean;
  cost: number;
  plan: string;
  suggestions: string[];
}

export interface QueryPerformanceMetrics {
  queryHash: string;
  averageExecutionTime: number;
  executionCount: number;
  slowestExecutionTime: number;
  fastestExecutionTime: number;
  lastExecuted: Date;
  cacheHitRate?: number;
}

export class QueryOptimizer {
  private static instance: QueryOptimizer;
  private queryMetrics = new Map<string, QueryPerformanceMetrics>();
  private slowQueryThreshold = 100; // milliseconds
  private enableProfiling = process.env.NODE_ENV !== 'production';

  private constructor() {}

  static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer();
    }
    return QueryOptimizer.instance;
  }

  /**
   * Analyze query execution plan and performance
   */
  async analyzeQuery(query: string, params: any[] = []): Promise<QueryAnalysis> {
    const startTime = performance.now();

    try {
      // Get query plan using EXPLAIN QUERY PLAN
      const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
      const plan = db.prepare(explainQuery).all(...params) as any[];

      // Execute the actual query to get real performance metrics
      const stmt = db.prepare(query);
      stmt.all(...params);

      const executionTime = performance.now() - startTime;

      // Analyze the plan
      const analysis = this.analyzePlan(plan, executionTime, query);

      // Track metrics
      this.trackQueryMetrics(query, executionTime);

      return analysis;
    } catch (error) {
      logger.error('Query analysis failed', error);
      throw error;
    }
  }

  /**
   * Optimize a query by suggesting improvements
   */
  optimizeQuery(query: string): { optimizedQuery: string; suggestions: string[] } {
    const suggestions: string[] = [];
    let optimizedQuery = query;

    // Remove unnecessary columns from SELECT *
    if (query.includes('SELECT *')) {
      suggestions.push('Replace SELECT * with specific column names to reduce data transfer');
    }

    // Suggest LIMIT for large result sets
    if (!query.toUpperCase().includes('LIMIT') && query.toUpperCase().includes('SELECT')) {
      suggestions.push('Consider adding LIMIT clause for pagination of large result sets');
    }

    // Suggest indexes for WHERE clauses
    const whereMatch = query.match(/WHERE\s+(\w+)\s*[=<>]/i);
    if (whereMatch) {
      suggestions.push(`Consider creating an index on column: ${whereMatch[1]}`);
    }

    // Suggest prepared statements for repeated queries
    if (query.includes('?')) {
      suggestions.push('Using prepared statements - good for performance and security');
    }

    // Optimize JOINs
    if (query.toUpperCase().includes('LEFT JOIN')) {
      suggestions.push('Ensure JOIN conditions use indexed columns for optimal performance');
    }

    // Suggest EXISTS over IN for subqueries
    if (query.toUpperCase().includes(' IN (SELECT')) {
      optimizedQuery = query.replace(/ IN \(SELECT/gi, ' EXISTS (SELECT 1 FROM');
      suggestions.push('Replaced IN with EXISTS for better performance with subqueries');
    }

    return { optimizedQuery, suggestions };
  }

  /**
   * Get performance metrics for all tracked queries
   */
  getQueryMetrics(): QueryPerformanceMetrics[] {
    return Array.from(this.queryMetrics.values());
  }

  /**
   * Get slow queries that exceed the threshold
   */
  getSlowQueries(): QueryPerformanceMetrics[] {
    return this.getQueryMetrics().filter(
      metric => metric.averageExecutionTime > this.slowQueryThreshold
    );
  }

  /**
   * Reset query metrics
   */
  resetMetrics(): void {
    this.queryMetrics.clear();
  }

  /**
   * Create optimal indexes based on query patterns
   */
  suggestIndexes(): string[] {
    // Common indexes for ServiceDesk schema
    const commonIndexSuggestions = [
      'CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON tickets(status_id, priority_id);',
      'CREATE INDEX IF NOT EXISTS idx_tickets_assigned_created ON tickets(assigned_to, created_at);',
      'CREATE INDEX IF NOT EXISTS idx_tickets_category_status ON tickets(category_id, status_id);',
      'CREATE INDEX IF NOT EXISTS idx_comments_ticket_created ON comments(ticket_id, created_at);',
      'CREATE INDEX IF NOT EXISTS idx_sla_tracking_due_dates ON sla_tracking(response_due_at, resolution_due_at);',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at);',
      'CREATE INDEX IF NOT EXISTS idx_attachments_ticket_type ON attachments(ticket_id, mime_type);',
      'CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, created_at) WHERE role IN (\'admin\', \'agent\');',
      'CREATE INDEX IF NOT EXISTS idx_kb_articles_status_category ON kb_articles(status, category_id);',
      'CREATE INDEX IF NOT EXISTS idx_analytics_date_type ON analytics_daily_metrics(date, metric_type);'
    ];

    return commonIndexSuggestions;
  }

  /**
   * Execute index creation suggestions
   */
  async createOptimalIndexes(): Promise<{ created: string[]; errors: string[] }> {
    const suggestions = this.suggestIndexes();
    const created: string[] = [];
    const errors: string[] = [];

    for (const indexQuery of suggestions) {
      try {
        db.exec(indexQuery);
        created.push(indexQuery);
      } catch (error) {
        errors.push(`Failed to create index: ${indexQuery} - ${error}`);
      }
    }

    return { created, errors };
  }

  /**
   * Analyze query plan details
   */
  private analyzePlan(plan: any[], executionTime: number, query: string): QueryAnalysis {
    const planText = plan.map(p => `${p.id}: ${p.detail}`).join('\n');

    // Analyze plan characteristics
    const hasFullTableScan = plan.some(p =>
      p.detail?.toLowerCase().includes('scan table') &&
      !p.detail?.toLowerCase().includes('using index')
    );

    const hasTemporaryTable = plan.some(p =>
      p.detail?.toLowerCase().includes('temp') ||
      p.detail?.toLowerCase().includes('temporary')
    );

    const hasIndex = plan.some(p =>
      p.detail?.toLowerCase().includes('using index') ||
      p.detail?.toLowerCase().includes('search using index')
    );

    // Count operations
    const scanCount = plan.filter(p => p.detail?.toLowerCase().includes('scan')).length;
    const searchCount = plan.filter(p => p.detail?.toLowerCase().includes('search')).length;

    // Calculate cost (heuristic based on execution time and plan complexity)
    const cost = executionTime * (scanCount + 1) * (hasFullTableScan ? 2 : 1);

    // Generate suggestions
    const suggestions: string[] = [];

    if (hasFullTableScan) {
      suggestions.push('Full table scan detected - consider adding appropriate indexes');
    }

    if (hasTemporaryTable) {
      suggestions.push('Temporary table created - consider query restructuring');
    }

    if (!hasIndex && query.toUpperCase().includes('WHERE')) {
      suggestions.push('No indexes used - create indexes on WHERE clause columns');
    }

    if (executionTime > this.slowQueryThreshold) {
      suggestions.push(`Query execution time (${executionTime.toFixed(2)}ms) exceeds threshold`);
    }

    return {
      query,
      executionTime,
      scanCount,
      searchCount,
      temporaryTable: hasTemporaryTable,
      index: hasIndex,
      fullTableScan: hasFullTableScan,
      cost,
      plan: planText,
      suggestions
    };
  }

  /**
   * Track query performance metrics
   */
  private trackQueryMetrics(query: string, executionTime: number): void {
    if (!this.enableProfiling) return;

    const queryHash = this.hashQuery(query);
    const existing = this.queryMetrics.get(queryHash);

    if (existing) {
      existing.executionCount++;
      existing.averageExecutionTime =
        (existing.averageExecutionTime * (existing.executionCount - 1) + executionTime) / existing.executionCount;
      existing.slowestExecutionTime = Math.max(existing.slowestExecutionTime, executionTime);
      existing.fastestExecutionTime = Math.min(existing.fastestExecutionTime, executionTime);
      existing.lastExecuted = new Date();
    } else {
      this.queryMetrics.set(queryHash, {
        queryHash,
        averageExecutionTime: executionTime,
        executionCount: 1,
        slowestExecutionTime: executionTime,
        fastestExecutionTime: executionTime,
        lastExecuted: new Date()
      });
    }
  }

  /**
   * Generate hash for query identification
   */
  private hashQuery(query: string): string {
    // Normalize query for consistent hashing
    const normalized = query
      .replace(/\s+/g, ' ')
      .replace(/\?/g, 'PARAM')
      .trim()
      .toLowerCase();

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// Export singleton instance
export const queryOptimizer = QueryOptimizer.getInstance();

// Helper function for easy query analysis
export async function analyzeQuery(query: string, params: any[] = []): Promise<QueryAnalysis> {
  return queryOptimizer.analyzeQuery(query, params);
}

// Helper function for query optimization
export function optimizeQuery(query: string) {
  return queryOptimizer.optimizeQuery(query);
}