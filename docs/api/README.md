# ServiceDesk API Documentation

## Overview

The ServiceDesk API provides comprehensive access to all platform features including ticket management, knowledge base, user management, SLA tracking, and advanced automation capabilities with full multi-tenant support.

**Base URL (Development)**: `http://localhost:3000`

**Base URL (Production)**: `https://api.servicedesk.com`

**API Version**: 1.0.0

## Key Features

- **Multi-tenant Architecture**: Complete organization isolation with tenant-aware queries
- **JWT Authentication**: Secure httpOnly cookies (15-minute access tokens)
- **ITIL Compliance**: Full support for Incident, Request, Change, and Problem management
- **Workflow Automation**: Auto-assignment, approval workflows, SLA tracking
- **Real-time Updates**: Server-Sent Events for notifications
- **Rate Limiting**: IP-based throttling for security
- **Audit Logging**: Complete trail of all actions

## Getting Started

### Quick Start

1. **Run database initialization**
   ```bash
   npm run init-db
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

3. **Authenticate** using POST `/api/auth/login`
   - Receive JWT token via httpOnly cookie
   - Token automatically included in subsequent requests

4. **Start making requests** to create tickets, manage users, or access analytics

### API Documentation Files

- **OpenAPI 3.0 Spec**: `openapi.yaml` - Complete machine-readable specification
- **Authentication Guide**: `authentication.md` - Detailed auth flow and security
- **Tickets Guide**: `tickets.md` - Complete ticket management documentation
- **Admin Guide**: `admin.md` - Administrative endpoints and permissions
- **Postman Collection**: `ServiceDesk-API.postman_collection.json` - Import into Postman

### Postman Collection

Import the Postman collection to get started immediately:

1. Open Postman
2. Click "Import" > "Upload Files"
3. Select `ServiceDesk-API.postman_collection.json`
4. Set environment variables:
   - `base_url`: http://localhost:3000
   - `tenant_slug`: empresa-demo
5. Run "Login" request to authenticate
6. Token automatically stored in environment variable `access_token`

## Authentication

The ServiceDesk API uses **JWT (JSON Web Tokens)** stored in httpOnly cookies for web applications, with Bearer token support for API clients.

### Authentication Flow

```
1. POST /api/auth/login        → Credentials validated
2. Success response            → JWT set in httpOnly cookie (15 min)
3. Subsequent requests         → Cookie sent automatically
4. Token expires               → Re-authenticate (no refresh token)
5. POST /api/auth/verify       → Check token validity anytime
```

**Key Security Features**:
- httpOnly cookies prevent XSS attacks
- 15-minute token expiration
- Account lockout after 5 failed attempts (1 minute)
- Rate limiting: 5 login attempts per 15 minutes per IP
- Complete audit logging

### Login Example

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "admin@empresa.com",
    "password": "Admin@123456",
    "tenant_slug": "empresa-demo"
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@empresa.com",
    "role": "tenant_admin",
    "organization_id": 1,
    "last_login_at": "2025-01-20T10:30:00Z"
  },
  "tenant": {
    "id": 1,
    "slug": "empresa-demo",
    "name": "Empresa Demo"
  }
}
```

**Important**: The JWT token is NOT in the response body. It's sent via httpOnly cookie.

### Using Cookies (Web Applications)

For browser-based applications, cookies are sent automatically:

```javascript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Important!
  body: JSON.stringify({
    email: 'admin@empresa.com',
    password: 'Admin@123456',
    tenant_slug: 'empresa-demo'
  })
});

// Subsequent requests (cookie sent automatically)
const tickets = await fetch('/api/tickets', {
  credentials: 'include'
});
```

### Using Bearer Tokens (API Clients)

For non-browser clients (mobile apps, scripts), use Bearer tokens:

**Admin endpoints require Bearer token**:

```bash
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Note**: Regular endpoints accept cookies. Admin endpoints require explicit Bearer tokens.

## Rate Limiting

To ensure fair usage and system stability, the API implements IP-based rate limiting:

### Limits by Endpoint Type

| Endpoint Type | Rate Limit | Window | Scope |
|--------------|------------|--------|-------|
| Login | 5 requests | 15 minutes | Per IP |
| Register | 5 requests | 1 hour | Per IP |
| Token Verify | 100 requests | 15 minutes | Per user |
| API Endpoints (GET/POST/PATCH) | 100 requests | 15 minutes | Per user |
| Ticket Creation | 100 requests | 15 minutes | Per user |

### Rate Limit Headers

All API responses include rate limit information in headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

### Exceeding Rate Limits

When you exceed the rate limit, you'll receive a `429 Too Many Requests` response:

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again in 45 seconds.",
  "retry_after": 45
}
```

