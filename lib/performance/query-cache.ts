/**
 * Database Query Cache with Intelligent Invalidation
 * Caches database query results with automatic invalidation based on data changes
 */

import { queryOptimizer } from './query-optimizer';
import { applicationCache } from './application-cache';
import { logger } from '../monitoring/logger';

export interface QueryCacheConfig {
  defaultTTL: number;
  maxEntries: number;
  intelligentInvalidation: boolean;
  trackDependencies: boolean;
  cacheKeyStrategy: 'simple' | 'semantic' | 'normalized';
  compression: {
    enabled: boolean;
    threshold: number;
  };
  clustering: {
    enabled: boolean;
    syncStrategy: 'immediate' | 'batch' | 'periodic';
  };
}

export interface CachedQuery {
  sql: string;
  params: any[];
  result: any;
  cacheKey: string;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  executionTime: number;
  dependencies: Set<string>;
  tags: Set<string>;
  invalidationRules: InvalidationRule[];
}

export interface InvalidationRule {
  type: 'table' | 'column' | 'condition' | 'time';
  target: string;
  condition?: (oldValue: any, newValue: any) => boolean;
  ttl?: number;
}

export interface QueryPattern {
  pattern: RegExp;
  cacheable: boolean;
  ttl: number;
  dependencies: string[];
  tags: string[];
  invalidationRules: InvalidationRule[];
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  averageQueryTime: number;
  cacheSize: number;
  memoryUsage: number;
  invalidationCount: number;
  topQueries: Array<{
    cacheKey: string;
    hitCount: number;
    totalTime: number;
    avgExecutionTime: number;
  }>;
}

export class QueryCache {
  private static instance: QueryCache;
  private cache = new Map<string, CachedQuery>();
  private patterns: QueryPattern[] = [];
  private tableDependencies = new Map<string, Set<string>>();
  private invalidationHistory: Array<{
    timestamp: Date;
    reason: string;
    affectedQueries: number;
  }> = [];

