/**
 * Intelligent Index Management for Enterprise Scale
 * Manages composite indexes, analyzes usage patterns, and optimizes database performance
 */

import db from '../db/connection';

export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  partial: boolean;
  size: number;
  usage: IndexUsageStats;
}

export interface IndexUsageStats {
  totalScans: number;
  totalSeeks: number;
  lastUsed: Date | null;
  avgScanTime: number;
  effectiveness: number; // 0-100 score
}

export interface IndexRecommendation {
  type: 'create' | 'drop' | 'modify';
  tableName: string;
  columns: string[];
  reason: string;
  estimatedImpact: 'high' | 'medium' | 'low';
  sql: string;
}

export class IndexManager {
  private static instance: IndexManager;
  private indexUsageStats = new Map<string, IndexUsageStats>();

  private constructor() {}

  static getInstance(): IndexManager {
    if (!IndexManager.instance) {
      IndexManager.instance = new IndexManager();
    }
    return IndexManager.instance;
  }

  /**
   * Get all indexes in the database
   */
  getAllIndexes(): IndexInfo[] {
    const indexes: IndexInfo[] = [];

    // Get all tables
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];

    for (const table of tables) {
      const tableIndexes = this.getTableIndexes(table.name);
      indexes.push(...tableIndexes);
    }

