# Rate Limiting Quick Reference

## 🚀 How to Add Rate Limiting to Any Endpoint

### Step 1: Import the Middleware
```typescript
import { createRateLimitMiddleware } from '@/lib/rate-limit'
```

### Step 2: Create Rate Limiter Instance
```typescript
// Choose appropriate strategy (see table below)
const rateLimiter = createRateLimitMiddleware('api')
```

### Step 3: Apply in Handler
```typescript
export async function POST(request: NextRequest) {
  // Apply rate limiting FIRST (before any logic)
  const rateLimitResult = await rateLimiter(request, '/api/your/endpoint')
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limit exceeded
  }

  // Your normal handler code here
  // ...
}
```

## 📊 Available Strategies

| Strategy | Window | Max Requests | Best For |
|----------|--------|--------------|----------|
| `'api'` | 15 min | 100 | General API endpoints |
| `'auth'` | 15 min | 5 | Login, verification |
| `'auth-strict'` | 1 hour | 3 | Registration, sensitive ops |
| `'refresh'` | 5 min | 10 | Token refresh |
| `'upload'` | 5 min | 10 | File uploads |
| `'search'` | 1 min | 30 | Search queries |
| `'password-reset'` | 1 hour | 3 | Password reset |
| `'embedding-generation'` | 5 min | 20 | AI embeddings |
| `'semantic-search'` | 1 min | 50 | Vector search |
| `'search-suggest'` | 1 min | 60 | Autocomplete |

## 🎯 Examples by Use Case

### Authentication Endpoints
```typescript
// Login (5 attempts per 15 min)
const loginRateLimit = createRateLimitMiddleware('auth')

// Registration (3 attempts per hour)
const registerRateLimit = createRateLimitMiddleware('auth-strict')

// Token verification
const verifyRateLimit = createRateLimitMiddleware('auth')
```

### AI/ML Endpoints
```typescript
// AI classification (standard API limit)
const classifyRateLimit = createRateLimitMiddleware('api')

// Model training (very restrictive)
const trainRateLimit = createRateLimitMiddleware('auth-strict')

// Embedding generation
const embedRateLimit = createRateLimitMiddleware('embedding-generation')
```

### Admin Operations
```typescript
// General admin endpoints
const adminRateLimit = createRateLimitMiddleware('api')

// Sensitive admin operations
const sensitiveAdminRateLimit = createRateLimitMiddleware('auth-strict')
```

### User Operations
```typescript
// Ticket creation (moderate)
const createTicketRateLimit = createRateLimitMiddleware('api')

// File uploads
const uploadRateLimit = createRateLimitMiddleware('upload')

// Search
const searchRateLimit = createRateLimitMiddleware('search')
```

## 🔧 Custom Configuration

Override default settings:
```typescript
const customRateLimit = createRateLimitMiddleware('api', {
  windowMs: 10 * 60 * 1000,  // 10 minutes
  maxRequests: 50,            // 50 requests
  message: 'Custom error message'
})
```

## 📝 Complete Implementation Example

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRateLimitMiddleware } from '@/lib/rate-limit'
import { verifyToken } from '@/lib/auth/sqlite-auth'

// Create rate limiter (outside handler)
const apiRateLimit = createRateLimitMiddleware('api')

