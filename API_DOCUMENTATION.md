# ServiceDesk API Documentation

## Overview

The ServiceDesk API is a comprehensive RESTful API for enterprise service desk operations, featuring multi-tenant architecture, JWT authentication, and extensive ticket management capabilities.

## Base URLs

- **Development**: `http://localhost:3000/api`
- **Production**: `https://{tenant}.servicedesk.com/api`

## Interactive Documentation

Access the interactive Swagger UI documentation at:

```
http://localhost:3000/api/docs
```

This provides a fully interactive interface where you can:
- Explore all available endpoints
- View request/response schemas
- Test API calls directly from the browser
- Download the OpenAPI specification

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

```
http://localhost:3000/api/docs/openapi.yaml
```

You can use this specification with any OpenAPI-compatible tool such as:
- Postman (import as OpenAPI 3.0)
- Insomnia
- Swagger Editor
- API client generators

## Authentication

### Overview

The API uses **JWT (JSON Web Token)** based authentication with two delivery methods:

1. **HTTP-only Secure Cookies** (recommended for web applications)
2. **Bearer Token in Authorization Header** (for API clients)

### Login

**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "tenant_slug": "acme-corp"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com",
    "role": "agent",
    "tenant_id": 1
  },
  "tenant": {
    "id": 1,
    "slug": "acme-corp",
    "name": "Acme Corporation"
  },
  "token_config": {
    "access_token_expiry": "15m",
    "refresh_token_expiry": "7d",
    "should_auto_refresh": true
  }
}
```

**Headers Set**:
- `Set-Cookie: auth_token={jwt}; HttpOnly; Secure; SameSite=Lax`
- `Set-Cookie: refresh_token={jwt}; HttpOnly; Secure; SameSite=Lax`
- `Set-Cookie: tenant_context={...}; SameSite=Lax`

### Using Bearer Token

For API clients, include the token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Expiration

- **Access Token**: 15 minutes
- **Refresh Token**: 7 days

Tokens automatically refresh when using cookie-based authentication.

### Logout

**Endpoint**: `POST /api/auth/logout`

Invalidates the current session and clears authentication cookies.

## Multi-Tenancy

The API supports multi-tenant architecture. Tenant context is resolved via:

### 1. Subdomain (Production)
```
https://acme-corp.servicedesk.com/api/tickets
```

### 2. HTTP Headers
```http
x-tenant-id: 1
x-tenant-slug: acme-corp
```

### 3. Cookie
```
tenant-context={id:1,slug:"acme-corp",name:"Acme"}
```

### 4. Request Body (Login/Register)
```json
{
  "tenant_slug": "acme-corp"
}
```

**Note**: Tenant context from subdomain takes precedence over headers and cookies.

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Auth endpoints**: 5 requests per minute per IP
- **General endpoints**: 100 requests per minute per user
- **Heavy operations**: 10 requests per minute

Rate limit information is returned in response headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

When rate limit is exceeded, you'll receive a `429 Too Many Requests` response.

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE"
}
```

### Common HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Authentication required or token invalid |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 413 | Payload Too Large | Request body or file too large |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

## Pagination

List endpoints support pagination via query parameters:

```http
GET /api/tickets?page=1&limit=10
```

**Parameters**:
- `page`: Page number (default: 1, min: 1)
- `limit`: Items per page (default: 10, min: 1, max: 100)

**Response**:
```json
{
  "success": true,
  "tickets": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "pages": 15
  }
}
```

## Filtering and Search

Many list endpoints support filtering and search:

### Search
```http
GET /api/tickets?search=password+reset
```

### Filters
```http
GET /api/tickets?status_id=2&priority_id=3&category_id=1
```

### Combined
```http
GET /api/tickets?search=login&priority_id=3&page=1&limit=25
```

## Common Endpoints

### Tickets

#### List Tickets
```http
GET /api/tickets?page=1&limit=10&status_id=1
```

