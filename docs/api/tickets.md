# Tickets API

## Overview

The Tickets API provides comprehensive ticket management with ITIL workflow support, multi-tenant isolation, and role-based access control.

## Supported Ticket Types

1. **Incident** (ticket_type_id: 1): Unplanned service interruptions
2. **Request** (ticket_type_id: 2): Service requests and fulfillment
3. **Change** (ticket_type_id: 3): Change management
4. **Problem** (ticket_type_id: 4): Root cause analysis

## Access Control

- **Admins/Agents**: View and manage all tickets in their organization
- **Regular Users**: View and manage only their own tickets
- **Team Managers**: View tickets assigned to their team

## Endpoints

### GET /api/tickets

Retrieve a paginated list of tickets with tenant isolation.

**Authentication**: Required (cookie or Bearer token)

**Rate Limit**: 100 requests per 15 minutes

#### Request

```http
GET /api/tickets?page=1&limit=10
Cookie: auth_token=...
```

**Query Parameters**:
- `page` (optional, integer, default: 1): Page number
- `limit` (optional, integer, default: 10, max: 100): Items per page

#### Response: Success (200 OK)

```json
{
  "success": true,
  "tickets": [
    {
      "id": 123,
      "title": "Computador não liga",
      "description": "O computador da sala 203 não está ligando",
      "created_at": "2025-01-20T09:15:00Z",
      "updated_at": "2025-01-20T10:30:00Z",
      "status": "Novo",
      "priority": "High",
      "category": "Hardware",
      "user_name": "Maria Santos"
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

#### Example with cURL

```bash
curl -X GET "http://localhost:3000/api/tickets?page=1&limit=10" \
  -b cookies.txt
```

#### Example with JavaScript

```javascript
const response = await fetch('/api/tickets?page=1&limit=10', {
  credentials: 'include'
});

const data = await response.json();
console.log(`Found ${data.pagination.total} tickets`);
```

---

### POST /api/tickets

Create a new ticket (simple version without workflow processing).

**Authentication**: Required

**Rate Limit**: 100 requests per 15 minutes

#### Request

```http
POST /api/tickets
Content-Type: application/json
Cookie: auth_token=...

{
  "title": "Problema com email",
  "description": "Não consigo enviar emails desde hoje de manhã",
  "category_id": 1,
  "priority_id": 2
}
```

**Body Parameters**:
- `title` (required, string): Ticket title
- `description` (required, string): Detailed description
- `category_id` (required, integer): Category ID (must belong to tenant)
- `priority_id` (required, integer): Priority ID (must belong to tenant)

**Auto-assigned**:
- `status_id`: Automatically set to "Novo" (New)
- `user_id`: Authenticated user ID
- `tenant_id`: User's organization ID

#### Response: Success (200 OK)

```json
{
  "success": true,
  "ticket": {
    "id": 124,
    "title": "Problema com email",
    "description": "Não consigo enviar emails desde hoje de manhã",
    "created_at": "2025-01-20T11:00:00Z",
    "updated_at": "2025-01-20T11:00:00Z",
    "status": "Novo",
    "priority": "Medium",
    "category": "Email",
    "user_name": "João Silva"
  }
}
```

#### Response: Validation Error (400 Bad Request)

```json
{
  "error": "Todos os campos são obrigatórios"
}
```

```json
{
  "error": "Categoria ou prioridade inválida"
}
```

#### Example with JavaScript

```javascript
const response = await fetch('/api/tickets', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    title: 'Problema com email',
    description: 'Não consigo enviar emails desde hoje de manhã',
    category_id: 1,
    priority_id: 2
  })
});

const data = await response.json();
console.log('Created ticket:', data.ticket.id);
```

---

### POST /api/tickets/create

Create a new ticket with full workflow processing (recommended).

**Authentication**: Required

**Rate Limit**: 100 requests per 15 minutes

**Features**:
- Auto-assignment based on ticket type and category
- Approval workflow creation (if required)
- SLA policy application
- Priority calculation from impact and urgency
- Real-time notifications

#### Request

```http
POST /api/tickets/create
Content-Type: application/json
Cookie: auth_token=...

