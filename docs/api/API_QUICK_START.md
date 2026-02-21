# ServiceDesk API - Quick Start Guide

## Getting Started in 5 Minutes

This guide will help you start using the ServiceDesk API in just a few minutes.

## Prerequisites

- ServiceDesk application running locally or on a server
- API client (cURL, Postman, or JavaScript)
- Valid user credentials

## Step 1: Access Interactive Documentation

The easiest way to explore the API is through the interactive Swagger UI:

```
http://localhost:3000/api/docs
```

This provides:
- 📚 Complete API reference
- 🧪 Try-it-out functionality
- 📝 Request/response examples
- 💾 Download OpenAPI specification

## Step 2: Authenticate

### Using Swagger UI

1. Go to `http://localhost:3000/api/docs`
2. Find the **POST /auth/login** endpoint under "Authentication"
3. Click "Try it out"
4. Fill in the request body:
   ```json
   {
     "email": "admin@acme.com",
     "password": "Admin@123",
     "tenant_slug": "acme-corp"
   }
   ```
5. Click "Execute"
6. Copy the token from the response
7. Click the "Authorize" button at the top
8. Paste the token in the "bearerAuth" field
9. Click "Authorize"

Now all your requests will include authentication!

### Using cURL

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "Admin@123",
    "tenant_slug": "acme-corp"
  }' \
  -c cookies.txt
```

The authentication cookie is saved to `cookies.txt`.

### Using JavaScript

```javascript
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'admin@acme.com',
    password: 'Admin@123',
    tenant_slug: 'acme-corp'
  })
});

const data = await response.json();
console.log('Logged in as:', data.user.name);
```

## Step 3: Create Your First Ticket

### Using Swagger UI

1. Find **POST /tickets** endpoint
2. Click "Try it out"
3. Fill in the request body:
   ```json
   {
     "title": "Test ticket from API",
     "description": "This is my first ticket via the API!",
     "category_id": 1,
     "priority_id": 2
   }
   ```
4. Click "Execute"
5. See the created ticket in the response!

### Using cURL

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Test ticket from API",
    "description": "This is my first ticket via the API!",
    "category_id": 1,
    "priority_id": 2
  }'
```

### Using JavaScript

```javascript
const response = await fetch('http://localhost:3000/api/tickets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    title: 'Test ticket from API',
    description: 'This is my first ticket via the API!',
    category_id: 1,
    priority_id: 2
  })
});

const ticket = await response.json();
console.log('Created ticket #', ticket.ticket.id);
```

## Step 4: List Tickets

### Using Swagger UI

1. Find **GET /tickets** endpoint
2. Click "Try it out"
3. Optionally adjust pagination (page, limit)
4. Click "Execute"
5. View all tickets in the response!

### Using cURL

```bash
curl -X GET "http://localhost:3000/api/tickets?page=1&limit=10" \
  -b cookies.txt
```

### Using JavaScript

```javascript
const response = await fetch('http://localhost:3000/api/tickets?page=1&limit=10', {
  credentials: 'include'
});

const data = await response.json();
console.log(`Found ${data.pagination.total} tickets`);
data.tickets.forEach(ticket => {
  console.log(`#${ticket.id}: ${ticket.title}`);
});
```

## Step 5: Add a Comment

### Using Swagger UI

1. Find **POST /tickets/{id}/comments** endpoint
2. Click "Try it out"
3. Enter a ticket ID in the path parameter
4. Fill in the request body:
   ```json
   {
     "content": "This is my first comment via the API!",
     "is_internal": false
   }
   ```
5. Click "Execute"

### Using cURL

```bash
curl -X POST "http://localhost:3000/api/tickets/1/comments" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "content": "This is my first comment via the API!",
    "is_internal": false
  }'
```

## Using Postman

### Import the Collection

1. Download `postman-collection.json` from the repository
2. Open Postman
3. Click **Import** > **Upload Files**
4. Select `postman-collection.json`
5. The collection is now available in your sidebar!

### Alternative: Import via URL

1. Open Postman
2. Click **Import** > **Link**
3. Enter: `http://localhost:3000/api/docs/openapi.yaml`
4. Click **Import**

### Set Up Environment

1. Create a new environment in Postman
2. Add these variables:
   - `baseUrl`: `http://localhost:3000/api`
   - `tenant_slug`: `acme-corp`
3. Select this environment

### Start Testing

1. Open the "Authentication" folder
2. Run "Login" request
3. The auth token is automatically saved
4. All subsequent requests will use this token!

