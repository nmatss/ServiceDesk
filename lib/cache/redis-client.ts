/**
 * Redis Client with Connection Pooling and Retry Logic
 *
 * Enterprise-grade Redis client with:
 * - Connection pooling
 * - Exponential backoff retry strategy
 * - Automatic reconnection
 * - Cluster and Sentinel support
 * - Health monitoring
 * - Graceful shutdown
 */

import Redis, { Cluster, ClusterNode, ClusterOptions, RedisOptions } from 'ioredis';
import logger from '../monitoring/structured-logger';

export interface RedisClientConfig {
  // Connection
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  username?: string;

  // Cluster mode
  cluster?: boolean;
  nodes?: ClusterNode[];
  clusterOptions?: ClusterOptions;

  // Sentinel mode (High Availability)
  sentinels?: Array<{ host: string; port: number }>;
  sentinelName?: string;

  // Connection pool
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
  commandTimeout?: number;
  keepAlive?: number;

  // Retry strategy
  retryStrategy?: (times: number) => number | void | null;
  reconnectOnError?: (err: Error) => boolean | 1 | 2;

  // Performance
  enableOfflineQueue?: boolean;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;

  // Monitoring
  showFriendlyErrorStack?: boolean;
}

export class RedisClient {
  private static instance: RedisClient;
  private client: Redis | Cluster;
  private config: RedisClientConfig;
  private isConnected: boolean = false;
  private lastError?: Error;

  // Health metrics
  private metrics = {
    totalCommands: 0,
    successfulCommands: 0,
    failedCommands: 0,
    connectionErrors: 0,
    reconnections: 0,
    avgLatency: 0,
    lastHealthCheck: Date.now(),
  };

  private constructor(config: RedisClientConfig) {
    this.config = this.normalizeConfig(config);
    this.client = this.createClient();
    this.setupEventHandlers();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: RedisClientConfig): RedisClient {
    if (!RedisClient.instance && config) {
      RedisClient.instance = new RedisClient(config);
    } else if (!RedisClient.instance) {
      throw new Error('RedisClient not initialized. Please provide config on first call.');
    }
    return RedisClient.instance;
  }

  /**
   * Reset instance (mainly for testing)
   */
  public static resetInstance(): void {
    if (RedisClient.instance) {
      RedisClient.instance.disconnect();
      RedisClient.instance = undefined as any;
    }
  }

  /**
   * Normalize and validate configuration
   */
  private normalizeConfig(config: RedisClientConfig): RedisClientConfig {
    // Default values
    const defaults: RedisClientConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      commandTimeout: 5000,
      keepAlive: 30000,
      enableOfflineQueue: true,
      enableReadyCheck: true,
      lazyConnect: false,
      showFriendlyErrorStack: process.env.NODE_ENV === 'development',
    };

