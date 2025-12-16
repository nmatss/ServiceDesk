import logger from '../monitoring/structured-logger';

/**
 * Advanced Pagination Optimizer for Large Datasets
 * Implements cursor-based pagination, offset optimization, and intelligent prefetching
 */

export interface PaginationConfig {
  defaultPageSize: number;
  maxPageSize: number;
  cursors: {
    enabled: boolean;
    encryptionKey?: string;
    algorithm: 'base64' | 'jwt' | 'encrypted';
  };
  prefetching: {
    enabled: boolean;
    pages: number;
    threshold: number; // Percentage of current page viewed before prefetch
  };
  caching: {
    enabled: boolean;
    ttl: number;
    maxPages: number;
  };
  optimization: {
    countQueries: boolean;
    indexHints: boolean;
    adaptivePageSize: boolean;
  };
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  cursor?: string;
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  filters?: Record<string, any>;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalCount?: number;
    totalPages?: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
  metadata: {
    executionTime: number;
    fromCache: boolean;
    optimizations: string[];
    warnings: string[];
  };
}

export interface CursorInfo {
  field: string;
  value: any;
  direction: 'asc' | 'desc';
  timestamp: number;
  userId?: string;
}

export interface PaginationMetrics {
  totalQueries: number;
  averageExecutionTime: number;
  cacheHitRate: number;
  cursorUsage: number;
  pageDistribution: Map<number, number>;
  optimizationsSaved: number;
}

export class PaginationOptimizer {
  private static instance: PaginationOptimizer;
  private config: PaginationConfig;
  private cache = new Map<string, { data: any; timestamp: number; metadata: any }>();
  private prefetchQueue = new Set<string>();
  private metrics: PaginationMetrics;

  private constructor(config: PaginationConfig) {
    this.config = config;
    this.metrics = {
      totalQueries: 0,
      averageExecutionTime: 0,
      cacheHitRate: 0,
      cursorUsage: 0,
      pageDistribution: new Map(),
      optimizationsSaved: 0
    };

    this.startCacheCleanup();
  }

  static getInstance(config?: PaginationConfig): PaginationOptimizer {
    if (!PaginationOptimizer.instance && config) {
      PaginationOptimizer.instance = new PaginationOptimizer(config);
    }
    return PaginationOptimizer.instance;
  }

