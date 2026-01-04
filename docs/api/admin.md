# Admin API Endpoints

## Overview

Admin endpoints provide privileged access to system management functions including user management, ticket administration, analytics, and configuration.

## Authentication

**Required**: Bearer token in Authorization header

**Note**: Unlike regular endpoints that accept httpOnly cookies, admin endpoints require explicit Bearer token authentication.

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Required Roles

Most admin endpoints require one of these roles:
- `super_admin`: Full system access across all tenants
- `tenant_admin`: Full access within their organization
- `team_manager`: Team management and oversight
- `agent`: Ticket and user management
- `user`: Limited access (create tickets, view own data)

## Endpoints

### Ticket Management

#### GET /api/admin/tickets/{id}

Retrieve ticket details with admin privileges.

**Required Roles**: admin, agent

**Request**:
```http
GET /api/admin/tickets/123
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response** (200 OK):
```json
{
  "ticket": {
    "id": 123,
    "title": "Computador não liga",
    "description": "O computador da sala 203 não está ligando",
    "user_id": 5,
    "assigned_to": 10,
    "category_id": 3,
    "priority_id": 2,
    "status_id": 1,
    "created_at": "2025-01-20T09:15:00Z",
    "updated_at": "2025-01-20T10:30:00Z"
  }
}
```

**Errors**:
- 401: Invalid or missing token
- 403: Insufficient permissions (not admin/agent)
- 404: Ticket not found

---

#### PUT /api/admin/tickets/{id}

Update ticket with full admin capabilities (including assignment).

**Required Roles**: admin, agent

**Request**:
```http
PUT /api/admin/tickets/123
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "title": "Computador não liga - URGENTE",
  "description": "O computador da sala 203 não está ligando após queda de energia",
  "category_id": 3,
  "priority_id": 1,
  "status_id": 2,
  "assigned_to": 10
}
```

**Body Parameters**:
- `title` (string): Ticket title
- `description` (string): Description
- `category_id` (integer): Category ID
- `priority_id` (integer): Priority ID
- `status_id` (integer): Status ID
- `assigned_to` (integer|null): Agent ID (null to unassign)

**Response** (200 OK):
```json
{
  "ticket": {
    "id": 123,
    "title": "Computador não liga - URGENTE",
    "assigned_to": 10,
    ...
  }
}
```

**Validation**:
- Title cannot be empty
- Description cannot be empty
- Category/priority/status must exist in tenant

---

#### DELETE /api/admin/tickets/{id}

Permanently delete a ticket (admin only - cannot be undone).

**Required Roles**: admin (super_admin, tenant_admin only)

**Request**:
```http
DELETE /api/admin/tickets/123
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response** (200 OK):
```json
{
  "message": "Ticket deletado com sucesso"
}
```

**Errors**:
- 401: Invalid token
- 403: Forbidden (agents cannot delete, only admins)
- 404: Ticket not found
- 500: Deletion failed

---

### User Management

#### GET /api/admin/users

List all users in the tenant organization.

**Required Roles**: admin, agent

**Request**:
```http
GET /api/admin/users
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response** (200 OK):
```json
{
  "users": [
    {
      "id": 1,
      "name": "Admin User",
      "email": "admin@empresa.com",
      "role": "tenant_admin",
      "organization_id": 1,
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z",
      "last_login_at": "2025-01-20T10:00:00Z"
    },
    ...
  ]
}
```

---

#### GET /api/admin/users/{id}

Get user details by ID.

**Required Roles**: admin, agent

**Request**:
```http
GET /api/admin/users/5
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response** (200 OK):
```json
{
  "user": {
    "id": 5,
    "name": "João Silva",
    "email": "joao.silva@empresa.com",
    "role": "user",
    "organization_id": 1,
    "job_title": "Analista de TI",
    "department": "Tecnologia",
    "phone": "+55 11 98765-4321",
    "is_active": true,
    "created_at": "2025-01-15T10:00:00Z",
    "last_login_at": "2025-01-20T09:30:00Z"
  }
}
```

---

#### PUT /api/admin/users/{id}

Update user properties (admin only).

**Required Roles**: admin

