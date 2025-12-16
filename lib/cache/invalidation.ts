/**
 * Cache Invalidation with Pub/Sub
 *
 * Cross-instance cache invalidation using Redis Pub/Sub.
 * Ensures all application instances have consistent cache.
 *
 * Features:
 * - Event-based invalidation
 * - Tag-based invalidation
 * - Pattern-based invalidation
 * - Broadcast to all instances
 * - Subscription management
 */

import { getRedisClient } from './redis-client';
import { getCacheManager } from './cache-manager';
import logger from '../monitoring/structured-logger';
import Redis from 'ioredis';

export interface InvalidationEvent {
  type: 'key' | 'tag' | 'pattern' | 'clear';
  target: string | string[]; // Key(s), tag(s), or pattern
  source: string; // Instance ID that triggered invalidation
  timestamp: number;
  metadata?: Record<string, any>;
}

export type InvalidationCallback = (event: InvalidationEvent) => void | Promise<void>;

export class CacheInvalidator {
  private static instance: CacheInvalidator;
  private redisClient: ReturnType<typeof getRedisClient>;
  private subscriber?: Redis;
  private cacheManager: ReturnType<typeof getCacheManager>;
  private instanceId: string;
  private channel = 'cache:invalidation';
  private callbacks: Set<InvalidationCallback> = new Set();
  private isSubscribed = false;

  private stats = {
    published: 0,
    received: 0,
    processed: 0,
    errors: 0,
  };

  private constructor() {
    this.redisClient = getRedisClient();
    this.cacheManager = getCacheManager();
    this.instanceId = this.generateInstanceId();
  }

  public static getInstance(): CacheInvalidator {
    if (!CacheInvalidator.instance) {
      CacheInvalidator.instance = new CacheInvalidator();
    }
    return CacheInvalidator.instance;
  }

  /**
   * Generate unique instance ID
   */
  private generateInstanceId(): string {
    const hostname = process.env.HOSTNAME || 'unknown';
    const pid = process.pid;
    const timestamp = Date.now();
    return `${hostname}:${pid}:${timestamp}`;
  }

  /**
   * Initialize subscriber
   */
  async initialize(): Promise<void> {
    if (this.isSubscribed) {
      logger.warn('CacheInvalidator already initialized');
      return;
    }

    try {
      // Create separate Redis connection for subscriber
      // (Required by Redis - can't use same connection for pub/sub and regular commands)
      this.subscriber = this.redisClient.getClient().duplicate() as Redis;

      // Subscribe to invalidation channel
      await this.subscriber.subscribe(this.channel);

      // Handle messages
      this.subscriber.on('message', (channel, message) => {
        if (channel === this.channel) {
          this.handleInvalidationMessage(message);
        }
      });

      // Handle errors
      this.subscriber.on('error', (error) => {
        logger.error('CacheInvalidator subscriber error', error);
        this.stats.errors++;
      });

      this.isSubscribed = true;

      logger.info('CacheInvalidator initialized', {
        instanceId: this.instanceId,
        channel: this.channel,
      });
    } catch (error) {
      logger.error('Failed to initialize CacheInvalidator', error);
      throw error;
    }
  }

  /**
   * Handle incoming invalidation message
   */
  private async handleInvalidationMessage(message: string): Promise<void> {
    try {
      const event: InvalidationEvent = JSON.parse(message);

      // Ignore messages from self
      if (event.source === this.instanceId) {
        return;
      }

      this.stats.received++;

      logger.debug('Invalidation event received', {
        type: event.type,
        target: event.target,
        source: event.source,
      });

      // Process invalidation
      await this.processInvalidation(event);

      // Trigger callbacks
      const callbacksArray = Array.from(this.callbacks);
      for (const callback of callbacksArray) {
        try {
          await callback(event);
        } catch (error) {
          logger.error('Invalidation callback error', error);
        }
      }

      this.stats.processed++;
    } catch (error) {
      logger.error('Failed to handle invalidation message', error);
      this.stats.errors++;
    }
  }

  /**
   * Process invalidation based on type
   */
  private async processInvalidation(event: InvalidationEvent): Promise<void> {
    switch (event.type) {
      case 'key':
        if (Array.isArray(event.target)) {
          for (const key of event.target) {
            await this.cacheManager.del(key);
          }
        } else {
          await this.cacheManager.del(event.target);
        }
        break;

      case 'tag':
        const tags = Array.isArray(event.target) ? event.target : [event.target];
        await this.cacheManager.invalidateByTags(tags);
        break;

      case 'pattern':
        await this.cacheManager.invalidateByPattern(event.target as string);
        break;

      case 'clear':
        await this.cacheManager.clear();
        break;

      default:
        logger.warn('Unknown invalidation type', { type: event.type });
    }
  }