{
  "title": "Impressora não imprime",
  "description": "A impressora HP do 3º andar não está imprimindo. Já tentei reiniciar mas sem sucesso.",
  "ticket_type_id": 1,
  "category_id": 3,
  "priority_id": 2,
  "impact": 3,
  "urgency": 3,
  "affected_users_count": 5,
  "business_service": "Impressão",
  "location": "Prédio B - 3º andar",
  "source": "web"
}
```

**Body Parameters**:
- `title` (required, string, 5-200 chars): Ticket title
- `description` (required, string, min 10 chars): Detailed description
- `ticket_type_id` (required, integer): 1=Incident, 2=Request, 3=Change, 4=Problem
- `category_id` (required, integer): Category ID
- `priority_id` (required, integer): Priority ID
- `impact` (optional, integer, 1-5, default: 3): Business impact level
- `urgency` (optional, integer, 1-5, default: 3): Time urgency level
- `affected_users_count` (optional, integer, default: 1): Number of affected users
- `business_service` (optional, string): Related business service
- `location` (optional, string): Physical location
- `source` (optional, string): web|email|phone|whatsapp|mobile (default: web)

**ITIL Fields Explained**:
- **Impact**: How many users/services are affected (1=Individual, 5=Enterprise-wide)
- **Urgency**: How quickly resolution is needed (1=Can wait, 5=Critical/immediate)
- **Priority**: Auto-calculated from Impact × Urgency (or manually set)

#### Response: Success (200 OK)

```json
{
  "ticket": {
    "id": 125,
    "title": "Impressora não imprime",
    "description": "A impressora HP do 3º andar não está imprimindo...",
    "ticket_type_id": 1,
    "ticket_type_name": "Incident",
    "workflow_type": "incident",
    "user_id": 5,
    "user_name": "João Silva",
    "category_id": 3,
    "category_name": "Hardware",
    "priority_id": 2,
    "priority_name": "High",
    "priority_level": 2,
    "status_id": 1,
    "status_name": "Novo",
    "status_color": "#3B82F6",
    "assigned_to": 10,
    "assignee_name": "Carlos Técnico",
    "assigned_team_id": 3,
    "team_name": "Suporte Técnico",
    "impact": 3,
    "urgency": 3,
    "affected_users_count": 5,
    "business_service": "Impressão",
    "location": "Prédio B - 3º andar",
    "source": "web",
    "created_at": "2025-01-20T11:15:00Z",
    "updated_at": "2025-01-20T11:15:00Z"
  },
  "workflow_result": {
    "message": "Ticket auto-assigned to Suporte Técnico team",
    "approval_required": false,
    "assigned_team": "auto-assigned"
  },
  "message": "Incident created successfully"
}
```

#### Response: Validation Error (404 Not Found)

```json
{
  "error": "Ticket type not found or not active"
}
```

```json
{
  "error": "Category not found or not active"
}
```

#### Example with JavaScript

```javascript
const response = await fetch('/api/tickets/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    title: 'Impressora não imprime',
    description: 'A impressora HP do 3º andar não está imprimindo. Já tentei reiniciar mas sem sucesso.',
    ticket_type_id: 1, // Incident
    category_id: 3,    // Hardware
    priority_id: 2,    // High
    impact: 3,
    urgency: 3,
    affected_users_count: 5,
    business_service: 'Impressão',
    location: 'Prédio B - 3º andar'
  })
});

const data = await response.json();
console.log('Created ticket with workflow:', data.ticket.id);
console.log('Auto-assigned to:', data.ticket.assignee_name);
```

---

### GET /api/tickets/{id}

Retrieve a single ticket with all related information.

**Authentication**: Required

**Access Control**:
- Admins/Agents: Can view any ticket in their organization
- Regular users: Can only view their own tickets

#### Request

```http
GET /api/tickets/123
Cookie: auth_token=...
```

**Path Parameters**:
- `id` (required, integer): Ticket ID

#### Response: Success (200 OK)

```json
{
  "success": true,
  "ticket": {
    "id": 123,
    "title": "Computador não liga",
    "description": "O computador da sala 203 não está ligando após queda de energia",
    "created_at": "2025-01-20T09:15:00Z",
    "updated_at": "2025-01-20T10:30:00Z",
    "status": "Novo",
    "status_id": 1,
    "status_color": "#3B82F6",
    "priority": "High",
    "priority_id": 2,
    "category": "Hardware",
    "category_id": 3,
    "user_name": "Maria Santos"
  }
}
```

#### Response: Not Found (404 Not Found)

```json
{
  "error": "Ticket não encontrado"
}
```

**Note**: Returns 404 if:
- Ticket doesn't exist
- Ticket exists but user has no permission to view it
- Ticket belongs to a different organization

#### Example with JavaScript

```javascript
const ticketId = 123;
const response = await fetch(`/api/tickets/${ticketId}`, {
  credentials: 'include'
});