**Request**:
```http
PUT /api/admin/users/5
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "João da Silva",
  "email": "joao.dasilva@empresa.com",
  "role": "agent",
  "is_active": true,
  "job_title": "Analista de TI Sênior"
}
```

**Body Parameters**:
- `name` (string): Full name
- `email` (string): Email address
- `role` (string): super_admin|tenant_admin|team_manager|agent|user
- `is_active` (boolean): Account active status
- `job_title` (string): Job title
- `department` (string): Department
- `phone` (string): Phone number

**Response** (200 OK):
```json
{
  "user": {
    "id": 5,
    "name": "João da Silva",
    "role": "agent",
    ...
  }
}
```

**Security Notes**:
- Only admins can change roles
- Cannot change own role to prevent privilege escalation
- Email must be unique within organization

---

### Analytics & Reports

#### GET /api/admin/stats

Get dashboard statistics for the organization.

**Required Roles**: admin, agent, team_manager

**Request**:
```http
GET /api/admin/stats
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response** (200 OK):
```json
{
  "tickets": {
    "total": 1234,
    "open": 45,
    "in_progress": 23,
    "resolved": 1150,
    "closed": 16
  },
  "users": {
    "total": 156,
    "active": 142,
    "agents": 12
  },
  "sla": {
    "compliance_rate": 94.5,
    "breaches_today": 2,
    "at_risk": 5
  },
  "avg_resolution_time_hours": 4.2
}
```

---

#### GET /api/admin/reports

Generate custom reports (admin only).

**Required Roles**: admin

**Request**:
```http
GET /api/admin/reports?type=sla&start_date=2025-01-01&end_date=2025-01-31
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Query Parameters**:
- `type` (required): sla|performance|satisfaction|category
- `start_date` (required): YYYY-MM-DD
- `end_date` (required): YYYY-MM-DD
- `format` (optional): json|csv|pdf (default: json)

**Response** (200 OK):
```json
{
  "report_type": "sla",
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "data": [
    {
      "date": "2025-01-01",
      "tickets_created": 45,
      "tickets_met_sla": 42,
      "tickets_breached": 3,
      "compliance_percentage": 93.3
    },
    ...
  ],
  "summary": {
    "total_tickets": 1234,
    "avg_compliance": 94.5,
    "total_breaches": 68
  }
}
```

---

### SLA Management

#### GET /api/admin/sla

List all SLA policies.

**Required Roles**: admin

**Request**:
```http
GET /api/admin/sla
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response** (200 OK):
```json
{
  "policies": [
    {
      "id": 1,
      "name": "Critical Incident SLA",
      "priority_id": 1,
      "response_time_minutes": 15,
      "resolution_time_hours": 4,
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z"
    },
    ...
  ]
}
```

---

#### POST /api/admin/sla

Create a new SLA policy.

**Required Roles**: admin

**Request**:
```http
POST /api/admin/sla
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "High Priority SLA",
  "priority_id": 2,
  "ticket_type_id": 1,
  "response_time_minutes": 60,
  "resolution_time_hours": 8,
  "business_hours_only": true,
  "is_active": true
}
```

**Body Parameters**:
- `name` (required, string): Policy name
- `priority_id` (required, integer): Priority level
- `ticket_type_id` (optional, integer): Ticket type (null = all types)
- `response_time_minutes` (required, integer): First response SLA (minutes)
- `resolution_time_hours` (required, integer): Resolution SLA (hours)
- `business_hours_only` (optional, boolean, default: false): Count only business hours
- `is_active` (optional, boolean, default: true): Active status

**Response** (201 Created):
```json
{
  "policy": {
    "id": 5,
    "name": "High Priority SLA",
    "priority_id": 2,
    ...
  }
}
```

---

#### PUT /api/admin/sla/{id}

Update an existing SLA policy.

**Required Roles**: admin

**Request**:
```http
PUT /api/admin/sla/5
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "response_time_minutes": 30,
  "resolution_time_hours": 6
}
```

**Response** (200 OK):
```json
{
  "policy": {
    "id": 5,
    "response_time_minutes": 30,
    "resolution_time_hours": 6,
    ...
  }
}
```

---

#### DELETE /api/admin/sla/{id}

Delete an SLA policy (admin only).

**Required Roles**: admin

**Request**:
```http
DELETE /api/admin/sla/5
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response** (200 OK):
```json
{
  "message": "SLA policy deleted successfully"
}
```