  /**
   * Publish invalidation event
   */
  private async publish(event: Omit<InvalidationEvent, 'source' | 'timestamp'>): Promise<void> {
    try {
      const fullEvent: InvalidationEvent = {
        ...event,
        source: this.instanceId,
        timestamp: Date.now(),
      };

      const redis = this.redisClient.getClient();
      await redis.publish(this.channel, JSON.stringify(fullEvent));

      this.stats.published++;

      logger.debug('Invalidation event published', {
        type: event.type,
        target: event.target,
      });
    } catch (error) {
      logger.error('Failed to publish invalidation event', error);
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Invalidate by key(s)
   */
  async invalidateKeys(keys: string | string[], metadata?: Record<string, any>): Promise<void> {
    const keyArray = Array.isArray(keys) ? keys : [keys];

    // Invalidate locally
    for (const key of keyArray) {
      await this.cacheManager.del(key);
    }

    // Broadcast to other instances
    await this.publish({
      type: 'key',
      target: keyArray,
      metadata,
    });

    logger.info('Cache invalidated by keys', {
      keys: keyArray,
      broadcast: true,
    });
  }

  /**
   * Invalidate by tag(s)
   */
  async invalidateTags(tags: string | string[], metadata?: Record<string, any>): Promise<void> {
    const tagArray = Array.isArray(tags) ? tags : [tags];

    // Invalidate locally
    await this.cacheManager.invalidateByTags(tagArray);

    // Broadcast to other instances
    await this.publish({
      type: 'tag',
      target: tagArray,
      metadata,
    });

    logger.info('Cache invalidated by tags', {
      tags: tagArray,
      broadcast: true,
    });
  }

  /**
   * Invalidate by pattern
   */
  async invalidatePattern(pattern: string, metadata?: Record<string, any>): Promise<void> {
    // Invalidate locally
    await this.cacheManager.invalidateByPattern(pattern);

    // Broadcast to other instances
    await this.publish({
      type: 'pattern',
      target: pattern,
      metadata,
    });

    logger.info('Cache invalidated by pattern', {
      pattern,
      broadcast: true,
    });
  }

  /**
   * Clear all cache
   */
  async clearAll(metadata?: Record<string, any>): Promise<void> {
    // Clear locally
    await this.cacheManager.clear();

    // Broadcast to other instances
    await this.publish({
      type: 'clear',
      target: '*',
      metadata,
    });

    logger.info('All cache cleared', {
      broadcast: true,
    });
  }

  /**
   * Subscribe to invalidation events
   */
  onInvalidation(callback: InvalidationCallback): () => void {
    this.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Get invalidation statistics
   */
  getStats() {
    return {
      ...this.stats,
      instanceId: this.instanceId,
      isSubscribed: this.isSubscribed,
      callbackCount: this.callbacks.size,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      published: 0,
      received: 0,
      processed: 0,
      errors: 0,
    };
  }

  /**
   * Shutdown invalidator
   */
  async shutdown(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.unsubscribe(this.channel);
      await this.subscriber.quit();
      this.subscriber = undefined;
    }

    this.isSubscribed = false;
    this.callbacks.clear();

    logger.info('CacheInvalidator shutdown', {
      instanceId: this.instanceId,
    });
  }
}

/**
 * Domain-specific invalidation helpers
 */
export class DomainInvalidator {
  private invalidator: CacheInvalidator;

  constructor() {
    this.invalidator = CacheInvalidator.getInstance();
  }

  /**
   * Invalidate user-related cache
   */
  async invalidateUser(userId: number): Promise<void> {
    await this.invalidator.invalidateTags([`user:${userId}`]);
    await this.invalidator.invalidatePattern(`*user:${userId}*`);

    logger.info('User cache invalidated', { userId });
  }

  /**
   * Invalidate ticket-related cache
   */
  async invalidateTicket(ticketId: number): Promise<void> {
    await this.invalidator.invalidateTags([`ticket:${ticketId}`, 'tickets']);
    await this.invalidator.invalidateKeys([
      `ticket:${ticketId}`,
      'dashboard:ticket-counts-by-status',
      'dashboard:ticket-counts-by-priority',
      'dashboard:today-ticket-count',
    ]);

    logger.info('Ticket cache invalidated', { ticketId });
  }

  /**
   * Invalidate category-related cache
   */
  async invalidateCategory(categoryId: number): Promise<void> {
    await this.invalidator.invalidateTags([`category:${categoryId}`, 'categories']);
    await this.invalidator.invalidateKeys(['categories:all']);

    logger.info('Category cache invalidated', { categoryId });
  }

  /**
   * Invalidate knowledge base cache
   */
  async invalidateKnowledgeBase(articleId?: number): Promise<void> {
    if (articleId) {
      await this.invalidator.invalidateTags([`kb:${articleId}`]);
      await this.invalidator.invalidateKeys([`kb:article:${articleId}`]);
    } else {
      await this.invalidator.invalidateTags(['kb']);
      await this.invalidator.invalidatePattern('kb:*');
    }

    logger.info('Knowledge base cache invalidated', { articleId });
  }

  /**
   * Invalidate dashboard cache
   */
  async invalidateDashboard(): Promise<void> {
    await this.invalidator.invalidateTags(['dashboard', 'metrics']);
    await this.invalidator.invalidatePattern('dashboard:*');

    logger.info('Dashboard cache invalidated');
  }

  /**
   * Invalidate statistics cache
   */
  async invalidateStats(): Promise<void> {
    await this.invalidator.invalidateTags(['stats', 'analytics']);
    await this.invalidator.invalidatePattern('stats:*');
    await this.invalidator.invalidatePattern('analytics:*');

    logger.info('Statistics cache invalidated');
  }

  /**
   * Invalidate configuration cache
   */
  async invalidateConfig(): Promise<void> {
    await this.invalidator.invalidateTags(['config', 'settings']);
    await this.invalidator.invalidateKeys([
      'categories:all',
      'priorities:all',
      'statuses:all',
    ]);

    logger.info('Configuration cache invalidated');
  }

  /**
   * Invalidate tenant-related cache
   */
  async invalidateTenant(tenantId: number): Promise<void> {
    await this.invalidator.invalidateTags([`tenant:${tenantId}`]);
    await this.invalidator.invalidatePattern(`*tenant:${tenantId}*`);

    logger.info('Tenant cache invalidated', { tenantId });
  }
}

/**
 * Get CacheInvalidator instance
 */
export function getCacheInvalidator(): CacheInvalidator {
  return CacheInvalidator.getInstance();
}

/**
 * Get DomainInvalidator instance
 */
export const domainInvalidator = new DomainInvalidator();

/**
 * Export singleton
 */
export const cacheInvalidator = CacheInvalidator.getInstance();
