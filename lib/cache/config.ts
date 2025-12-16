/**
 * Cache System Configuration
 *
 * Centralized configuration for the entire caching infrastructure.
 */

import { RedisClientConfig } from './redis-client';
import { CacheOptions } from './cache-manager';

export interface CacheSystemConfig {
  // Redis configuration
  redis: RedisClientConfig;

  // Cache Manager configuration
  cache: {
    l1MaxSize: number;
    l1MaxAge: number; // milliseconds
    defaultTTL: number; // seconds
    keyPrefix: string;
    compressionThreshold: number;
    enableL1: boolean;
    enableL2: boolean;
  };

  // Session configuration
  sessions: {
    ttl: number; // seconds
    refreshThreshold: number; // seconds
    maxDevices: number;
    validateIp: boolean;
    validateUserAgent: boolean;
  };

  // Rate limiting configuration
  rateLimit: {
    defaultWindowMs: number;
    defaultMaxRequests: number;
    algorithm: 'fixed' | 'sliding-log' | 'sliding-counter' | 'token-bucket' | 'leaky-bucket';
  };

  // Cache warming configuration
  warming: {
    enableOnStartup: boolean;
    enableScheduled: boolean;
    strategies: string[]; // Strategy names to enable
  };

  // Invalidation configuration
  invalidation: {
    enablePubSub: boolean;
    channel: string;
  };

  // Metrics configuration
  metrics: {
    enabled: boolean;
    collectInterval: number; // milliseconds
    exportPrometheus: boolean;
  };
}

/**
 * Default configuration
 */
export const defaultCacheConfig: CacheSystemConfig = {
  redis: {
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
  },

  cache: {
    l1MaxSize: parseInt(process.env.CACHE_L1_MAX_SIZE || '500'),
    l1MaxAge: parseInt(process.env.CACHE_L1_MAX_AGE || '60000'), // 1 minute
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'), // 5 minutes
    keyPrefix: process.env.CACHE_KEY_PREFIX || 'servicedesk',
    compressionThreshold: 1024, // 1KB
    enableL1: process.env.CACHE_ENABLE_L1 !== 'false',
    enableL2: process.env.CACHE_ENABLE_L2 !== 'false',
  },

  sessions: {
    ttl: parseInt(process.env.SESSION_TTL || '86400'), // 24 hours
    refreshThreshold: parseInt(process.env.SESSION_REFRESH_THRESHOLD || '3600'), // 1 hour
    maxDevices: parseInt(process.env.SESSION_MAX_DEVICES || '5'),
    validateIp: process.env.SESSION_VALIDATE_IP === 'true',
    validateUserAgent: process.env.SESSION_VALIDATE_UA === 'true',
  },

  rateLimit: {
    defaultWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    defaultMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    algorithm: (process.env.RATE_LIMIT_ALGORITHM as any) || 'sliding-counter',
  },

  warming: {
    enableOnStartup: process.env.CACHE_WARM_ON_STARTUP !== 'false',
    enableScheduled: process.env.CACHE_WARM_SCHEDULED === 'true',
    strategies: ['system-configs', 'active-users', 'dashboard-metrics'],
  },

  invalidation: {
    enablePubSub: process.env.CACHE_INVALIDATION_PUBSUB !== 'false',
    channel: process.env.CACHE_INVALIDATION_CHANNEL || 'cache:invalidation',
  },

  metrics: {
    enabled: process.env.CACHE_METRICS_ENABLED !== 'false',
    collectInterval: parseInt(process.env.CACHE_METRICS_INTERVAL || '60000'), // 1 minute
    exportPrometheus: process.env.CACHE_METRICS_PROMETHEUS === 'true',
  },
};

/**
 * Production configuration (optimized for performance)
 */
export const productionCacheConfig: Partial<CacheSystemConfig> = {
  cache: {
    l1MaxSize: 1000,
    l1MaxAge: 120000, // 2 minutes
    defaultTTL: 600, // 10 minutes
    keyPrefix: 'servicedesk:prod',
    compressionThreshold: 512, // 512 bytes
    enableL1: true,
    enableL2: true,
  },

  sessions: {
    ttl: 86400, // 24 hours
    refreshThreshold: 7200, // 2 hours
    maxDevices: 10,
    validateIp: true,
    validateUserAgent: true,
  },

  warming: {
    enableOnStartup: true,
    enableScheduled: true,
    strategies: [
      'system-configs',
      'active-users',
      'recent-tickets',
      'kb-popular',
      'dashboard-metrics',
    ],
  },

  metrics: {
    enabled: true,
    collectInterval: 30000, // 30 seconds
    exportPrometheus: true,
  },
};

/**
 * Development configuration (optimized for debugging)
 */
export const developmentCacheConfig: Partial<CacheSystemConfig> = {
  cache: {
    l1MaxSize: 100,
    l1MaxAge: 30000, // 30 seconds
    defaultTTL: 60, // 1 minute
    keyPrefix: 'servicedesk:dev',
    compressionThreshold: 2048, // 2KB
    enableL1: true,
    enableL2: process.env.REDIS_HOST !== undefined,
  },

  sessions: {
    ttl: 3600, // 1 hour
    refreshThreshold: 600, // 10 minutes
    maxDevices: 3,
    validateIp: false,
    validateUserAgent: false,
  },

  warming: {
    enableOnStartup: false,
    enableScheduled: false,
    strategies: [],
  },

  metrics: {
    enabled: true,
    collectInterval: 60000, // 1 minute
    exportPrometheus: false,
  },
};

/**
 * Get configuration based on environment
 */
export function getCacheConfig(): CacheSystemConfig {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    return {
      ...defaultCacheConfig,
      ...productionCacheConfig,
    };
  }

  return {
    ...defaultCacheConfig,
    ...developmentCacheConfig,
  };
}

/**
 * TTL presets for different data types
 */
export const ttlPresets = {
  // Very short (30 seconds)
  veryShort: 30,

  // Short (5 minutes)
  short: 300,

  // Medium (30 minutes)
  medium: 1800,

  // Long (2 hours)
  long: 7200,

  // Very long (24 hours)
  veryLong: 86400,

  // Specific data types
  dashboardMetrics: 60, // 1 minute
  userProfile: 300, // 5 minutes
  ticketDetails: 180, // 3 minutes
  categoryList: 1800, // 30 minutes
  kbArticle: 3600, // 1 hour
  systemConfig: 7200, // 2 hours
  staticContent: 86400, // 24 hours
};

/**
 * Cache options presets
 */
export const cacheOptionsPresets: Record<string, CacheOptions> = {
  dashboardMetrics: {
    ttl: ttlPresets.dashboardMetrics,
    tags: ['dashboard', 'metrics'],
    compress: false,
  },

  userProfile: {
    ttl: ttlPresets.userProfile,
    tags: ['user'],
    compress: false,
  },

  ticketDetails: {
    ttl: ttlPresets.ticketDetails,
    tags: ['ticket'],
    compress: true,
    compressionThreshold: 512,
  },

  categoryList: {
    ttl: ttlPresets.categoryList,
    tags: ['categories'],
    compress: false,
  },

  kbArticle: {
    ttl: ttlPresets.kbArticle,
    tags: ['kb'],
    compress: true,
    compressionThreshold: 1024,
  },

  systemConfig: {
    ttl: ttlPresets.systemConfig,
    tags: ['config', 'system'],
    compress: false,
  },

  staticContent: {
    ttl: ttlPresets.staticContent,
    tags: ['static'],
    compress: true,
    compressionThreshold: 512,
  },
};