---

### Settings & Configuration

#### GET /api/admin/settings

Get system settings for the organization.

**Required Roles**: admin

**Request**:
```http
GET /api/admin/settings
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response** (200 OK):
```json
{
  "settings": {
    "organization_name": "Empresa Demo",
    "support_email": "suporte@empresa.com",
    "business_hours": {
      "start": "09:00",
      "end": "18:00",
      "timezone": "America/Sao_Paulo",
      "working_days": [1, 2, 3, 4, 5]
    },
    "notifications": {
      "email_enabled": true,
      "sms_enabled": false,
      "push_enabled": true
    },
    "ticket_settings": {
      "auto_assign": true,
      "require_category": true,
      "allow_user_close": false
    }
  }
}
```

---

#### PUT /api/admin/settings

Update system settings.

**Required Roles**: admin

**Request**:
```http
PUT /api/admin/settings
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "organization_name": "Empresa Demo S.A.",
  "support_email": "support@empresa.com",
  "business_hours": {
    "start": "08:00",
    "end": "18:00"
  }
}
```

**Response** (200 OK):
```json
{
  "settings": {
    "organization_name": "Empresa Demo S.A.",
    ...
  },
  "message": "Settings updated successfully"
}
```

---

### Templates

#### GET /api/admin/templates

List ticket templates.

**Required Roles**: admin, agent

**Request**:
```http
GET /api/admin/templates
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response** (200 OK):
```json
{
  "templates": [
    {
      "id": 1,
      "name": "Password Reset",
      "category_id": 1,
      "priority_id": 3,
      "description_template": "User {{user_name}} requests password reset for account {{email}}",
      "is_active": true
    },
    ...
  ]
}
```

---

### Audit Logs

#### GET /api/admin/audit

Query audit logs for security and compliance.

**Required Roles**: admin

**Request**:
```http
GET /api/admin/audit?start_date=2025-01-01&end_date=2025-01-31&user_id=5
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Query Parameters**:
- `start_date` (optional): Filter from date (YYYY-MM-DD)
- `end_date` (optional): Filter to date (YYYY-MM-DD)
- `user_id` (optional): Filter by user ID
- `entity_type` (optional): Filter by entity (user|ticket|sla)
- `action` (optional): Filter by action (create|update|delete|login)
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50): Items per page

**Response** (200 OK):
```json
{
  "logs": [
    {
      "id": 12345,
      "organization_id": 1,
      "user_id": 5,
      "entity_type": "ticket",
      "entity_id": 123,
      "action": "update",
      "old_values": {"status_id": 1},
      "new_values": {"status_id": 2},
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2025-01-20T10:30:00Z"
    },
    ...
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "pages": 5
  }
}
```

**Logged Actions**:
- `login`: User authentication
- `register`: User registration
- `create`: Entity creation
- `update`: Entity modification
- `delete`: Entity deletion
- `assign`: Ticket assignment
- `resolve`: Ticket resolution

---

## Role-Based Access Control (RBAC)

### Role Hierarchy

```
super_admin (highest)
  └─ Full access to all tenants
  └─ Create/modify/delete any resource
  └─ System configuration

tenant_admin
  └─ Full access within organization
  └─ User and role management
  └─ Settings and configuration
  └─ Cannot access other tenants

team_manager
  └─ Manage team members
  └─ View team performance
  └─ Assign tickets to team
  └─ Limited admin functions

agent
  └─ Ticket management
  └─ View all tickets in organization
  └─ Cannot manage users or settings
  └─ Cannot delete tickets

user (lowest)
  └─ Create tickets
  └─ View own tickets
  └─ Update own tickets
  └─ No admin access