    return indexes;
  }

  /**
   * Get indexes for a specific table
   */
  getTableIndexes(tableName: string): IndexInfo[] {
    const indexes = db.prepare(`
      SELECT name, sql, origin FROM sqlite_master
      WHERE type = 'index' AND tbl_name = ? AND name NOT LIKE 'sqlite_%'
    `).all(tableName) as { name: string; sql: string | null; origin: string }[];

    return indexes.map(index => {
      const columns = this.parseIndexColumns(index.sql || '');
      const unique = index.sql?.includes('UNIQUE') || false;
      const partial = index.sql?.includes('WHERE') || false;

      return {
        name: index.name,
        table: tableName,
        columns,
        unique,
        partial,
        size: this.getIndexSize(index.name),
        usage: this.getIndexUsage(index.name)
      };
    });
  }

  /**
   * Analyze query patterns and recommend indexes
   */
  async analyzeAndRecommend(queryPatterns: string[]): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // Analyze WHERE clauses
    const wherePatterns = this.extractWherePatterns(queryPatterns);
    recommendations.push(...this.recommendIndexesForWhere(wherePatterns));

    // Analyze JOIN patterns
    const joinPatterns = this.extractJoinPatterns(queryPatterns);
    recommendations.push(...this.recommendIndexesForJoins(joinPatterns));

    // Analyze ORDER BY patterns
    const orderByPatterns = this.extractOrderByPatterns(queryPatterns);
    recommendations.push(...this.recommendIndexesForOrderBy(orderByPatterns));

    // Find unused indexes
    const unusedIndexes = this.findUnusedIndexes();
    recommendations.push(...this.recommendDropUnusedIndexes(unusedIndexes));

    // Find missing composite indexes
    const compositeRecommendations = this.recommendCompositeIndexes(queryPatterns);
    recommendations.push(...compositeRecommendations);

    return recommendations;
  }

  /**
   * Create enterprise-ready composite indexes
   */
  async createEnterpriseIndexes(): Promise<{ created: string[]; errors: string[] }> {
    const created: string[] = [];
    const errors: string[] = [];

    const enterpriseIndexes = [
      // Ticket management indexes
      {
        name: 'idx_tickets_enterprise_status',
        sql: `CREATE INDEX IF NOT EXISTS idx_tickets_enterprise_status
              ON tickets(status_id, priority_id, assigned_to, created_at)`
      },
      {
        name: 'idx_tickets_enterprise_user',
        sql: `CREATE INDEX IF NOT EXISTS idx_tickets_enterprise_user
              ON tickets(user_id, status_id, created_at DESC)`
      },
      {
        name: 'idx_tickets_enterprise_agent',
        sql: `CREATE INDEX IF NOT EXISTS idx_tickets_enterprise_agent
              ON tickets(assigned_to, status_id, priority_id, updated_at DESC)
              WHERE assigned_to IS NOT NULL`
      },

      // SLA tracking indexes
      {
        name: 'idx_sla_enterprise_due',
        sql: `CREATE INDEX IF NOT EXISTS idx_sla_enterprise_due
              ON sla_tracking(response_due_at, resolution_due_at, response_met, resolution_met)`
      },
      {
        name: 'idx_sla_enterprise_performance',
        sql: `CREATE INDEX IF NOT EXISTS idx_sla_enterprise_performance
              ON sla_tracking(sla_policy_id, response_met, resolution_met, created_at)`
      },

      // Analytics and reporting indexes
      {
        name: 'idx_analytics_enterprise_daily',
        sql: `CREATE INDEX IF NOT EXISTS idx_analytics_enterprise_daily
              ON analytics_daily_metrics(date DESC, metric_type, metric_value)`
      },
      {
        name: 'idx_analytics_enterprise_agent',
        sql: `CREATE INDEX IF NOT EXISTS idx_analytics_enterprise_agent
              ON analytics_agent_metrics(agent_id, date DESC, metric_type)`
      },

      // Notification system indexes
      {
        name: 'idx_notifications_enterprise_user',
        sql: `CREATE INDEX IF NOT EXISTS idx_notifications_enterprise_user
              ON notifications(user_id, read_at, created_at DESC)
              WHERE read_at IS NULL`
      },
      {
        name: 'idx_notifications_enterprise_type',
        sql: `CREATE INDEX IF NOT EXISTS idx_notifications_enterprise_type
              ON notifications(type, created_at DESC, user_id)`
      },

      // Comments and attachments indexes
      {
        name: 'idx_comments_enterprise_ticket',
        sql: `CREATE INDEX IF NOT EXISTS idx_comments_enterprise_ticket
              ON comments(ticket_id, created_at DESC, is_internal)`
      },
      {
        name: 'idx_attachments_enterprise_ticket',
        sql: `CREATE INDEX IF NOT EXISTS idx_attachments_enterprise_ticket
              ON attachments(ticket_id, mime_type, created_at DESC)`
      },

      // Knowledge base indexes
      {
        name: 'idx_kb_articles_enterprise_search',
        sql: `CREATE INDEX IF NOT EXISTS idx_kb_articles_enterprise_search
              ON kb_articles(status, category_id, view_count DESC, updated_at DESC)
              WHERE status = 'published'`
      },

      // User session indexes
      {
        name: 'idx_user_sessions_enterprise_active',
        sql: `CREATE INDEX IF NOT EXISTS idx_user_sessions_enterprise_active
              ON user_sessions(user_id, is_active, last_activity DESC)
              WHERE is_active = 1`
      },

      // Workflow and automation indexes
      {
        name: 'idx_workflow_enterprise_status',
        sql: `CREATE INDEX IF NOT EXISTS idx_workflow_enterprise_status
              ON workflow_instances(workflow_id, status, created_at DESC)`
      },
      {
        name: 'idx_automations_enterprise_trigger',
        sql: `CREATE INDEX IF NOT EXISTS idx_automations_enterprise_trigger
              ON automations(trigger_type, is_active, priority DESC)
              WHERE is_active = 1`
      }
    ];

    for (const index of enterpriseIndexes) {
      try {
        db.exec(index.sql);
        created.push(index.name);
      } catch (error) {
        errors.push(`Failed to create ${index.name}: ${error}`);
      }
    }

    return { created, errors };
  }

  /**
   * Monitor index usage and performance
   */
  monitorIndexUsage(indexName: string, operation: 'scan' | 'seek', executionTime: number): void {
    const stats = this.indexUsageStats.get(indexName) || {
      totalScans: 0,
      totalSeeks: 0,
      lastUsed: null,
      avgScanTime: 0,
      effectiveness: 0
    };

    if (operation === 'scan') {
      stats.totalScans++;
    } else {
      stats.totalSeeks++;
    }

    stats.lastUsed = new Date();

    // Update average scan time
    const totalOperations = stats.totalScans + stats.totalSeeks;
    stats.avgScanTime = (stats.avgScanTime * (totalOperations - 1) + executionTime) / totalOperations;

    // Calculate effectiveness (seeks are better than scans)
    stats.effectiveness = Math.min(100, (stats.totalSeeks / totalOperations) * 100);

    this.indexUsageStats.set(indexName, stats);
  }

  /**
   * Get index performance statistics
   */
  getIndexPerformanceStats(): { name: string; stats: IndexUsageStats }[] {
    return Array.from(this.indexUsageStats.entries()).map(([name, stats]) => ({
      name,
      stats
    }));
  }

  /**
   * Find and drop unused indexes
   */
  async cleanupUnusedIndexes(daysUnused: number = 30): Promise<{ dropped: string[]; errors: string[] }> {
    const dropped: string[] = [];
    const errors: string[] = [];

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysUnused);

    const unusedIndexes = this.findUnusedIndexes().filter(indexName => {
      const stats = this.indexUsageStats.get(indexName);
      return !stats?.lastUsed || stats.lastUsed < cutoffDate;
    });

    for (const indexName of unusedIndexes) {
      try {
        // Don't drop system or primary key indexes
        if (!indexName.startsWith('sqlite_') && !indexName.includes('pk_')) {
          db.exec(`DROP INDEX IF EXISTS ${indexName}`);
          dropped.push(indexName);
        }
      } catch (error) {
        errors.push(`Failed to drop ${indexName}: ${error}`);
      }
    }

    return { dropped, errors };
  }

  /**
   * Rebuild fragmented indexes
   */
  async rebuildIndexes(tableName?: string): Promise<{ rebuilt: string[]; errors: string[] }> {
    const rebuilt: string[] = [];
    const errors: string[] = [];

    try {
      if (tableName) {
        db.exec(`REINDEX ${tableName}`);
        rebuilt.push(tableName);
      } else {
        db.exec('REINDEX');
        rebuilt.push('ALL_INDEXES');
      }
    } catch (error) {
      errors.push(`Failed to rebuild indexes: ${error}`);
    }

    return { rebuilt, errors };
  }

  private parseIndexColumns(sql: string): string[] {
    if (!sql) return [];

    const match = sql.match(/\(([^)]+)\)/);
    if (!match || !match[1]) return [];

    return match[1].split(',').map(col => {
      const parts = col.trim().split(' ');
      return parts[0] || '';
    }).filter(col => col !== '');
  }

  private getIndexSize(indexName: string): number {
    try {
      // SQLite doesn't provide direct index size, so we estimate
      const info = db.pragma(`index_info(${indexName})`) as unknown[];
      return Array.isArray(info) ? info.length * 1024 : 0; // Rough estimate
    } catch {
      return 0;
    }
  }

  private getIndexUsage(indexName: string): IndexUsageStats {
    return this.indexUsageStats.get(indexName) || {
      totalScans: 0,
      totalSeeks: 0,
      lastUsed: null,
      avgScanTime: 0,
      effectiveness: 0
    };
  }

  private extractWherePatterns(queries: string[]): { table: string; columns: string[] }[] {
    const patterns: { table: string; columns: string[] }[] = [];

    for (const query of queries) {
      const whereMatch = query.match(/FROM\s+(\w+).*WHERE\s+(.+?)(?:\s+ORDER|\s+GROUP|\s+LIMIT|$)/i);
      if (whereMatch && whereMatch[1] && whereMatch[2]) {
        const table = whereMatch[1];
        const whereClause = whereMatch[2];
        const columns = this.extractColumnsFromWhere(whereClause);
        patterns.push({ table, columns });
      }
    }

    return patterns;
  }

  private extractJoinPatterns(queries: string[]): { leftTable: string; rightTable: string; columns: string[] }[] {
    const patterns: { leftTable: string; rightTable: string; columns: string[] }[] = [];

    for (const query of queries) {
      const joinMatches = query.matchAll(/JOIN\s+(\w+)\s+.*?ON\s+([^WHERE\s]+)/gi);
      for (const match of joinMatches) {
        if (match[1] && match[2]) {
          const rightTable = match[1];
          const onClause = match[2];
          const columns = this.extractColumnsFromJoin(onClause);
          patterns.push({ leftTable: '', rightTable, columns });
        }
      }
    }

    return patterns;
  }

  private extractOrderByPatterns(queries: string[]): { table: string; columns: string[] }[] {
    const patterns: { table: string; columns: string[] }[] = [];

    for (const query of queries) {
      const orderMatch = query.match(/FROM\s+(\w+).*ORDER\s+BY\s+([^LIMIT\s]+)/i);
      if (orderMatch && orderMatch[1] && orderMatch[2]) {
        const table = orderMatch[1];
        const orderClause = orderMatch[2];
        const columns = orderClause.split(',')
          .map(col => {
            const parts = col.trim().split(' ');
            return parts[0] || '';
          })
          .filter(col => col !== '');
        patterns.push({ table, columns });
      }
    }

    return patterns;
  }

  private extractColumnsFromWhere(whereClause: string): string[] {
    const columns: string[] = [];
    const columnMatches = whereClause.matchAll(/(\w+)\s*[=<>!]/g);

    for (const match of columnMatches) {
      if (match[1]) {
        columns.push(match[1]);
      }
    }

    return columns;
  }

  private extractColumnsFromJoin(onClause: string): string[] {
    const columns: string[] = [];
    const columnMatches = onClause.matchAll(/(\w+)\.(\w+)/g);

    for (const match of columnMatches) {
      if (match[2]) {
        columns.push(match[2]);
      }
    }

    return columns;
  }

  private recommendIndexesForWhere(patterns: { table: string; columns: string[] }[]): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    for (const pattern of patterns) {
      if (pattern.columns.length > 0) {
        recommendations.push({
          type: 'create',
          tableName: pattern.table,
          columns: pattern.columns,
          reason: `Frequent WHERE clauses on columns: ${pattern.columns.join(', ')}`,
          estimatedImpact: pattern.columns.length > 1 ? 'high' : 'medium',
          sql: `CREATE INDEX IF NOT EXISTS idx_${pattern.table}_${pattern.columns.join('_')} ON ${pattern.table}(${pattern.columns.join(', ')})`
        });
      }
    }

    return recommendations;
  }

  private recommendIndexesForJoins(patterns: { leftTable: string; rightTable: string; columns: string[] }[]): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    for (const pattern of patterns) {
      if (pattern.columns.length > 0) {
        recommendations.push({
          type: 'create',
          tableName: pattern.rightTable,
          columns: pattern.columns,
          reason: `JOIN operation on columns: ${pattern.columns.join(', ')}`,
          estimatedImpact: 'high',
          sql: `CREATE INDEX IF NOT EXISTS idx_${pattern.rightTable}_join_${pattern.columns.join('_')} ON ${pattern.rightTable}(${pattern.columns.join(', ')})`
        });
      }
    }

    return recommendations;
  }

  private recommendIndexesForOrderBy(patterns: { table: string; columns: string[] }[]): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    for (const pattern of patterns) {
      if (pattern.columns.length > 0) {
        recommendations.push({
          type: 'create',
          tableName: pattern.table,
          columns: pattern.columns,
          reason: `ORDER BY operations on columns: ${pattern.columns.join(', ')}`,
          estimatedImpact: 'medium',
          sql: `CREATE INDEX IF NOT EXISTS idx_${pattern.table}_sort_${pattern.columns.join('_')} ON ${pattern.table}(${pattern.columns.join(', ')})`
        });
      }
    }

    return recommendations;
  }

  private recommendDropUnusedIndexes(unusedIndexes: string[]): IndexRecommendation[] {
    return unusedIndexes.map(indexName => ({
      type: 'drop' as const,
      tableName: '',
      columns: [],
      reason: `Index ${indexName} is not being used`,
      estimatedImpact: 'low' as const,
      sql: `DROP INDEX IF EXISTS ${indexName}`
    }));
  }

  private recommendCompositeIndexes(_queries: string[]): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    // Analyze common column combinations in ServiceDesk queries
    const commonCombinations = [
      { table: 'tickets', columns: ['status_id', 'priority_id', 'created_at'], reason: 'Common ticket filtering pattern' },
      { table: 'tickets', columns: ['user_id', 'status_id'], reason: 'User ticket queries' },
      { table: 'tickets', columns: ['assigned_to', 'status_id'], reason: 'Agent workload queries' },
      { table: 'comments', columns: ['ticket_id', 'created_at'], reason: 'Ticket comment timeline' },
      { table: 'sla_tracking', columns: ['response_due_at', 'resolution_due_at'], reason: 'SLA deadline monitoring' }
    ];

    for (const combo of commonCombinations) {
      recommendations.push({
        type: 'create',
        tableName: combo.table,
        columns: combo.columns,
        reason: combo.reason,
        estimatedImpact: 'high',
        sql: `CREATE INDEX IF NOT EXISTS idx_${combo.table}_composite_${combo.columns.join('_')} ON ${combo.table}(${combo.columns.join(', ')})`
      });
    }

    return recommendations;
  }

  private findUnusedIndexes(): string[] {
    const allIndexes = this.getAllIndexes();
    const unused: string[] = [];

    for (const index of allIndexes) {
      const stats = this.indexUsageStats.get(index.name);
      if (!stats || (stats.totalScans === 0 && stats.totalSeeks === 0)) {
        unused.push(index.name);
      }
    }

    return unused;
  }
}

// Export singleton instance
export const indexManager = IndexManager.getInstance();