export async function POST(request: NextRequest) {
  // 1. Apply rate limiting FIRST
  const rateLimitResult = await apiRateLimit(request, '/api/example')
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Returns 429 with proper headers
  }

  // 2. Verify authentication
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await verifyToken(token)
  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // 3. Process request
  try {
    const body = await request.json()

    // Your business logic here

    return NextResponse.json({ success: true, data: {} })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
```

## 🔍 Response When Rate Limit Exceeded

**HTTP 429 Too Many Requests**

```json
{
  "success": false,
  "error": "Muitas requisições para API. Tente novamente em 15 minutos.",
  "retryAfter": 900
}
```

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-12-13T15:30:00.000Z
Retry-After: 900
```

## 🧪 Testing Rate Limits

### Manual Testing (curl)
```bash
# Test until rate limit is hit
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/your/endpoint \
    -H "Content-Type: application/json" \
    -d '{"test":"data"}' \
    -v
  echo "Request $i completed"
  sleep 1
done
```

### Load Testing (artillery)
```bash
# Create artillery config
cat > rate-limit-test.yml <<EOF
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 20
scenarios:
  - flow:
    - post:
        url: '/api/your/endpoint'
        json:
          test: 'data'
EOF

# Run test
artillery run rate-limit-test.yml
```

## 📊 Monitoring Rate Limits

### Check Database Statistics
```typescript
import { getRateLimitStats } from '@/lib/rate-limit'

const stats = getRateLimitStats()
console.log(stats)
// {
//   totalEntries: 150,
//   activeEntries: 120,
//   expiredEntries: 30
// }
```

### Reset Rate Limit for User/IP
```typescript
import { resetRateLimit } from '@/lib/rate-limit'

const wasReset = resetRateLimit(request, '/api/endpoint')
console.log(`Rate limit reset: ${wasReset}`)
```

### Check Without Incrementing
```typescript
import { checkRateLimit, rateLimitConfigs } from '@/lib/rate-limit'

const status = await checkRateLimit(
  request,
  rateLimitConfigs.api,
  '/api/endpoint'
)

console.log({
  allowed: status.allowed,
  remaining: status.remaining,
  resetTime: status.resetTime
})
```

## ⚙️ Production Configuration

### Enable Redis (Recommended)
```typescript
// In your app initialization
import { configureRateLimitStore } from '@/lib/rate-limit'
import Redis from 'ioredis'

if (process.env.NODE_ENV === 'production') {
  const redis = new Redis(process.env.REDIS_URL)
  configureRateLimitStore(redis)
}
```

### Environment Variables
```env
# Rate limiting (optional - uses defaults if not set)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Redis for production
REDIS_URL=redis://localhost:6379
```

## 🚨 Common Mistakes to Avoid

❌ **Don't apply rate limiting inside try/catch**
```typescript
// WRONG
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimiter(request, '/api/endpoint')
    // ...
  } catch (error) {
    // Rate limit errors won't be caught properly
  }
}
```

✅ **Apply rate limiting BEFORE try/catch**
```typescript
// CORRECT
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimiter(request, '/api/endpoint')
  if (rateLimitResult instanceof Response) {
    return rateLimitResult
  }

  try {
    // Your logic here
  } catch (error) {
    // Handle errors
  }
}
```

❌ **Don't create rate limiter inside handler**
```typescript
// WRONG - Creates new instance per request
export async function POST(request: NextRequest) {
  const rateLimiter = createRateLimitMiddleware('api') // Recreated every time!
  // ...
}
```

✅ **Create rate limiter outside handler**
```typescript
// CORRECT - Reuses same instance
const rateLimiter = createRateLimitMiddleware('api')

export async function POST(request: NextRequest) {
  // Use rateLimiter
}
```

## 🎓 Best Practices

1. **Always apply rate limiting first** - Before authentication, validation, or business logic
2. **Use specific strategies** - Don't use 'api' for everything
3. **Test your limits** - Ensure they match real usage patterns
4. **Monitor violations** - Track and alert on excessive rate limit hits
5. **Document your limits** - In API docs for external consumers
6. **Use Redis in production** - In-memory storage doesn't scale across instances
7. **Set appropriate retry headers** - Help clients understand when to retry
8. **Log rate limit events** - For security monitoring and abuse detection

## 📚 Related Documentation

- Full implementation report: `RATE_LIMITING_IMPLEMENTATION_REPORT.md`
- Rate limit module: `lib/rate-limit/index.ts`
- Security guide: `.github/SECURITY.md`

---

**Quick Start Checklist:**
- [ ] Import `createRateLimitMiddleware`
- [ ] Choose appropriate strategy
- [ ] Create limiter instance (outside handler)
- [ ] Apply in handler (first thing)
- [ ] Check if result is Response
- [ ] Test with multiple requests
- [ ] Monitor in production

**Need Help?** Check the implementation in existing files:
- `app/api/auth/login/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/tickets/create/route.ts`