  private config: QueryCacheConfig;
  private metrics = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    totalExecutionTime: 0,
    cacheExecutionTime: 0
  };

  private constructor(config: QueryCacheConfig) {
    this.config = config;
    this.setupDefaultPatterns();
    this.startInvalidationMonitoring();
  }

  static getInstance(config?: QueryCacheConfig): QueryCache {
    if (!QueryCache.instance && config) {
      QueryCache.instance = new QueryCache(config);
    }
    return QueryCache.instance;
  }

  /**
   * Execute a query with caching
   */
  async executeQuery<T = any>(
    sql: string,
    params: any[] = [],
    options: {
      ttl?: number;
      tags?: string[];
      forceFresh?: boolean;
      trackExecution?: boolean;
    } = {}
  ): Promise<T> {
    const { ttl, tags = [], forceFresh = false, trackExecution = true } = options;

    // Generate cache key
    const cacheKey = this.generateCacheKey(sql, params);

    // Check if query is cacheable
    const pattern = this.findMatchingPattern(sql);
    if (!pattern?.cacheable && !forceFresh) {
      return this.executeUncachedQuery(sql, params, trackExecution);
    }

    // Try to get from cache
    if (!forceFresh) {
      const cached = await this.getFromCache<T>(cacheKey);
      if (cached !== null) {
        this.metrics.hits++;
        this.updateAccessStats(cacheKey);
        return cached;
      }
    }

    // Cache miss - execute query
    this.metrics.misses++;
    const startTime = Date.now();

    const result = await this.executeUncachedQuery<T>(sql, params, trackExecution);

    const executionTime = Date.now() - startTime;
    this.metrics.totalExecutionTime += executionTime;

    // Cache the result
    await this.cacheResult(cacheKey, sql, params, result, executionTime, {
      ttl: ttl || pattern?.ttl || this.config.defaultTTL,
      tags: [...tags, ...(pattern?.tags || [])],
      dependencies: pattern?.dependencies || [],
      invalidationRules: pattern?.invalidationRules || []
    });

    return result;
  }

  /**
   * Invalidate cache based on data changes
   */
  async invalidateByTable(tableName: string, changes?: {
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    affectedRows?: any[];
    columns?: string[];
  }): Promise<number> {
    let invalidatedCount = 0;

    // Find queries that depend on this table
    const dependentQueries = this.tableDependencies.get(tableName) || new Set();

    for (const cacheKey of dependentQueries) {
      const cachedQuery = this.cache.get(cacheKey);
      if (!cachedQuery) continue;

      // Check invalidation rules
      let shouldInvalidate = true;

      if (changes && cachedQuery.invalidationRules.length > 0) {
        shouldInvalidate = this.shouldInvalidateByRules(
          cachedQuery.invalidationRules,
          tableName,
          changes
        );
      }

      if (shouldInvalidate) {
        this.cache.delete(cacheKey);
        invalidatedCount++;
      }
    }

    // Record invalidation
    this.invalidationHistory.push({
      timestamp: new Date(),
      reason: `Table ${tableName} changed`,
      affectedQueries: invalidatedCount
    });

    this.metrics.invalidations += invalidatedCount;

    return invalidatedCount;
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidatedCount = 0;
    const tagSet = new Set(tags);

    for (const [cacheKey, cachedQuery] of this.cache.entries()) {
      const hasMatchingTag = Array.from(cachedQuery.tags).some(tag => tagSet.has(tag));

      if (hasMatchingTag) {
        this.cache.delete(cacheKey);
        this.removeFromDependencies(cacheKey);
        invalidatedCount++;
      }
    }

    this.invalidationHistory.push({
      timestamp: new Date(),
      reason: `Tags invalidation: ${tags.join(', ')}`,
      affectedQueries: invalidatedCount
    });

    this.metrics.invalidations += invalidatedCount;

    return invalidatedCount;
  }

  /**
   * Warm cache with common queries
   */
  async warmCache(queries: Array<{
    sql: string;
    params: any[];
    priority: 'high' | 'medium' | 'low';
  }>): Promise<{ warmed: number; failed: number }> {
    let warmed = 0;
    let failed = 0;

    // Sort by priority
    const sortedQueries = queries.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const query of sortedQueries) {
      try {
        await this.executeQuery(query.sql, query.params, { forceFresh: true });
        warmed++;
      } catch (error) {
        logger.warn('Failed to warm cache for query', query.sql, error);
        failed++;
      }
    }

    return { warmed, failed };
  }

  /**
   * Add a query pattern for intelligent caching
   */
  addPattern(pattern: QueryPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Get cache metrics and statistics
   */
  getMetrics(): CacheMetrics {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;
    const missRate = 100 - hitRate;

    const averageQueryTime = this.metrics.misses > 0
      ? this.metrics.totalExecutionTime / this.metrics.misses
      : 0;

    // Calculate top queries
    const queryStats = new Map<string, { hitCount: number; totalTime: number; count: number }>();

    for (const cachedQuery of this.cache.values()) {
      const existing = queryStats.get(cachedQuery.cacheKey) || {
        hitCount: 0,
        totalTime: 0,
        count: 0
      };

      existing.hitCount += cachedQuery.accessCount;
      existing.totalTime += cachedQuery.executionTime;
      existing.count++;

      queryStats.set(cachedQuery.cacheKey, existing);
    }

    const topQueries = Array.from(queryStats.entries())
      .map(([cacheKey, stats]) => ({
        cacheKey,
        hitCount: stats.hitCount,
        totalTime: stats.totalTime,
        avgExecutionTime: stats.totalTime / stats.count
      }))
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10);

    return {
      hitRate,
      missRate,
      averageQueryTime,
      cacheSize: this.cache.size,
      memoryUsage: this.calculateMemoryUsage(),
      invalidationCount: this.metrics.invalidations,
      topQueries
    };
  }

  /**
   * Get cache entries for analysis
   */
  getCacheEntries(filter?: {
    table?: string;
    tags?: string[];
    minAccessCount?: number;
  }): Array<{
    cacheKey: string;
    sql: string;
    accessCount: number;
    age: number;
    executionTime: number;
    tags: string[];
    dependencies: string[];
  }> {
    const entries: Array<{
      cacheKey: string;
      sql: string;
      accessCount: number;
      age: number;
      executionTime: number;
      tags: string[];
      dependencies: string[];
    }> = [];

    const now = Date.now();

    for (const cachedQuery of this.cache.values()) {
      const age = now - cachedQuery.createdAt.getTime();

      // Apply filters
      if (filter) {
        if (filter.table && !cachedQuery.dependencies.has(filter.table)) {
          continue;
        }

        if (filter.tags && !filter.tags.some(tag => cachedQuery.tags.has(tag))) {
          continue;
        }

        if (filter.minAccessCount && cachedQuery.accessCount < filter.minAccessCount) {
          continue;
        }
      }

      entries.push({
        cacheKey: cachedQuery.cacheKey,
        sql: cachedQuery.sql,
        accessCount: cachedQuery.accessCount,
        age,
        executionTime: cachedQuery.executionTime,
        tags: Array.from(cachedQuery.tags),
        dependencies: Array.from(cachedQuery.dependencies)
      });
    }

    return entries;
  }

  /**
   * Clear all cached queries
   */
  clear(): void {
    this.cache.clear();
    this.tableDependencies.clear();
    this.invalidationHistory = [];
    this.metrics = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      totalExecutionTime: 0,
      cacheExecutionTime: 0
    };
  }

  /**
   * Export cache state for analysis
   */
  export(): {
    entries: Array<{
      cacheKey: string;
      sql: string;
      params: any[];
      metadata: {
        createdAt: string;
        accessCount: number;
        executionTime: number;
        dependencies: string[];
        tags: string[];
      };
    }>;
    metrics: CacheMetrics;
    invalidationHistory: Array<{
      timestamp: string;
      reason: string;
      affectedQueries: number;
    }>;
  } {
    const entries = Array.from(this.cache.values()).map(cached => ({
      cacheKey: cached.cacheKey,
      sql: cached.sql,
      params: cached.params,
      metadata: {
        createdAt: cached.createdAt.toISOString(),
        accessCount: cached.accessCount,
        executionTime: cached.executionTime,
        dependencies: Array.from(cached.dependencies),
        tags: Array.from(cached.tags)
      }
    }));

    const invalidationHistory = this.invalidationHistory.map(entry => ({
      timestamp: entry.timestamp.toISOString(),
      reason: entry.reason,
      affectedQueries: entry.affectedQueries
    }));

    return {
      entries,
      metrics: this.getMetrics(),
      invalidationHistory
    };
  }

  private generateCacheKey(sql: string, params: any[]): string {
    switch (this.config.cacheKeyStrategy) {
      case 'simple':
        return this.generateSimpleKey(sql, params);
      case 'semantic':
        return this.generateSemanticKey(sql, params);
      case 'normalized':
        return this.generateNormalizedKey(sql, params);
      default:
        return this.generateSimpleKey(sql, params);
    }
  }

  private generateSimpleKey(sql: string, params: any[]): string {
    const paramString = JSON.stringify(params);
    return `query:${this.hash(sql + paramString)}`;
  }

  private generateSemanticKey(sql: string, params: any[]): string {
    // Normalize SQL for semantic equivalence
    const normalizedSQL = sql
      .replace(/\s+/g, ' ')
      .replace(/\s*([(),=<>])\s*/g, '$1')
      .trim()
      .toLowerCase();

    const paramString = JSON.stringify(params);
    return `query:semantic:${this.hash(normalizedSQL + paramString)}`;
  }

  private generateNormalizedKey(sql: string, params: any[]): string {
    // Parse and normalize SQL structure
    const normalized = this.normalizeSQL(sql);
    const paramString = JSON.stringify(params);
    return `query:normalized:${this.hash(normalized + paramString)}`;
  }

  private normalizeSQL(sql: string): string {
    // Basic SQL normalization (would be more sophisticated in practice)
    return sql
      .replace(/\s+/g, ' ')
      .replace(/\s*([(),=<>])\s*/g, '$1')
      .replace(/\bWHERE\s+/i, 'WHERE ')
      .replace(/\bORDER\s+BY\s+/i, 'ORDER BY ')
      .trim()
      .toLowerCase();
  }

  private hash(input: string): string {
    // Simple hash function (would use crypto in practice)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private findMatchingPattern(sql: string): QueryPattern | null {
    for (const pattern of this.patterns) {
      if (pattern.pattern.test(sql)) {
        return pattern;
      }
    }
    return null;
  }

  private async executeUncachedQuery<T>(
    sql: string,
    params: any[],
    trackExecution: boolean
  ): Promise<T> {
    if (trackExecution) {
      // Use query optimizer for analysis
      const analysis = await queryOptimizer.analyzeQuery(sql, params);
      logger.info('Query analysis', analysis);
    }

    // Execute query using your database connection
    // This is a placeholder - replace with actual database execution
    throw new Error('Database execution not implemented');
  }

  private async getFromCache<T>(cacheKey: string): Promise<T | null> {
    const cachedQuery = this.cache.get(cacheKey);
    if (!cachedQuery) {
      return null;
    }

    // Check TTL
    const now = Date.now();
    const age = now - cachedQuery.createdAt.getTime();
    const ttl = this.findMatchingPattern(cachedQuery.sql)?.ttl || this.config.defaultTTL;

    if (age > ttl * 1000) {
      this.cache.delete(cacheKey);
      this.removeFromDependencies(cacheKey);
      return null;
    }

    return cachedQuery.result as T;
  }

  private async cacheResult(
    cacheKey: string,
    sql: string,
    params: any[],
    result: any,
    executionTime: number,
    options: {
      ttl: number;
      tags: string[];
      dependencies: string[];
      invalidationRules: InvalidationRule[];
    }
  ): Promise<void> {
    // Check cache size limits
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const cachedQuery: CachedQuery = {
      sql,
      params,
      result,
      cacheKey,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      executionTime,
      dependencies: new Set(options.dependencies),
      tags: new Set(options.tags),
      invalidationRules: options.invalidationRules
    };

    this.cache.set(cacheKey, cachedQuery);

    // Update table dependencies
    for (const table of options.dependencies) {
      if (!this.tableDependencies.has(table)) {
        this.tableDependencies.set(table, new Set());
      }
      this.tableDependencies.get(table)!.add(cacheKey);
    }
  }

  private updateAccessStats(cacheKey: string): void {
    const cachedQuery = this.cache.get(cacheKey);
    if (cachedQuery) {
      cachedQuery.lastAccessed = new Date();
      cachedQuery.accessCount++;
    }
  }

  private shouldInvalidateByRules(
    rules: InvalidationRule[],
    tableName: string,
    changes: {
      operation: 'INSERT' | 'UPDATE' | 'DELETE';
      affectedRows?: any[];
      columns?: string[];
    }
  ): boolean {
    for (const rule of rules) {
      if (rule.type === 'table' && rule.target === tableName) {
        return true;
      }

      if (rule.type === 'column' && changes.columns?.includes(rule.target)) {
        return true;
      }

      if (rule.type === 'condition' && rule.condition && changes.affectedRows) {
        // Custom condition evaluation
        for (const row of changes.affectedRows) {
          if (rule.condition(null, row)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private removeFromDependencies(cacheKey: string): void {
    for (const [table, cacheKeys] of this.tableDependencies.entries()) {
      cacheKeys.delete(cacheKey);
      if (cacheKeys.size === 0) {
        this.tableDependencies.delete(table);
      }
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, cachedQuery] of this.cache.entries()) {
      if (cachedQuery.lastAccessed.getTime() < oldestTime) {
        oldestTime = cachedQuery.lastAccessed.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.removeFromDependencies(oldestKey);
    }
  }

  private calculateMemoryUsage(): number {
    let totalSize = 0;
    for (const cachedQuery of this.cache.values()) {
      totalSize += JSON.stringify(cachedQuery).length * 2; // Rough estimation
    }
    return totalSize;
  }

  private setupDefaultPatterns(): void {
    // Common ServiceDesk query patterns
    this.patterns = [
      {
        pattern: /SELECT.*FROM\s+users\s+WHERE\s+id\s*=\s*\?/i,
        cacheable: true,
        ttl: 1800, // 30 minutes
        dependencies: ['users'],
        tags: ['user', 'profile'],
        invalidationRules: [
          { type: 'table', target: 'users' }
        ]
      },
      {
        pattern: /SELECT.*FROM\s+tickets\s+WHERE\s+status_id\s*=\s*\?/i,
        cacheable: true,
        ttl: 300, // 5 minutes
        dependencies: ['tickets', 'statuses'],
        tags: ['tickets', 'status'],
        invalidationRules: [
          { type: 'table', target: 'tickets' },
          { type: 'column', target: 'status_id' }
        ]
      },
      {
        pattern: /SELECT.*FROM\s+categories/i,
        cacheable: true,
        ttl: 3600, // 1 hour
        dependencies: ['categories'],
        tags: ['categories', 'metadata'],
        invalidationRules: [
          { type: 'table', target: 'categories' }
        ]
      },
      {
        pattern: /SELECT.*COUNT.*FROM/i,
        cacheable: true,
        ttl: 600, // 10 minutes
        dependencies: [],
        tags: ['analytics', 'count'],
        invalidationRules: []
      },
      {
        pattern: /INSERT|UPDATE|DELETE/i,
        cacheable: false,
        ttl: 0,
        dependencies: [],
        tags: [],
        invalidationRules: []
      }
    ];
  }

  private startInvalidationMonitoring(): void {
    // Monitor database changes for intelligent invalidation
    // This would integrate with database triggers or change streams
  }
}

// Default configuration
export const defaultQueryCacheConfig: QueryCacheConfig = {
  defaultTTL: 300, // 5 minutes
  maxEntries: 1000,
  intelligentInvalidation: true,
  trackDependencies: true,
  cacheKeyStrategy: 'semantic',
  compression: {
    enabled: true,
    threshold: 1024 // 1KB
  },
  clustering: {
    enabled: false,
    syncStrategy: 'periodic'
  }
};

// Export factory function
export function createQueryCache(config: Partial<QueryCacheConfig> = {}): QueryCache {
  const finalConfig = { ...defaultQueryCacheConfig, ...config };
  return QueryCache.getInstance(finalConfig);
}

// Global query cache instance
export const queryCache = createQueryCache();