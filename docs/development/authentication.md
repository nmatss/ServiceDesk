# Authentication System

ServiceDesk authentication architecture and implementation.

## Overview

Multi-layered authentication system:

- **JWT tokens**: Stateless authentication
- **Refresh tokens**: Long-lived sessions
- **2FA/TOTP**: Two-factor authentication
- **WebAuthn**: Biometric authentication
- **SSO**: OAuth2, SAML, LDAP

## JWT Flow

```
User Login
    ↓
Credentials Verified
    ↓
Generate JWT + Refresh Token
    ↓
Return Tokens
    ↓
Client Stores JWT
    ↓
API Requests with JWT
    ↓
JWT Expired?
    ├─ No → Process Request
    └─ Yes → Use Refresh Token
```

## Implementation

### Login Endpoint

```typescript
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}
```

Response:
```json
{
  "token": "jwt-token",
  "refreshToken": "refresh-token",
  "user": { /* user data */ }
}
```

### Protected Routes

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('token');
  if (!token) return redirect('/login');
  // Verify JWT
}
```

### Password Hashing

```typescript
import bcrypt from 'bcrypt';

// Hash
const hash = await bcrypt.hash(password, 10);

// Verify
const valid = await bcrypt.compare(password, hash);
```

## 2FA Setup

Enable 2FA:

```typescript
POST /api/auth/2fa/enable
```

Verify 2FA:

```typescript
POST /api/auth/2fa/verify
{
  "code": "123456"
}
```

## SSO Integration

### OAuth2 Flow

1. Redirect to OAuth provider
2. User authorizes
3. Callback with authorization code
4. Exchange code for tokens
5. Create/update user account

### Supported Providers

- Google OAuth
- Microsoft Azure AD
- Gov.br (Brazilian Government)
- GitHub

## Security Features

- Password hashing (bcrypt)
- Rate limiting (5 attempts)
- Account lockout (30 minutes)
- Session management
- CSRF protection
- XSS protection

## References

- [lib/auth/sqlite-auth.ts](../../lib/auth/sqlite-auth.ts)
- [middleware.ts](../../middleware.ts)
