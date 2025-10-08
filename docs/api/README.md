# ServiceDesk API Documentation

## Overview

The ServiceDesk API provides comprehensive access to all platform features including ticket management, knowledge base, user management, SLA tracking, and advanced automation capabilities.

**Base URL**: `https://api.servicedesk.example.com/api`

**API Version**: 1.0.0

## Getting Started

### Quick Start

1. **Register an account** or obtain API credentials from your administrator
2. **Authenticate** using the `/auth/login` endpoint to receive JWT tokens
3. **Include the access token** in the `Authorization` header for all subsequent requests
4. **Start making requests** to create tickets, manage users, or access analytics

### API Documentation Formats

- **OpenAPI 3.0 Spec**: See `openapi.yaml` for complete machine-readable specification
- **Interactive Docs**: Available at `/api/docs` (Swagger UI)
- **Postman Collection**: Import from `/api/postman-collection.json`

## Authentication

The ServiceDesk API uses **JWT (JSON Web Tokens)** for authentication with access and refresh token pairs.

### Authentication Flow

```
1. POST /api/auth/login        → Receive access + refresh tokens
2. Store tokens securely       → Save in httpOnly cookies or secure storage
3. Use access token            → Include in Authorization header
4. Token expires (1h)          → Use refresh token to get new access token
5. POST /api/auth/refresh      → Receive new access token
```

### Login Example

```bash
curl -X POST https://api.servicedesk.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

**Response**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

### Using Access Tokens

Include the access token in the `Authorization` header for all authenticated requests:

```bash
curl -X GET https://api.servicedesk.example.com/api/tickets \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Token Refresh

When the access token expires (default: 1 hour), use the refresh token to obtain a new one:

```bash
curl -X POST https://api.servicedesk.example.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

### Multi-Factor Authentication (MFA)

If MFA is enabled for your account:

1. Complete the initial login to receive a challenge
2. Submit the MFA code from your authenticator app
3. Receive access and refresh tokens upon successful verification

```bash
curl -X POST https://api.servicedesk.example.com/api/auth/mfa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "TEMP_SESSION_TOKEN",
    "code": "123456"
  }'
```

## Rate Limiting

To ensure fair usage and system stability, the API implements rate limiting:

### Limits by Endpoint Type

| Endpoint Type | Rate Limit | Window |
|--------------|------------|--------|
| Authentication | 5 requests | 15 minutes |
| Read Operations (GET) | 100 requests | 1 minute |
| Write Operations (POST/PUT/PATCH) | 50 requests | 1 minute |
| Delete Operations | 20 requests | 1 minute |
| AI/Analytics | 30 requests | 1 minute |

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
