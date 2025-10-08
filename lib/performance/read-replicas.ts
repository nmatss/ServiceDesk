/**
 * Read Replica Management for Analytics and Reporting
 * Distributes read queries across multiple database replicas for better performance
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

export interface ReadReplicaConfig {
  url: string;
  weight: number;
  priority: number;
  healthCheckInterval: number;
  maxRetries: number;
  timeout: number;
  tags: string[];
}

export interface ReplicaStatus {
  id: string;
  url: string;
  isHealthy: boolean;
  lastHealthCheck: Date;
  latency: number;
  queryCount: number;
  errorCount: number;
  weight: number;
  priority: number;
}

export interface QueryRoutingRule {
  pattern: RegExp;
  preferredReplicas: string[];
  fallbackToMaster: boolean;
  cacheTime?: number;
}

export class ReadReplicaManager extends EventEmitter {
  private static instance: ReadReplicaManager;
  private replicas = new Map<string, Database.Database>();
  private replicaConfigs = new Map<string, ReadReplicaConfig>();
  private replicaStatus = new Map<string, ReplicaStatus>();
  private routingRules: QueryRoutingRule[] = [];
  private healthCheckInterval?: NodeJS.Timeout;
  private queryDistribution = new Map<string, number>();

  private constructor() {
    super();
    this.setupDefaultRoutingRules();
    this.startHealthChecking();
  }

  static getInstance(): ReadReplicaManager {
    if (!ReadReplicaManager.instance) {
      ReadReplicaManager.instance = new ReadReplicaManager();
    }
    return ReadReplicaManager.instance;
  }

  /**
   * Add a read replica to the pool
   */
  async addReplica(config: ReadReplicaConfig): Promise<string> {
    const replicaId = `replica_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const database = new Database(config.url, {
        readonly: true,
        fileMustExist: true,
        timeout: config.timeout
      });

      // Optimize for read performance
      database.pragma('journal_mode = WAL');
      database.pragma('synchronous = NORMAL');
      database.pragma('cache_size = 20000');
      database.pragma('temp_store = MEMORY');
      database.pragma('mmap_size = 536870912'); // 512MB for read replicas

      this.replicas.set(replicaId, database);
      this.replicaConfigs.set(replicaId, config);
      this.replicaStatus.set(replicaId, {
        id: replicaId,
        url: config.url,
        isHealthy: true,
        lastHealthCheck: new Date(),
        latency: 0,
        queryCount: 0,
        errorCount: 0,
        weight: config.weight,
        priority: config.priority
      });

      // Initial health check
      await this.checkReplicaHealth(replicaId);

      this.emit('replica:added', { replicaId, config });

      return replicaId;
    } catch (error) {
      this.emit('replica:error', { replicaId, error });
      throw error;
    }
  }

  /**
   * Remove a read replica from the pool
   */
  async removeReplica(replicaId: string): Promise<void> {
    const database = this.replicas.get(replicaId);
    if (database) {
      try {
        database.close();
      } catch (error) {
        this.emit('replica:error', { replicaId, error });
      }
    }

    this.replicas.delete(replicaId);
    this.replicaConfigs.delete(replicaId);
    this.replicaStatus.delete(replicaId);

    this.emit('replica:removed', { replicaId });
  }

  /**
   * Execute a read query on the best available replica
   */
  async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    options: {
      preferredReplicas?: string[];
      fallbackToMaster?: boolean;
      maxRetries?: number;
    } = {}
  ): Promise<T> {
    const {
      preferredReplicas = [],
      fallbackToMaster = true,
      maxRetries = 3
    } = options;

    // Find the best replica for this query
    const replicaId = this.selectBestReplica(query, preferredReplicas);

    if (!replicaId) {
      if (fallbackToMaster) {
        throw new Error('No healthy replicas available and fallback to master not implemented');
      } else {
        throw new Error('No healthy replicas available');
      }
    }

    return this.executeOnReplica(replicaId, query, params, maxRetries);
  }

  /**
   * Execute analytics queries with specialized routing
   */
  async executeAnalyticsQuery<T = any>(
    query: string,
    params: any[] = [],
    options: {
      timeRange?: 'realtime' | 'recent' | 'historical';
      complexity?: 'simple' | 'complex' | 'heavy';
    } = {}
  ): Promise<T> {
    const { timeRange = 'recent', complexity = 'simple' } = options;

    // Route based on query characteristics
    let preferredReplicas: string[] = [];

    if (complexity === 'heavy' || timeRange === 'historical') {
      // Use dedicated analytics replicas
      preferredReplicas = this.getReplicasByTag('analytics');
    } else if (timeRange === 'realtime') {
      // Use fast, low-latency replicas
      preferredReplicas = this.getHighPerformanceReplicas();
    }

    return this.executeQuery(query, params, {
      preferredReplicas,
      fallbackToMaster: false,
      maxRetries: 2
    });
  }

  /**
   * Execute reporting queries with load balancing
   */
  async executeReportingQuery<T = any>(
    query: string,
    params: any[] = [],
    reportType: 'dashboard' | 'export' | 'scheduled' = 'dashboard'
  ): Promise<T> {
    let preferredReplicas: string[] = [];

    switch (reportType) {
      case 'dashboard':
        // Use balanced replicas for dashboard queries
        preferredReplicas = this.getBalancedReplicas();
        break;
      case 'export':
        // Use dedicated export replicas
        preferredReplicas = this.getReplicasByTag('export');
        break;
      case 'scheduled':
        // Use background processing replicas
        preferredReplicas = this.getReplicasByTag('background');
        break;
    }

    return this.executeQuery(query, params, {
      preferredReplicas,
      fallbackToMaster: true,
      maxRetries: 3
    });
  }

  /**
   * Add a query routing rule
   */
  addRoutingRule(rule: QueryRoutingRule): void {
    this.routingRules.push(rule);
    this.emit('routing:rule-added', rule);
  }

  /**
   * Get replica status information
   */
  getReplicaStatus(): ReplicaStatus[] {
    return Array.from(this.replicaStatus.values());
  }

  /**
   * Get query distribution statistics
   */
  getQueryDistribution(): { replicaId: string; queryCount: number; percentage: number }[] {
    const total = Array.from(this.queryDistribution.values()).reduce((sum, count) => sum + count, 0);

    return Array.from(this.queryDistribution.entries()).map(([replicaId, queryCount]) => ({
      replicaId,
      queryCount,
      percentage: total > 0 ? (queryCount / total) * 100 : 0
    }));
  }

  /**
   * Perform manual failover
   */
  async failoverReplica(replicaId: string): Promise<void> {
    const status = this.replicaStatus.get(replicaId);
    if (status) {
      status.isHealthy = false;
      this.emit('replica:failover', { replicaId });
    }
  }

  /**
   * Restore a failed replica
   */
  async restoreReplica(replicaId: string): Promise<void> {
    const healthy = await this.checkReplicaHealth(replicaId);
    if (healthy) {
      this.emit('replica:restored', { replicaId });
    }
  }

  /**
   * Get performance metrics for all replicas
   */
  getPerformanceMetrics(): {
    replicaId: string;
    avgLatency: number;
    queryCount: number;
    errorRate: number;
    throughput: number;
  }[] {
    return Array.from(this.replicaStatus.values()).map(status => ({
      replicaId: status.id,
      avgLatency: status.latency,
      queryCount: status.queryCount,
      errorRate: status.queryCount > 0 ? (status.errorCount / status.queryCount) * 100 : 0,
      throughput: status.queryCount // Queries per time period
    }));
  }

  private selectBestReplica(query: string, preferredReplicas: string[]): string | null {
    // Apply routing rules
    for (const rule of this.routingRules) {
      if (rule.pattern.test(query)) {
        for (const replicaId of rule.preferredReplicas) {
          const status = this.replicaStatus.get(replicaId);
          if (status?.isHealthy) {
            return replicaId;
          }
        }
      }
    }

    // Use preferred replicas if specified
    if (preferredReplicas.length > 0) {
      for (const replicaId of preferredReplicas) {
        const status = this.replicaStatus.get(replicaId);
        if (status?.isHealthy) {
          return replicaId;
        }
      }
    }

    // Weighted round-robin selection among healthy replicas
    const healthyReplicas = Array.from(this.replicaStatus.values())
      .filter(status => status.isHealthy)
      .sort((a, b) => {
        // Sort by priority first, then by load
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.queryCount - b.queryCount; // Lower load first
      });

    if (healthyReplicas.length === 0) {
      return null;
    }

    // Weighted selection based on replica weights
    const totalWeight = healthyReplicas.reduce((sum, replica) => sum + replica.weight, 0);
    const random = Math.random() * totalWeight;
    let currentWeight = 0;

    for (const replica of healthyReplicas) {
      currentWeight += replica.weight;
      if (random <= currentWeight) {
        return replica.id;
      }
    }

    return healthyReplicas[0].id;
  }

  private async executeOnReplica<T>(
    replicaId: string,
    query: string,
    params: any[],
    maxRetries: number
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const database = this.replicas.get(replicaId);
        const status = this.replicaStatus.get(replicaId);

        if (!database || !status?.isHealthy) {
          throw new Error(`Replica ${replicaId} is not available`);
        }

        const startTime = Date.now();
        const result = database.prepare(query).all(...params) as T;
        const latency = Date.now() - startTime;

        // Update replica statistics
        status.queryCount++;
        status.latency = (status.latency * (status.queryCount - 1) + latency) / status.queryCount;
        this.updateQueryDistribution(replicaId);

        this.emit('query:executed', { replicaId, query, latency });

        return result;
      } catch (error) {
        lastError = error as Error;
        const status = this.replicaStatus.get(replicaId);
        if (status) {
          status.errorCount++;
        }

        this.emit('query:error', { replicaId, query, error, attempt });

        // Mark replica as unhealthy after multiple failures
        if (attempt === maxRetries - 1) {
          await this.checkReplicaHealth(replicaId);
        }
      }
    }

    throw lastError || new Error('Query execution failed');
  }

  private async checkReplicaHealth(replicaId: string): Promise<boolean> {
    const database = this.replicas.get(replicaId);
    const status = this.replicaStatus.get(replicaId);

    if (!database || !status) {
      return false;
    }

    try {
      const startTime = Date.now();
      database.prepare('SELECT 1').get();
      const latency = Date.now() - startTime;

      status.isHealthy = true;
      status.lastHealthCheck = new Date();
      status.latency = latency;

      this.emit('replica:healthy', { replicaId, latency });

      return true;
    } catch (error) {
      status.isHealthy = false;
      status.lastHealthCheck = new Date();

      this.emit('replica:unhealthy', { replicaId, error });

      return false;
    }
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      const healthCheckPromises = Array.from(this.replicas.keys()).map(replicaId =>
        this.checkReplicaHealth(replicaId)
      );

      await Promise.allSettled(healthCheckPromises);
    }, 30000); // Check every 30 seconds
  }

  private setupDefaultRoutingRules(): void {
    // Analytics queries
    this.addRoutingRule({
      pattern: /SELECT.*FROM.*analytics_/i,
      preferredReplicas: this.getReplicasByTag('analytics'),
      fallbackToMaster: false
    });

    // Reporting queries
    this.addRoutingRule({
      pattern: /SELECT.*COUNT.*GROUP BY/i,
      preferredReplicas: this.getReplicasByTag('reporting'),
      fallbackToMaster: true
    });

    // Dashboard KPI queries
    this.addRoutingRule({
      pattern: /SELECT.*realtime|dashboard/i,
      preferredReplicas: this.getHighPerformanceReplicas(),
      fallbackToMaster: true
    });

    // Heavy aggregation queries
    this.addRoutingRule({
      pattern: /SELECT.*AVG.*SUM.*FROM.*JOIN/i,
      preferredReplicas: this.getReplicasByTag('heavy'),
      fallbackToMaster: false
    });
  }

  private getReplicasByTag(tag: string): string[] {
    const replicas: string[] = [];

    for (const [replicaId, config] of this.replicaConfigs.entries()) {
      if (config.tags.includes(tag)) {
        replicas.push(replicaId);
      }
    }

    return replicas;
  }

  private getHighPerformanceReplicas(): string[] {
    return Array.from(this.replicaStatus.values())
      .filter(status => status.isHealthy && status.latency < 50)
      .sort((a, b) => a.latency - b.latency)
      .map(status => status.id);
  }

  private getBalancedReplicas(): string[] {
    return Array.from(this.replicaStatus.values())
      .filter(status => status.isHealthy)
      .sort((a, b) => a.queryCount - b.queryCount)
      .map(status => status.id);
  }

  private updateQueryDistribution(replicaId: string): void {
    const current = this.queryDistribution.get(replicaId) || 0;
    this.queryDistribution.set(replicaId, current + 1);
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const closePromises = Array.from(this.replicas.entries()).map(async ([replicaId, database]) => {
      try {
        database.close();
      } catch (error) {
        this.emit('replica:error', { replicaId, error });
      }
    });

    await Promise.allSettled(closePromises);

    this.replicas.clear();
    this.replicaConfigs.clear();
    this.replicaStatus.clear();

    this.emit('manager:shutdown');
  }
}

// Export singleton instance
export const readReplicaManager = ReadReplicaManager.getInstance();

// Helper functions for common use cases
export async function executeAnalyticsQuery<T = any>(
  query: string,
  params: any[] = [],
  options?: {
    timeRange?: 'realtime' | 'recent' | 'historical';
    complexity?: 'simple' | 'complex' | 'heavy';
  }
): Promise<T> {
  return readReplicaManager.executeAnalyticsQuery(query, params, options);
}

export async function executeReportingQuery<T = any>(
  query: string,
  params: any[] = [],
  reportType?: 'dashboard' | 'export' | 'scheduled'
): Promise<T> {
  return readReplicaManager.executeReportingQuery(query, params, reportType);
}