#### Create Ticket
```http
POST /api/tickets
Content-Type: application/json

{
  "title": "Cannot access dashboard",
  "description": "Detailed description...",
  "category_id": 2,
  "priority_id": 3
}
```

#### Get Ticket
```http
GET /api/tickets/1
```

#### Update Ticket
```http
PUT /api/tickets/1
Content-Type: application/json

{
  "status_id": 2,
  "assigned_to": 5
}
```

### Comments

#### List Comments
```http
GET /api/tickets/1/comments
```

#### Add Comment
```http
POST /api/tickets/1/comments
Content-Type: application/json

{
  "content": "I've investigated the issue...",
  "is_internal": false
}
```

### Attachments

#### Upload Attachment
```http
POST /api/tickets/1/attachments
Content-Type: multipart/form-data

file: [binary data]
```

### Knowledge Base

#### List Articles
```http
GET /api/knowledge?search=password&category=Getting+Started
```

#### Create Article (Admin only)
```http
POST /api/knowledge
Content-Type: application/json

{
  "title": "How to reset your password",
  "content": "Step-by-step guide...",
  "category": "Getting Started",
  "status": "published"
}
```

### Analytics (Admin only)

#### Get Analytics
```http
GET /api/analytics?period=30d&type=overview
```

### Notifications

#### List Notifications
```http
GET /api/notifications?page=1&limit=20&is_read=false
```

#### Get Unread Count
```http
GET /api/notifications/unread
```

## Role-Based Access Control

### User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `super_admin` | Platform super administrator | Full access across all tenants |
| `tenant_admin` | Tenant administrator | Full access within tenant |
| `team_manager` | Team manager | Manage team members and tickets |
| `admin` | Administrator | Tenant-wide admin access |
| `agent` | Support agent | Handle assigned tickets |
| `user` | End user | Create and view own tickets |
| `manager` | Manager | View team analytics |
| `read_only` | Read-only access | View-only permissions |
| `api_client` | API client | Programmatic access |

### Permission Levels

Different endpoints require different permission levels:

- **Public**: No authentication required
- **Authenticated**: Any logged-in user
- **Agent**: Agents and above
- **Admin**: Admins and above
- **Tenant Admin**: Tenant admins only
- **Super Admin**: Super admins only

## Security Features

### CSRF Protection

State-changing requests (POST, PUT, PATCH, DELETE) require a CSRF token:

```http
X-CSRF-Token: {token}
```

The token is automatically set in cookies and managed by the middleware.

### Security Headers

All responses include comprehensive security headers:

- Content-Security-Policy
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Strict-Transport-Security
- Referrer-Policy
- Permissions-Policy

### Password Requirements

Passwords must meet the following criteria:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

## API Client Examples

### cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecureP@ss123",
    "tenant_slug": "acme-corp"
  }' \
  -c cookies.txt

# Create ticket (using cookies)
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Test ticket",
    "description": "Test description",
    "category_id": 1,
    "priority_id": 2
  }'
```

### JavaScript (Fetch)

```javascript
// Login
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Important for cookies
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecureP@ss123',
    tenant_slug: 'acme-corp'
  })
});

const loginData = await loginResponse.json();

// Create ticket (cookies sent automatically)
const ticketResponse = await fetch('http://localhost:3000/api/tickets', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify({
    title: 'Test ticket',
    description: 'Test description',
    category_id: 1,
    priority_id: 2
  })
});

const ticketData = await ticketResponse.json();
```

### Python (requests)

```python
import requests

# Login
session = requests.Session()
login_response = session.post(
    'http://localhost:3000/api/auth/login',
    json={
        'email': 'user@example.com',
        'password': 'SecureP@ss123',
        'tenant_slug': 'acme-corp'
    }
)

