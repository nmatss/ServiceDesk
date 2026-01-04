# Authentication API

## Overview

The ServiceDesk authentication system uses JWT (JSON Web Tokens) with httpOnly cookies for secure session management. All authentication endpoints support multi-tenant isolation.

## Security Features

- **Password Security**: bcrypt hashing with salt
- **Account Lockout**: 5 failed attempts = 1 minute lockout
- **Rate Limiting**: 5 login attempts per 15 minutes per IP
- **Token Expiration**: 15-minute access tokens
- **httpOnly Cookies**: Prevents XSS token theft
- **Audit Logging**: All login attempts logged with IP and user agent

## Endpoints

### POST /api/auth/login

Authenticate a user and receive JWT token via httpOnly cookie.

**Rate Limit**: 5 requests per 15 minutes per IP

#### Request

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "password": "SenhaSegura@123",
  "tenant_slug": "empresa-demo"
}
```

**Body Parameters**:
- `email` (required, string): User email address
- `password` (required, string): User password (minimum 12 characters)
- `tenant_slug` (optional, string): Tenant organization slug (required if not using subdomain)

#### Response: Success (200 OK)

```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "user": {
    "id": 1,
    "name": "João Silva",
    "email": "usuario@empresa.com",
    "role": "user",
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

**Cookies Set**:
- `auth_token`: JWT token (httpOnly, secure, 15 minutes)
- `tenant-context`: Tenant information (readable, 24 hours)

**Note**: The JWT token is NEVER returned in the JSON response body. It's only sent via httpOnly cookie for security.

#### Response: Invalid Credentials (401 Unauthorized)

```json
{
  "success": false,
  "error": "Credenciais inválidas",
  "remaining_attempts": 3
}
```

#### Response: Account Locked (423 Locked)

```json
{
  "success": false,
  "error": "Muitas tentativas de login falhadas. Conta bloqueada por 1 minutos.",
  "locked_until": "2025-01-20T10:35:00Z"
}
```

#### Response: Rate Limit Exceeded (429 Too Many Requests)

```json
{
  "success": false,
  "error": "Muitas tentativas de login. Tente novamente mais tarde.",
  "retryAfter": 300
}
```

**Headers**:
- `X-RateLimit-Limit`: 5
- `X-RateLimit-Remaining`: 0
- `X-RateLimit-Reset`: 2025-01-20T10:35:00Z
- `Retry-After`: 300

#### Example with cURL

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "usuario@empresa.com",
    "password": "SenhaSegura@123",
    "tenant_slug": "empresa-demo"
  }'
```

#### Example with JavaScript

```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include', // Important: include cookies
  body: JSON.stringify({
    email: 'usuario@empresa.com',
    password: 'SenhaSegura@123',
    tenant_slug: 'empresa-demo'
  })
});

const data = await response.json();

if (data.success) {
  console.log('Logged in as:', data.user.name);
  // Token is automatically stored in httpOnly cookie
}
```

---

### POST /api/auth/register

Register a new user account within a tenant organization.

**Rate Limit**: 5 requests per hour per IP (strict)

#### Request

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "João Silva",
  "email": "joao.silva@empresa.com",
  "password": "SenhaForte@2025",
  "tenant_slug": "empresa-demo",
  "job_title": "Analista de TI",
  "department": "Tecnologia",
  "phone": "+55 11 98765-4321"
}
```

**Body Parameters**:
- `name` (required, string): Full name (minimum 3 characters)
- `email` (required, string): Valid email address
- `password` (required, string): Strong password (see requirements below)
- `tenant_slug` (optional, string): Tenant organization slug
- `job_title` (optional, string): User's job title
- `department` (optional, string): User's department
- `phone` (optional, string): Contact phone number

**Password Requirements**:
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*()_+-=[]{};':"\\|,.<>/?)

#### Response: Success (200 OK)

```json
{
  "success": true,
  "message": "Usuário criado com sucesso",
  "user": {
    "id": 5,
    "name": "João Silva",
    "email": "joao.silva@empresa.com",
    "role": "user",
    "tenant_id": 1,
    "job_title": "Analista de TI",
    "department": "Tecnologia",
    "phone": "+55 11 98765-4321",
    "created_at": "2025-01-20T11:00:00Z"
  },
  "tenant": {
    "id": 1,
    "slug": "empresa-demo",
    "name": "Empresa Demo"
  }
}
```

**Cookies Set**: Same as login (user is automatically logged in)

#### Response: Validation Error (400 Bad Request)

```json
{
  "success": false,
  "error": "A senha deve ter pelo menos 12 caracteres"
}
```

**Possible Validation Errors**:
- "Nome, email e senha são obrigatórios"
- "A senha deve ter pelo menos 12 caracteres"
- "A senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial"
- "Email inválido"
- "Tenant não encontrado"

#### Response: Email Already Exists (409 Conflict)

```json
{
  "success": false,
  "error": "Este email já está em uso nesta organização"
}
```

#### Response: User Limit Reached (403 Forbidden)