    return { ...defaults, ...config };
  }

  /**
   * Create Redis client (standalone, cluster, or sentinel)
   */
  private createClient(): Redis | Cluster {
    // Cluster mode
    if (this.config.cluster && this.config.nodes && this.config.nodes.length > 0) {
      logger.info('Creating Redis Cluster client', {
        nodes: this.config.nodes.length,
      });

      return new Cluster(this.config.nodes, {
        redisOptions: this.buildRedisOptions(),
        clusterRetryStrategy: this.clusterRetryStrategy.bind(this),
        ...this.config.clusterOptions,
      });
    }

    // Sentinel mode (HA)
    if (this.config.sentinels && this.config.sentinelName) {
      logger.info('Creating Redis Sentinel client', {
        sentinels: this.config.sentinels.length,
        name: this.config.sentinelName,
      });

      return new Redis({
        ...this.buildRedisOptions(),
        sentinels: this.config.sentinels,
        name: this.config.sentinelName,
      });
    }

    // Standalone mode
    logger.info('Creating Redis standalone client', {
      host: this.config.host,
      port: this.config.port,
      db: this.config.db,
    });

    return new Redis(this.buildRedisOptions());
  }

  /**
   * Build Redis options
   */
  private buildRedisOptions(): RedisOptions {
    return {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      username: this.config.username,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      connectTimeout: this.config.connectTimeout,
      commandTimeout: this.config.commandTimeout,
      keepAlive: this.config.keepAlive,
      enableOfflineQueue: this.config.enableOfflineQueue,
      enableReadyCheck: this.config.enableReadyCheck,
      lazyConnect: this.config.lazyConnect,
      showFriendlyErrorStack: this.config.showFriendlyErrorStack,
      retryStrategy: this.config.retryStrategy || this.defaultRetryStrategy.bind(this),
      reconnectOnError: this.config.reconnectOnError || this.defaultReconnectOnError.bind(this),
    };
  }

  /**
   * Default retry strategy with exponential backoff
   */
  private defaultRetryStrategy(times: number): number | null {
    // Max 10 attempts
    if (times > 10) {
      logger.error('Redis: Max retry attempts reached', { attempts: times });
      return null;
    }

    // Exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms, 1.6s, 3.2s, 6.4s, 12.8s, 25.6s
    const delay = Math.min(100 * Math.pow(2, times - 1), 30000);

    logger.warn('Redis: Retrying connection', {
      attempt: times,
      delayMs: delay
    });

    return delay;
  }

  /**
   * Cluster retry strategy
   */
  private clusterRetryStrategy(times: number): number | null {
    return this.defaultRetryStrategy(times);
  }

  /**
   * Decide whether to reconnect on specific errors
   */
  private defaultReconnectOnError(err: Error): boolean | 1 | 2 {
    const targetErrors = [
      'READONLY',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
    ];

    if (targetErrors.some(target => err.message.includes(target))) {
      // 1 = reconnect, 2 = reconnect and resend failed command
      return 2;
    }

    return false;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis: Connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis: Ready to accept commands');
    });

    this.client.on('error', (error: Error) => {
      logger.error('Redis: Connection error', error);
      this.lastError = error;
      this.metrics.connectionErrors++;
    });

    this.client.on('close', () => {
      logger.warn('Redis: Connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', (ms: number) => {
      logger.info('Redis: Reconnecting', { delayMs: ms });
      this.metrics.reconnections++;
    });

    this.client.on('end', () => {
      logger.info('Redis: Connection ended');
      this.isConnected = false;
    });

    // Cluster-specific events
    if (this.client instanceof Cluster) {
      this.client.on('node error', (error: Error, address: string) => {
        logger.error('Redis Cluster: Node error', { error, address });
      });

      this.client.on('+node', (node: any) => {
        logger.info('Redis Cluster: Node added', { address: node.options.host });
      });

      this.client.on('-node', (node: any) => {
        logger.warn('Redis Cluster: Node removed', { address: node.options.host });
      });
    }
  }

  /**
   * Get the underlying Redis client
   */
  public getClient(): Redis | Cluster {
    return this.client;
  }

  /**
   * Check if client is connected
   */
  public isClientConnected(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  /**
   * Connect to Redis
   */
  public async connect(): Promise<void> {
    if (this.isClientConnected()) {
      logger.info('Redis: Already connected');
      return;
    }

    try {
      await this.client.connect();
      logger.info('Redis: Connection established');
    } catch (error) {
      logger.error('Redis: Failed to connect', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      logger.info('Redis: Disconnected gracefully');
    } catch (error) {
      logger.error('Redis: Error during disconnect', error);
      // Force disconnect
      this.client.disconnect();
    }
  }

  /**
   * Ping Redis server
   */
  public async ping(): Promise<boolean> {
    try {
      const start = Date.now();
      const result = await this.client.ping();
      const latency = Date.now() - start;

      this.updateLatencyMetric(latency);
      this.metrics.totalCommands++;
      this.metrics.successfulCommands++;

      return result === 'PONG';
    } catch (error) {
      logger.error('Redis: Ping failed', error);
      this.metrics.totalCommands++;
      this.metrics.failedCommands++;
      return false;
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    connected: boolean;
    latency: number;
    errors: number;
    reconnections: number;
    uptime: number;
    memory?: {
      used: number;
      peak: number;
      fragmentation: number;
    };
    clients?: number;
    lastError?: string;
  }> {
    try {
      const start = Date.now();
      const pingResult = await this.ping();
      const latency = Date.now() - start;

      // Get Redis INFO
      let memory, clients;
      try {
        const info = await this.client.info('memory');
        const clientsInfo = await this.client.info('clients');

        memory = this.parseMemoryInfo(info);
        clients = this.parseClientsInfo(clientsInfo);
      } catch (error) {
        logger.warn('Redis: Could not get INFO', error);
      }

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!pingResult || latency > 1000) {
        status = 'unhealthy';
      } else if (latency > 100 || this.metrics.connectionErrors > 5) {
        status = 'degraded';
      }

      return {
        status,
        connected: this.isClientConnected(),
        latency,
        errors: this.metrics.connectionErrors,
        reconnections: this.metrics.reconnections,
        uptime: Date.now() - this.metrics.lastHealthCheck,
        memory,
        clients,
        lastError: this.lastError?.message,
      };
    } catch (error) {
      logger.error('Redis: Health check failed', error);
      return {
        status: 'unhealthy',
        connected: false,
        latency: -1,
        errors: this.metrics.connectionErrors,
        reconnections: this.metrics.reconnections,
        uptime: Date.now() - this.metrics.lastHealthCheck,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get metrics
   */
  public getMetrics() {
    const successRate = this.metrics.totalCommands > 0
      ? (this.metrics.successfulCommands / this.metrics.totalCommands) * 100
      : 0;

    return {
      ...this.metrics,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      connectionErrors: 0,
      reconnections: 0,
      avgLatency: 0,
      lastHealthCheck: Date.now(),
    };
  }

  /**
   * Update latency metric (exponential moving average)
   */
  private updateLatencyMetric(latency: number): void {
    if (this.metrics.avgLatency === 0) {
      this.metrics.avgLatency = latency;
    } else {
      // EMA with alpha = 0.2
      this.metrics.avgLatency = 0.8 * this.metrics.avgLatency + 0.2 * latency;
    }
  }

  /**
   * Parse memory info from Redis INFO command
   */
  private parseMemoryInfo(info: string): {
    used: number;
    peak: number;
    fragmentation: number;
  } {
    const lines = info.split('\r\n');
    const data: Record<string, string> = {};

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key && value) {
          data[key] = value;
        }
      }
    }

    return {
      used: parseInt(data['used_memory'] || '0'),
      peak: parseInt(data['used_memory_peak'] || '0'),
      fragmentation: parseFloat(data['mem_fragmentation_ratio'] || '0'),
    };
  }

  /**
   * Parse clients info from Redis INFO command
   */
  private parseClientsInfo(info: string): number {
    const lines = info.split('\r\n');

    for (const line of lines) {
      if (line.startsWith('connected_clients:')) {
        return parseInt(line.split(':')[1] || '0');
      }
    }

    return 0;
  }

  /**
   * Execute command with error handling and metrics
   */
  public async executeCommand<T>(
    command: () => Promise<T>,
    commandName: string = 'unknown'
  ): Promise<T> {
    const start = Date.now();
    this.metrics.totalCommands++;

    try {
      const result = await command();
      const latency = Date.now() - start;

      this.updateLatencyMetric(latency);
      this.metrics.successfulCommands++;

      return result;
    } catch (error) {
      this.metrics.failedCommands++;
      logger.error(`Redis: Command failed [${commandName}]`, error);
      throw error;
    }
  }
}

/**
 * Factory function to create Redis client
 */
export function createRedisClient(config?: RedisClientConfig): RedisClient {
  return RedisClient.getInstance(config);
}

/**
 * Get existing Redis client instance
 */
export function getRedisClient(): RedisClient {
  return RedisClient.getInstance();
}

/**
 * Default configuration based on environment
 */
export const defaultRedisConfig: RedisClientConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  commandTimeout: 5000,
  keepAlive: 30000,
  enableOfflineQueue: true,
  enableReadyCheck: true,
  lazyConnect: false,
};

/**
 * Cluster configuration
 */
export const clusterRedisConfig: RedisClientConfig = {
  cluster: true,
  nodes: process.env.REDIS_CLUSTER_NODES
    ? JSON.parse(process.env.REDIS_CLUSTER_NODES)
    : [
        { host: 'localhost', port: 7000 },
        { host: 'localhost', port: 7001 },
        { host: 'localhost', port: 7002 },
      ],
  password: process.env.REDIS_PASSWORD,
};

/**
 * Sentinel configuration (High Availability)
 */
export const sentinelRedisConfig: RedisClientConfig = {
  sentinels: process.env.REDIS_SENTINELS
    ? JSON.parse(process.env.REDIS_SENTINELS)
    : [
        { host: 'localhost', port: 26379 },
        { host: 'localhost', port: 26380 },
        { host: 'localhost', port: 26381 },
      ],
  sentinelName: process.env.REDIS_SENTINEL_NAME || 'mymaster',
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
};