# Create ticket (session maintains cookies)
ticket_response = session.post(
    'http://localhost:3000/api/tickets',
    json={
        'title': 'Test ticket',
        'description': 'Test description',
        'category_id': 1,
        'priority_id': 2
    }
)

ticket = ticket_response.json()
```

### Postman

1. Import the OpenAPI specification:
   - Click **Import** > **Link**
   - Enter: `http://localhost:3000/api/docs/openapi.yaml`
   - Click **Import**

2. Set up environment:
   - Create a new environment
   - Add variable: `baseUrl` = `http://localhost:3000/api`
   - Add variable: `tenant_slug` = `acme-corp`

3. Configure authentication:
   - Use **Bearer Token** auth type
   - Or enable **Cookie** management for automatic handling

## Advanced Features

### Real-time Notifications (SSE)

Subscribe to real-time notifications using Server-Sent Events:

```http
GET /api/notifications/sse
```

```javascript
const eventSource = new EventSource('/api/notifications/sse');

eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('New notification:', notification);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};
```

### AI-Powered Features

#### Classify Ticket
```http
POST /api/ai/classify-ticket
Content-Type: application/json

{
  "ticket_id": 1
}
```

#### Suggest Solutions
```http
POST /api/ai/suggest-solutions
Content-Type: application/json

{
  "ticket_id": 1
}
```

#### Detect Duplicates
```http
POST /api/ai/detect-duplicates
Content-Type: application/json

{
  "title": "Password reset issue",
  "description": "Cannot reset my password"
}
```

### Workflow Automation

#### List Workflows
```http
GET /api/workflows/definitions
```

#### Execute Workflow
```http
POST /api/workflows/execute
Content-Type: application/json

{
  "workflow_id": 1,
  "trigger_data": {
    "ticket_id": 5
  }
}
```

## Webhooks

Configure webhooks to receive events:

### Webhook Events

- `ticket.created`
- `ticket.updated`
- `ticket.assigned`
- `ticket.resolved`
- `comment.added`
- `sla.warning`
- `sla.breached`

### Webhook Payload Example

```json
{
  "event": "ticket.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "tenant_id": 1,
  "data": {
    "ticket_id": 123,
    "title": "New ticket",
    "priority": "high",
    "created_by": {
      "id": 5,
      "name": "John Doe"
    }
  }
}
```

## Rate Limit & Performance

### Best Practices

1. **Use pagination**: Don't fetch all records at once
2. **Implement caching**: Cache reference data (categories, priorities, statuses)
3. **Batch operations**: Use bulk endpoints when available
4. **Respect rate limits**: Implement exponential backoff
5. **Use ETags**: Leverage conditional requests with If-None-Match

### ETag Support

```http
GET /api/tickets/1
If-None-Match: "abc123"
```

If content hasn't changed:
```http
HTTP/1.1 304 Not Modified
ETag: "abc123"
```

## Troubleshooting

### Common Issues

#### 401 Unauthorized
- Check if token is included in request
- Verify token hasn't expired
- Ensure correct tenant context

#### 403 Forbidden
- Verify user has required role/permissions
- Check tenant isolation (accessing another tenant's data)

#### 429 Too Many Requests
- Implement request throttling
- Use exponential backoff
- Consider caching

#### CSRF Token Errors
- Ensure CSRF token is included in state-changing requests
- Check cookie settings (SameSite, Secure)

## Support and Resources

- **Interactive Docs**: `/api/docs`
- **OpenAPI Spec**: `/api/docs/openapi.yaml`
- **Health Check**: `/api/health`
- **Repository**: [GitHub URL]
- **Support Email**: support@servicedesk.com

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial API release
- Complete CRUD operations for tickets
- Multi-tenant support
- JWT authentication
- Knowledge base endpoints
- Analytics and reporting
- Real-time notifications
- AI-powered features
- Workflow automation

---

**Last Updated**: 2024-01-15
**API Version**: 1.0.0
**OpenAPI Version**: 3.0.0