```json
{
  "success": false,
  "error": "Limite de usuários atingido para esta organização"
}
```

#### Example with cURL

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "name": "João Silva",
    "email": "joao.silva@empresa.com",
    "password": "SenhaForte@2025",
    "tenant_slug": "empresa-demo"
  }'
```

---

### GET /api/auth/verify

Verify the validity of a JWT token and return user information.

**Rate Limit**: 100 requests per 15 minutes (uses API rate limit, not auth)

#### Request

Token can be provided via:
1. httpOnly cookie `auth_token` (automatic)
2. Authorization header: `Bearer <token>`

```http
GET /api/auth/verify
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Or with cookie:

```http
GET /api/auth/verify
Cookie: auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response: Valid Token (200 OK)

```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "João Silva",
    "email": "joao.silva@empresa.com",
    "role": "user"
  }
}
```

#### Response: Missing Token (401 Unauthorized)

```json
{
  "success": false,
  "error": "Token não fornecido",
  "code": "NO_TOKEN"
}
```

#### Response: Invalid/Expired Token (401 Unauthorized)

```json
{
  "success": false,
  "error": "Token inválido ou expirado",
  "code": "INVALID_TOKEN"
}
```

#### Example with JavaScript

```javascript
// Automatically uses cookie
const response = await fetch('/api/auth/verify', {
  credentials: 'include'
});

const data = await response.json();

if (data.success) {
  console.log('Authenticated user:', data.user);
} else {
  console.log('Not authenticated:', data.code);
  // Redirect to login
}
```

---

### POST /api/auth/verify

Alternative POST endpoint for token verification (accepts token in body).

#### Request

```http
POST /api/auth/verify
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Body Parameters**:
- `token` (required, string): JWT token to verify

#### Response

Same as GET /api/auth/verify

---

## Authentication Flow

### Web Application Flow

```
1. User submits login form
   ├─> POST /api/auth/login
   │   └─> Credentials validated
   │       ├─> Success: Set httpOnly cookie with JWT
   │       └─> Failure: Return error (401/423/429)
   │
2. Browser stores cookie automatically
   │
3. Subsequent requests include cookie
   ├─> Cookie sent automatically by browser
   └─> Middleware validates JWT from cookie
       ├─> Valid: Allow request
       └─> Expired: Return 401 (client should re-login)
```

### API Client Flow

```
1. POST /api/auth/login
   └─> Store token from response (not in httpOnly cookie for API clients)

2. Include token in Authorization header
   └─> Authorization: Bearer <token>

3. Token expires after 15 minutes
   └─> Re-authenticate with /api/auth/login
```

## Security Best Practices

### For Web Applications

1. **Always use credentials: 'include'** in fetch requests
2. **Never store JWT in localStorage** (XSS vulnerability)
3. **Let httpOnly cookie handle token storage**
4. **Implement CSRF protection** for state-changing operations
5. **Use HTTPS in production** (secure cookie flag)

### For API Clients

1. **Store tokens securely** (encrypted storage, environment variables)
2. **Implement token refresh logic** (re-authenticate before expiry)
3. **Use HTTPS for all requests**
4. **Handle rate limits gracefully** (exponential backoff)
5. **Never log tokens** in application logs

### Password Guidelines for Users

1. Minimum 12 characters
2. Mix of uppercase, lowercase, numbers, special characters
3. Avoid common passwords (dictionary words, sequences)
4. Use unique passwords for each service
5. Consider using a password manager

## Multi-Tenant Considerations

### Tenant Resolution

The system resolves tenant context in this order:
1. Subdomain (e.g., empresa-demo.servicedesk.com)
2. `tenant_slug` in request body (login/register)
3. `tenant-context` cookie (after login)
4. Default organization (development only)

### Tenant Isolation

- Users can only authenticate within their assigned organization
- Organization ID is embedded in JWT payload
- All queries filter by organization_id/tenant_id
- Cross-tenant access is strictly prevented

## Error Codes Reference

| Code | HTTP Status | Description | Action |
|------|-------------|-------------|--------|
| `NO_TOKEN` | 401 | Token not provided | Redirect to login |
| `INVALID_TOKEN` | 401 | Token invalid or expired | Redirect to login |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password | Show error, allow retry |
| `ACCOUNT_LOCKED` | 423 | Too many failed attempts | Show lockout message |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Show retry timer |
| `INTERNAL_ERROR` | 500 | Server error | Log error, show generic message |

## Audit Logging

All authentication events are logged in the `audit_logs` table:

**Logged Events**:
- Successful logins (with IP, user agent, timestamp)
- Failed login attempts (with reason, IP, remaining attempts)
- Account lockouts
- User registrations
- Token verifications (simplified logging)

**Logged Information**:
- User ID (if known)
- Email address
- IP address (X-Forwarded-For or X-Real-IP)
- User agent string
- Organization ID
- Timestamp
- Action outcome (success/failure)
- Failure reason (if applicable)

Access audit logs via admin endpoints or database queries.