  /**
   * Execute optimized pagination query
   */
  async paginate<T>(
    queryBuilder: {
      select: string;
      from: string;
      where?: string;
      orderBy?: string;
      params?: any[];
    },
    pagination: PaginationQuery,
    options: {
      estimateCount?: boolean;
      useIndex?: string;
      trackMetrics?: boolean;
    } = {}
  ): Promise<PaginationResult<T>> {
    const startTime = Date.now();
    const optimizations: string[] = [];
    const warnings: string[] = [];

    this.metrics.totalQueries++;

    // Normalize pagination parameters
    const normalizedPagination = this.normalizePagination(pagination);

    // Generate cache key
    const cacheKey = this.generateCacheKey(queryBuilder, normalizedPagination);

    // Check cache
    if (this.config.caching.enabled) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        this.updateMetrics(Date.now() - startTime, true);
        return {
          ...cached.data,
          metadata: {
            ...cached.metadata,
            fromCache: true
          }
        };
      }
    }

    // Determine pagination strategy
    const strategy = this.selectPaginationStrategy(normalizedPagination, queryBuilder);
    optimizations.push(`Using ${strategy} pagination strategy`);

    let result: PaginationResult<T>;

    switch (strategy) {
      case 'cursor':
        result = await this.executeCursorPagination<T>(queryBuilder, normalizedPagination, options);
        break;
      case 'offset-optimized':
        result = await this.executeOptimizedOffset<T>(queryBuilder, normalizedPagination, options);
        break;
      case 'keyset':
        result = await this.executeKeysetPagination<T>(queryBuilder, normalizedPagination, options);
        break;
      default:
        result = await this.executeStandardPagination<T>(queryBuilder, normalizedPagination, options);
    }

    const executionTime = Date.now() - startTime;

    // Add metadata
    result.metadata = {
      executionTime,
      fromCache: false,
      optimizations,
      warnings
    };

    // Cache result
    if (this.config.caching.enabled) {
      this.cacheResult(cacheKey, result);
    }

    // Schedule prefetching
    if (this.config.prefetching.enabled) {
      this.schedulePrefetch(queryBuilder, normalizedPagination);
    }

    // Update metrics
    this.updateMetrics(executionTime, false);

    return result;
  }

  /**
   * Generate cursor for cursor-based pagination
   */
  generateCursor(record: any, sortFields: Array<{ field: string; direction: 'asc' | 'desc' }>): string {
    const cursorData: CursorInfo = {
      field: sortFields[0]?.field || 'id',
      value: record[sortFields[0]?.field || 'id'],
      direction: sortFields[0]?.direction || 'asc',
      timestamp: Date.now()
    };

    return this.encodeCursor(cursorData);
  }

  /**
   * Decode cursor for pagination
   */
  decodeCursor(cursor: string): CursorInfo | null {
    try {
      return this.decodeEncodedCursor(cursor);
    } catch (error) {
      logger.warn('Failed to decode cursor', error);
      return null;
    }
  }

  /**
   * Optimize pagination based on usage patterns
   */
  optimizeConfiguration(usageData: {
    popularPageSizes: Map<number, number>;
    averagePageAccess: number;
    deepPaginationFrequency: number;
    sortPatterns: Map<string, number>;
  }): {
    optimizedConfig: Partial<PaginationConfig>;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    const optimizedConfig: Partial<PaginationConfig> = {};

    // Analyze page size usage
    const topPageSizes = Array.from(usageData.popularPageSizes.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    if (topPageSizes.length > 0) {
      const mostPopularPageSize = topPageSizes[0]?.[0];
      if (mostPopularPageSize && mostPopularPageSize !== this.config.defaultPageSize) {
        optimizedConfig.defaultPageSize = mostPopularPageSize;
        recommendations.push(`Adjust default page size to ${mostPopularPageSize} based on usage patterns`);
      }
    }

    // Analyze deep pagination
    if (usageData.deepPaginationFrequency > 0.3) {
      recommendations.push('High deep pagination usage detected - consider enabling cursor-based pagination');
      optimizedConfig.cursors = { ...this.config.cursors, enabled: true };
    }

    // Analyze prefetching effectiveness
    if (usageData.averagePageAccess > 0.8) {
      recommendations.push('High sequential page access - increase prefetching');
      optimizedConfig.prefetching = {
        ...this.config.prefetching,
        enabled: true,
        pages: Math.min(5, this.config.prefetching.pages + 1)
      };
    }

    return { optimizedConfig, recommendations };
  }

  /**
   * Get pagination performance metrics
   */
  getMetrics(): PaginationMetrics {
    return { ...this.metrics };
  }

  /**
   * Estimate query cost for different pagination strategies
   */
  async estimateQueryCost(
    _queryBuilder: {
      select: string;
      from: string;
      where?: string;
      orderBy?: string;
    },
    pagination: PaginationQuery
  ): Promise<{
    strategies: Array<{
      name: string;
      estimatedCost: number;
      estimatedTime: number;
      advantages: string[];
      disadvantages: string[];
    }>;
    recommendation: string;
  }> {
    const strategies = [
      {
        name: 'offset',
        estimatedCost: this.estimateOffsetCost(pagination),
        estimatedTime: 50,
        advantages: ['Simple implementation', 'Precise page numbers'],
        disadvantages: ['Poor performance for large offsets', 'Inconsistent results during updates']
      },
      {
        name: 'cursor',
        estimatedCost: 10,
        estimatedTime: 25,
        advantages: ['Consistent performance', 'Real-time data friendly'],
        disadvantages: ['No random page access', 'Complex URL structure']
      },
      {
        name: 'keyset',
        estimatedCost: 15,
        estimatedTime: 30,
        advantages: ['Fast performance', 'Stable pagination'],
        disadvantages: ['Requires unique sort field', 'Complex for multiple sort fields']
      }
    ];

    // Determine recommendation
    const recommended = strategies.reduce((best, current) =>
      current.estimatedCost < best.estimatedCost ? current : best
    );

    return {
      strategies,
      recommendation: recommended.name
    };
  }

  /**
   * Prefetch next pages based on access patterns
   */
  async prefetchNextPages<T>(
    queryBuilder: {
      select: string;
      from: string;
      where?: string;
      orderBy?: string;
      params?: any[];
    },
    currentPagination: PaginationQuery
  ): Promise<void> {
    if (!this.config.prefetching.enabled) return;

    const prefetchCount = this.config.prefetching.pages;
    const prefetchPromises: Promise<void>[] = [];

    for (let i = 1; i <= prefetchCount; i++) {
      const nextPagination: Required<PaginationQuery> = {
        page: (currentPagination.page || 1) + i,
        pageSize: currentPagination.pageSize || this.config.defaultPageSize,
        cursor: currentPagination.cursor || '',
        sort: currentPagination.sort || [{ field: 'id', direction: 'asc' }],
        filters: currentPagination.filters || {}
      };

      const cacheKey = this.generateCacheKey(queryBuilder, nextPagination);

      if (!this.cache.has(cacheKey) && !this.prefetchQueue.has(cacheKey)) {
        this.prefetchQueue.add(cacheKey);

        const prefetchPromise = this.paginate<T>(queryBuilder, nextPagination)
          .then(() => {
            this.prefetchQueue.delete(cacheKey);
          })
          .catch(error => {
            logger.warn('Prefetch failed', error);
            this.prefetchQueue.delete(cacheKey);
          });

        prefetchPromises.push(prefetchPromise);
      }
    }

    // Execute prefetches in background
    Promise.all(prefetchPromises).catch(err => logger.warn('Error prefetching pages', err));
  }

  private normalizePagination(pagination: PaginationQuery): Required<PaginationQuery> {
    return {
      page: pagination.page || 1,
      pageSize: Math.min(pagination.pageSize || this.config.defaultPageSize, this.config.maxPageSize),
      cursor: pagination.cursor || '',
      sort: pagination.sort || [{ field: 'id', direction: 'asc' }],
      filters: pagination.filters || {}
    };
  }

  private selectPaginationStrategy(
    pagination: Required<PaginationQuery>,
    _queryBuilder: any
  ): 'cursor' | 'offset-optimized' | 'keyset' | 'standard' {
    // Use cursor if available and enabled
    if (pagination.cursor && this.config.cursors.enabled) {
      return 'cursor';
    }

    // Use keyset for deep pagination with simple sort
    if (pagination.page > 10 && pagination.sort.length === 1) {
      return 'keyset';
    }

    // Use optimized offset for moderate pagination
    if (pagination.page <= 100) {
      return 'offset-optimized';
    }

    // Fallback to standard pagination
    return 'standard';
  }

  private async executeCursorPagination<T>(
    queryBuilder: any,
    pagination: Required<PaginationQuery>,
    _options: any
  ): Promise<PaginationResult<T>> {
    const cursorInfo = pagination.cursor ? this.decodeCursor(pagination.cursor) : null;

    let whereClause = queryBuilder.where || '';
    const params = [...(queryBuilder.params || [])];

    if (cursorInfo) {
      const operator = cursorInfo.direction === 'asc' ? '>' : '<';
      const cursorCondition = `${cursorInfo.field} ${operator} ?`;

      if (whereClause) {
        whereClause += ` AND ${cursorCondition}`;
      } else {
        whereClause = cursorCondition;
      }

      params.push(cursorInfo.value);
    }

    const query = this.buildQuery({
      ...queryBuilder,
      where: whereClause,
      params
    }, pagination);

    const data = await this.executeQuery<T>(query, params);

    // Generate cursors for next/previous
    const nextCursor = data.length > 0 ?
      this.generateCursor(data[data.length - 1], pagination.sort) : undefined;

    return {
      data,
      pagination: {
        currentPage: pagination.page,
        pageSize: pagination.pageSize,
        hasNextPage: data.length === pagination.pageSize,
        hasPreviousPage: !!pagination.cursor,
        nextCursor,
        previousCursor: undefined // Would need to implement reverse cursor logic
      },
      metadata: {
        executionTime: 0,
        fromCache: false,
        optimizations: [],
        warnings: []
      }
    };
  }

  private async executeOptimizedOffset<T>(
    queryBuilder: any,
    pagination: Required<PaginationQuery>,
    options: any
  ): Promise<PaginationResult<T>> {
    const offset = (pagination.page - 1) * pagination.pageSize;

    // For offset optimization, we might use a covering index or subquery
    let optimizedQuery = queryBuilder;

    if (this.config.optimization.indexHints && options?.useIndex) {
      optimizedQuery = {
        ...queryBuilder,
        from: `${queryBuilder.from} USE INDEX (${options.useIndex})`
      };
    }

    const query = this.buildQuery(optimizedQuery, pagination, offset);
    const params = [...(queryBuilder.params || [])];

    const data = await this.executeQuery<T>(query, params);

    // Get total count if needed (with optimization)
    let totalCount: number | undefined;
    if (options.estimateCount !== false) {
      totalCount = await this.getOptimizedCount(queryBuilder);
    }

    const totalPages = totalCount ? Math.ceil(totalCount / pagination.pageSize) : undefined;

    return {
      data,
      pagination: {
        currentPage: pagination.page,
        pageSize: pagination.pageSize,
        totalCount,
        totalPages,
        hasNextPage: data.length === pagination.pageSize,
        hasPreviousPage: pagination.page > 1
      },
      metadata: {
        executionTime: 0,
        fromCache: false,
        optimizations: [],
        warnings: []
      }
    };
  }

  private async executeKeysetPagination<T>(
    queryBuilder: any,
    pagination: Required<PaginationQuery>,
    options: any
  ): Promise<PaginationResult<T>> {
    // Similar to cursor but uses the last value from previous page
    // This is a simplified implementation
    return this.executeCursorPagination<T>(queryBuilder, pagination, options);
  }

  private async executeStandardPagination<T>(
    queryBuilder: any,
    pagination: Required<PaginationQuery>,
    _options: any
  ): Promise<PaginationResult<T>> {
    const offset = (pagination.page - 1) * pagination.pageSize;
    const query = this.buildQuery(queryBuilder, pagination, offset);
    const params = [...(queryBuilder.params || [])];

    const data = await this.executeQuery<T>(query, params);

    return {
      data,
      pagination: {
        currentPage: pagination.page,
        pageSize: pagination.pageSize,
        hasNextPage: data.length === pagination.pageSize,
        hasPreviousPage: pagination.page > 1
      },
      metadata: {
        executionTime: 0,
        fromCache: false,
        optimizations: [],
        warnings: []
      }
    };
  }

  private buildQuery(
    queryBuilder: any,
    pagination: Required<PaginationQuery>,
    offset?: number
  ): string {
    let query = `SELECT ${queryBuilder.select} FROM ${queryBuilder.from}`;

    if (queryBuilder.where) {
      query += ` WHERE ${queryBuilder.where}`;
    }

    // Add filters
    const filterConditions = this.buildFilterConditions(pagination.filters);
    if (filterConditions) {
      query += queryBuilder.where ? ` AND ${filterConditions}` : ` WHERE ${filterConditions}`;
    }

    // Add ordering
    if (queryBuilder.orderBy || pagination.sort.length > 0) {
      const orderClause = queryBuilder.orderBy ||
        pagination.sort.map(s => `${s.field} ${s.direction.toUpperCase()}`).join(', ');
      query += ` ORDER BY ${orderClause}`;
    }

    // Add limit and offset
    query += ` LIMIT ${pagination.pageSize}`;
    if (offset !== undefined && offset > 0) {
      query += ` OFFSET ${offset}`;
    }

    return query;
  }

  private buildFilterConditions(filters: Record<string, any>): string {
    const conditions: string[] = [];

    for (const [field, value] of Object.entries(filters)) {
      if (value === null || value === undefined) continue;

      if (Array.isArray(value)) {
        conditions.push(`${field} IN (${value.map(() => '?').join(', ')})`);
      } else if (typeof value === 'object' && value.operator) {
        conditions.push(`${field} ${value.operator} ?`);
      } else {
        conditions.push(`${field} = ?`);
      }
    }

    return conditions.join(' AND ');
  }

  private async executeQuery<T>(query: string, params: any[]): Promise<T[]> {
    // This would be replaced with actual database execution
    logger.info('Executing query', query, 'with params:', params);
    return [] as T[];
  }

  private async getOptimizedCount(queryBuilder: any): Promise<number> {
    // Use approximate count for better performance when possible
    let countQuery = `SELECT COUNT(*) as count FROM ${queryBuilder.from}`;

    if (queryBuilder.where) {
      countQuery += ` WHERE ${queryBuilder.where}`;
    }

    // For large tables, might use EXPLAIN or statistics instead
    const result = await this.executeQuery<{ count: number }>(countQuery, queryBuilder.params || []);
    return result[0]?.count || 0;
  }

  private encodeCursor(cursorInfo: CursorInfo): string {
    const data = JSON.stringify(cursorInfo);

    switch (this.config.cursors.algorithm) {
      case 'base64':
        return Buffer.from(data).toString('base64');
      case 'jwt':
        // Would use JWT library
        return Buffer.from(data).toString('base64');
      case 'encrypted':
        // Would use encryption
        return Buffer.from(data).toString('base64');
      default:
        return Buffer.from(data).toString('base64');
    }
  }

  private decodeEncodedCursor(cursor: string): CursorInfo {
    let data: string;

    switch (this.config.cursors.algorithm) {
      case 'base64':
        data = Buffer.from(cursor, 'base64').toString();
        break;
      case 'jwt':
        // Would use JWT library
        data = Buffer.from(cursor, 'base64').toString();
        break;
      case 'encrypted':
        // Would use decryption
        data = Buffer.from(cursor, 'base64').toString();
        break;
      default:
        data = Buffer.from(cursor, 'base64').toString();
    }

    return JSON.parse(data);
  }

  private generateCacheKey(queryBuilder: any, pagination: Required<PaginationQuery>): string {
    const key = JSON.stringify({
      query: queryBuilder,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        sort: pagination.sort,
        filters: pagination.filters
      }
    });

    return `pagination:${this.hash(key)}`;
  }

  private hash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private getFromCache<T>(cacheKey: string): { data: PaginationResult<T>; metadata: any } | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.timestamp > this.config.caching.ttl * 1000) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached as { data: PaginationResult<T>; metadata: any };
  }

  private cacheResult<T>(cacheKey: string, result: PaginationResult<T>): void {
    // Clean cache if needed
    if (this.cache.size >= this.config.caching.maxPages) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      metadata: result.metadata
    });
  }

  private schedulePrefetch(queryBuilder: any, pagination: Required<PaginationQuery>): void {
    // Schedule prefetch in next tick to avoid blocking current request
    setTimeout(() => {
      this.prefetchNextPages(queryBuilder, pagination);
    }, 0);
  }

  private updateMetrics(executionTime: number, fromCache: boolean): void {
    this.metrics.averageExecutionTime =
      (this.metrics.averageExecutionTime * (this.metrics.totalQueries - 1) + executionTime) / this.metrics.totalQueries;

    if (fromCache) {
      this.metrics.cacheHitRate =
        (this.metrics.cacheHitRate * (this.metrics.totalQueries - 1) + 100) / this.metrics.totalQueries;
    } else {
      this.metrics.cacheHitRate =
        (this.metrics.cacheHitRate * (this.metrics.totalQueries - 1)) / this.metrics.totalQueries;
    }
  }

  private estimateOffsetCost(pagination: PaginationQuery): number {
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || this.config.defaultPageSize;
    const offset = (page - 1) * pageSize;

    // Offset cost increases linearly with offset size
    return Math.max(10, offset / 1000);
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const ttlMs = this.config.caching.ttl * 1000;

      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > ttlMs) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }
}

// Default configuration
export const defaultPaginationConfig: PaginationConfig = {
  defaultPageSize: 20,
  maxPageSize: 100,
  cursors: {
    enabled: true,
    algorithm: 'base64'
  },
  prefetching: {
    enabled: true,
    pages: 2,
    threshold: 75
  },
  caching: {
    enabled: true,
    ttl: 300, // 5 minutes
    maxPages: 100
  },
  optimization: {
    countQueries: true,
    indexHints: true,
    adaptivePageSize: false
  }
};

// Export factory function
export function createPaginationOptimizer(config: PaginationConfig = defaultPaginationConfig): PaginationOptimizer {
  return PaginationOptimizer.getInstance(config);
}