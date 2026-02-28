/**
 * Cache Warming Strategies
 *
 * Proactively loads data into cache to avoid cold starts and improve performance.
 *
 * Features:
 * - Startup warming
 * - Scheduled warming
 * - Predictive warming
 * - Batch warming
 * - Priority-based warming
 */

import { CacheManager, getCacheManager, CacheOptions } from './cache-manager';
import logger from '../monitoring/structured-logger';
import { executeQuery, executeQueryOne } from '@/lib/db/adapter';

export interface WarmingStrategy {
  name: string;
  priority: number; // 1-10, higher = more important
  fetchFn: () => Promise<Array<{ key: string; value: any; options?: CacheOptions }>>;
  schedule?: string; // Cron expression for scheduled warming
  enabled: boolean;
}

export interface WarmingResult {
  strategy: string;
  success: number;
  failed: number;
  duration: number;
  errors: string[];
}

export class CacheWarmer {
  private static instance: CacheWarmer;
  private cacheManager: CacheManager;
  private strategies: Map<string, WarmingStrategy> = new Map();
  private warmingInProgress: boolean = false;
  private schedules: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.cacheManager = getCacheManager();
    this.registerDefaultStrategies();
  }

  public static getInstance(): CacheWarmer {
    if (!CacheWarmer.instance) {
      CacheWarmer.instance = new CacheWarmer();
    }
    return CacheWarmer.instance;
  }

  /**
   * Register default warming strategies
   */
  private registerDefaultStrategies(): void {
    // Strategy 1: Categories, Priorities, Statuses
    this.registerStrategy({
      name: 'system-configs',
      priority: 10,
      enabled: true,
      fetchFn: async () => {
        const items: Array<{ key: string; value: any; options?: CacheOptions }> = [];

        try {
          // Categories
          const categories = await executeQuery<any>('SELECT * FROM categories ORDER BY name', []);
          items.push({
            key: 'categories:all',
            value: categories,
            options: { ttl: 1800, tags: ['categories'] }, // 30 minutes
          });

          // Priorities
          const priorities = await executeQuery<any>('SELECT * FROM priorities ORDER BY level', []);
          items.push({
            key: 'priorities:all',
            value: priorities,
            options: { ttl: 1800, tags: ['priorities'] },
          });

          // Statuses
          const statuses = await executeQuery<any>('SELECT * FROM statuses ORDER BY name', []);
          items.push({
            key: 'statuses:all',
            value: statuses,
            options: { ttl: 1800, tags: ['statuses'] },
          });

          logger.info('System configs warmed', { count: items.length });
        } catch (error) {
          logger.error('Failed to warm system configs', error);
        }

        return items;
      },
    });

    // Strategy 2: Active users
    this.registerStrategy({
      name: 'active-users',
      priority: 8,
      enabled: true,
      fetchFn: async () => {
        const items: Array<{ key: string; value: any; options?: CacheOptions }> = [];

        try {
          // Get users who logged in within last 24 hours
          const activeUsers = await executeQuery<{ id: number; email: string; name: string; role: string; tenant_id: number }>(
            `SELECT id, email, name, role, tenant_id
             FROM users
             WHERE last_login > datetime('now', '-1 day')
             LIMIT 100`,
            []
          );

          for (const user of activeUsers) {
            items.push({
              key: `user:${user.id}`,
              value: user,
              options: { ttl: 300, tags: [`user:${user.id}`] }, // 5 minutes
            });
          }

          logger.info('Active users warmed', { count: items.length });
        } catch (error) {
          logger.error('Failed to warm active users', error);
        }

        return items;
      },
    });

    // Strategy 3: Recent tickets
    this.registerStrategy({
      name: 'recent-tickets',
      priority: 7,
      enabled: true,
      fetchFn: async () => {
        const items: Array<{ key: string; value: any; options?: CacheOptions }> = [];

        try {
          // Get recently updated tickets
          const recentTickets = await executeQuery<{ id: number; [key: string]: any }>(
            `SELECT * FROM tickets
             WHERE updated_at > datetime('now', '-6 hours')
             ORDER BY updated_at DESC
             LIMIT 50`,
            []
          );

          for (const ticket of recentTickets) {
            items.push({
              key: `ticket:${ticket.id}`,
              value: ticket,
              options: { ttl: 180, tags: [`ticket:${ticket.id}`, 'tickets'] }, // 3 minutes
            });
          }

          logger.info('Recent tickets warmed', { count: items.length });
        } catch (error) {
          logger.error('Failed to warm recent tickets', error);
        }

        return items;
      },
    });

    // Strategy 4: KB popular articles
    this.registerStrategy({
      name: 'kb-popular',
      priority: 6,
      enabled: true,
      fetchFn: async () => {
        const items: Array<{ key: string; value: any; options?: CacheOptions }> = [];

        try {
          // Get most viewed KB articles
          const popularArticles = await executeQuery<{ id: number; [key: string]: any }>(
            `SELECT * FROM kb_articles
             WHERE is_published = 1
             ORDER BY views DESC
             LIMIT 20`,
            []
          );

          for (const article of popularArticles) {
            items.push({
              key: `kb:article:${article.id}`,
              value: article,
              options: { ttl: 3600, tags: [`kb:${article.id}`, 'kb'] }, // 1 hour
            });
          }

          logger.info('Popular KB articles warmed', { count: items.length });
        } catch (error) {
          logger.error('Failed to warm KB articles', error);
        }

        return items;
      },
    });

    // Strategy 5: Dashboard metrics (aggregate data)
    this.registerStrategy({
      name: 'dashboard-metrics',
      priority: 9,
      enabled: true,
      fetchFn: async () => {
        const items: Array<{ key: string; value: any; options?: CacheOptions }> = [];

        try {
          // Ticket counts by status
          const statusCounts = await executeQuery<any>(
            `SELECT status_id, COUNT(*) as count
             FROM tickets
             GROUP BY status_id`,
            []
          );

          items.push({
            key: 'dashboard:ticket-counts-by-status',
            value: statusCounts,
            options: { ttl: 60, tags: ['dashboard', 'metrics'] }, // 1 minute
          });

          // Ticket counts by priority
          const priorityCounts = await executeQuery<any>(
            `SELECT priority_id, COUNT(*) as count
             FROM tickets
             GROUP BY priority_id`,
            []
          );

          items.push({
            key: 'dashboard:ticket-counts-by-priority',
            value: priorityCounts,
            options: { ttl: 60, tags: ['dashboard', 'metrics'] },
          });

          // Today's ticket count
          const todayCount = await executeQueryOne<any>(
            `SELECT COUNT(*) as count
             FROM tickets
             WHERE DATE(created_at) = DATE('now')`,
            []
          );

          items.push({
            key: 'dashboard:today-ticket-count',
            value: todayCount,
            options: { ttl: 60, tags: ['dashboard', 'metrics'] },
          });

          logger.info('Dashboard metrics warmed', { count: items.length });
        } catch (error) {
          logger.error('Failed to warm dashboard metrics', error);
        }

        return items;
      },
    });
  }

  /**
   * Register a warming strategy
   */
  registerStrategy(strategy: WarmingStrategy): void {
    this.strategies.set(strategy.name, strategy);

    // Schedule if cron expression provided
    if (strategy.schedule && strategy.enabled) {
      this.scheduleWarming(strategy.name, strategy.schedule);
    }

    logger.info('Warming strategy registered', {
      name: strategy.name,
      priority: strategy.priority,
      scheduled: !!strategy.schedule,
    });
  }

  /**
   * Unregister a warming strategy
   */
  unregisterStrategy(name: string): boolean {
    // Clear schedule if exists
    const schedule = this.schedules.get(name);
    if (schedule) {
      clearInterval(schedule);
      this.schedules.delete(name);
    }

    return this.strategies.delete(name);
  }

  /**
   * Warm cache using a specific strategy
   */
  async warmStrategy(strategyName: string): Promise<WarmingResult> {
    const strategy = this.strategies.get(strategyName);

    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyName}`);
    }

    if (!strategy.enabled) {
      logger.warn('Attempted to warm disabled strategy', { name: strategyName });
      return {
        strategy: strategyName,
        success: 0,
        failed: 0,
        duration: 0,
        errors: ['Strategy is disabled'],
      };
    }

    const startTime = Date.now();
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      logger.info('Warming cache with strategy', { name: strategyName });

      // Fetch data
      const items = await strategy.fetchFn();

      // Warm cache
      for (const item of items) {
        try {
          await this.cacheManager.set(item.key, item.value, item.options);
          success++;
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to cache ${item.key}: ${errorMsg}`);
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Cache warming completed', {
        strategy: strategyName,
        success,
        failed,
        duration,
      });

      return {
        strategy: strategyName,
        success,
        failed,
        duration,
        errors,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Cache warming failed', {
        strategy: strategyName,
        error: errorMsg,
      });

      return {
        strategy: strategyName,
        success: 0,
        failed: 0,
        duration,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Warm cache using all enabled strategies
   */
  async warmAll(): Promise<WarmingResult[]> {
    if (this.warmingInProgress) {
      logger.warn('Cache warming already in progress');
      return [];
    }

    this.warmingInProgress = true;

    try {
      // Sort strategies by priority (higher first)
      const sorted = Array.from(this.strategies.values())
        .filter(s => s.enabled)
        .sort((a, b) => b.priority - a.priority);

      const results: WarmingResult[] = [];

      for (const strategy of sorted) {
        const result = await this.warmStrategy(strategy.name);
        results.push(result);
      }

      logger.info('All cache warming completed', {
        strategies: results.length,
        totalSuccess: results.reduce((sum, r) => sum + r.success, 0),
        totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
      });

      return results;
    } finally {
      this.warmingInProgress = false;
    }
  }

  /**
   * Schedule warming using simple interval (for cron we'd use node-cron)
   */
  private scheduleWarming(strategyName: string, cronExpression: string): void {
    // For simplicity, we'll use intervals
    // In production, you'd use a proper cron library like node-cron

    // Parse simple interval format: "every 5m", "every 1h", etc.
    const match = cronExpression.match(/every (\d+)([mh])/);
    if (!match || !match[1] || !match[2]) {
      logger.warn('Invalid cron expression, skipping schedule', {
        strategy: strategyName,
        cron: cronExpression,
      });
      return;
    }

    const amount = match[1];
    const unit = match[2];
    const intervalMs = parseInt(amount) * (unit === 'h' ? 3600000 : 60000);

    const interval = setInterval(() => {
      logger.info('Scheduled warming triggered', { strategy: strategyName });
      this.warmStrategy(strategyName).catch(error => {
        logger.error('Scheduled warming failed', { strategy: strategyName, error });
      });
    }, intervalMs);

    this.schedules.set(strategyName, interval);

    logger.info('Warming scheduled', {
      strategy: strategyName,
      interval: cronExpression,
      intervalMs,
    });
  }

  /**
   * Stop all scheduled warmings
   */
  stopAllSchedules(): void {
    const schedulesArray = Array.from(this.schedules.entries());
    for (const [name, interval] of schedulesArray) {
      clearInterval(interval);
      logger.info('Warming schedule stopped', { strategy: name });
    }

    this.schedules.clear();
  }

  /**
   * Get warming statistics
   */
  getStats(): {
    totalStrategies: number;
    enabledStrategies: number;
    scheduledStrategies: number;
    warmingInProgress: boolean;
  } {
    const strategies = Array.from(this.strategies.values());

    return {
      totalStrategies: strategies.length,
      enabledStrategies: strategies.filter(s => s.enabled).length,
      scheduledStrategies: this.schedules.size,
      warmingInProgress: this.warmingInProgress,
    };
  }

  /**
   * List all registered strategies
   */
  listStrategies(): Array<{
    name: string;
    priority: number;
    enabled: boolean;
    scheduled: boolean;
  }> {
    return Array.from(this.strategies.values()).map(s => ({
      name: s.name,
      priority: s.priority,
      enabled: s.enabled,
      scheduled: !!s.schedule,
    }));
  }
}

/**
 * Get CacheWarmer instance
 */
export function getCacheWarmer(): CacheWarmer {
  return CacheWarmer.getInstance();
}

/**
 * Export singleton
 */
export const cacheWarmer = CacheWarmer.getInstance();

/**
 * Convenience function to warm cache on startup
 */
export async function warmCacheOnStartup(): Promise<void> {
  logger.info('Starting cache warming on startup');

  try {
    const warmer = getCacheWarmer();
    const results = await warmer.warmAll();

    const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

    logger.info('Cache warming on startup completed', {
      strategies: results.length,
      success: totalSuccess,
      failed: totalFailed,
    });
  } catch (error) {
    logger.error('Cache warming on startup failed', error);
  }
}