```

### Permission Matrix

| Action | User | Agent | Team Manager | Tenant Admin | Super Admin |
|--------|------|-------|--------------|--------------|-------------|
| Create ticket | ✓ | ✓ | ✓ | ✓ | ✓ |
| View own tickets | ✓ | ✓ | ✓ | ✓ | ✓ |
| View all tickets | ✗ | ✓ | ✓ | ✓ | ✓ |
| Update any ticket | ✗ | ✓ | ✓ | ✓ | ✓ |
| Delete ticket | ✗ | ✗ | ✗ | ✓ | ✓ |
| Manage users | ✗ | ✗ | Team only | ✓ | ✓ |
| Change user roles | ✗ | ✗ | ✗ | ✓ | ✓ |
| SLA management | ✗ | ✗ | ✗ | ✓ | ✓ |
| View audit logs | ✗ | ✗ | ✗ | ✓ | ✓ |
| Settings | ✗ | ✗ | ✗ | ✓ | ✓ |
| Cross-tenant access | ✗ | ✗ | ✗ | ✗ | ✓ |

---

## Best Practices

### Authentication

1. **Use Bearer tokens** for admin endpoints (not cookies)
2. **Store tokens securely** (never in localStorage for web apps)
3. **Rotate tokens regularly** (re-authenticate periodically)
4. **Validate permissions** on client side before API calls
5. **Handle 403 errors** gracefully (redirect to access denied page)

### User Management

1. **Never change your own role** to prevent privilege escalation
2. **Audit all role changes** (automatically logged)
3. **Deactivate users** instead of deleting when possible
4. **Verify email uniqueness** before updates
5. **Use pagination** for large user lists

### Ticket Management

1. **Use PATCH** for partial updates (POST /api/tickets/[id])
2. **Use PUT** only in admin endpoints (full updates)
3. **Validate tenant isolation** (queries automatically filter)
4. **Log all admin actions** (automatic via middleware)
5. **Soft delete** preferred over hard delete

### Reporting & Analytics

1. **Cache report results** when possible
2. **Use date range limits** to prevent performance issues
3. **Export large datasets** as CSV/PDF instead of JSON
4. **Schedule heavy reports** during off-peak hours
5. **Implement result pagination** for large datasets

### Security

1. **Never log sensitive data** (passwords, tokens, personal info)
2. **Validate all input** on server side
3. **Use parameterized queries** (already implemented)
4. **Audit privileged actions** (automatic)
5. **Monitor failed authentication** attempts
6. **Implement IP allowlisting** for super admin access (optional)

---

## Error Codes

| Code | HTTP Status | Description | Action |
|------|-------------|-------------|--------|
| INVALID_TOKEN | 401 | Missing or invalid Bearer token | Re-authenticate |
| INSUFFICIENT_PERMISSIONS | 403 | User lacks required role | Show access denied |
| RESOURCE_NOT_FOUND | 404 | Entity not found | Show not found message |
| VALIDATION_ERROR | 400 | Input validation failed | Show field errors |
| DUPLICATE_RESOURCE | 409 | Resource already exists | Update instead of create |
| TENANT_ISOLATION_ERROR | 403 | Cross-tenant access attempt | Log security event |

---

## Example Implementation

### JavaScript Admin Client

```javascript
class ServiceDeskAdminAPI {
  constructor(baseURL, accessToken) {
    this.baseURL = baseURL;
    this.accessToken = accessToken;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // User management
  async listUsers() {
    return this.request('/api/admin/users');
  }

  async updateUser(userId, userData) {
    return this.request(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }

  // Ticket management
  async getTicket(ticketId) {
    return this.request(`/api/admin/tickets/${ticketId}`);
  }

  async deleteTicket(ticketId) {
    return this.request(`/api/admin/tickets/${ticketId}`, {
      method: 'DELETE'
    });
  }

  // Analytics
  async getStats() {
    return this.request('/api/admin/stats');
  }

  async generateReport(type, startDate, endDate) {
    return this.request(
      `/api/admin/reports?type=${type}&start_date=${startDate}&end_date=${endDate}`
    );
  }

  // SLA management
  async createSLAPolicy(policyData) {
    return this.request('/api/admin/sla', {
      method: 'POST',
      body: JSON.stringify(policyData)
    });
  }
}

// Usage
const adminAPI = new ServiceDeskAdminAPI(
  'http://localhost:3000',
  'your-bearer-token'
);

try {
  const users = await adminAPI.listUsers();
  console.log('Users:', users);

  const stats = await adminAPI.getStats();
  console.log('Dashboard stats:', stats);
} catch (error) {
  console.error('Admin API error:', error);
}
```