### Best Practices

- **Cache responses** when possible
- **Implement exponential backoff** for retries
- **Use webhooks** instead of polling for real-time updates
- **Batch operations** where supported

## Error Codes

The API uses standard HTTP status codes and returns detailed error messages.

### HTTP Status Codes

| Code | Name | Description |
|------|------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request successful, no response body |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., duplicate email) |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "field": "email",
    "constraint": "must be a valid email address"
  }
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|-----------|-------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Invalid email or password |
| `TOKEN_EXPIRED` | 401 | Access token has expired |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource doesn't exist |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `DUPLICATE_RESOURCE` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `SLA_BREACH` | 422 | Action would cause SLA breach |
| `WORKFLOW_ERROR` | 500 | Workflow execution failed |

### Validation Errors

Validation errors include detailed field-level information:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": {
    "title": ["Title is required", "Title must be at least 5 characters"],
    "priority_id": ["Priority must be between 1 and 4"]
  }
}
```

## Pagination

List endpoints support cursor-based and offset-based pagination.

### Offset-Based Pagination (Default)

```bash
GET /api/tickets?page=2&limit=20
```

**Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response**:
```json
{
  "tickets": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 156,
    "total_pages": 8,
    "has_next": true,
    "has_prev": true
  }
}
```

### Cursor-Based Pagination (Recommended for Large Datasets)

```bash
GET /api/tickets?cursor=eyJpZCI6MTIzfQ&limit=20
```

**Response**:
```json
{
  "tickets": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTQzfQ",
    "prev_cursor": "eyJpZCI6MTAzfQ",
    "has_next": true,
    "has_prev": true
  }
}
```

## Filtering and Sorting

Most list endpoints support filtering and sorting.

### Filtering

```bash
# Filter by status
GET /api/tickets?status=open

# Multiple filters
GET /api/tickets?status=open&priority=high&category=technical

# Date range
GET /api/tickets?created_after=2024-01-01&created_before=2024-12-31

# Search
GET /api/tickets?search=login+error
```

### Sorting

```bash
# Sort by field
GET /api/tickets?sort_by=created_at&sort_order=desc

# Multiple sort fields
GET /api/tickets?sort_by=priority&sort_by=created_at&sort_order=desc
```

### Advanced Filtering (Field Operators)

```bash
# Greater than
GET /api/tickets?priority__gte=3

# Less than or equal
GET /api/tickets?created_at__lte=2024-12-31

# In list
GET /api/tickets?status__in=open,in_progress

# Not equal
GET /api/tickets?assigned_to__ne=null
```

## Webhooks

ServiceDesk supports webhooks for real-time event notifications.

### Supported Events

- `ticket.created` - New ticket created
- `ticket.updated` - Ticket updated
- `ticket.assigned` - Ticket assigned to agent
- `ticket.resolved` - Ticket resolved
- `ticket.closed` - Ticket closed
- `comment.created` - New comment added
- `sla.warning` - SLA warning threshold reached
- `sla.breach` - SLA breached
- `user.created` - New user registered
- `workflow.completed` - Workflow completed

### Creating a Webhook

```bash
curl -X POST https://api.servicedesk.example.com/api/webhooks \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Notifications",
    "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "event_types": ["ticket.created", "ticket.assigned"],
    "secret_token": "your-secret-for-signature-verification",
    "is_active": true
  }'
```

### Webhook Payload Format

All webhooks receive a consistent payload structure:

```json
{
  "event": "ticket.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "ticket": {
      "id": 42,
      "title": "Cannot access application",
      "status": "open",
      ...
    }
  },
  "metadata": {
    "webhook_id": 1,
    "delivery_id": "uuid-here"
  }
}
```

### Webhook Security

#### Signature Verification

All webhook requests include a signature in the `X-ServiceDesk-Signature` header:

```
X-ServiceDesk-Signature: sha256=abc123...
```

**Verification Example (Node.js)**:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' +
    crypto.createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

#### IP Allowlist

Configure your firewall to only accept webhooks from ServiceDesk IPs:
- Production: `52.1.2.3/32`, `52.1.2.4/32`
- Staging: `52.10.20.30/32`

### Webhook Retries

Failed webhook deliveries are automatically retried:
- Retry 1: After 1 minute
- Retry 2: After 5 minutes
- Retry 3: After 15 minutes
- Retry 4: After 1 hour
- Final: After 6 hours

After 5 failed attempts, the webhook is automatically disabled and you receive an alert.

## Real-Time Updates (WebSocket)

For real-time updates, connect to the WebSocket endpoint.

### Connection

```javascript
import io from 'socket.io-client';