if (response.ok) {
  const data = await response.json();
  console.log('Ticket:', data.ticket);
} else if (response.status === 404) {
  console.log('Ticket not found or no permission');
}
```

---

### PATCH /api/tickets/{id}

Update ticket fields (status, priority, category, title, description).

**Authentication**: Required

**Access Control**:
- Admins/Agents: Can update any ticket in their organization
- Regular users: Can only update their own tickets

#### Request

```http
PATCH /api/tickets/123
Content-Type: application/json
Cookie: auth_token=...

{
  "status_id": 2,
  "priority_id": 3,
  "title": "Computador não liga - Resolvido"
}
```

**Body Parameters** (all optional, send only fields to update):
- `status_id` (integer): New status ID (must belong to tenant)
- `priority_id` (integer): New priority ID (must belong to tenant)
- `category_id` (integer): New category ID (must belong to tenant)
- `title` (string): Updated title
- `description` (string): Updated description

**Validation**:
- All referenced IDs must exist and belong to the same tenant
- At least one field must be provided

#### Response: Success (200 OK)

```json
{
  "success": true,
  "ticket": {
    "id": 123,
    "title": "Computador não liga - Resolvido",
    "description": "O computador da sala 203 não está ligando após queda de energia",
    "created_at": "2025-01-20T09:15:00Z",
    "updated_at": "2025-01-20T11:30:00Z",
    "status": "Em Progresso",
    "status_id": 2,
    "status_color": "#F59E0B",
    "priority": "Medium",
    "priority_id": 3,
    "category": "Hardware",
    "category_id": 3,
    "user_name": "Maria Santos"
  }
}
```

#### Response: Validation Error (400 Bad Request)

```json
{
  "error": "Status inválido"
}
```

```json
{
  "error": "Nenhum campo para atualizar"
}
```

#### Response: Not Found (404 Not Found)

```json
{
  "error": "Ticket não encontrado ou sem permissão"
}
```

#### Example with JavaScript

```javascript
const response = await fetch('/api/tickets/123', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    status_id: 2,
    priority_id: 3
  })
});

const data = await response.json();
console.log('Updated ticket:', data.ticket.title);
```

---

## Admin Endpoints

Admin-specific ticket management endpoints require `admin` or `agent` role and use Bearer token authentication.

### GET /api/admin/tickets/{id}

Get ticket with admin privileges (Bearer token required).

**Authentication**: Bearer token (not cookie)

**Required Roles**: admin, agent

#### Request

```http
GET /api/admin/tickets/123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response: Success (200 OK)

```json
{
  "ticket": {
    "id": 123,
    "title": "Computador não liga",
    ...
  }
}
```

#### Response: Unauthorized (401)

```json
{
  "error": "Token de acesso requerido"
}
```

#### Response: Forbidden (403)

```json
{
  "error": "Acesso negado"
}
```

---

### PUT /api/admin/tickets/{id}

Update ticket with admin privileges (supports assignment changes).

**Authentication**: Bearer token

**Required Roles**: admin, agent

#### Request

```http
PUT /api/admin/tickets/123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "title": "Computador não liga - Alta prioridade",
  "status_id": 2,
  "assigned_to": 10
}
```

**Body Parameters**:
- `title` (string): Updated title
- `description` (string): Updated description
- `category_id` (integer): Category ID
- `priority_id` (integer): Priority ID
- `status_id` (integer): Status ID
- `assigned_to` (integer|null): Agent ID to assign (or null to unassign)

#### Response: Success (200 OK)

```json
{
  "ticket": {
    "id": 123,
    "title": "Computador não liga - Alta prioridade",
    "assigned_to": 10,
    ...
  }
}
```

---

### DELETE /api/admin/tickets/{id}

Permanently delete a ticket (admin only).

**Authentication**: Bearer token

**Required Roles**: admin (super_admin, tenant_admin)

**Warning**: This action cannot be undone.

#### Request

