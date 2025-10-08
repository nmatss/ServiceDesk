# ServiceDesk API Reference

Complete API documentation for the ServiceDesk application.

**Base URL:** `http://localhost:4000/api`
**Authentication:** JWT Bearer Token (except where noted as public)
**Content-Type:** `application/json`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Tickets](#tickets)
3. [Comments](#comments)
4. [Attachments](#attachments)
5. [Users & Admin](#users--admin)
6. [Reference Data](#reference-data)
7. [Notifications](#notifications)
8. [Knowledge Base](#knowledge-base)
9. [Analytics](#analytics)
10. [Teams](#teams)
11. [SLA](#sla)
12. [Templates](#templates)
13. [Workflows](#workflows)
14. [Integrations](#integrations)
15. [AI Features](#ai-features)
16. [Error Codes](#error-codes)

---

## Authentication

### Register New User

**Endpoint:** `POST /api/auth/register`
**Auth Required:** No
**Rate Limited:** Yes (10 requests per IP per minute)

**Request Body:**
```json
{
  "name": "string (required, 2-100 chars)",
  "email": "string (required, valid email)",
  "password": "string (required, min 6 chars)",
  "tenant_slug": "string (required)",
  "job_title": "string (optional)",
  "department": "string (optional)",
  "phone": "string (optional)"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Usuário criado com sucesso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "tenant_id": 1,
    "job_title": "Developer",
    "department": "Engineering",
    "phone": "+1234567890",
    "created_at": "2025-01-01T00:00:00Z"
  },
  "tenant": {
    "id": 1,
    "slug": "empresa-demo",
    "name": "Empresa Demo"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields, invalid email, weak password
- `409 Conflict`: Email already exists
- `403 Forbidden`: Tenant user limit reached
- `500 Internal Server Error`: Server error

---

### Login

**Endpoint:** `POST /api/auth/login`
**Auth Required:** No
**Rate Limited:** Yes (5 requests per IP per minute)

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)",
  "tenant_slug": "string (required)"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "tenant_id": 1,
    "job_title": "Developer",
    "department": "Engineering",
    "last_login_at": "2025-01-01T00:00:00Z"
  },
  "tenant": {
    "id": 1,
    "slug": "empresa-demo",
    "name": "Empresa Demo"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Tenant not found
- `401 Unauthorized`: Invalid credentials
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

**Notes:**
- Sets `auth_token` HttpOnly cookie (8 hour expiry)
- Sets `tenant_context` cookie for client-side access
- Creates audit log entry

---

### Logout

**Endpoint:** `POST /api/auth/logout`
**Auth Required:** Yes

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

---

### Change Password

**Endpoint:** `POST /api/auth/change-password`
**Auth Required:** Yes

**Request Body:**
```json
{
  "current_password": "string (required)",
  "new_password": "string (required, min 6 chars)"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Senha alterada com sucesso"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Current password incorrect
- `500 Internal Server Error`: Server error

---

### Get User Profile

**Endpoint:** `GET /api/auth/profile`
**Auth Required:** Yes

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "tenant_id": 1,
    "job_title": "Developer",
    "department": "Engineering",
    "created_at": "2025-01-01T00:00:00Z",
    "last_login_at": "2025-01-01T12:00:00Z"
  }
}
```

---

### Update User Profile

**Endpoint:** `PATCH /api/auth/profile`
**Auth Required:** Yes

**Request Body:**
```json
{
  "name": "string (optional)",
  "job_title": "string (optional)",
  "department": "string (optional)",
  "phone": "string (optional)"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": { /* updated user object */ }
}
```

---

## Tickets

### List Tickets

**Endpoint:** `GET /api/tickets`
**Auth Required:** Yes

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 10, max: 100)
- `status`: string (filter by status name)
- `priority`: string (filter by priority name)
- `category`: string (filter by category name)
- `assigned_to`: number (filter by assigned agent ID)

**Success Response (200):**
```json
{
  "success": true,
  "tickets": [
    {
      "id": 1,
      "title": "Login issue",
      "description": "Cannot login to the system",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T12:00:00Z",
      "status": "Em Progresso",
      "priority": "Alta",
      "category": "Technical Support",
      "user_name": "John Doe"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5
  }
}
```

**Notes:**
- Regular users see only their own tickets
- Agents/admins see all tickets in their tenant

---

### Create Ticket

**Endpoint:** `POST /api/tickets`
**Auth Required:** Yes

**Request Body:**
```json
{
  "title": "string (required, max 200 chars)",
  "description": "string (required, max 5000 chars)",
  "category_id": "number (required)",
  "priority_id": "number (required)"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "ticket": {
    "id": 1,
    "title": "Login issue",
    "description": "Cannot login to the system",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z",
    "status": "Novo",
    "priority": "Alta",
    "category": "Technical Support",
    "user_name": "John Doe"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing/invalid fields, invalid category/priority
- `401 Unauthorized`: Not authenticated
- `500 Internal Server Error`: Server error

---

### Get Single Ticket

**Endpoint:** `GET /api/tickets/:id`
**Auth Required:** Yes

**Success Response (200):**
```json
{
  "success": true,
  "ticket": {
    "id": 1,
    "title": "Login issue",
    "description": "Cannot login to the system",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T12:00:00Z",
    "status": "Em Progresso",
    "status_id": 2,
    "status_color": "#FFA500",
    "priority": "Alta",
    "priority_id": 3,
    "category": "Technical Support",
    "category_id": 1,
    "user_name": "John Doe"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Ticket not found or no permission

---

### Update Ticket

**Endpoint:** `PATCH /api/tickets/:id`
**Auth Required:** Yes

**Request Body (all fields optional):**
```json
{
  "title": "string",
  "description": "string",
  "status_id": "number",
  "priority_id": "number",
  "category_id": "number"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "ticket": { /* updated ticket object */ }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid status/priority/category, no fields to update
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Ticket not found or no permission

**Notes:**
- Users can only update their own tickets
- Agents/admins can update any ticket in their tenant

---

### Get Ticket Comments

**Endpoint:** `GET /api/tickets/:id/comments`
**Auth Required:** Yes

**Success Response (200):**
```json
{
  "success": true,
  "comments": [
    {
      "id": 1,
      "ticket_id": 1,
      "user_id": 1,
      "user_name": "John Doe",
      "content": "I tried resetting my password but it didn't work",
      "is_internal": false,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### Add Comment to Ticket

**Endpoint:** `POST /api/tickets/:id/comments`
**Auth Required:** Yes

**Request Body:**
```json
{
  "content": "string (required, max 5000 chars)",
  "is_internal": "boolean (optional, default: false)"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "ticket_id": 1,
    "user_id": 1,
    "content": "Comment text",
    "is_internal": false,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Notes:**
- Internal comments (`is_internal: true`) are only visible to agents/admins

---

### Get Ticket Attachments

**Endpoint:** `GET /api/tickets/:id/attachments`
**Auth Required:** Yes

**Success Response (200):**
```json
{
  "success": true,
  "attachments": [
    {
      "id": 1,
      "ticket_id": 1,
      "filename": "screenshot.png",
      "original_name": "screenshot.png",
      "mime_type": "image/png",
      "size": 102400,
      "uploaded_by": 1,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### Upload Attachment to Ticket

**Endpoint:** `POST /api/tickets/:id/attachments`
**Auth Required:** Yes
**Content-Type:** `multipart/form-data`

**Request Body:**
- `file`: File (required, max 10MB)

**Success Response (201):**
```json
{
  "success": true,
  "attachment": {
    "id": 1,
    "ticket_id": 1,
    "filename": "screenshot.png",
    "original_name": "screenshot.png",
    "mime_type": "image/png",
    "size": 102400,
    "uploaded_by": 1,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: No file, file too large, invalid file type
- `413 Payload Too Large`: File exceeds size limit

---

## Comments

### Create Comment

**Endpoint:** `POST /api/comments`
**Auth Required:** Yes

**Request Body:**
```json
{
  "ticket_id": "number (required)",
  "content": "string (required, max 5000 chars)",
  "is_internal": "boolean (optional, default: false)"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "comment": { /* comment object */ }
}
```

---

## Attachments

### Get Attachment

**Endpoint:** `GET /api/attachments/:id`
**Auth Required:** Yes

**Success Response (200):**
- Returns the file binary data
- Content-Type header set to file's MIME type
- Content-Disposition header set for download

**Error Responses:**
- `404 Not Found`: Attachment not found or no permission

---

### Delete Attachment

**Endpoint:** `DELETE /api/attachments/:id`
**Auth Required:** Yes

**Success Response (200):**
```json
{
  "success": true,
  "message": "Attachment deleted successfully"
}
```

**Notes:**
- Only the uploader or agents/admins can delete attachments

---

## Users & Admin

### List Users (Admin)

**Endpoint:** `GET /api/admin/users`
**Auth Required:** Yes (Admin/Agent role)

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 10)
- `role`: string (filter by role)
- `is_active`: boolean (filter by active status)

**Success Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "tenant_id": 1,
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

**Error Responses:**
- `403 Forbidden`: Insufficient permissions

---

### Get User by ID (Admin)

**Endpoint:** `GET /api/admin/users/:id`
**Auth Required:** Yes (Admin/Agent role)

**Success Response (200):**
```json
{
  "success": true,
  "user": { /* full user object */ }
}
```

---

### Update User (Admin)

**Endpoint:** `PATCH /api/admin/users/:id`
**Auth Required:** Yes (Admin role)

**Request Body (all optional):**
```json
{
  "name": "string",
  "role": "string (user|agent|admin)",
  "is_active": "boolean",
  "job_title": "string",
  "department": "string"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": { /* updated user object */ }
}
```

---

### Delete User (Admin)

**Endpoint:** `DELETE /api/admin/users/:id`
**Auth Required:** Yes (Admin role)

**Success Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Notes:**
- Soft delete (sets `is_active` to false)

---

### Get Admin Stats

**Endpoint:** `GET /api/admin/stats`
**Auth Required:** Yes (Admin/Agent role)

**Success Response (200):**
```json
{
  "success": true,
  "stats": {
    "total_tickets": 150,
    "open_tickets": 45,
    "closed_tickets": 105,
    "total_users": 50,
    "active_agents": 5,
    "avg_resolution_time_hours": 24.5,
    "sla_compliance_rate": 0.92
  }
}
```

---

## Reference Data

### Get Categories

**Endpoint:** `GET /api/categories`
**Auth Required:** No (Public)

**Success Response (200):**
```json
{
  "categories": [
    {
      "id": 1,
      "name": "Technical Support",
      "description": "Hardware and software issues",
      "color": "#3B82F6",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### Get Priorities

**Endpoint:** `GET /api/priorities`
**Auth Required:** No (Public)

**Success Response (200):**
```json
{
  "priorities": [
    {
      "id": 1,
      "name": "Baixa",
      "level": 1,
      "color": "#22C55E",
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": 2,
      "name": "Média",
      "level": 2,
      "color": "#EAB308",
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": 3,
      "name": "Alta",
      "level": 3,
      "color": "#F97316",
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": 4,
      "name": "Crítica",
      "level": 4,
      "color": "#EF4444",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### Get Statuses

**Endpoint:** `GET /api/statuses`
**Auth Required:** No (Public)

**Success Response (200):**
```json
{
  "statuses": [
    {
      "id": 1,
      "name": "Novo",
      "description": "Ticket criado",
      "color": "#3B82F6",
      "is_final": false,
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": 2,
      "name": "Em Progresso",
      "color": "#EAB308",
      "is_final": false
    },
    {
      "id": 3,
      "name": "Resolvido",
      "color": "#22C55E",
      "is_final": true
    }
  ]
}
```

---

### Get Ticket Types

**Endpoint:** `GET /api/ticket-types`
**Auth Required:** No (Public)

**Success Response (200):**
```json
{
  "ticketTypes": [
    {
      "id": 1,
      "name": "Incident",
      "description": "Service interruption or issue",
      "icon": "exclamation-circle"
    }
  ]
}
```

---

## Notifications

### Get Notifications

**Endpoint:** `GET /api/notifications`
**Auth Required:** Yes

**Query Parameters:**
- `unread_only`: boolean (default: false)
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Success Response (200):**
```json
{
  "success": true,
  "notifications": [
    {
      "id": 1,
      "user_id": 1,
      "title": "New comment on your ticket",
      "message": "Agent John replied to your ticket #123",
      "type": "comment",
      "is_read": false,
      "ticket_id": 123,
      "ticket_title": "Login issue",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "unread": 5,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### Get Unread Count

**Endpoint:** `GET /api/notifications/unread`
**Auth Required:** Yes

**Success Response (200):**
```json
{
  "count": 5
}
```

---

### Mark Notification as Read

**Endpoint:** `PUT /api/notifications`
**Auth Required:** Yes

**Request Body:**
```json
{
  "notification_id": 1
}
```

**Success Response (200):**
```json
{
  "message": "Notificação marcada como lida"
}
```

---

### Mark All Notifications as Read

**Endpoint:** `PUT /api/notifications`
**Auth Required:** Yes

**Request Body:**
```json
{
  "mark_all_read": true
}
```

**Success Response (200):**
```json
{
  "message": "25 notificações marcadas como lidas"
}
```

---

## Knowledge Base

### Search Knowledge Base

**Endpoint:** `GET /api/knowledge/search`
**Auth Required:** No (Public)

**Query Parameters:**
- `q`: string (required, min 2 chars)
- `category`: string (optional, filter by category slug)
- `tags`: string (optional, comma-separated tags)
- `mode`: string (optional, values: `semantic`, `keyword`, `hybrid`, default: `hybrid`)
- `limit`: number (optional, default: 10)
- `offset`: number (optional, default: 0)

**Success Response (200):**
```json
{
  "success": true,
  "query": "login",
  "mode": "hybrid",
  "results": [
    {
      "id": 1,
      "title": "How to reset your password",
      "slug": "how-to-reset-password",
      "summary": "Step-by-step guide to reset your password",
      "category": {
        "name": "Account Management",
        "slug": "account-management",
        "color": "#3B82F6"
      },
      "score": 0.95,
      "matchType": "semantic",
      "highlights": ["password", "reset"]
    }
  ],
  "categorySuggestions": [
    {
      "name": "Account Management",
      "slug": "account-management",
      "icon": "user",
      "color": "#3B82F6"
    }
  ],
  "suggestions": ["password reset", "login issues", "forgot password"],
  "facets": {
    "categories": [
      { "id": 1, "count": 5 }
    ],
    "tags": [
      { "tag": "authentication", "count": 3 }
    ]
  },
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 15
  }
}
```

---

### Track Search Click

**Endpoint:** `POST /api/knowledge/search`
**Auth Required:** No

**Request Body:**
```json
{
  "query": "string (required)",
  "articleId": "number (required)",
  "position": "number (optional, click position in results)",
  "userId": "number (optional)"
}
```

**Success Response (200):**
```json
{
  "success": true
}
```

---

### Get Knowledge Categories

**Endpoint:** `GET /api/knowledge/categories`
**Auth Required:** No

**Success Response (200):**
```json
{
  "categories": [
    {
      "id": 1,
      "name": "Getting Started",
      "slug": "getting-started",
      "description": "Basic guides for new users",
      "icon": "rocket",
      "color": "#3B82F6",
      "article_count": 15
    }
  ]
}
```

---

### Get Knowledge Articles

**Endpoint:** `GET /api/knowledge/articles`
**Auth Required:** No

**Query Parameters:**
- `category`: string (filter by category slug)
- `limit`: number (default: 20)
- `offset`: number (default: 0)

**Success Response (200):**
```json
{
  "articles": [
    {
      "id": 1,
      "title": "Getting Started Guide",
      "slug": "getting-started-guide",
      "summary": "Learn the basics of ServiceDesk",
      "category_name": "Getting Started",
      "view_count": 150,
      "helpful_votes": 25,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 45
  }
}
```

---

### Get Article by Slug

**Endpoint:** `GET /api/knowledge/articles/:slug`
**Auth Required:** No

**Success Response (200):**
```json
{
  "article": {
    "id": 1,
    "title": "Getting Started Guide",
    "slug": "getting-started-guide",
    "content": "Full article content in HTML/Markdown",
    "summary": "Learn the basics",
    "category_name": "Getting Started",
    "category_slug": "getting-started",
    "tags": ["tutorial", "beginner"],
    "view_count": 150,
    "helpful_votes": 25,
    "not_helpful_votes": 2,
    "author_name": "Jane Doe",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-02T00:00:00Z"
  }
}
```

---

### Vote on Article

**Endpoint:** `POST /api/knowledge/articles/:slug/feedback`
**Auth Required:** No

**Request Body:**
```json
{
  "helpful": true
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Feedback recorded"
}
```

---

## Analytics

### Get Overview Analytics

**Endpoint:** `GET /api/analytics/overview`
**Auth Required:** Yes

**Query Parameters:**
- `start_date`: ISO date string (optional)
- `end_date`: ISO date string (optional)

**Success Response (200):**
```json
{
  "overview": {
    "total_tickets": 150,
    "open_tickets": 45,
    "resolved_tickets": 105,
    "avg_resolution_time_hours": 24.5,
    "ticket_trend": [
      { "date": "2025-01-01", "count": 10 },
      { "date": "2025-01-02", "count": 15 }
    ]
  }
}
```

---

### Get Knowledge Base Analytics

**Endpoint:** `GET /api/analytics/knowledge`
**Auth Required:** Yes (Admin/Agent)

**Success Response (200):**
```json
{
  "analytics": {
    "total_articles": 45,
    "total_views": 1500,
    "total_searches": 500,
    "top_articles": [
      {
        "id": 1,
        "title": "Getting Started",
        "view_count": 150,
        "helpful_votes": 25
      }
    ],
    "top_searches": [
      { "query": "password reset", "count": 50 }
    ]
  }
}
```

---

### Get Realtime Metrics

**Endpoint:** `GET /api/analytics/realtime`
**Auth Required:** Yes (Admin/Agent)

**Success Response (200):**
```json
{
  "metrics": {
    "online_users": 15,
    "active_tickets": 45,
    "recent_activity": [
      {
        "type": "ticket_created",
        "timestamp": "2025-01-01T12:00:00Z",
        "user": "John Doe"
      }
    ]
  }
}
```

---

## Teams

### List Teams

**Endpoint:** `GET /api/teams`
**Auth Required:** Yes (Admin)

**Success Response (200):**
```json
{
  "teams": [
    {
      "id": 1,
      "name": "Support Team",
      "description": "Level 1 support",
      "member_count": 5,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### Get Team Details

**Endpoint:** `GET /api/teams/:id`
**Auth Required:** Yes (Admin)

**Success Response (200):**
```json
{
  "team": {
    "id": 1,
    "name": "Support Team",
    "description": "Level 1 support",
    "members": [
      {
        "id": 1,
        "name": "John Doe",
        "role": "agent",
        "joined_at": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

### Get Team Members

**Endpoint:** `GET /api/teams/:id/members`
**Auth Required:** Yes (Admin)

**Success Response (200):**
```json
{
  "members": [
    {
      "user_id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "agent"
    }
  ]
}
```

---

## SLA

### List SLA Policies

**Endpoint:** `GET /api/sla`
**Auth Required:** Yes (Admin)

**Success Response (200):**
```json
{
  "policies": [
    {
      "id": 1,
      "name": "High Priority SLA",
      "priority_id": 3,
      "response_time_hours": 4,
      "resolution_time_hours": 24,
      "is_active": true
    }
  ]
}
```

---

### Get SLA Tracking for Tickets

**Endpoint:** `GET /api/sla/tickets`
**Auth Required:** Yes (Admin/Agent)

**Success Response (200):**
```json
{
  "sla_tracking": [
    {
      "ticket_id": 1,
      "policy_name": "High Priority SLA",
      "response_due_at": "2025-01-01T16:00:00Z",
      "resolution_due_at": "2025-01-02T12:00:00Z",
      "response_breached": false,
      "resolution_breached": false
    }
  ]
}
```

---

## Templates

### Get Templates

**Endpoint:** `GET /api/admin/templates`
**Auth Required:** Yes (Agent/Admin)

**Success Response (200):**
```json
{
  "templates": [
    {
      "id": 1,
      "name": "Password Reset Response",
      "type": "response",
      "content_template": "Hello {{user_name}}, ...",
      "usage_count": 50,
      "last_used_at": "2025-01-01T12:00:00Z"
    }
  ]
}
```

---

### Apply Template

**Endpoint:** `POST /api/templates/apply`
**Auth Required:** Yes

**Request Body:**
```json
{
  "template_id": 1,
  "variables": {
    "user_name": "John",
    "ticket_number": 123
  }
}
```

**Success Response (200):**
```json
{
  "content": "Hello John, regarding ticket #123..."
}
```

---

## Workflows

### List Workflow Definitions

**Endpoint:** `GET /api/workflows/definitions`
**Auth Required:** Yes (Admin)

**Success Response (200):**
```json
{
  "workflows": [
    {
      "id": 1,
      "name": "Auto-assign tickets",
      "description": "Automatically assign tickets based on category",
      "trigger_type": "ticket_created",
      "is_active": true
    }
  ]
}
```

---

### Get Workflow Details

**Endpoint:** `GET /api/workflows/definitions/:id`
**Auth Required:** Yes (Admin)

**Success Response (200):**
```json
{
  "workflow": {
    "id": 1,
    "name": "Auto-assign tickets",
    "trigger_conditions": {},
    "steps_json": [],
    "is_active": true
  }
}
```

---

### Execute Workflow Manually

**Endpoint:** `POST /api/workflows/execute`
**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "workflow_id": 1,
  "entity_type": "ticket",
  "entity_id": 123
}
```

**Success Response (200):**
```json
{
  "execution_id": 1,
  "status": "running"
}
```

---

## Integrations

### WhatsApp - Send Message

**Endpoint:** `POST /api/integrations/whatsapp/send`
**Auth Required:** Yes (Agent/Admin)

**Request Body:**
```json
{
  "phone_number": "+5511999999999",
  "message": "Your ticket has been updated"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message_id": "wamid.XXX"
}
```

---

### WhatsApp - Get Contacts

**Endpoint:** `GET /api/integrations/whatsapp/contacts`
**Auth Required:** Yes (Agent/Admin)

**Success Response (200):**
```json
{
  "contacts": [
    {
      "id": 1,
      "phone_number": "+5511999999999",
      "display_name": "John Doe",
      "is_business": false
    }
  ]
}
```

---

### WhatsApp - Webhook

**Endpoint:** `POST /api/integrations/whatsapp/webhook`
**Auth Required:** No (Webhook signature validation)

**Notes:**
- Receives incoming WhatsApp messages
- Validates webhook signature
- Processes messages and creates tickets

---

### Gov.br - OAuth Callback

**Endpoint:** `GET /api/auth/govbr/callback`
**Auth Required:** No

**Query Parameters:**
- `code`: Authorization code from Gov.br
- `state`: CSRF token

**Success Response (302):**
- Redirects to dashboard with session cookie

---

## AI Features

### Classify Ticket

**Endpoint:** `POST /api/ai/classify-ticket`
**Auth Required:** Yes (Agent/Admin)

**Request Body:**
```json
{
  "ticket_id": 1
}
```

**Success Response (200):**
```json
{
  "classification": {
    "suggested_category_id": 1,
    "suggested_priority_id": 3,
    "confidence_score": 0.92,
    "reasoning": "Based on keywords and urgency indicators"
  }
}
```

---

### Suggest Solutions

**Endpoint:** `POST /api/ai/suggest-solutions`
**Auth Required:** Yes

**Request Body:**
```json
{
  "ticket_id": 1
}
```

**Success Response (200):**
```json
{
  "suggestions": [
    {
      "content": "Try resetting your password using the forgot password link",
      "confidence_score": 0.88,
      "source_type": "knowledge_base",
      "source_references": [1, 5]
    }
  ]
}
```

---

### Generate Response

**Endpoint:** `POST /api/ai/generate-response`
**Auth Required:** Yes (Agent/Admin)

**Request Body:**
```json
{
  "ticket_id": 1,
  "context": "User is asking about password reset"
}
```

**Success Response (200):**
```json
{
  "response": "Hello! To reset your password, please follow these steps: ..."
}
```

---

### Analyze Sentiment

**Endpoint:** `POST /api/ai/analyze-sentiment`
**Auth Required:** Yes (Agent/Admin)

**Request Body:**
```json
{
  "text": "I'm very frustrated with this system!"
}
```

**Success Response (200):**
```json
{
  "sentiment": "negative",
  "score": -0.75,
  "emotion": "frustration"
}
```

---

### Detect Duplicate Tickets

**Endpoint:** `POST /api/ai/detect-duplicates`
**Auth Required:** Yes (Agent/Admin)

**Request Body:**
```json
{
  "ticket_id": 1
}
```

**Success Response (200):**
```json
{
  "duplicates": [
    {
      "ticket_id": 45,
      "similarity_score": 0.92,
      "title": "Cannot login to system"
    }
  ]
}
```

---

## Error Codes

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request successful, no response body |
| 400 | Bad Request | Invalid request parameters or body |
| 401 | Unauthorized | Authentication required or failed |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 413 | Payload Too Large | Request body too large |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE" // Optional
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `TENANT_NOT_FOUND` | Tenant context not found |
| `INVALID_CREDENTIALS` | Login credentials are incorrect |
| `EMAIL_ALREADY_EXISTS` | Email already registered |
| `WEAK_PASSWORD` | Password doesn't meet requirements |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INVALID_TOKEN` | JWT token is invalid or expired |
| `PERMISSION_DENIED` | User lacks required permissions |
| `RESOURCE_NOT_FOUND` | Requested resource doesn't exist |
| `VALIDATION_ERROR` | Request validation failed |
| `FILE_TOO_LARGE` | Uploaded file exceeds size limit |

---

## Rate Limiting

### Limits by Endpoint

| Endpoint | Limit |
|----------|-------|
| `/api/auth/login` | 5 requests per minute per IP |
| `/api/auth/register` | 10 requests per hour per IP |
| `/api/auth/change-password` | 3 requests per hour per user |
| All other endpoints | 100 requests per minute per user |

### Rate Limit Headers

Response headers indicate rate limit status:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

When rate limit is exceeded:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```

---

## Authentication

### JWT Token

All authenticated requests must include a JWT token in one of these formats:

**Authorization Header (Recommended):**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Cookie (Automatically set by login):**
```
Cookie: auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Payload

```json
{
  "user_id": 1,
  "tenant_id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "tenant_slug": "empresa-demo",
  "iat": 1640000000,
  "exp": 1640028800
}
```

### Token Expiry

- Access tokens expire after 8 hours
- Refresh tokens (if implemented) expire after 30 days

---

## Pagination

List endpoints support pagination with these query parameters:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

Response includes pagination metadata:

```json
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "pages": 15,
    "hasMore": true
  }
}
```

---

## CORS

The API supports CORS with these headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Webhooks

### Webhook Events

Subscribe to these events:

- `ticket.created`
- `ticket.updated`
- `ticket.resolved`
- `comment.created`
- `sla.breached`
- `user.created`

### Webhook Payload Format

```json
{
  "event": "ticket.created",
  "timestamp": "2025-01-01T12:00:00Z",
  "data": {
    "ticket_id": 1,
    "title": "Login issue",
    "user_id": 1
  }
}
```

### Webhook Security

All webhooks include:

- `X-Webhook-Signature` header (HMAC-SHA256)
- Timestamp verification
- Retry mechanism (3 attempts)

---

## SDK & Libraries

### Official SDKs

Coming soon:
- JavaScript/TypeScript SDK
- Python SDK
- PHP SDK

### Example Code

**JavaScript (Fetch API):**

```javascript
const response = await fetch('http://localhost:4000/api/tickets', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

**cURL:**

```bash
curl -X GET http://localhost:4000/api/tickets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

## Versioning

Current API version: **v1**

Future versions will be accessible via:
- URL: `/api/v2/tickets`
- Header: `API-Version: 2`

---

## Support

For API support:
- Documentation: This file
- Issues: GitHub Issues
- Email: support@servicedesk.com

---

**Last Updated:** 2025-01-05
**API Version:** 1.0.0