const socket = io('https://api.servicedesk.example.com', {
  auth: {
    token: 'YOUR_ACCESS_TOKEN'
  }
});

socket.on('connect', () => {
  console.log('Connected to real-time updates');
});
```

### Subscribing to Events

```javascript
// Subscribe to ticket updates
socket.emit('subscribe', { channel: 'tickets' });

// Subscribe to specific ticket
socket.emit('subscribe', { channel: 'ticket:42' });

// Listen for updates
socket.on('ticket:updated', (data) => {
  console.log('Ticket updated:', data);
});

socket.on('notification', (notification) => {
  console.log('New notification:', notification);
});
```

### Available Channels

- `tickets` - All ticket updates
- `ticket:{id}` - Specific ticket updates
- `notifications` - User notifications
- `sla_warnings` - SLA warning alerts
- `online_users` - Agent presence updates

## API Best Practices

### 1. Use Appropriate HTTP Methods

- **GET** - Retrieve resources (idempotent, cacheable)
- **POST** - Create new resources
- **PUT** - Replace entire resource
- **PATCH** - Partial update
- **DELETE** - Remove resource

### 2. Handle Errors Gracefully

```javascript
try {
  const response = await fetch('/api/tickets', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    const error = await response.json();
    console.error(`Error ${response.status}:`, error.message);
    // Handle specific error codes
    if (response.status === 401) {
      // Refresh token or redirect to login
    }
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error('Network error:', error);
}
```

### 3. Implement Exponential Backoff

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || (2 ** i);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, (2 ** i) * 1000));
    }
  }
}
```

### 4. Cache Responses

```javascript
// Use ETags for conditional requests
const response = await fetch('/api/tickets/42', {
  headers: {
    'If-None-Match': cachedETag
  }
});

if (response.status === 304) {
  // Use cached data
  return cachedTicket;
}
```

### 5. Batch Operations

Instead of multiple single requests, use batch endpoints when available:

```javascript
// Bad - Multiple requests
tickets.forEach(async (id) => {
  await deleteTicket(id);
});

// Good - Single batch request
await fetch('/api/tickets/batch/delete', {
  method: 'POST',
  body: JSON.stringify({ ids: [1, 2, 3, 4, 5] })
});
```

## Code Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.servicedesk.example.com/api',
  timeout: 10000,
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token');
      const { data } = await axios.post('/api/auth/refresh', { refreshToken });
      localStorage.setItem('access_token', data.accessToken);
      error.config.headers.Authorization = `Bearer ${data.accessToken}`;
      return axios(error.config);
    }
    return Promise.reject(error);
  }
);

// Usage
const tickets = await api.get('/tickets', {
  params: { status: 'open', limit: 20 }
});
```

### Python

```python
import requests
from typing import Optional

class ServiceDeskAPI:
    def __init__(self, base_url: str, access_token: str):
        self.base_url = base_url
        self.access_token = access_token
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        })

    def get_tickets(self, status: Optional[str] = None, limit: int = 20):
        params = {'limit': limit}
        if status:
            params['status'] = status

        response = self.session.get(
            f'{self.base_url}/tickets',
            params=params
        )
        response.raise_for_status()
        return response.json()

    def create_ticket(self, title: str, description: str,
                     category_id: int, priority_id: int):
        data = {
            'title': title,
            'description': description,
            'category_id': category_id,
            'priority_id': priority_id
        }
        response = self.session.post(f'{self.base_url}/tickets', json=data)
        response.raise_for_status()
        return response.json()

# Usage
api = ServiceDeskAPI('https://api.servicedesk.example.com/api', 'your-token')
tickets = api.get_tickets(status='open')
```

## Support and Resources

- **API Status**: https://status.servicedesk.example.com
- **API Changelog**: https://docs.servicedesk.example.com/changelog
- **Developer Forum**: https://forum.servicedesk.example.com
- **Support Email**: api-support@servicedesk.example.com
- **GitHub Issues**: https://github.com/servicedesk/api/issues

## Versioning

The API uses semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes

Current version: **1.0.0**

### Deprecation Policy

- Deprecated features are marked 6 months before removal
- Deprecated endpoints return `X-API-Deprecated: true` header
- Breaking changes trigger a new major version