```http
DELETE /api/admin/tickets/123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response: Success (200 OK)

```json
{
  "message": "Ticket deletado com sucesso"
}
```

#### Response: Forbidden (403)

```json
{
  "error": "Acesso negado"
}
```

Only users with `admin` role can delete tickets. Agents cannot delete.

---

## Ticket Workflow

### Lifecycle States

```
┌─────────┐
│  Novo   │ ──┐
└─────────┘   │
              ▼
        ┌──────────────┐
        │ Em Progresso │
        └──────────────┘
              │
              ▼
        ┌──────────┐
        │Resolvido │
        └──────────┘
              │
              ▼
        ┌──────────┐
        │ Fechado  │
        └──────────┘
```

### Auto-Assignment Rules

When using `/api/tickets/create`, the system automatically:

1. **Checks ticket type workflow** (incident, request, change, problem)
2. **Finds matching team** based on category and ticket type
3. **Assigns to team** if auto-assignment rules exist
4. **Creates approval workflow** if required for ticket type
5. **Applies SLA policy** matching ticket type and priority
6. **Sends notifications** to assigned team/agent

### Approval Workflows

For change requests and specific ticket types:

1. Ticket created with `approval_required: true`
2. Approval requests created in `approval_requests` table
3. Approvers notified via email/notification
4. Each approval step must be completed sequentially
5. After all approvals, ticket proceeds to assigned team

---

## Best Practices

### Creating Tickets

1. **Use /api/tickets/create** for production (includes workflow)
2. **Provide detailed descriptions** (minimum 10 characters)
3. **Set appropriate impact and urgency** for accurate priority
4. **Include location and business service** for better tracking
5. **Use correct ticket_type_id** for ITIL compliance

### Updating Tickets

1. **Only send changed fields** in PATCH requests
2. **Validate IDs** before sending (use GET /api/categories, etc.)
3. **Handle 404 errors** gracefully (ticket may not exist or no permission)
4. **Use admin endpoints** only when necessary (require stronger auth)

### Pagination

1. **Use limit parameter** to control page size (10-50 recommended)
2. **Cache results** when appropriate
3. **Implement infinite scroll** for better UX
4. **Show total count** from pagination.total

### Error Handling

```javascript
async function createTicket(ticketData) {
  try {
    const response = await fetch('/api/tickets/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(ticketData)
    });

    if (!response.ok) {
      const error = await response.json();

      if (response.status === 401) {
        // Redirect to login
        window.location.href = '/login';
      } else if (response.status === 404) {
        // Invalid category/priority/ticket type
        throw new Error(error.error || 'Invalid data');
      } else if (response.status === 429) {
        // Rate limited
        throw new Error('Too many requests. Please wait.');
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to create ticket:', error);
    throw error;
  }
}
```

---

## Field Reference

### Standard Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| id | integer | Unique ticket identifier | 123 |
| title | string | Short description | "Impressora não imprime" |
| description | string | Detailed problem description | "A impressora HP do 3º andar..." |
| user_id | integer | Creator user ID | 5 |
| assigned_to | integer/null | Assigned agent ID | 10 |
| category_id | integer | Category identifier | 3 |
| priority_id | integer | Priority identifier | 2 |
| status_id | integer | Status identifier | 1 |
| created_at | datetime | Creation timestamp | "2025-01-20T09:15:00Z" |
| updated_at | datetime | Last update timestamp | "2025-01-20T10:30:00Z" |

### ITIL Extended Fields

| Field | Type | Description | Range |
|-------|------|-------------|-------|
| ticket_type_id | integer | 1=Incident, 2=Request, 3=Change, 4=Problem | 1-4 |
| impact | integer | Business impact level | 1-5 |
| urgency | integer | Time urgency level | 1-5 |
| affected_users_count | integer | Number of affected users | 1+ |
| business_service | string | Related service | "Email Corporativo" |
| location | string | Physical location | "Prédio A - Sala 203" |
| source | string | Ticket origin | web, email, phone, whatsapp, mobile |
| assigned_team_id | integer/null | Assigned team ID | 3 |

### Read-Only Fields (Returned in Responses)

| Field | Description |
|-------|-------------|
| user_name | Creator's name |
| assignee_name | Assigned agent's name |
| team_name | Assigned team's name |
| category_name | Category name |
| priority_name | Priority name (Low, Medium, High, Critical) |
| priority_level | Priority level (1-4) |
| status_name | Status name |
| status_color | Status color hex code |
| ticket_type_name | Ticket type name |
| workflow_type | Workflow type (incident, request, change, problem) |
