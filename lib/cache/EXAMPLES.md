# Redis Cache - Usage Examples

## Table of Contents

1. [Initialization](#initialization)
2. [Basic Operations](#basic-operations)
3. [Cache Patterns](#cache-patterns)
4. [Session Management](#session-management)
5. [Rate Limiting](#rate-limiting)
6. [Cache Warming](#cache-warming)
7. [Invalidation](#invalidation)
8. [Monitoring](#monitoring)
9. [Production Recipes](#production-recipes)

## Initialization

### Simple Initialization

```typescript
// app/startup.ts
import { initializeCacheSystem } from '@/lib/cache/redis-cache';

async function main() {
  await initializeCacheSystem();
  console.log('Cache system ready!');
}

main();
```

### Custom Configuration

```typescript
import { createRedisClient, getCacheManager } from '@/lib/cache/redis-cache';

// Custom Redis config
const redisClient = createRedisClient({
  host: 'redis.example.com',
  port: 6380,
  password: 'my-secret',
  db: 1,
  cluster: false,
});

// Custom cache config
const cacheManager = getCacheManager({
  l1MaxSize: 1000,
  defaultTTL: 600,
  enableL1: true,
  enableL2: true,
});
```

## Basic Operations

### Simple Get/Set

```typescript
import { cacheManager } from '@/lib/cache/redis-cache';

// Set value
await cacheManager.set('greeting', 'Hello World', { ttl: 60 });

// Get value
const greeting = await cacheManager.get<string>('greeting');
console.log(greeting); // "Hello World"

// Delete value
await cacheManager.del('greeting');
```

### With Tags

```typescript
// Set with tags
await cacheManager.set(
  `ticket:${ticketId}`,
  ticketData,
  {
    ttl: 300,
    tags: ['tickets', `ticket:${ticketId}`],
  }
);

// Later: invalidate all tickets
await cacheManager.invalidateByTags(['tickets']);
```

### With Compression

```typescript
const largeDocument = { /* large object */ };

await cacheManager.set('doc:large', largeDocument, {
  ttl: 3600,
  compress: true,
  compressionThreshold: 512, // compress if > 512 bytes
});

const doc = await cacheManager.get('doc:large');
// Automatically decompressed
```

### Multiple Operations

```typescript
// Set multiple
await cacheManager.mset([
  { key: 'user:1', value: { name: 'Alice' }, ttl: 300 },
  { key: 'user:2', value: { name: 'Bob' }, ttl: 300 },
  { key: 'user:3', value: { name: 'Charlie' }, ttl: 300 },
]);

// Get multiple
const users = await cacheManager.mget<User>(['user:1', 'user:2', 'user:3']);
users.forEach((user, key) => {
  console.log(`${key}: ${user?.name}`);
});
```

## Cache Patterns

### Cache-Aside (Most Common)

```typescript
import { cacheAside } from '@/lib/cache/redis-cache';

async function getUser(userId: number) {
  return cacheAside.get(
    `user:${userId}`,
    async () => {
      // Fetch from database
      return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    },
    {
      ttl: 300,
      tags: [`user:${userId}`],
    }
  );
}

const user = await getUser(123);
```

### Cache-Aside with Proactive Refresh

```typescript
import { cacheAside } from '@/lib/cache/redis-cache';

// Refresh cache when 20% of TTL remains
const tickets = await cacheAside.getWithRefresh(
  'tickets:recent',
  async () => {
    return db.prepare('SELECT * FROM tickets ORDER BY created_at DESC LIMIT 50').all();
  },
  {
    ttl: 300,
    refreshThreshold: 0.2, // Refresh when < 60s remain
    tags: ['tickets'],
  }
);
```

### Write-Through

```typescript
import { writeThrough } from '@/lib/cache/redis-cache';

async function updateUser(userId: number, updates: Partial<User>) {
  await writeThrough.write(
    `user:${userId}`,
    { ...existingUser, ...updates },
    async (data) => {
      // Write to database
      db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?')
        .run(data.name, data.email, userId);
    },
    {
      ttl: 300,
      tags: [`user:${userId}`],
    }
  );
}
```

### Write-Behind (Async)

```typescript
import { writeBehind } from '@/lib/cache/redis-cache';

// Create write-behind instance
const analyticsCache = new WriteBehindPattern(undefined, {
  flushIntervalMs: 5000, // Flush every 5 seconds
  maxRetries: 3,
  batchSize: 10,
});

// Log analytics event
async function trackEvent(event: AnalyticsEvent) {
  await analyticsCache.write(
    `event:${event.id}`,
    event,
    async (data) => {
      // Async write to analytics DB
      await analyticsDb.insert(data);
    },
    { ttl: 60 }
  );
}

// Events are cached immediately, written to DB asynchronously
await trackEvent({ id: '123', type: 'page_view', page: '/home' });
```

### Read-Through

```typescript
import { readThrough } from '@/lib/cache/redis-cache';

// Register loaders
readThrough.registerLoader('user:*', async (key) => {
  const userId = key.split(':')[1];
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
});

readThrough.registerLoader('ticket:*', async (key) => {
  const ticketId = key.split(':')[1];
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
});

// Read (cache handles loading)
const user = await readThrough.read('user:123', { ttl: 300 });
const ticket = await readThrough.read('ticket:456', { ttl: 180 });
```

## Session Management

### Login

```typescript
import { sessionManager } from '@/lib/cache/redis-cache';

async function handleLogin(req, userId: number, tenantId: number) {
  const { sessionId, session } = await sessionManager.createSession({
    userId,
    tenantId,
    role: 'user',
    email: 'user@example.com',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || '',
  }, {
    ttl: 86400, // 24 hours
    maxDevices: 5,
  });

  // Set cookie
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: true,
    maxAge: 86400000,
  });

  return session;
}
```

### Authentication Middleware

```typescript
import { sessionManager } from '@/lib/cache/redis-cache';

async function authenticate(req, res, next) {
  const sessionId = req.cookies.sessionId;

  if (!sessionId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const session = await sessionManager.getSession(sessionId, {
    validateIp: req.ip,
    validateUserAgent: req.headers['user-agent'],
  });

  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  // Update activity
  await sessionManager.touchSession(sessionId);

  // Attach to request
  req.session = session;
  req.user = { id: session.userId, role: session.role };

  next();
}
```

### Logout

```typescript
// Single device logout
await sessionManager.deleteSession(sessionId);

// All devices logout
await sessionManager.deleteUserSessions(userId);
```

### Multi-Device Management

```typescript
// Get all user sessions
const sessions = await sessionManager.getUserSessions(userId);

console.log(`User has ${sessions.length} active sessions:`);
sessions.forEach(session => {
  console.log(`- Device: ${session.deviceId}`);
  console.log(`  Last activity: ${new Date(session.lastActivity)}`);
  console.log(`  IP: ${session.ipAddress}`);
});

// Logout specific device
const targetSession = sessions.find(s => s.deviceId === deviceId);
if (targetSession) {
  await sessionManager.deleteSession(targetSession.sessionId);
}
```

## Rate Limiting

### API Endpoint Protection

```typescript
import { redisRateLimiter, rateLimitPresets } from '@/lib/cache/redis-cache';

async function apiRateLimitMiddleware(req, res, next) {
  const identifier = `api:user:${req.user.id}`;

  const result = await redisRateLimiter.limit(identifier, {
    ...rateLimitPresets.api,
    algorithm: 'sliding-counter',
  });

  // Add headers
  res.setHeader('X-RateLimit-Limit', result.total);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', result.resetTime);

  if (!result.allowed) {
    res.setHeader('Retry-After', result.retryAfter || 60);
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: result.retryAfter,
    });
  }

  next();
}
```

### Login Rate Limiting

```typescript
import { redisRateLimiter, rateLimitPresets } from '@/lib/cache/redis-cache';

async function handleLogin(req, res) {
  const identifier = `auth:${req.ip}:${req.body.email}`;

  const result = await redisRateLimiter.limit(identifier, {
    ...rateLimitPresets.auth,
    algorithm: 'sliding-log', // More accurate
  });

  if (!result.allowed) {
    return res.status(429).json({
      error: 'Too many login attempts',
      retryAfter: result.retryAfter,
    });
  }

  // Process login...
}
```

### Custom Rate Limit

```typescript
// Token bucket (good for bursts)
const uploadLimit = await redisRateLimiter.tokenBucket(
  `upload:user:${userId}`,
  {
    windowMs: 60000, // 1 minute
    maxRequests: 10,
    refillRate: 2, // 2 tokens per second
    bucketSize: 10,
  }
);

// Leaky bucket (smooth rate)
const searchLimit = await redisRateLimiter.leakyBucket(
  `search:user:${userId}`,
  {
    windowMs: 60000,
    maxRequests: 30,
    leakRate: 0.5, // 0.5 requests per second
    bucketSize: 30,
  }
);
```

## Cache Warming

### Startup Warming

```typescript
import { cacheWarmer, warmCacheOnStartup } from '@/lib/cache/redis-cache';

// Automatic warming on startup
await warmCacheOnStartup();
```

### Custom Strategy

```typescript
import { cacheWarmer } from '@/lib/cache/redis-cache';

cacheWarmer.registerStrategy({
  name: 'popular-products',
  priority: 9,
  enabled: true,
  fetchFn: async () => {
    const products = await db.prepare(`
      SELECT * FROM products
      WHERE is_featured = 1
      LIMIT 20
    `).all();

    return products.map(product => ({
      key: `product:${product.id}`,
      value: product,
      options: {
        ttl: 3600,
        tags: ['products', `product:${product.id}`],
      },
    }));
  },
  schedule: 'every 1h', // Refresh hourly
});

// Warm this strategy
await cacheWarmer.warmStrategy('popular-products');
```

### Scheduled Warming

```typescript
// Warm dashboard every 5 minutes
cacheWarmer.registerStrategy({
  name: 'dashboard-refresh',
  priority: 10,
  enabled: true,
  fetchFn: async () => {
    const metrics = await calculateDashboardMetrics();
    return [{
      key: 'dashboard:metrics',
      value: metrics,
      options: { ttl: 60, tags: ['dashboard'] },
    }];
  },
  schedule: 'every 5m',
});
```

## Invalidation

### Automatic Invalidation on Updates

```typescript
import { domainInvalidator } from '@/lib/cache/redis-cache';

async function updateTicket(ticketId: number, updates: any) {
  // Update database
  await db.updateTicket(ticketId, updates);

  // Invalidate cache (across all instances)
  await domainInvalidator.invalidateTicket(ticketId);
}
```

### Event-Based Invalidation

```typescript
import { cacheInvalidator } from '@/lib/cache/redis-cache';

// Listen for invalidation events
cacheInvalidator.onInvalidation(async (event) => {
  console.log('Cache invalidated:', event.type, event.target);

  // Trigger custom logic
  if (event.type === 'tag' && event.target.includes('users')) {
    await refreshUserAnalytics();
  }
});
```

### Complex Invalidation

```typescript
import { cacheInvalidator } from '@/lib/cache/redis-cache';

async function reorganizeCategories() {
  // Update categories
  await db.reorganizeCategories();

  // Invalidate related caches
  await Promise.all([
    cacheInvalidator.invalidateTags(['categories']),
    cacheInvalidator.invalidatePattern('ticket:*'),
    cacheInvalidator.invalidateKeys(['dashboard:metrics']),
  ]);
}
```

## Monitoring

### Health Check

```typescript
import { cacheMetrics } from '@/lib/cache/redis-cache';

app.get('/health/cache', async (req, res) => {
  const health = await cacheMetrics.healthCheck();

  res.status(health.status === 'healthy' ? 200 : 503).json({
    status: health.status,
    checks: health.checks,
  });
});
```

### Metrics Endpoint

```typescript
import { cacheMetrics } from '@/lib/cache/redis-cache';

// JSON metrics
app.get('/metrics/cache', async (req, res) => {
  const metrics = await cacheMetrics.getMetricsJSON();
  res.json(metrics);
});

// Prometheus metrics
app.get('/metrics', async (req, res) => {
  const metrics = await cacheMetrics.getPrometheusMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});
```

### Dashboard

```typescript
import { cacheManager, cacheMetrics, sessionManager } from '@/lib/cache/redis-cache';

app.get('/admin/cache-dashboard', async (req, res) => {
  const [metrics, cacheStats, sessionStats] = await Promise.all([
    cacheMetrics.getMetricsJSON(),
    cacheManager.getStats(),
    sessionManager.getStats(),
  ]);

  res.json({
    performance: {
      hitRate: metrics.hitRate.total.toFixed(2) + '%',
      avgLatency: metrics.latency.get.avg.toFixed(2) + 'ms',
      p95Latency: metrics.latency.get.p95 + 'ms',
    },
    cache: {
      l1Size: `${cacheStats.l1.size}/${cacheStats.l1.maxSize}`,
      l1HitRate: cacheStats.l1.hitRate.toFixed(2) + '%',
      l2HitRate: cacheStats.l2.hitRate.toFixed(2) + '%',
    },
    sessions: {
      total: sessionStats.totalSessions,
      byUser: sessionStats.sessionsByUser.size,
    },
    health: {
      status: metrics.health.status,
      uptime: Math.floor(metrics.health.uptime / 1000) + 's',
    },
  });
});
```

## Production Recipes

### Recipe 1: High-Performance API

```typescript
import {
  initializeCacheSystem,
  cacheAside,
  redisRateLimiter,
  cacheMetrics,
} from '@/lib/cache/redis-cache';

// Initialize
await initializeCacheSystem({
  skipWarming: false,
  skipMetrics: false,
});

// API endpoint with caching + rate limiting
app.get('/api/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id);

  // Rate limiting
  const rateLimit = await redisRateLimiter.limit(
    `api:${req.ip}`,
    { windowMs: 60000, maxRequests: 100, algorithm: 'sliding-counter' }
  );

  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Cached response
  const user = await cacheAside.get(
    `user:${userId}`,
    async () => await db.getUser(userId),
    { ttl: 300, tags: [`user:${userId}`] }
  );

  res.json(user);
});
```

### Recipe 2: Session-Based Auth

```typescript
import { sessionManager, cacheInvalidator } from '@/lib/cache/redis-cache';

// Login
app.post('/auth/login', async (req, res) => {
  const user = await authenticateUser(req.body.email, req.body.password);

  const { sessionId } = await sessionManager.createSession({
    userId: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    email: user.email,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || '',
  }, {
    ttl: 86400,
    maxDevices: 5,
  });

  res.cookie('sid', sessionId, { httpOnly: true, secure: true });
  res.json({ success: true });
});

// Logout
app.post('/auth/logout', async (req, res) => {
  const sessionId = req.cookies.sid;
  await sessionManager.deleteSession(sessionId);
  res.clearCookie('sid');
  res.json({ success: true });
});

// Logout all devices
app.post('/auth/logout-all', async (req, res) => {
  await sessionManager.deleteUserSessions(req.user.id);
  res.json({ success: true });
});
```

### Recipe 3: Real-time Dashboard

```typescript
import { cacheWarmer, cacheInvalidator } from '@/lib/cache/redis-cache';

// Warm dashboard every minute
cacheWarmer.registerStrategy({
  name: 'dashboard-realtime',
  priority: 10,
  enabled: true,
  fetchFn: async () => {
    const metrics = {
      ticketsToday: await db.getTicketsToday(),
      ticketsByStatus: await db.getTicketsByStatus(),
      avgResponseTime: await db.getAvgResponseTime(),
      slaCompliance: await db.getSlaCompliance(),
    };

    return [{
      key: 'dashboard:realtime',
      value: metrics,
      options: { ttl: 60, tags: ['dashboard'] },
    }];
  },
  schedule: 'every 1m',
});

// Invalidate on ticket updates
async function onTicketUpdate(ticketId: number) {
  await db.updateTicket(ticketId);
  await cacheInvalidator.invalidateTags(['dashboard']);
}
```

This comprehensive guide should cover most use cases. Let me know if you need more specific examples!