## Common Tasks

### Get Current User Profile

```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -b cookies.txt
```

### Search Tickets

```bash
curl -X GET "http://localhost:3000/api/tickets?search=password&priority_id=3" \
  -b cookies.txt
```

### Update Ticket Status

```bash
curl -X PUT http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status_id": 2,
    "assigned_to": 3
  }'
```

### Get Analytics (Admin only)

```bash
curl -X GET "http://localhost:3000/api/analytics?period=30d&type=overview" \
  -b cookies.txt
```

### Create Knowledge Article (Admin only)

```bash
curl -X POST http://localhost:3000/api/knowledge \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "How to Reset Password",
    "content": "Step-by-step guide...",
    "category": "Getting Started",
    "status": "published"
  }'
```

## Reference Data

Before creating tickets, you might want to get the available categories, priorities, and statuses:

```bash
# Get categories
curl -X GET http://localhost:3000/api/categories -b cookies.txt

# Get priorities
curl -X GET http://localhost:3000/api/priorities -b cookies.txt

# Get statuses
curl -X GET http://localhost:3000/api/statuses -b cookies.txt
```

## Testing Authentication

### Verify Token

```bash
curl -X GET http://localhost:3000/api/auth/verify \
  -b cookies.txt
```

### Using Bearer Token (instead of cookies)

If you prefer Bearer tokens over cookies:

```bash
# Login and extract token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"Admin@123","tenant_slug":"acme-corp"}' \
  | jq -r '.token')

# Use token in subsequent requests
curl -X GET http://localhost:3000/api/tickets \
  -H "Authorization: Bearer $TOKEN"
```

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `401`: Not authenticated (login required)
- `403`: Insufficient permissions
- `404`: Resource not found
- `429`: Rate limit exceeded
- `500`: Server error

## Rate Limiting

If you see this response:

```json
{
  "success": false,
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

Wait for the time specified in the `X-RateLimit-Reset` header before retrying.

## Multi-Tenant Support

### Using Subdomain (Production)

```bash
curl -X POST https://acme-corp.servicedesk.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@acme.com","password":"SecureP@ss123"}'
```

### Using Headers (Development)

```bash
curl -X GET http://localhost:3000/api/tickets \
  -H "x-tenant-slug: acme-corp" \
  -b cookies.txt
```

## Next Steps

Now that you've mastered the basics:

1. 📖 Read the full [API Documentation](API_DOCUMENTATION.md)
2. 🔍 Explore all endpoints in [Swagger UI](http://localhost:3000/api/docs)
3. 💻 Download the [OpenAPI Spec](http://localhost:3000/api/docs/openapi.yaml)
4. 📮 Import the [Postman Collection](postman-collection.json)
5. 🤖 Try AI-powered endpoints (`/api/ai/*`)
6. 🔔 Set up real-time notifications (`/api/notifications/sse`)
7. ⚙️ Configure webhooks for your application

## Need Help?

- 📚 Full documentation: `/API_DOCUMENTATION.md`
- 🌐 Interactive docs: `http://localhost:3000/api/docs`
- 💬 Support: support@servicedesk.com
- 🐛 Issues: [GitHub Issues]

## Example: Complete Ticket Workflow

Here's a complete example of creating and managing a ticket:

```javascript
// 1. Login
const loginRes = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecureP@ss123',
    tenant_slug: 'acme-corp'
  })
});
const { user } = await loginRes.json();
console.log('Logged in as:', user.name);

// 2. Get reference data
const categoriesRes = await fetch('/api/categories', {
  credentials: 'include'
});
const { categories } = await categoriesRes.json();
const techSupportCategory = categories.find(c => c.name === 'Technical Support');

// 3. Create ticket
const ticketRes = await fetch('/api/tickets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    title: 'Login issue',
    description: 'Cannot login to the system',
    category_id: techSupportCategory.id,
    priority_id: 3
  })
});
const { ticket } = await ticketRes.json();
console.log('Created ticket:', ticket.id);

// 4. Add comment
const commentRes = await fetch(`/api/tickets/${ticket.id}/comments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    content: 'I tried clearing cache but still having issues',
    is_internal: false
  })
});
const { comment } = await commentRes.json();
console.log('Added comment:', comment.id);

// 5. Check ticket status
const statusRes = await fetch(`/api/tickets/${ticket.id}`, {
  credentials: 'include'
});
const { ticket: updatedTicket } = await statusRes.json();
console.log('Ticket status:', updatedTicket.status);
```

Happy coding! 🚀
